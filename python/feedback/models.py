import secrets
import uuid

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    phone = models.CharField(max_length=20)
    display_name = models.CharField(max_length=120, blank=True, null=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    going_well = models.TextField(blank=True)
    platform_helpful = models.BooleanField(null=True, blank=True)
    improvement = models.TextField(blank=True)
    is_approved = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    sms_sent_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @classmethod
    def generate_token(cls) -> str:
        return secrets.token_urlsafe(32)

    @property
    def is_submitted(self) -> bool:
        return self.submitted_at is not None
