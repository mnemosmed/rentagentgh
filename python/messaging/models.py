import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    agent = models.ForeignKey("agents.Agent", on_delete=models.CASCADE, related_name="conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    agent_notified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time the agent was SMS-notified about this conversation.",
    )

    class Meta:
        unique_together = [("user", "agent")]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user_id} ↔ {self.agent.display_name}"

    def unread_count_for(self, user: User) -> int:
        return self.messages.filter(is_read=False).exclude(sender=user).count()

    def last_message(self):
        return self.messages.order_by("-created_at").first()


class Message(models.Model):
    MEDIA_IMAGE = "image"
    MEDIA_VIDEO = "video"
    MEDIA_FILE = "file"
    MEDIA_CHOICES = [
        (MEDIA_IMAGE, "Image"),
        (MEDIA_VIDEO, "Video"),
        (MEDIA_FILE, "File"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    content = models.TextField(max_length=settings.MAX_MESSAGE_LENGTH)
    is_read = models.BooleanField(default=False)
    media_file = models.FileField(upload_to="chat-media/%Y/%m/", blank=True, null=True)
    media_type = models.CharField(max_length=20, blank=True, choices=MEDIA_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender_id}: {self.content[:40]}"
