import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from accounts.arkesel import SMSError, send_sms
from agents.models import Agent, AgentAccessToken

logger = logging.getLogger(__name__)


def _sender_display_name(user) -> str:
    profile = getattr(user, "profile", None)
    if profile and profile.display_name:
        return profile.display_name
    if user.first_name:
        return user.first_name
    return "A renter"


def _agent_phone(agent: Agent) -> str:
    if agent.phone:
        return agent.phone.strip()
    if agent.whatsapp:
        return agent.whatsapp.strip()
    if agent.claimed_by_id:
        profile = getattr(agent.claimed_by, "profile", None)
        if profile and profile.phone:
            return profile.phone.strip()
    return ""


def _should_notify(conversation, now) -> bool:
    if not conversation.agent_notified_at:
        return True
    cooldown = timedelta(minutes=getattr(settings, "AGENT_SMS_COOLDOWN_MINUTES", 15))
    return conversation.agent_notified_at <= now - cooldown


def notify_agent_new_inquiry(conversation, sender_user) -> bool:
    """
    SMS the agent when a renter contacts them (initial request or follow-up message).
    Returns True if an SMS was sent.
    """
    agent: Agent = conversation.agent
    agent_phone = _agent_phone(agent)
    if not agent_phone:
        logger.info("No phone for agent %s, skipping SMS", agent.id)
        return False

    now = timezone.now()
    if not _should_notify(conversation, now):
        logger.info("Agent SMS cooldown active for conversation %s", conversation.id)
        return False

    sender_name = _sender_display_name(sender_user)
    base_url = settings.SITE_URL.rstrip("/")
    is_claimed = bool(agent.claimed_by_id)

    if is_claimed:
        chat_url = f"{base_url}/agents/dashboard/?id={conversation.id}"
        sms_message = (
            f"Hi {agent.display_name}, {sender_name} contacted you on RentAgentGhana. "
            f"View & reply: {chat_url}"
        )
    else:
        token_record = AgentAccessToken.objects.filter(
            conversation=conversation,
            agent=agent,
        ).first()
        if token_record:
            access_token = token_record.token
        else:
            access_token = secrets.token_urlsafe(32)
            AgentAccessToken.objects.create(
                conversation=conversation,
                agent=agent,
                token=access_token,
                expires_at=now + timedelta(days=30),
            )
        chat_url = f"{base_url}/agents/auth/?token={access_token}"
        sms_message = (
            f"Hi {agent.display_name}, {sender_name} sent you a rental inquiry on RentAgentGhana. "
            f"View & reply: {chat_url}"
        )

    try:
        send_sms([agent_phone], sms_message)
    except SMSError:
        logger.exception("Failed to notify agent %s via SMS", agent.id)
        return False

    conversation.agent_notified_at = now
    conversation.save(update_fields=["agent_notified_at"])

    if is_claimed:
        agent.last_sms_notified_at = now
        agent.save(update_fields=["last_sms_notified_at"])

    logger.info("SMS sent to agent %s for conversation %s", agent.id, conversation.id)
    return True
