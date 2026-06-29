from django.contrib import admin

from .models import ContactTemplate, PhoneOTP, Profile, Role


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "phone")
    search_fields = ("display_name", "user__email", "phone")


admin.site.register(Role)
admin.site.register(PhoneOTP)


@admin.register(ContactTemplate)
class ContactTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "property_type", "location", "updated_at")
    search_fields = ("name", "user__email", "location")
