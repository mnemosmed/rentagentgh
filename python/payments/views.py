import json
import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from .models import AccessPass
from .paystack import (
    PaystackError,
    initialize_transaction,
    verify_transaction,
    verify_webhook_signature,
)
from .services import (
    VALID_PLANS,
    get_or_create_pending_pass,
    has_active_access,
    plan_fee_pesewas,
)

logger = logging.getLogger(__name__)


def _safe_next_url(raw: str | None) -> str:
    """Prefer an onsite next URL (agent profile), else search."""
    nxt = (raw or "").strip()
    if nxt.startswith("/") and not nxt.startswith("//"):
        return nxt
    return reverse("agents:search")


def _pop_payment_next(request) -> str:
    return _safe_next_url(request.session.pop("payment_next", None))


@login_required
@require_POST
def unlock_access_view(request):
    """Start (or short-circuit) payment for weekly/monthly renter access."""
    plan = (request.POST.get("plan") or "").strip().lower()
    next_url = _safe_next_url(request.POST.get("next") or request.GET.get("next"))

    if plan not in VALID_PLANS:
        messages.error(request, "Choose a weekly or monthly access plan.")
        return redirect(next_url)

    if has_active_access(request.user):
        messages.info(request, "You already have active access. Renewing will extend it.")

    if plan_fee_pesewas(plan) <= 0:
        access = get_or_create_pending_pass(request.user, plan)
        access.mark_paid("free")
        messages.success(
            request,
            f"Access unlocked until {access.expires_at:%d %b %Y}. "
            "You can contact agents and send messages.",
        )
        return redirect(next_url)

    access = get_or_create_pending_pass(request.user, plan)
    request.session["payment_next"] = next_url
    callback_url = request.build_absolute_uri(reverse("payments:callback"))
    try:
        data = initialize_transaction(
            email=access.email,
            amount=access.amount,
            reference=access.reference,
            callback_url=callback_url,
            currency=access.currency,
            metadata={
                "user_id": request.user.id,
                "plan": plan,
                "purpose": "renter_access",
            },
        )
    except PaystackError as exc:
        logger.error("Access pass init failed for user %s: %s", request.user.id, exc)
        messages.error(request, "Could not start payment. Please try again.")
        return redirect(next_url)

    return redirect(data["authorization_url"])


@login_required
@require_http_methods(["GET"])
def payment_callback_view(request):
    """Paystack redirects here after checkout; verify and finalize."""
    reference = request.GET.get("reference") or request.GET.get("trxref")
    next_url = _pop_payment_next(request)
    if not reference:
        messages.error(request, "Missing payment reference.")
        return redirect(next_url)

    access = get_object_or_404(AccessPass, reference=reference, user=request.user)

    if access.is_paid:
        messages.success(
            request,
            f"You have access until {access.expires_at:%d %b %Y}.",
        )
        return redirect(next_url)

    try:
        data = verify_transaction(reference)
    except PaystackError:
        messages.error(
            request,
            "We couldn't confirm your payment yet. If you were charged, it will be applied shortly.",
        )
        return redirect(next_url)

    if data.get("status") == "success":
        access.mark_paid(data.get("gateway_response", ""))
        messages.success(
            request,
            f"Payment received — access until {access.expires_at:%d %b %Y}. "
            "You can contact agents and send messages.",
        )
    else:
        access.mark_failed(data.get("gateway_response", ""))
        messages.error(request, "Payment was not completed.")

    return redirect(next_url)


@csrf_exempt
@require_POST
def paystack_webhook_view(request):
    """Server-to-server confirmation from Paystack (charge.success)."""
    signature = request.headers.get("x-paystack-signature")
    if not verify_webhook_signature(request.body, signature):
        logger.warning("Rejected Paystack webhook with bad signature.")
        return HttpResponseBadRequest("Invalid signature")

    try:
        event = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return HttpResponseBadRequest("Invalid payload")

    if event.get("event") == "charge.success":
        data = event.get("data", {})
        reference = data.get("reference")
        access = AccessPass.objects.filter(reference=reference).first()
        if access and not access.is_paid:
            access.mark_paid(data.get("gateway_response", "webhook"))
            logger.info("Access pass %s marked paid via webhook.", reference)

    return HttpResponse(status=200)
