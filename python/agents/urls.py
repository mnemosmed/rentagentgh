from django.urls import path

from .views import (
    agent_auth_view,
    agent_dashboard_view,
    agent_profile_view,
    contact_agent_view,
    search_view,
)

app_name = "agents"

urlpatterns = [
    path("search/", search_view, name="search"),
    path("<uuid:agent_id>/", agent_profile_view, name="profile"),
    path("<uuid:agent_id>/contact/", contact_agent_view, name="contact"),
    path("auth/", agent_auth_view, name="auth"),
    path("dashboard/", agent_dashboard_view, name="dashboard"),
]
