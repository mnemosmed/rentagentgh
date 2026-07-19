import json
import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from agents.models import Agent

from .models import ContactUnlock
from .paystack import (
    PaystackError,
    initialize_transaction,
    verify_transaction,
    verify_webhook_signature,
)
from .services import (
    contact_fee_pesewas,
    get_or_create_pending_unlock,
    has_contact_access,
)

logger = logging.getLogger(__name__)


@login_required
@require_POST
def unlock_contact_view(request, agent_id):
    """Start (or short-circuit) a payment to unlock contacting an agent."""
    agent = get_object_or_404(Agent, pk=agent_id)

    if has_contact_access(request.user, agent):
        return redirect("agents:profile", agent_id=agent.id)

    # Free tier / dev mode: unlock immediately without hitting Paystack.
    if contact_fee_pesewas() <= 0:
        unlock = get_or_create_pending_unlock(request.user, agent)
        unlock.mark_paid("free")
        messages.success(request, f"You can now contact {agent.display_name}.")
        return redirect("agents:profile", agent_id=agent.id)

    unlock = get_or_create_pending_unlock(request.user, agent)
    callback_url = request.build_absolute_uri(reverse("payments:callback"))
    try:
        data = initialize_transaction(
            email=unlock.email,
            amount=unlock.amount,
            reference=unlock.reference,
            callback_url=callback_url,
            currency=unlock.currency,
            metadata={
                "agent_id": str(agent.id),
                "user_id": request.user.id,
                "purpose": "contact_unlock",
            },
        )
    except PaystackError as exc:
        logger.error("Unlock init failed for %s: %s", agent.id, exc)
        messages.error(request, "Could not start payment. Please try again.")
        return redirect("agents:profile", agent_id=agent.id)

    return redirect(data["authorization_url"])


@login_required
@require_http_methods(["GET"])
def payment_callback_view(request):
    """Paystack redirects here after checkout; verify and finalize."""
    reference = request.GET.get("reference") or request.GET.get("trxref")
    if not reference:
        messages.error(request, "Missing payment reference.")
        return redirect("core:home")

    unlock = get_object_or_404(ContactUnlock, reference=reference, user=request.user)

    if unlock.is_paid:
        messages.success(request, f"You can now contact {unlock.agent.display_name}.")
        return redirect("agents:profile", agent_id=unlock.agent_id)

    try:
        data = verify_transaction(reference)
    except PaystackError:
        messages.error(request, "We couldn't confirm your payment yet. If you were charged, it will be applied shortly.")
        return redirect("agents:profile", agent_id=unlock.agent_id)

    if data.get("status") == "success":
        unlock.mark_paid(data.get("gateway_response", ""))
        messages.success(request, f"Payment received — you can now contact {unlock.agent.display_name}.")
    else:
        unlock.mark_failed(data.get("gateway_response", ""))
        messages.error(request, "Payment was not completed.")

    return redirect("agents:profile", agent_id=unlock.agent_id)


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
        unlock = ContactUnlock.objects.filter(reference=reference).first()
        if unlock and not unlock.is_paid:
            unlock.mark_paid(data.get("gateway_response", "webhook"))
            logger.info("Unlock %s marked paid via webhook.", reference)

    return HttpResponse(status=200)
