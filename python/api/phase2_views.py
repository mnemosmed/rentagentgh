import logging

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.arkesel import SMSError
from accounts.models import PhoneOTP, Role, UserRole
from accounts.phone_utils import is_valid_ghana_phone, normalize_phone
from accounts.services import send_otp_sms
from agents.models import Agent, AgentRating
from messaging.forms import validate_chat_media
from messaging.models import Conversation, Message
from messaging.notifications import notify_agent_new_inquiry
from messaging.services import (
    build_agent_conversations,
    build_renter_conversations,
    mark_conversation_read,
    total_unread_for_user,
)
from payments.services import can_renter_message, has_contact_access

from .serializers import (
    AgentMeUpdateSerializer,
    ClaimStartSerializer,
    ClaimVerifySerializer,
    ContactAgentSerializer,
    CreateConversationSerializer,
    RatingSerializer,
    serialize_agent,
    serialize_message,
    serialize_rating,
    serialize_thread_item,
    serialize_user,
)

logger = logging.getLogger(__name__)

CLAIM_CACHE_TTL = 60 * 15


def _tokens_for_user(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": serialize_user(user),
    }


def _detect_media_type(media) -> str:
    content_type = getattr(media, "content_type", "") or ""
    if content_type.startswith("image/"):
        return Message.MEDIA_IMAGE
    if content_type.startswith("video/"):
        return Message.MEDIA_VIDEO
    name = (getattr(media, "name", "") or "").lower()
    if name.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic")):
        return Message.MEDIA_IMAGE
    if name.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return Message.MEDIA_VIDEO
    return Message.MEDIA_FILE


def _user_can_access_conversation(user, conversation: Conversation) -> bool:
    if conversation.user_id == user.id:
        return True
    return Agent.objects.filter(claimed_by=user, pk=conversation.agent_id).exists()


def _claimed_agent(user):
    return Agent.objects.filter(claimed_by=user).first()


def _conversation_mode(user) -> str:
    return "agent" if _claimed_agent(user) else "renter"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_count_view(request):
    return Response({"unread_count": total_unread_for_user(request.user)})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversations_view(request):
    if request.method == "GET":
        agent = _claimed_agent(request.user)
        if agent:
            items = build_agent_conversations(agent, request.user)
            mode = "agent"
        else:
            items = build_renter_conversations(request.user)
            mode = "renter"
        return Response(
            {
                "mode": mode,
                "conversations": [serialize_thread_item(i, mode=mode) for i in items],
            }
        )

    serializer = CreateConversationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not can_renter_message(request.user):
        return Response(
            {"detail": "Get weekly or monthly access to message agents."},
            status=403,
        )
    agent = get_object_or_404(Agent, pk=serializer.validated_data["agent_id"])
    conversation, created = Conversation.objects.get_or_create(
        user=request.user, agent=agent
    )
    return Response(
        {
            "id": str(conversation.id),
            "created": created,
            "agent_id": str(agent.id),
        },
        status=201 if created else 200,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def conversation_detail_view(request, conversation_id):
    conversation = get_object_or_404(
        Conversation.objects.select_related("agent", "user"),
        pk=conversation_id,
    )
    if not _user_can_access_conversation(request.user, conversation):
        return Response({"detail": "Not found."}, status=404)

    mark_conversation_read(conversation, request.user)
    messages = conversation.messages.select_related("sender").order_by("created_at")
    is_renter = conversation.user_id == request.user.id
    can_send = True
    if is_renter:
        can_send = can_renter_message(request.user)

    if is_renter:
        peer_name = conversation.agent.display_name
        peer_subtitle = conversation.agent.primary_area
        peer_profile_url = f"/agents/{conversation.agent_id}"
        mode = "renter"
    else:
        renter = conversation.user
        peer_name = renter.profile.display_name or renter.get_username()
        peer_subtitle = "Renter"
        peer_profile_url = ""
        mode = "agent"

    return Response(
        {
            "id": str(conversation.id),
            "mode": mode,
            "peer_name": peer_name,
            "peer_subtitle": peer_subtitle,
            "peer_profile_url": peer_profile_url,
            "agent_id": str(conversation.agent_id),
            "can_send": can_send,
            "messages": [serialize_message(m, request) for m in messages],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def send_message_view(request, conversation_id):
    conversation = get_object_or_404(Conversation, pk=conversation_id)
    if not _user_can_access_conversation(request.user, conversation):
        return Response({"detail": "Not found."}, status=404)

    is_renter = conversation.user_id == request.user.id
    if is_renter and not can_renter_message(request.user):
        return Response(
            {
                "detail": "Your access has expired. Renew to keep messaging agents.",
            },
            status=403,
        )

    content = (request.data.get("content") or "").strip()
    media = request.FILES.get("media_file")
    if media:
        try:
            validate_chat_media(media)
        except ValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=400)

    if not content and not media:
        return Response({"detail": "Add a message or attach a photo/video."}, status=400)

    if content and len(content) > 5000:
        return Response({"detail": "Message is too long."}, status=400)

    media_type = _detect_media_type(media) if media else ""
    message = Message.objects.create(
        conversation=conversation,
        sender=request.user,
        content=content,
        media_file=media,
        media_type=media_type,
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    if is_renter:
        notify_agent_new_inquiry(conversation, request.user)

    return Response(serialize_message(message, request), status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def contact_agent_view(request, agent_id):
    agent = get_object_or_404(Agent, pk=agent_id)
    if not has_contact_access(request.user, agent):
        return Response(
            {"detail": "Get weekly or monthly access to contact agents."},
            status=403,
        )

    serializer = ContactAgentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    conversation, _ = Conversation.objects.get_or_create(user=request.user, agent=agent)
    lines = [
        "New rental request:",
        f"Property type: {data['property_type']}",
        f"Location: {data['location']}",
    ]
    if data.get("budget_min") or data.get("budget_max"):
        lines.append(
            f"Budget: GHS {data.get('budget_min') or '?'} – {data.get('budget_max') or '?'}"
        )
    lines.append(f"Move-in: {data['move_in']}")
    if data.get("preferences"):
        lines.append(f"Notes: {data['preferences']}")

    Message.objects.create(
        conversation=conversation,
        sender=request.user,
        content="\n".join(lines),
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    notify_agent_new_inquiry(conversation, request.user)

    return Response(
        {
            "conversation_id": str(conversation.id),
            "detail": f"Message sent to {agent.display_name}.",
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rate_agent_view(request, agent_id):
    agent = get_object_or_404(Agent, pk=agent_id)
    serializer = RatingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    rating, _ = AgentRating.objects.update_or_create(
        agent=agent,
        user=request.user,
        defaults=serializer.validated_data,
    )
    return Response(serialize_rating(rating))


@api_view(["POST"])
@permission_classes([AllowAny])
def claim_start_view(request):
    serializer = ClaimStartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    name = serializer.validated_data["display_name"].strip()
    area = (serializer.validated_data.get("primary_area") or "").strip()
    phone = normalize_phone(serializer.validated_data["phone"])

    if not is_valid_ghana_phone(phone):
        return Response({"detail": "Enter a valid Ghana phone number."}, status=400)

    qs = Agent.objects.filter(display_name__iexact=name)
    if area:
        qs = qs.filter(primary_area__iexact=area)
    agent = qs.first()
    if not agent:
        return Response({"detail": "No agent profile found with that name."}, status=404)
    if agent.claimed_by_id:
        return Response({"detail": "This profile has already been claimed."}, status=400)

    otp = PhoneOTP.create_for_phone(phone)
    try:
        send_otp_sms(phone, otp.otp_code)
    except SMSError:
        logger.exception("Claim OTP SMS failed for %s", phone)
        return Response({"detail": "Could not send SMS. Try again."}, status=502)

    cache_key = f"agent_claim:{phone}:{agent.id}"
    cache.set(cache_key, str(agent.id), CLAIM_CACHE_TTL)

    return Response(
        {
            "detail": "Verification code sent.",
            "agent_id": str(agent.id),
            "phone": phone,
            "display_name": agent.display_name,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def claim_verify_view(request):
    serializer = ClaimVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = normalize_phone(serializer.validated_data["phone"])
    agent_id = str(serializer.validated_data["agent_id"])
    otp_code = serializer.validated_data["otp"]

    agent = get_object_or_404(Agent, pk=agent_id)
    if agent.claimed_by_id:
        return Response({"detail": "This profile has already been claimed."}, status=400)

    record = (
        PhoneOTP.objects.filter(phone=phone, verified=False)
        .order_by("-created_at")
        .first()
    )
    if not record or not record.is_valid(otp_code):
        return Response({"detail": "Invalid or expired code."}, status=400)

    record.verified = True
    record.save(update_fields=["verified"])

    if request.user.is_authenticated:
        user = request.user
    else:
        user, created = User.objects.get_or_create(
            username=phone,
            defaults={"first_name": agent.display_name},
        )
        if created:
            user.set_unusable_password()
            user.save()

    agent.claimed_by = user
    agent.phone = phone
    agent.is_verified = True
    agent.save(update_fields=["claimed_by", "phone", "is_verified", "updated_at"])
    Role.objects.get_or_create(user=user, role=UserRole.AGENT)

    user.profile.phone = phone
    if not user.profile.display_name:
        user.profile.display_name = agent.display_name
    user.profile.save()

    cache.delete(f"agent_claim:{phone}:{agent_id}")
    tokens = _tokens_for_user(user)
    return Response(
        {
            "detail": "Profile claimed successfully.",
            "agent": serialize_agent(agent, None, include_contacts=True),
            **tokens,
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def agent_me_view(request):
    agent = _claimed_agent(request.user)
    if not agent:
        return Response({"detail": "No claimed agent profile."}, status=404)

    if request.method == "GET":
        data = serialize_agent(agent, request, include_contacts=True)
        data["covered_areas"] = agent.covered_areas
        return Response(data)

    serializer = AgentMeUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    for field in ("display_name", "short_bio", "phone", "whatsapp", "primary_area"):
        if field in data:
            setattr(agent, field, data[field])
    if "covered_areas" in data:
        agent.covered_areas = data["covered_areas"]
    agent.save()
    return Response(serialize_agent(agent, request, include_contacts=True))
