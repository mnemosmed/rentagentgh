"""Thin Paystack REST client + webhook signature helper.

Docs: https://paystack.com/docs/api/
Only the endpoints RentAgentGhana needs are wrapped:
  - transaction/initialize  -> returns an authorization_url to redirect the user to
  - transaction/verify/:ref -> confirms a payment succeeded
Plus HMAC-SHA512 verification for incoming webhooks.
"""
from __future__ import annotations

import hashlib
import hmac
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

PAYSTACK_BASE_URL = "https://api.paystack.co"


class PaystackError(Exception):
    pass


def _secret_key() -> str:
    key = settings.PAYSTACK_SECRET_KEY
    if not key:
        raise PaystackError("PAYSTACK_SECRET_KEY is not configured.")
    return key


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_secret_key()}",
        "Content-Type": "application/json",
    }


def initialize_transaction(
    *,
    email: str,
    amount: int,
    reference: str,
    callback_url: str,
    currency: str = "GHS",
    metadata: dict | None = None,
) -> dict:
    """Create a transaction. ``amount`` is in the smallest unit (pesewas).

    Returns the Paystack ``data`` object which includes ``authorization_url``.
    """
    payload = {
        "email": email,
        "amount": amount,
        "reference": reference,
        "callback_url": callback_url,
        "currency": currency,
    }
    if metadata:
        payload["metadata"] = metadata

    try:
        response = requests.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            json=payload,
            headers=_headers(),
            timeout=30,
        )
        data = response.json() if response.content else {}
    except requests.RequestException as exc:
        logger.exception("Paystack initialize failed")
        raise PaystackError(f"Payment initialization failed: {exc}") from exc

    if not response.ok or not data.get("status"):
        logger.error("Paystack initialize error %s: %s", response.status_code, data)
        raise PaystackError(data.get("message", "Payment initialization failed."))

    return data["data"]


def verify_transaction(reference: str) -> dict:
    """Verify a transaction by reference. Returns the Paystack ``data`` object."""
    try:
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=_headers(),
            timeout=30,
        )
        data = response.json() if response.content else {}
    except requests.RequestException as exc:
        logger.exception("Paystack verify failed")
        raise PaystackError(f"Payment verification failed: {exc}") from exc

    if not response.ok or not data.get("status"):
        logger.error("Paystack verify error %s: %s", response.status_code, data)
        raise PaystackError(data.get("message", "Payment verification failed."))

    return data["data"]


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    """Validate the ``x-paystack-signature`` header (HMAC-SHA512 of the body)."""
    if not signature:
        return False
    try:
        computed = hmac.new(
            _secret_key().encode("utf-8"), raw_body, hashlib.sha512
        ).hexdigest()
    except PaystackError:
        return False
    return hmac.compare_digest(computed, signature)
