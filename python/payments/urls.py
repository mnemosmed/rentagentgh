from django.urls import path

from .views import (
    payment_callback_view,
    paystack_webhook_view,
    unlock_access_view,
)

app_name = "payments"

urlpatterns = [
    path("unlock/", unlock_access_view, name="unlock"),
    path("callback/", payment_callback_view, name="callback"),
    path("webhook/", paystack_webhook_view, name="webhook"),
]
