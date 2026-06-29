from django import forms


class FeedbackSubmitForm(forms.Form):
    rating = forms.IntegerField(min_value=1, max_value=5)
    going_well = forms.CharField(widget=forms.Textarea, required=False)
    platform_helpful = forms.BooleanField(required=True)
    improvement = forms.CharField(widget=forms.Textarea, required=False)


class SiteFeedbackForm(forms.Form):
    message = forms.CharField(widget=forms.Textarea(attrs={"rows": 4}))
    email = forms.EmailField(required=False)
