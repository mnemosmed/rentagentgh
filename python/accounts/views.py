from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.views import PasswordResetConfirmView
from django.contrib import messages
from django.core.mail import send_mail
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.http import require_http_methods

from accounts.models import PhoneOTP, Role, UserRole, ContactTemplate, normalize_phone
from accounts.arkesel import SMSError
from accounts.services import send_otp_sms
from .forms import (
    LoginForm,
    OtpVerifyForm,
    PhoneForm,
    ProfileForm,
    PasswordResetRequestForm,
    SetPasswordForm,
    SignUpForm,
)


def _ensure_renter_role(user: User):
    Role.objects.get_or_create(user=user, role=UserRole.RENTER)


@require_http_methods(["GET", "POST"])
def signup_view(request):
    if request.user.is_authenticated:
        return redirect("core:home")
    form = SignUpForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        _ensure_renter_role(user)
        if user.first_name:
            user.profile.display_name = user.first_name
            user.profile.save()
        messages.success(request, "Account created. You can sign in now.")
        return redirect("accounts:login")
    return render(request, "accounts/signup.html", {"form": form})


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect(request.GET.get("next") or "core:home")
    form = LoginForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        from django.contrib.auth import login

        login(request, form.get_user())
        return redirect(request.GET.get("next") or request.POST.get("next") or "core:home")
    return render(request, "accounts/login.html", {"form": form, "next": request.GET.get("next", "")})


def logout_view(request):
    from django.contrib.auth import logout

    logout(request)
    return redirect("core:home")


@require_http_methods(["GET", "POST"])
def phone_auth_view(request):
    step = request.session.get("phone_auth_step", "phone")
    if request.method == "POST":
        action = request.POST.get("action", "send")
        if action == "send":
            form = PhoneForm(request.POST)
            if form.is_valid():
                phone = normalize_phone(form.cleaned_data["phone"])
                otp = PhoneOTP.create_for_phone(phone)
                try:
                    send_otp_sms(phone, otp.otp_code)
                except SMSError:
                    messages.error(request, "Could not send SMS. Check your number and try again.")
                    return redirect("accounts:phone_auth")
                request.session["phone_auth_phone"] = phone
                request.session["phone_auth_first_name"] = form.cleaned_data.get("first_name", "")
                request.session["phone_auth_step"] = "verify"
                messages.info(request, "Verification code sent.")
                return redirect("accounts:phone_auth")
        elif action == "verify":
            form = OtpVerifyForm(request.POST)
            if form.is_valid():
                phone = normalize_phone(form.cleaned_data["phone"])
                record = PhoneOTP.objects.filter(phone=phone, verified=False).order_by("-created_at").first()
                if not record or not record.is_valid(form.cleaned_data["otp"]):
                    messages.error(request, "Invalid or expired code.")
                else:
                    record.verified = True
                    record.save()
                    user, created = User.objects.get_or_create(
                        username=phone,
                        defaults={"first_name": request.session.get("phone_auth_first_name", "")},
                    )
                    if created:
                        user.set_unusable_password()
                        user.save()
                        _ensure_renter_role(user)
                    user.profile.phone = phone
                    if user.first_name:
                        user.profile.display_name = user.first_name
                    user.profile.save()
                    from django.contrib.auth import login

                    login(request, user)
                    for key in ("phone_auth_step", "phone_auth_phone", "phone_auth_first_name"):
                        request.session.pop(key, None)
                    return redirect(request.GET.get("next") or "core:home")
    else:
        form = PhoneForm(initial={"phone": request.session.get("phone_auth_phone", "")})
        if step == "verify":
            form = OtpVerifyForm(initial={"phone": request.session.get("phone_auth_phone", "")})

    return render(
        request,
        "accounts/phone_auth.html",
        {
            "step": request.session.get("phone_auth_step", "phone"),
            "phone": request.session.get("phone_auth_phone", ""),
            "phone_form": PhoneForm(),
            "otp_form": OtpVerifyForm(initial={"phone": request.session.get("phone_auth_phone", "")}),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def profile_view(request):
    profile = request.user.profile
    form = ProfileForm(request.POST or None, instance=request.user, profile=profile)
    password_form = SetPasswordForm(request.user, request.POST or None)
    if request.method == "POST":
        action = request.POST.get("action", "profile")
        if action == "profile" and form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect("accounts:profile")
        if action == "password" and password_form.is_valid():
            password_form.save()
            from django.contrib.auth import update_session_auth_hash

            update_session_auth_hash(request, password_form.user)
            messages.success(request, "Password updated.")
            return redirect("accounts:profile")
        if action == "delete_template":
            template = ContactTemplate.objects.filter(
                user=request.user, pk=request.POST.get("template_id")
            ).first()
            if template:
                name = template.name
                template.delete()
                messages.success(request, f"Template “{name}” deleted.")
            return redirect("accounts:profile")
    contact_templates = ContactTemplate.objects.filter(user=request.user).order_by("-updated_at")
    return render(
        request,
        "accounts/profile.html",
        {
            "form": form,
            "password_form": password_form,
            "contact_templates": contact_templates,
        },
    )


@require_http_methods(["GET", "POST"])
def password_reset_request(request):
    form = PasswordResetRequestForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"]
        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = request.build_absolute_uri(
                reverse("accounts:password_reset_confirm", kwargs={"uidb64": uid, "token": token})
            )
            send_mail(
                "Reset your RentAgentGhana password",
                f"Use this link to reset your password:\n\n{reset_url}",
                None,
                [email],
                fail_silently=True,
            )
        messages.info(request, "If an account exists for that email, a reset link was sent.")
        return redirect("accounts:login")
    return render(request, "accounts/password_reset.html", {"form": form})


class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = "accounts/password_reset_confirm.html"
    success_url = "/accounts/login/"
