import json
import secrets
import string
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from accounts.phone_utils import normalize_phone


class UserRole(models.TextChoices):
    RENTER = "renter", "Renter"
    AGENT = "agent", "Agent"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=20, blank=True)
    display_name = models.CharField(max_length=120, blank=True)
    last_sms_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.display_name or self.user.get_username()


class Role(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=20, choices=UserRole.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "role")]

    def __str__(self):
        return f"{self.user_id}:{self.role}"


class PhoneOTP(models.Model):
    phone = models.CharField(max_length=20, db_index=True)
    otp_code = models.CharField(max_length=6)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    @classmethod
    def generate_code(cls, length=6):
        return "".join(secrets.choice(string.digits) for _ in range(length))

    @classmethod
    def create_for_phone(cls, phone: str):
        cls.objects.filter(phone=phone, verified=False).delete()
        code = cls.generate_code()
        return cls.objects.create(
            phone=phone,
            otp_code=code,
            expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        )

    def is_valid(self, code: str) -> bool:
        return (
            not self.verified
            and self.otp_code == code
            and timezone.now() <= self.expires_at
        )


class ContactTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contact_templates")
    name = models.CharField(max_length=80)
    property_type = models.CharField(max_length=40)
    location = models.CharField(max_length=200)
    budget_min = models.PositiveIntegerField(null=True, blank=True)
    budget_max = models.PositiveIntegerField(null=True, blank=True)
    move_in = models.CharField(max_length=40)
    preferences = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        unique_together = [("user", "name")]

    def __str__(self):
        return self.name

    def to_form_initial(self) -> dict:
        return {
            "property_type": self.property_type,
            "location": self.location,
            "budget_min": self.budget_min,
            "budget_max": self.budget_max,
            "move_in": self.move_in,
            "preferences": self.preferences,
        }

    def form_data_json(self) -> str:
        data = self.to_form_initial()
        data["budget_min"] = data["budget_min"] if data["budget_min"] is not None else ""
        data["budget_max"] = data["budget_max"] if data["budget_max"] is not None else ""
        return json.dumps(data)


__all__ = ["UserRole", "Profile", "Role", "PhoneOTP", "ContactTemplate", "normalize_phone"]
