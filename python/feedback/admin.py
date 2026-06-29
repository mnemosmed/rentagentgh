from django.contrib import admin

from .models import UserFeedback


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    list_display = ("display_name", "phone", "rating", "is_approved", "is_published", "submitted_at")
    list_filter = ("is_approved", "is_published")
    search_fields = ("phone", "display_name", "token")
