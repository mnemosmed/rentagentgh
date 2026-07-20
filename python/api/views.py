import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.arkesel import SMSError
from accounts.models import PhoneOTP, Role, UserRole
from accounts.phone_utils import is_valid_ghana_phone, normalize_phone
from accounts.services import send_otp_sms
from agents.areas import get_all_areas
from agents.dedupe import unique_agents_by_name
from agents.models import Agent
from messaging.models import Conversation
from payments.models import AccessPass
from payments.paystack import PaystackError, initialize_transaction, verify_transaction
from payments.services import (
    VALID_PLANS,
    get_or_create_pending_pass,
    plan_fee_pesewas,
)

from .serializers import (
    PhoneSendSerializer,
    PhoneVerifySerializer,
    UnlockSerializer,
    serialize_agent,
    serialize_plans,
    serialize_rating,
    serialize_user,
)

logger = logging.getLogger(__name__)


def _tokens_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": serialize_user(user),
    }


def _ensure_renter_role(user: User) -> None:
    Role.objects.get_or_create(user=user, role=UserRole.RENTER)


def _sorted_agents(queryset):
    agents = list(queryset)
    agents.sort(
        key=lambda a: (
            -(a.rating_stats["overall_rating"] or -1),
            -(a.rating_stats["total_ratings"] or 0),
            a.display_name.lower(),
        )
    )
    return unique_agents_by_name(agents)


@api_view(["POST"])
@permission_classes([AllowAny])
def phone_send_view(request):
    serializer = PhoneSendSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = normalize_phone(serializer.validated_data["phone"])
    if not is_valid_ghana_phone(phone):
        return Response({"detail": "Enter a valid Ghana phone number."}, status=400)

    otp = PhoneOTP.create_for_phone(phone)
    try:
        send_otp_sms(phone, otp.otp_code)
    except SMSError:
        logger.exception("Failed to send OTP SMS to %s", phone)
        return Response({"detail": "Could not send SMS. Try again."}, status=502)

    return Response({"detail": "Verification code sent.", "phone": phone})


@api_view(["POST"])
@permission_classes([AllowAny])
def phone_verify_view(request):
    serializer = PhoneVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = normalize_phone(serializer.validated_data["phone"])
    otp_code = serializer.validated_data["otp"]
    first_name = (serializer.validated_data.get("first_name") or "").strip()

    record = (
        PhoneOTP.objects.filter(phone=phone, verified=False)
        .order_by("-created_at")
        .first()
    )
    if not record or not record.is_valid(otp_code):
        return Response({"detail": "Invalid or expired code."}, status=400)

    record.verified = True
    record.save(update_fields=["verified"])

    user, created = User.objects.get_or_create(
        username=phone,
        defaults={"first_name": first_name},
    )
    if created:
        user.set_unusable_password()
        user.save()
        _ensure_renter_role(user)
    elif first_name and not user.first_name:
        user.first_name = first_name
        user.save(update_fields=["first_name"])

    user.profile.phone = phone
    if user.first_name and not user.profile.display_name:
        user.profile.display_name = user.first_name
    user.profile.save()

    return Response(_tokens_for_user(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(serialize_user(request.user))


@api_view(["GET"])
@permission_classes([AllowAny])
def areas_view(request):
    return Response({"areas": get_all_areas()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def agent_search_view(request):
    area = (request.query_params.get("area") or "").strip()
    if not area:
        return Response({"area": "", "agents": []})

    agents = _sorted_agents([a for a in Agent.objects.all() if a.serves_area(area)])
    contacted_ids = set(
        Conversation.objects.filter(user=request.user).values_list("agent_id", flat=True)
    )
    payload = []
    for agent in agents:
        item = serialize_agent(agent, request)
        item["contacted"] = agent.id in contacted_ids
        payload.append(item)
    return Response({"area": area, "agents": payload})


@api_view(["GET"])
@permission_classes([AllowAny])
def agent_detail_view(request, agent_id):
    agent = get_object_or_404(Agent, pk=agent_id)
    data = serialize_agent(agent, request)
    data["access_plans"] = serialize_plans()
    data["reviews"] = [
        serialize_rating(r)
        for r in agent.ratings.select_related("user").order_by("-created_at")[:20]
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def payment_plans_view(request):
    return Response({"plans": serialize_plans()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_unlock_view(request):
    serializer = UnlockSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    plan = serializer.validated_data["plan"]
    if plan not in VALID_PLANS:
        return Response({"detail": "Choose weekly or monthly."}, status=400)

    if plan_fee_pesewas(plan) <= 0:
        access = get_or_create_pending_pass(request.user, plan)
        access.mark_paid("free")
        return Response(
            {
                "status": "paid",
                "plan": plan,
                "expires_at": access.expires_at.isoformat() if access.expires_at else None,
                "authorization_url": None,
                "user": serialize_user(request.user),
            }
        )

    access = get_or_create_pending_pass(request.user, plan)
    frontend = (settings.FRONTEND_URL or "").rstrip("/")
    callback_url = serializer.validated_data.get("callback_url")
    if not callback_url:
        callback_url = (
            f"{frontend}/access/callback"
            if frontend
            else request.build_absolute_uri("/api/payments/confirm/")
        )
    try:
        data = initialize_transaction(
            email=access.email,
            amount=access.amount,
            reference=access.reference,
            callback_url=callback_url,
            currency=access.currency,
            metadata={
                "user_id": request.user.id,
                "plan": plan,
                "purpose": "renter_access",
            },
        )
    except PaystackError as exc:
        logger.error("API unlock init failed for user %s: %s", request.user.id, exc)
        return Response({"detail": "Could not start payment. Try again."}, status=502)

    return Response(
        {
            "status": "pending",
            "plan": plan,
            "reference": access.reference,
            "authorization_url": data["authorization_url"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_confirm_view(request):
    reference = request.query_params.get("reference") or request.query_params.get("trxref")
    if not reference:
        return Response({"detail": "Missing payment reference."}, status=400)

    access = get_object_or_404(AccessPass, reference=reference, user=request.user)
    if access.is_paid:
        return Response(
            {
                "status": "paid",
                "plan": access.plan,
                "expires_at": access.expires_at.isoformat() if access.expires_at else None,
                "user": serialize_user(request.user),
            }
        )

    try:
        data = verify_transaction(reference)
    except PaystackError:
        return Response(
            {
                "status": access.status,
                "detail": "Could not confirm payment yet.",
                "user": serialize_user(request.user),
            },
            status=202,
        )

    if data.get("status") == "success":
        access.mark_paid(data.get("gateway_response", ""))
        return Response(
            {
                "status": "paid",
                "plan": access.plan,
                "expires_at": access.expires_at.isoformat() if access.expires_at else None,
                "user": serialize_user(request.user),
            }
        )

    access.mark_failed(data.get("gateway_response", ""))
    return Response({"status": "failed", "detail": "Payment was not completed."}, status=400)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_view(request):
    return Response({"ok": True, "service": "rentagent-api"})
