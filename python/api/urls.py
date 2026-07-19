from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import phase2_views, views

app_name = "api"

urlpatterns = [
    path("health/", views.health_view, name="health"),
    path("auth/phone/send/", views.phone_send_view, name="phone_send"),
    path("auth/phone/verify/", views.phone_verify_view, name="phone_verify"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.me_view, name="me"),
    path("me/unread-count/", phase2_views.unread_count_view, name="unread_count"),
    path("areas/", views.areas_view, name="areas"),
    path("agents/search/", views.agent_search_view, name="agent_search"),
    path("agents/me/", phase2_views.agent_me_view, name="agent_me"),
    path("agents/claim/start/", phase2_views.claim_start_view, name="claim_start"),
    path("agents/claim/verify/", phase2_views.claim_verify_view, name="claim_verify"),
    path("agents/<uuid:agent_id>/", views.agent_detail_view, name="agent_detail"),
    path("agents/<uuid:agent_id>/contact/", phase2_views.contact_agent_view, name="agent_contact"),
    path("agents/<uuid:agent_id>/ratings/", phase2_views.rate_agent_view, name="agent_rate"),
    path("conversations/", phase2_views.conversations_view, name="conversations"),
    path(
        "conversations/<uuid:conversation_id>/",
        phase2_views.conversation_detail_view,
        name="conversation_detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        phase2_views.send_message_view,
        name="conversation_send",
    ),
    path("payments/plans/", views.payment_plans_view, name="payment_plans"),
    path("payments/unlock/", views.payment_unlock_view, name="payment_unlock"),
    path("payments/confirm/", views.payment_confirm_view, name="payment_confirm"),
]
