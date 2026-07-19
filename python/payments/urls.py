from django.urls import path

from .views import (
    payment_callback_view,
    paystack_webhook_view,
    unlock_contact_view,
)

app_name = "payments"

urlpatterns = [
    path("unlock/<uuid:agent_id>/", unlock_contact_view, name="unlock"),
    path("callback/", payment_callback_view, name="callback"),
    path("webhook/", paystack_webhook_view, name="webhook"),
]
