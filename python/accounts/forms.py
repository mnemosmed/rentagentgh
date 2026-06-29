from django import forms
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm, UserCreationForm
from django.contrib.auth.models import User

from core.forms import style_form_fields


class SignUpForm(UserCreationForm):
    first_name = forms.CharField(max_length=120, required=False)
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("email", "first_name", "password1", "password2")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        style_form_fields(self)

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = self.cleaned_data["email"]
        user.email = self.cleaned_data["email"]
        user.first_name = self.cleaned_data.get("first_name", "")
        if commit:
            user.save()
        return user


class LoginForm(AuthenticationForm):
    username = forms.EmailField(label="Email")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        style_form_fields(self)

    def clean(self):
        email = self.cleaned_data.get("username")
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user:
                self.cleaned_data["username"] = user.username
        return super().clean()


class PhoneForm(forms.Form):
    phone = forms.CharField(max_length=20, widget=forms.TextInput(attrs={"placeholder": "+233..."}))
    first_name = forms.CharField(max_length=120, required=False)


class OtpVerifyForm(forms.Form):
    phone = forms.CharField(max_length=20, widget=forms.HiddenInput())
    otp = forms.CharField(max_length=6, min_length=6)


class ProfileForm(forms.ModelForm):
    display_name = forms.CharField(
        max_length=120,
        required=False,
        label="Display name",
        widget=forms.TextInput(attrs={"placeholder": "How agents see you"}),
    )
    phone = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "+233 XX XXX XXXX"}),
    )

    class Meta:
        model = User
        fields = ("first_name", "email")
        labels = {"first_name": "First name", "email": "Email address"}
        widgets = {
            "first_name": forms.TextInput(attrs={"placeholder": "Your first name"}),
            "email": forms.EmailInput(attrs={"placeholder": "you@example.com"}),
        }

    def __init__(self, *args, **kwargs):
        self.profile = kwargs.pop("profile")
        super().__init__(*args, **kwargs)
        self.fields["display_name"].initial = self.profile.display_name
        self.fields["phone"].initial = self.profile.phone
        style_form_fields(self)

    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            self.profile.display_name = self.cleaned_data["display_name"]
            self.profile.phone = self.cleaned_data["phone"]
            self.profile.save()
        return user


class PasswordResetRequestForm(forms.Form):
    email = forms.EmailField()


class SetPasswordForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        style_form_fields(self)
        self.fields["old_password"].widget.attrs.setdefault("placeholder", "Current password")
        self.fields["new_password1"].widget.attrs.setdefault("placeholder", "New password")
        self.fields["new_password2"].widget.attrs.setdefault("placeholder", "Confirm new password")
