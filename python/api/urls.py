from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "api"

urlpatterns = [
    path("health/", views.health_view, name="health"),
    path("auth/phone/send/", views.phone_send_view, name="phone_send"),
    path("auth/phone/verify/", views.phone_verify_view, name="phone_verify"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.me_view, name="me"),
    path("areas/", views.areas_view, name="areas"),
    path("agents/search/", views.agent_search_view, name="agent_search"),
    path("agents/<uuid:agent_id>/", views.agent_detail_view, name="agent_detail"),
    path("payments/plans/", views.payment_plans_view, name="payment_plans"),
    path("payments/unlock/", views.payment_unlock_view, name="payment_unlock"),
    path("payments/confirm/", views.payment_confirm_view, name="payment_confirm"),
]
