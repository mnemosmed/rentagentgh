from django import forms

from core.forms import style_form_fields

from .models import Agent, AgentRating

PROPERTY_TYPES = [
    ("Studio", "Studio"),
    ("1-bedroom", "1-bedroom"),
    ("2-bedroom", "2-bedroom"),
    ("3-bedroom", "3-bedroom"),
    ("4+ bedroom", "4+ bedroom"),
    ("Single room", "Single room"),
    ("Chamber and hall", "Chamber and hall"),
    ("Self-contained", "Self-contained"),
    ("House", "House"),
    ("Other", "Other"),
]

MOVE_IN_OPTIONS = [
    ("Immediately", "Immediately"),
    ("Within 2 weeks", "Within 2 weeks"),
    ("Next month", "Next month"),
    ("In 2-3 months", "In 2–3 months"),
    ("Flexible", "Flexible"),
]


class AgentSearchForm(forms.Form):
    area = forms.CharField(max_length=120, required=False)


class ContactAgentForm(forms.Form):
    property_type = forms.ChoiceField(choices=PROPERTY_TYPES, label="Property type")
    location = forms.CharField(
        max_length=200,
        widget=forms.TextInput(attrs={"placeholder": "e.g. East Legon"}),
    )
    budget_min = forms.IntegerField(
        required=False,
        min_value=0,
        label="Budget min (GHS)",
        widget=forms.NumberInput(attrs={"placeholder": "2000", "min": 0}),
    )
    budget_max = forms.IntegerField(
        required=False,
        min_value=0,
        label="Budget max (GHS)",
        widget=forms.NumberInput(attrs={"placeholder": "5000", "min": 0}),
    )
    move_in = forms.ChoiceField(choices=MOVE_IN_OPTIONS, label="Move-in date")
    preferences = forms.CharField(
        label="Other preferences (optional)",
        required=False,
        widget=forms.Textarea(
            attrs={
                "rows": 3,
                "placeholder": "Furnished, parking, pets, etc.",
            }
        ),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        style_form_fields(self)


class AgentProfileForm(forms.ModelForm):
    covered_areas_text = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="One area per line",
        required=False,
    )

    class Meta:
        model = Agent
        fields = (
            "display_name",
            "short_bio",
            "phone",
            "whatsapp",
            "primary_area",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.covered_areas:
            self.fields["covered_areas_text"].initial = "\n".join(self.instance.covered_areas)
        style_form_fields(self)

    def save(self, commit=True):
        agent = super().save(commit=False)
        text = self.cleaned_data.get("covered_areas_text", "")
        agent.covered_areas = [a.strip() for a in text.splitlines() if a.strip()]
        if commit:
            agent.save()
        return agent


class AgentClaimForm(forms.Form):
    display_name = forms.CharField(
        max_length=200,
        label="Agent / business name",
        widget=forms.TextInput(attrs={"placeholder": "As listed on RentAgentGhana"}),
    )
    primary_area = forms.CharField(
        max_length=120,
        required=False,
        label="Primary area (optional)",
        widget=forms.TextInput(attrs={"placeholder": "e.g. East Legon"}),
    )
    phone = forms.CharField(
        max_length=20,
        label="Phone number",
        widget=forms.TextInput(attrs={"placeholder": "+233..."}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        style_form_fields(self)


class AgentRatingForm(forms.ModelForm):
    class Meta:
        model = AgentRating
        fields = ("helpfulness", "responsiveness", "trustworthiness", "comment")
        labels = {
            "helpfulness": "Helpfulness",
            "responsiveness": "Responsiveness",
            "trustworthiness": "Trustworthiness",
        }
        widgets = {
            "comment": forms.Textarea(
                attrs={"rows": 3, "class": "textarea", "placeholder": "Optional review"}
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["comment"].widget.attrs.setdefault("class", "textarea")
