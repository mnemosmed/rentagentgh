from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth.models import User

from agents.models import Agent
from messaging.models import Conversation

from .models import ContactUnlock


def contact_fee_pesewas() -> int:
    """The unlock fee in the smallest currency unit (pesewas)."""
    return int(round(settings.CONTACT_UNLOCK_AMOUNT_GHS * 100))


def has_contact_access(user: User, agent: Agent) -> bool:
    """True if this user may contact this agent without paying.

    Access is granted when the user owns the agent profile, has already
    started a conversation (grandfathered / already paid), or holds a paid
    unlock for the agent.
    """
    if not user.is_authenticated:
        return False
    if agent.claimed_by_id == user.id:
        return True
    if Conversation.objects.filter(user=user, agent=agent).exists():
        return True
    return ContactUnlock.objects.filter(
        user=user, agent=agent, status=ContactUnlock.STATUS_PAID
    ).exists()


def generate_reference(user: User, agent: Agent) -> str:
    return f"rag_{user.pk}_{str(agent.pk)[:8]}_{secrets.token_hex(6)}"


def get_or_create_pending_unlock(user: User, agent: Agent) -> ContactUnlock:
    """Reuse an existing pending unlock or create a fresh one."""
    pending = (
        ContactUnlock.objects.filter(
            user=user, agent=agent, status=ContactUnlock.STATUS_PENDING
        )
        .order_by("-created_at")
        .first()
    )
    if pending:
        return pending
    return ContactUnlock.objects.create(
        user=user,
        agent=agent,
        reference=generate_reference(user, agent),
        email=(user.email or f"{user.get_username()}@rentagent.gh"),
        amount=contact_fee_pesewas(),
        currency=settings.PAYSTACK_CURRENCY,
    )
