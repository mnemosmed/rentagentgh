from datetime import timedelta

from django import template
from django.utils import timezone

register = template.Library()


@register.filter
def initials(name):
    if not name:
        return "?"
    parts = str(name).split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    word = parts[0]
    return (word[:2] if len(word) >= 2 else word[0]).upper()


@register.filter
def avatar_hue(name):
    if not name:
        return 258
    return sum(ord(c) for c in str(name)) % 360


@register.filter
def chat_list_time(value):
    if not value:
        return ""
    now = timezone.localtime(timezone.now())
    dt = timezone.localtime(value)
    if dt.date() == now.date():
        return dt.strftime("%I:%M %p").lstrip("0")
    if dt.date() == (now - timedelta(days=1)).date():
        return "Yesterday"
    if (now.date() - dt.date()).days < 7:
        return dt.strftime("%a")
    return dt.strftime("%d/%m/%y")


@register.filter
def chat_bubble_time(value):
    if not value:
        return ""
    return timezone.localtime(value).strftime("%I:%M %p").lstrip("0")


@register.filter
def chat_date_label(value):
    if not value:
        return ""
    now = timezone.localtime(timezone.now())
    dt = timezone.localtime(value)
    if dt.date() == now.date():
        return "Today"
    if dt.date() == (now - timedelta(days=1)).date():
        return "Yesterday"
    return dt.strftime("%B %d, %Y")


@register.filter
def star_count(value):
    try:
        return max(0, min(5, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0
