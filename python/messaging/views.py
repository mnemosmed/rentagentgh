from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from accounts.models import Role, UserRole
from agents.models import Agent
from payments.services import can_renter_message, plan_choices_for_template

from messaging.notifications import notify_agent_new_inquiry

from .forms import MessageForm
from .models import Conversation, Message
from .services import (
    build_agent_conversations,
    build_renter_conversations,
    get_unread_divider,
    mark_conversation_read,
    snapshot_unread_divider,
    clear_all_unread_dividers,
    clear_other_unread_dividers,
)


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
    agent = Agent.objects.filter(claimed_by=user, pk=conversation.agent_id).first()
    return agent is not None


def _chat_peer_context(request, conversation: Conversation) -> dict:
    agent = Agent.objects.filter(claimed_by=request.user, pk=conversation.agent_id).first()
    if agent:
        renter = conversation.user
        name = renter.profile.display_name or renter.get_username()
        return {
            "peer_name": name,
            "peer_subtitle": "Renter",
            "peer_profile_url": "",
            "reply_url_name": "messaging:agent_reply",
            "show_back": True,
            "back_url": f"{reverse('agents:dashboard')}?id={conversation.id}",
        }
    return {
        "peer_name": conversation.agent.display_name,
        "peer_subtitle": conversation.agent.primary_area,
        "peer_profile_url": reverse("agents:profile", kwargs={"agent_id": conversation.agent_id}),
        "reply_url_name": None,
        "show_back": True,
        "back_url": reverse("messaging:inbox"),
    }


def _conversation_chat_context(request, conversation: Conversation) -> dict:
    clear_other_unread_dividers(request, conversation)
    unread_divider = snapshot_unread_divider(request, conversation, request.user)
    mark_conversation_read(conversation, request.user)
    if not unread_divider:
        unread_divider = get_unread_divider(request, conversation)
    return {
        "messages": conversation.messages.select_related("sender").order_by("created_at"),
        "unread_divider": unread_divider,
    }


@login_required
def inbox_view(request, conversation_id=None):
    if Role.objects.filter(user=request.user, role=UserRole.AGENT).exists():
        agent = Agent.objects.filter(claimed_by=request.user).first()
        if agent:
            return redirect("agents:dashboard")

    conversations = build_renter_conversations(request.user)

    selected = None
    unread_divider = None
    chat_messages = []
    if conversation_id:
        selected = get_object_or_404(Conversation, pk=conversation_id, user=request.user)
    elif request.GET.get("agent"):
        agent = get_object_or_404(Agent, pk=request.GET["agent"])
        if not can_renter_message(request.user):
            messages.error(
                request,
                "Get weekly or monthly access to message agents.",
            )
            return redirect("agents:profile", agent_id=agent.id)
        selected, _ = Conversation.objects.get_or_create(user=request.user, agent=agent)

    if not selected:
        clear_all_unread_dividers(request)

    chat_context = {}
    renter_can_send = True
    access_plans = []
    if selected:
        chat_ctx = _conversation_chat_context(request, selected)
        chat_messages = chat_ctx["messages"]
        unread_divider = chat_ctx["unread_divider"]
        chat_context = _chat_peer_context(request, selected)
        # Agents reply freely; renters need an active access pass to send.
        if not chat_context.get("reply_url_name"):
            renter_can_send = can_renter_message(request.user)
            if not renter_can_send:
                access_plans = plan_choices_for_template()

    return render(
        request,
        "messaging/inbox.html",
        {
            "conversations": conversations,
            "selected": selected,
            "chat_messages": chat_messages,
            "message_form": MessageForm(),
            "unread_divider": unread_divider,
            "scroll_to_unread": bool(unread_divider),
            "renter_can_send": renter_can_send,
            "access_plans": access_plans,
            **chat_context,
        },
    )


@login_required
def threads_partial_view(request):
    selected_id = request.GET.get("selected")
    selected = None

    if Role.objects.filter(user=request.user, role=UserRole.AGENT).exists():
        agent = Agent.objects.filter(claimed_by=request.user).first()
        if agent:
            if selected_id:
                selected = Conversation.objects.filter(pk=selected_id, agent=agent).first()
            return render(
                request,
                "messaging/partials/thread_list.html",
                {
                    "conversations": build_agent_conversations(agent, request.user),
                    "thread_mode": "agent",
                    "selected": selected,
                },
            )

    if selected_id:
        selected = Conversation.objects.filter(pk=selected_id, user=request.user).first()

    return render(
        request,
        "messaging/partials/thread_list.html",
        {
            "conversations": build_renter_conversations(request.user),
            "thread_mode": "renter",
            "selected": selected,
        },
    )


@login_required
@require_http_methods(["POST"])
def send_message_view(request, conversation_id):
    conversation = get_object_or_404(Conversation, pk=conversation_id)
    if not _user_can_access_conversation(request.user, conversation):
        return HttpResponseForbidden()

    is_renter = conversation.user_id == request.user.id
    if is_renter and not can_renter_message(request.user):
        msg = "Your access has expired. Renew weekly or monthly access to keep messaging agents."
        if request.headers.get("HX-Request"):
            return chat_partial_view(request, conversation_id, upload_error=msg)
        messages.error(request, msg)
        return redirect("messaging:conversation", conversation_id=conversation_id)

    upload_error = None
    form = MessageForm(request.POST, request.FILES)
    if form.is_valid():
        content = form.cleaned_data.get("content", "").strip()
        media = form.cleaned_data.get("media_file")
        if content or media:
            media_type = _detect_media_type(media) if media else ""
            Message.objects.create(
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
        else:
            upload_error = "Add a message or attach a photo/video."
    else:
        errors = form.errors.get("media_file") or form.errors.get("content") or form.non_field_errors()
        upload_error = errors[0] if errors else "Could not send message."

    if request.headers.get("HX-Request"):
        return chat_partial_view(request, conversation_id, upload_error=upload_error)
    if upload_error:
        messages.error(request, upload_error)
    return redirect("messaging:conversation", conversation_id=conversation_id)


@login_required
def chat_partial_view(request, conversation_id, upload_error=None):
    conversation = get_object_or_404(Conversation, pk=conversation_id)
    if not _user_can_access_conversation(request.user, conversation):
        return HttpResponseForbidden()

    mark_conversation_read(conversation, request.user)
    unread_divider = get_unread_divider(request, conversation)
    ctx = _chat_peer_context(request, conversation)
    renter_can_send = True
    access_plans = []
    if not ctx.get("reply_url_name"):
        renter_can_send = can_renter_message(request.user)
        if not renter_can_send:
            access_plans = plan_choices_for_template()
    return render(
        request,
        "messaging/partials/chat.html",
        {
            "conversation": conversation,
            "messages": conversation.messages.select_related("sender").order_by("created_at"),
            "message_form": MessageForm(),
            "upload_error": upload_error,
            "unread_divider": unread_divider,
            "scroll_to_unread": False,
            "renter_can_send": renter_can_send,
            "access_plans": access_plans,
            **ctx,
        },
    )


@login_required
@require_http_methods(["POST"])
def agent_reply_view(request, conversation_id):
    agent = Agent.objects.filter(claimed_by=request.user).first()
    if not agent:
        return HttpResponseForbidden()
    conversation = get_object_or_404(Conversation, pk=conversation_id, agent=agent)
    return send_message_view(request, conversation_id)
