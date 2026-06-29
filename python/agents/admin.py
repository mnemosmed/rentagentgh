from django.contrib import admin

from .models import Agent, AgentAccessToken, AgentRating


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ("display_name", "primary_area", "is_verified", "claimed_by")
    search_fields = ("display_name", "primary_area", "tiktok_handle")
    list_filter = ("is_verified", "primary_area")


admin.site.register(AgentRating)
admin.site.register(AgentAccessToken)
