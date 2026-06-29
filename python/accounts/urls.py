from django.urls import path

from .views import (
    CustomPasswordResetConfirmView,
    login_view,
    logout_view,
    password_reset_request,
    phone_auth_view,
    profile_view,
    signup_view,
)

app_name = "accounts"

urlpatterns = [
    path("signup/", signup_view, name="signup"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("phone/", phone_auth_view, name="phone_auth"),
    path("profile/", profile_view, name="profile"),
    path("password-reset/", password_reset_request, name="password_reset"),
    path(
        "reset/<uidb64>/<token>/",
        CustomPasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]
