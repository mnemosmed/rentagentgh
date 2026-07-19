from django.contrib import admin

from .models import AccessPass, ContactUnlock


@admin.register(AccessPass)
class AccessPassAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "user",
        "plan",
        "status",
        "amount_display",
        "paid_at",
        "expires_at",
        "created_at",
    )
    list_filter = ("plan", "status", "currency", "created_at")
    search_fields = ("reference", "user__username", "email")
    readonly_fields = ("created_at", "updated_at", "paid_at")
    raw_id_fields = ("user",)


@admin.register(ContactUnlock)
class ContactUnlockAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "user",
        "agent",
        "status",
        "amount",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "currency", "created_at")
    search_fields = ("reference", "user__username", "agent__display_name", "email")
    readonly_fields = ("created_at", "updated_at", "paid_at")
    raw_id_fields = ("user", "agent")
