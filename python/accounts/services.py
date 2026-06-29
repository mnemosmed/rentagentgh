import logging

from django.conf import settings

from .arkesel import SMSError, send_sms

logger = logging.getLogger(__name__)


def send_otp_sms(phone: str, code: str) -> None:
    message = (
        f"Your RentAgentGhana verification code is: {code}. "
        f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes."
    )
    try:
        send_sms([phone], message)
    except SMSError:
        logger.exception("Failed to send OTP SMS to %s", phone[:6] + "...")
        raise
