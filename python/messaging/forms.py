import os

from django import forms
from django.conf import settings
from django.core.exceptions import ValidationError

ALLOWED_MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".mp4", ".mov", ".webm", ".mkv"}


def validate_chat_media(file_obj):
    if file_obj.size > settings.MAX_CHAT_MEDIA_BYTES:
        raise ValidationError("File must be 25 MB or smaller.")
    content_type = getattr(file_obj, "content_type", "") or ""
    if content_type.startswith("image/") or content_type.startswith("video/"):
        return
    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_MEDIA_EXTENSIONS:
        raise ValidationError("Only photos and videos are allowed.")


class MessageForm(forms.Form):
    content = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 2, "placeholder": "Type a message..."}),
        required=False,
        max_length=settings.MAX_MESSAGE_LENGTH,
    )
    media_file = forms.FileField(required=False, validators=[validate_chat_media])
