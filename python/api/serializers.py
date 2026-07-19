from rest_framework import serializers

from agents.models import Agent, AgentRating
from messaging.models import Message
from payments.services import has_contact_access, plan_choices_for_template


class PhoneSendSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class PhoneVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class UnlockSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["weekly", "monthly"])
    callback_url = serializers.URLField(required=False, allow_blank=True)


class CreateConversationSerializer(serializers.Serializer):
    agent_id = serializers.UUIDField()


class ContactAgentSerializer(serializers.Serializer):
    property_type = serializers.CharField(max_length=40)
    location = serializers.CharField(max_length=200)
    budget_min = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    budget_max = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    move_in = serializers.CharField(max_length=40)
    preferences = serializers.CharField(required=False, allow_blank=True, default="")


class RatingSerializer(serializers.Serializer):
    helpfulness = serializers.IntegerField(min_value=1, max_value=5)
    responsiveness = serializers.IntegerField(min_value=1, max_value=5)
    trustworthiness = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class ClaimStartSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=200)
    primary_area = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=20)


class ClaimVerifySerializer(serializers.Serializer):
    agent_id = serializers.UUIDField()
    phone = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6)


class AgentMeUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=200, required=False)
    short_bio = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    whatsapp = serializers.CharField(max_length=20, required=False, allow_blank=True)
    primary_area = serializers.CharField(max_length=120, required=False)
    covered_areas = serializers.ListField(
        child=serializers.CharField(max_length=120), required=False
    )


def serialize_user(user) -> dict:
    from accounts.models import Role, UserRole
    from payments.services import access_expires_at

    profile = getattr(user, "profile", None)
    roles = list(Role.objects.filter(user=user).values_list("role", flat=True))
    expires = access_expires_at(user)
    return {
        "id": user.id,
        "username": user.get_username(),
        "display_name": (profile.display_name if profile else "")
        or user.first_name
        or user.get_username(),
        "phone": profile.phone if profile else "",
        "roles": roles,
        "is_agent": UserRole.AGENT in roles,
        "has_active_access": expires is not None,
        "access_expires_at": expires.isoformat() if expires else None,
    }


def serialize_agent(agent: Agent, request=None, *, include_contacts: bool | None = None) -> dict:
    user = getattr(request, "user", None) if request else None
    if include_contacts is None:
        include_contacts = bool(user and has_contact_access(user, agent))

    stats = agent.rating_stats
    data = {
        "id": str(agent.id),
        "display_name": agent.display_name,
        "primary_area": agent.primary_area,
        "covered_areas": agent.covered_areas,
        "short_bio": agent.short_bio,
        "tiktok_handle": agent.tiktok_handle,
        "is_verified": agent.is_verified,
        "rating_stats": stats,
        "contact_unlocked": include_contacts,
    }
    if include_contacts:
        data["phone"] = agent.phone
        data["whatsapp"] = agent.whatsapp
    else:
        data["phone"] = None
        data["whatsapp"] = None
    return data


def serialize_rating(rating: AgentRating) -> dict:
    return {
        "id": str(rating.id),
        "overall": rating.overall,
        "helpfulness": rating.helpfulness,
        "responsiveness": rating.responsiveness,
        "trustworthiness": rating.trustworthiness,
        "comment": rating.comment,
        "created_at": rating.created_at.isoformat(),
    }


def serialize_plans() -> list[dict]:
    return plan_choices_for_template()


def serialize_message(message: Message, request=None) -> dict:
    media_url = None
    if message.media_file:
        url = message.media_file.url
        from django.conf import settings

        site = (getattr(settings, "SITE_URL", "") or "").rstrip("/")
        if site and url.startswith("/"):
            media_url = f"{site}{url}"
        elif request is not None:
            media_url = request.build_absolute_uri(url)
        else:
            media_url = url
    return {
        "id": str(message.id),
        "sender_id": message.sender_id,
        "content": message.content,
        "is_read": message.is_read,
        "media_type": message.media_type,
        "media_url": media_url,
        "created_at": message.created_at.isoformat(),
    }


def serialize_thread_item(item: dict, *, mode: str) -> dict:
    conv = item["conversation"]
    last = item.get("last_message")
    payload = {
        "id": str(conv.id),
        "peer_name": item["peer_name"],
        "preview": item.get("preview") or "",
        "unread_count": item.get("unread_count") or 0,
        "updated_at": conv.updated_at.isoformat(),
        "last_message_at": last.created_at.isoformat() if last else conv.updated_at.isoformat(),
        "mode": mode,
    }
    if mode == "renter":
        payload["agent_id"] = str(conv.agent_id)
        payload["peer_subtitle"] = conv.agent.primary_area
    else:
        payload["renter_id"] = conv.user_id
        payload["peer_subtitle"] = "Renter"
    return payload
