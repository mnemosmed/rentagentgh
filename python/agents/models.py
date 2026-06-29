import uuid

from django.contrib.auth.models import User
from django.db import models
from django.db.models import Avg, Count


class Agent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=200)
    tiktok_handle = models.CharField(max_length=100)
    tiktok_profile_url = models.URLField(max_length=500)
    covered_areas = models.JSONField(default=list)
    primary_area = models.CharField(max_length=120)
    short_bio = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    is_verified = models.BooleanField(default=False)
    claimed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="claimed_agents",
    )
    last_sms_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self):
        return self.display_name

    @property
    def rating_stats(self):
        stats = self.ratings.aggregate(
            avg_helpfulness=Avg("helpfulness"),
            avg_responsiveness=Avg("responsiveness"),
            avg_trustworthiness=Avg("trustworthiness"),
            total_ratings=Count("id"),
        )
        if not stats["total_ratings"]:
            return {
                "overall_rating": None,
                "total_ratings": 0,
                "avg_helpfulness": None,
                "avg_responsiveness": None,
                "avg_trustworthiness": None,
            }
        overall = (
            stats["avg_helpfulness"]
            + stats["avg_responsiveness"]
            + stats["avg_trustworthiness"]
        ) / 3
        return {
            "overall_rating": round(overall, 1),
            "total_ratings": stats["total_ratings"],
            "avg_helpfulness": round(stats["avg_helpfulness"], 1),
            "avg_responsiveness": round(stats["avg_responsiveness"], 1),
            "avg_trustworthiness": round(stats["avg_trustworthiness"], 1),
        }

    def serves_area(self, area: str) -> bool:
        if not area:
            return False
        needle = area.lower()
        return any(needle in a.lower() for a in self.covered_areas)


class AgentRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="ratings")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="agent_ratings")
    helpfulness = models.PositiveSmallIntegerField()
    responsiveness = models.PositiveSmallIntegerField()
    trustworthiness = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("agent", "user")]

    @property
    def overall(self):
        return round((self.helpfulness + self.responsiveness + self.trustworthiness) / 3, 1)


class AgentAccessToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="access_tokens")
    conversation = models.ForeignKey(
        "messaging.Conversation",
        on_delete=models.CASCADE,
        related_name="agent_tokens",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
