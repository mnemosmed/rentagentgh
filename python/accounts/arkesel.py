import logging

import requests
from django.conf import settings

from .phone_utils import arkesel_recipient

logger = logging.getLogger(__name__)

ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send"


class SMSError(Exception):
    pass


def send_sms(recipients: list[str], message: str) -> dict:
    """
    Send SMS via Arkesel. Falls back to console logging when SMS_ENABLED is False.
    recipients: phone numbers in any Ghana format; normalized for Arkesel automatically.
    """
    formatted = [arkesel_recipient(p) for p in recipients]

    if not settings.SMS_ENABLED:
        logger.warning("DEV SMS to %s: %s", formatted, message)
        print(f"\n>>> SMS to {', '.join(formatted)}:\n{message}\n")
        return {"status": "dev", "recipients": formatted}

    api_key = settings.ARKESEL_API_KEY
    if not api_key:
        raise SMSError("ARKESEL_API_KEY is not configured")

    payload = {
        "sender": settings.ARKESEL_SENDER_ID,
        "message": message,
        "recipients": formatted,
    }
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(ARKESEL_SEND_URL, json=payload, headers=headers, timeout=30)
        data = response.json() if response.content else {}
    except requests.RequestException as exc:
        logger.exception("Arkesel request failed")
        raise SMSError(f"SMS request failed: {exc}") from exc

    if not response.ok:
        logger.error("Arkesel error %s: %s", response.status_code, data)
        raise SMSError(f"SMS send failed: {data}")

    logger.info("Arkesel SMS sent to %s", formatted[0][:5] + "...")
    return data
