import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class AccessPass(models.Model):
    """Time-limited renter access to all agent contacts and messaging.

    Weekly = 7 days, monthly = 30 days. Renewals stack from the later of
    now or the user's current ``expires_at``.
    """

    PLAN_WEEKLY = "weekly"
    PLAN_MONTHLY = "monthly"
    PLAN_CHOICES = [
        (PLAN_WEEKLY, "Weekly"),
        (PLAN_MONTHLY, "Monthly"),
    ]
    PLAN_DURATION_DAYS = {
        PLAN_WEEKLY: 7,
        PLAN_MONTHLY: 30,
    }

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
        User, on_delete=models.CASCADE, related_name="access_passes"
    )
    plan = models.CharField(max_length=10, choices=PLAN_CHOICES)
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
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status", "expires_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.plan} [{self.status}]"

    @property
    def is_paid(self) -> bool:
        return self.status == self.STATUS_PAID

    @property
    def is_active(self) -> bool:
        return (
            self.status == self.STATUS_PAID
            and self.expires_at is not None
            and self.expires_at > timezone.now()
        )

    @property
    def amount_display(self) -> str:
        return f"{self.currency} {self.amount / 100:.2f}"

    @property
    def duration_days(self) -> int:
        return self.PLAN_DURATION_DAYS.get(self.plan, 7)

    def mark_paid(self, gateway_response: str = "") -> None:
        if self.status == self.STATUS_PAID and self.expires_at:
            return

        now = timezone.now()
        base = now
        existing = (
            AccessPass.objects.filter(
                user_id=self.user_id,
                status=self.STATUS_PAID,
                expires_at__gt=now,
            )
            .exclude(pk=self.pk)
            .order_by("-expires_at")
            .first()
        )
        if existing and existing.expires_at:
            base = existing.expires_at

        self.status = self.STATUS_PAID
        self.paid_at = now
        self.expires_at = base + timedelta(days=self.duration_days)
        if gateway_response:
            self.gateway_response = gateway_response[:255]
        self.save(
            update_fields=[
                "status",
                "paid_at",
                "expires_at",
                "gateway_response",
                "updated_at",
            ]
        )

    def mark_failed(self, gateway_response: str = "") -> None:
        if self.status == self.STATUS_PENDING:
            self.status = self.STATUS_FAILED
            if gateway_response:
                self.gateway_response = gateway_response[:255]
            self.save(update_fields=["status", "gateway_response", "updated_at"])


class ContactUnlock(models.Model):
    """Legacy per-agent unlock. Kept for historical rows; unused for access."""

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
