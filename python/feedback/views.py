from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .forms import FeedbackSubmitForm, SiteFeedbackForm
from .models import UserFeedback


@require_http_methods(["GET", "POST"])
def feedback_form_view(request, token):
    feedback = get_object_or_404(UserFeedback, token=token)
    if feedback.is_submitted:
        return render(request, "feedback/submitted.html", {"feedback": feedback})

    if request.method == "POST":
        rating = int(request.POST.get("rating", 0))
        if rating < 1 or rating > 5:
            messages.error(request, "Please select a rating between 1 and 5.")
        elif "platform_helpful" not in request.POST:
            messages.error(request, "Please answer if RentAgent was helpful.")
        else:
            feedback.rating = rating
            feedback.going_well = request.POST.get("going_well", "").strip()
            feedback.platform_helpful = request.POST.get("platform_helpful") == "true"
            feedback.improvement = request.POST.get("improvement", "").strip()
            feedback.submitted_at = timezone.now()
            feedback.save()
            return render(request, "feedback/submitted.html", {"feedback": feedback})

    return render(request, "feedback/form.html", {"feedback": feedback})


@staff_member_required
def admin_feedback_list(request):
    items = UserFeedback.objects.filter(submitted_at__isnull=False).order_by("-submitted_at")
    if request.method == "POST":
        fid = request.POST.get("id")
        action = request.POST.get("action")
        item = get_object_or_404(UserFeedback, pk=fid)
        if action == "approve":
            item.is_approved = True
            item.is_published = True
            item.save()
            messages.success(request, "Feedback published.")
        elif action == "reject":
            item.is_approved = False
            item.is_published = False
            item.save()
            messages.info(request, "Feedback hidden.")
        return redirect("feedback:admin_list")
    return render(request, "feedback/admin_list.html", {"items": items})


@require_http_methods(["POST"])
def site_feedback_view(request):
    form = SiteFeedbackForm(request.POST)
    if form.is_valid():
        UserFeedback.objects.create(
            token=UserFeedback.generate_token(),
            phone=form.cleaned_data.get("email") or "anonymous",
            display_name=form.cleaned_data.get("email") or "Anonymous",
            going_well=form.cleaned_data["message"],
            submitted_at=timezone.now(),
            is_approved=False,
        )
        messages.success(request, "Thanks for your feedback!")
    else:
        messages.error(request, "Could not send feedback.")
    return redirect(request.META.get("HTTP_REFERER", "/"))
