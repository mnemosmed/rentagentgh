from django.contrib import admin

from .models import ContactUnlock


@admin.register(ContactUnlock)
class ContactUnlockAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "user",
        "agent",
        "status",
        "amount_display",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "currency", "created_at")
    search_fields = ("reference", "user__username", "agent__display_name", "email")
    readonly_fields = ("created_at", "updated_at", "paid_at")
    raw_id_fields = ("user", "agent")
