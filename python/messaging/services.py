from __future__ import annotations

from django.contrib.auth.models import User

from agents.models import Agent

from .models import Conversation, Message


def message_preview(message: Message | None) -> str:
    if not message:
        return ""
    if message.media_type == Message.MEDIA_IMAGE:
        return "Photo"
    if message.media_type == Message.MEDIA_VIDEO:
        return "Video"
    if message.media_file:
        return "Attachment"
    text = (message.content or "").strip()
    return text if len(text) <= 80 else f"{text[:77]}…"


def total_unread_for_user(user: User) -> int:
    if not user.is_authenticated:
        return 0
    agent = Agent.objects.filter(claimed_by=user).first()
    if agent:
        return (
            Message.objects.filter(conversation__agent=agent, is_read=False)
            .exclude(sender=user)
            .count()
        )
    return (
        Message.objects.filter(conversation__user=user, is_read=False)
        .exclude(sender=user)
        .count()
    )


def mark_conversation_read(conversation: Conversation, user: User) -> None:
    Message.objects.filter(conversation=conversation, is_read=False).exclude(sender=user).update(
        is_read=True
    )


def snapshot_unread_divider(request, conversation: Conversation, user: User) -> dict | None:
    key = f"unread_divider_{conversation.id}"
    stored = request.session.get(key)
    if stored:
        return stored

    unreads = (
        Message.objects.filter(conversation=conversation, is_read=False)
        .exclude(sender=user)
        .order_by("created_at")
    )
    count = unreads.count()
    if not count:
        return None

    first = unreads.first()
    stored = {"count": count, "first_id": str(first.id)}
    request.session[key] = stored
    return stored


def get_unread_divider(request, conversation: Conversation) -> dict | None:
    return request.session.get(f"unread_divider_{conversation.id}")


def clear_all_unread_dividers(request) -> None:
    for key in list(request.session.keys()):
        if key.startswith("unread_divider_"):
            del request.session[key]


def clear_other_unread_dividers(request, conversation: Conversation) -> None:
    prefix = "unread_divider_"
    active = f"{prefix}{conversation.id}"
    for key in list(request.session.keys()):
        if key.startswith(prefix) and key != active:
            del request.session[key]


def build_renter_conversations(user: User) -> list[dict]:
    items = []
    for conv in Conversation.objects.filter(user=user).select_related("agent"):
        last = conv.last_message()
        items.append(
            {
                "conversation": conv,
                "agent": conv.agent,
                "peer_name": conv.agent.display_name,
                "last_message": last,
                "preview": message_preview(last),
                "unread_count": conv.unread_count_for(user),
            }
        )
    _sort_conversations(items)
    return items


def build_agent_conversations(agent: Agent, user: User) -> list[dict]:
    items = []
    for conv in Conversation.objects.filter(agent=agent).select_related("user", "user__profile"):
        last = conv.last_message()
        name = conv.user.profile.display_name or conv.user.get_username()
        items.append(
            {
                "conversation": conv,
                "peer_name": name,
                "renter_name": name,
                "last_message": last,
                "preview": message_preview(last),
                "unread_count": conv.unread_count_for(user),
            }
        )
    _sort_conversations(items)
    return items


def _sort_conversations(items: list[dict]) -> None:
    items.sort(
        key=lambda c: (
            0 if c["unread_count"] else 1,
            -(
                c["last_message"].created_at.timestamp()
                if c["last_message"]
                else c["conversation"].updated_at.timestamp()
            ),
        )
    )
