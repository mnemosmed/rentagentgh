from rest_framework import serializers

from agents.models import Agent, AgentRating
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


def serialize_user(user) -> dict:
    from payments.services import access_expires_at
    from accounts.models import Role, UserRole

    profile = getattr(user, "profile", None)
    roles = list(Role.objects.filter(user=user).values_list("role", flat=True))
    expires = access_expires_at(user)
    return {
        "id": user.id,
        "username": user.get_username(),
        "display_name": (profile.display_name if profile else "") or user.first_name or user.get_username(),
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
