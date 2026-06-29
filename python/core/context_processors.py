from django.conf import settings
from django.utils import timezone


def site_context(request):
    return {
        "SITE_NAME": settings.SITE_NAME,
        "SITE_URL": settings.SITE_URL,
    }


def unread_messages(request):
    count = 0
    if request.user.is_authenticated:
        from messaging.services import total_unread_for_user

        count = total_unread_for_user(request.user)
    return {"unread_message_count": count}
