from __future__ import annotations

import secrets
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone

from agents.models import Agent

from .models import AccessPass

VALID_PLANS = {AccessPass.PLAN_WEEKLY, AccessPass.PLAN_MONTHLY}


def plan_amount_ghs(plan: str) -> float:
    if plan == AccessPass.PLAN_WEEKLY:
        return float(settings.RENTER_WEEKLY_AMOUNT_GHS)
    if plan == AccessPass.PLAN_MONTHLY:
        return float(settings.RENTER_MONTHLY_AMOUNT_GHS)
    raise ValueError(f"Unknown plan: {plan}")


def plan_fee_pesewas(plan: str) -> int:
    return int(round(plan_amount_ghs(plan) * 100))


def active_access_pass(user: User) -> AccessPass | None:
    """Return the user's furthest-expiring active access pass, if any."""
    if not user.is_authenticated:
        return None
    return (
        AccessPass.objects.filter(
            user=user,
            status=AccessPass.STATUS_PAID,
            expires_at__gt=timezone.now(),
        )
        .order_by("-expires_at")
        .first()
    )


def has_active_access(user: User) -> bool:
    return active_access_pass(user) is not None


def access_expires_at(user: User) -> datetime | None:
    pass_obj = active_access_pass(user)
    return pass_obj.expires_at if pass_obj else None


def has_contact_access(user: User, agent: Agent) -> bool:
    """True if this user may see contacts and message agents.

    Agents always have access to their own profile. Renters need a paid
    weekly or monthly access pass.
    """
    if not user.is_authenticated:
        return False
    if agent.claimed_by_id == user.id:
        return True
    return has_active_access(user)


def can_renter_message(user: User) -> bool:
    """True if a renter may send messages (active access pass required)."""
    if not user.is_authenticated:
        return False
    return has_active_access(user)


def generate_reference(user: User, plan: str) -> str:
    return f"rag_{plan}_{user.pk}_{secrets.token_hex(6)}"


def get_or_create_pending_pass(user: User, plan: str) -> AccessPass:
    """Reuse a pending pass for this plan or create a fresh one."""
    if plan not in VALID_PLANS:
        raise ValueError(f"Unknown plan: {plan}")

    pending = (
        AccessPass.objects.filter(
            user=user, plan=plan, status=AccessPass.STATUS_PENDING
        )
        .order_by("-created_at")
        .first()
    )
    amount = plan_fee_pesewas(plan)
    if pending:
        if pending.amount != amount:
            pending.amount = amount
            pending.save(update_fields=["amount", "updated_at"])
        return pending

    return AccessPass.objects.create(
        user=user,
        plan=plan,
        reference=generate_reference(user, plan),
        email=(user.email or f"{user.get_username()}@rentagent.gh"),
        amount=amount,
        currency=settings.PAYSTACK_CURRENCY,
    )


def plan_choices_for_template() -> list[dict]:
    return [
        {
            "id": AccessPass.PLAN_WEEKLY,
            "label": "1 week",
            "amount_ghs": settings.RENTER_WEEKLY_AMOUNT_GHS,
            "days": AccessPass.PLAN_DURATION_DAYS[AccessPass.PLAN_WEEKLY],
        },
        {
            "id": AccessPass.PLAN_MONTHLY,
            "label": "1 month",
            "amount_ghs": settings.RENTER_MONTHLY_AMOUNT_GHS,
            "days": AccessPass.PLAN_DURATION_DAYS[AccessPass.PLAN_MONTHLY],
        },
    ]
