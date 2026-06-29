from django.shortcuts import render
from django.urls import reverse

from agents.areas import get_all_areas
from feedback.models import UserFeedback


def home_view(request):
    testimonials = UserFeedback.objects.filter(is_published=True, rating__gte=4).order_by("-submitted_at")[:6]
    return render(
        request,
        "core/home.html",
        {
            "testimonials": testimonials,
            "all_areas": get_all_areas(),
            "search_action": reverse("agents:search"),
        },
    )
