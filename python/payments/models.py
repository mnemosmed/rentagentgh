import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class ContactUnlock(models.Model):
    """A renter's paid access to contact a specific agent.

    Renters pay a small Paystack fee to unlock the ability to send a rental
    request to an agent and see the agent's phone / WhatsApp. Once ``status``
    is ``paid`` the unlock is permanent for that (user, agent) pair.
    """

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="contact_unlocks"
    )
    agent = models.ForeignKey(
        "agents.Agent", on_delete=models.CASCADE, related_name="contact_unlocks"
    )
    reference = models.CharField(max_length=64, unique=True, db_index=True)
    email = models.EmailField(blank=True)
    amount = models.PositiveIntegerField(
        help_text="Charged amount in the smallest currency unit (pesewas)."
    )
    currency = models.CharField(max_length=3, default="GHS")
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    gateway_response = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "agent", "status"]),
        ]

    def __str__(self):
        return f"{self.user_id} → {self.agent_id} [{self.status}]"

    @property
    def is_paid(self) -> bool:
        return self.status == self.STATUS_PAID

    @property
    def amount_display(self) -> str:
        return f"{self.currency} {self.amount / 100:.2f}"

    def mark_paid(self, gateway_response: str = "") -> None:
        if self.status != self.STATUS_PAID:
            self.status = self.STATUS_PAID
            self.paid_at = timezone.now()
            if gateway_response:
                self.gateway_response = gateway_response[:255]
            self.save(
                update_fields=["status", "paid_at", "gateway_response", "updated_at"]
            )

    def mark_failed(self, gateway_response: str = "") -> None:
        if self.status == self.STATUS_PENDING:
            self.status = self.STATUS_FAILED
            if gateway_response:
                self.gateway_response = gateway_response[:255]
            self.save(update_fields=["status", "gateway_response", "updated_at"])
