from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods

from payments.services import (
    access_expires_at,
    has_contact_access,
    plan_choices_for_template,
)

from accounts.models import PhoneOTP, Role, UserRole, ContactTemplate, normalize_phone
from accounts.arkesel import SMSError
from accounts.services import send_otp_sms
from messaging.forms import MessageForm
from messaging.models import Conversation, Message
from messaging.notifications import notify_agent_new_inquiry
from messaging.services import build_agent_conversations, clear_all_unread_dividers
from messaging.views import _chat_peer_context, _conversation_chat_context

from .areas import get_all_areas
from .dedupe import unique_agents_by_name
from .forms import (
    AgentClaimForm,
    AgentProfileForm,
    AgentRatingForm,
    AgentSearchForm,
    ContactAgentForm,
)
from .models import Agent, AgentRating


def _contact_form_initial(request, agent) -> dict:
    initial = {"location": agent.primary_area}
    if not request.user.is_authenticated:
        return initial
    template_id = request.GET.get("template")
    if template_id:
        template = ContactTemplate.objects.filter(user=request.user, pk=template_id).first()
        if template:
            return template.to_form_initial()
    return initial


def _save_contact_template(user, name: str, form: ContactAgentForm):
    data = form.cleaned_data
    ContactTemplate.objects.update_or_create(
        user=user,
        name=name,
        defaults={
            "property_type": data["property_type"],
            "location": data["location"],
            "budget_min": data.get("budget_min"),
            "budget_max": data.get("budget_max"),
            "move_in": data["move_in"],
            "preferences": data.get("preferences") or "",
        },
    )


def _sorted_agents(queryset):
    agents = list(queryset)
    agents.sort(
        key=lambda a: (
            -(a.rating_stats["overall_rating"] or -1),
            -(a.rating_stats["total_ratings"] or 0),
            a.display_name.lower(),
        )
    )
    return unique_agents_by_name(agents)


@require_http_methods(["GET"])
def search_view(request):
    form = AgentSearchForm(request.GET or None)
    area = form.data.get("area", "").strip() if form.is_valid() else request.GET.get("area", "").strip()

    if area and not request.user.is_authenticated:
        return redirect(f"{reverse('accounts:login')}?next={request.get_full_path()}")

    agents = []
    if area and request.user.is_authenticated:
        agents = _sorted_agents([a for a in Agent.objects.all() if a.serves_area(area)])

    contacted_ids = set()
    if request.user.is_authenticated:
        contacted_ids = set(
            Conversation.objects.filter(user=request.user).values_list("agent_id", flat=True)
        )

    return render(
        request,
        "agents/search.html",
        {
            "form": form,
            "area": area,
            "agents": agents,
            "all_areas": get_all_areas(),
            "contacted_ids": contacted_ids,
        },
    )


@require_http_methods(["GET", "POST"])
def agent_profile_view(request, agent_id):
    agent = get_object_or_404(Agent, pk=agent_id)
    is_owner = request.user.is_authenticated and agent.claimed_by_id == request.user.id
    contact_unlocked = has_contact_access(request.user, agent)
    rating_stats = agent.rating_stats
    user_rating = None
    if request.user.is_authenticated:
        user_rating = AgentRating.objects.filter(agent=agent, user=request.user).first()

    edit_form = None
    if is_owner and request.method == "POST" and request.POST.get("action") == "edit":
        edit_form = AgentProfileForm(request.POST, instance=agent)
        if edit_form.is_valid():
            edit_form.save()
            messages.success(request, "Profile updated.")
            return redirect("agents:profile", agent_id=agent.id)
    elif is_owner:
        edit_form = AgentProfileForm(instance=agent)

    rating_form = AgentRatingForm()
    show_save_template_panel = False
    contact_form = None
    if request.method == "POST" and request.user.is_authenticated:
        action = request.POST.get("action")
        if action == "rate":
            rating_form = AgentRatingForm(request.POST)
            if rating_form.is_valid():
                AgentRating.objects.update_or_create(
                    agent=agent,
                    user=request.user,
                    defaults=rating_form.cleaned_data,
                )
                messages.success(request, "Thank you for your rating!")
                return redirect("agents:profile", agent_id=agent.id)
        elif action == "save_template" and not is_owner:
            contact_form = ContactAgentForm(request.POST)
            template_name = request.POST.get("template_name", "").strip()
            if not template_name:
                messages.error(request, "Enter a name for your template.")
            elif contact_form.is_valid():
                _save_contact_template(request.user, template_name, contact_form)
                messages.success(request, f"Template “{template_name}” saved.")
                return redirect("agents:profile", agent_id=agent.id)
            else:
                messages.error(request, "Fix the form errors before saving a template.")
        elif action == "delete_template" and not is_owner:
            template = ContactTemplate.objects.filter(
                user=request.user, pk=request.POST.get("template_id")
            ).first()
            if template:
                name = template.name
                template.delete()
                messages.success(request, f"Template “{name}” deleted.")
            return redirect("agents:profile", agent_id=agent.id)

    if contact_form is None:
        contact_form = ContactAgentForm(initial=_contact_form_initial(request, agent))
    show_save_template_panel = (
        request.method == "POST"
        and request.POST.get("action") == "save_template"
        and not is_owner
    )
    contact_templates = []
    if request.user.is_authenticated and not is_owner:
        contact_templates = list(
            ContactTemplate.objects.filter(user=request.user).order_by("-updated_at")
        )

    return render(
        request,
        "agents/profile.html",
        {
            "agent": agent,
            "rating_stats": rating_stats,
            "is_owner": is_owner,
            "edit_form": edit_form,
            "rating_form": rating_form,
            "user_rating": user_rating,
            "contact_form": contact_form,
            "contact_templates": contact_templates,
            "show_save_template_panel": show_save_template_panel,
            "contact_unlocked": contact_unlocked,
            "access_plans": plan_choices_for_template(),
            "access_expires_at": access_expires_at(request.user),
            "reviews": agent.ratings.select_related("user").order_by("-created_at")[:20],
        },
    )


@login_required
@require_http_methods(["POST"])
def contact_agent_view(request, agent_id):
    agent = get_object_or_404(Agent, pk=agent_id)
    if not has_contact_access(request.user, agent):
        messages.error(
            request,
            "Get weekly or monthly access to contact agents and send messages.",
        )
        return redirect("agents:profile", agent_id=agent.id)
    form = ContactAgentForm(request.POST)
    if form.is_valid():
        conversation, _ = Conversation.objects.get_or_create(user=request.user, agent=agent)
        data = form.cleaned_data
        lines = [
            "New rental request:",
            f"Property type: {data['property_type']}",
            f"Location: {data['location']}",
        ]
        if data.get("budget_min") or data.get("budget_max"):
            lines.append(f"Budget: GHS {data.get('budget_min') or '?'} – {data.get('budget_max') or '?'}")
        lines.append(f"Move-in: {data['move_in']}")
        if data.get("preferences"):
            lines.append(f"Notes: {data['preferences']}")
        Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content="\n".join(lines),
        )
        conversation.save()
        notify_agent_new_inquiry(conversation, request.user)
        messages.success(request, f"Message sent to {agent.display_name}.")
        return redirect("messaging:conversation", conversation_id=conversation.id)
    messages.error(request, "Please check your request details.")
    return redirect("agents:profile", agent_id=agent.id)


@require_http_methods(["GET", "POST"])
def agent_auth_view(request):
    if request.user.is_authenticated:
        claimed = Agent.objects.filter(claimed_by=request.user).first()
        if claimed:
            return redirect("agents:dashboard")

    form = AgentClaimForm(request.POST or None)
    verify_step = request.session.get("agent_claim_step", "search")
    agent_id = request.session.get("agent_claim_id")

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "search" and form.is_valid():
            name = form.cleaned_data["display_name"].strip()
            area = form.cleaned_data.get("primary_area", "").strip()
            qs = Agent.objects.filter(display_name__iexact=name)
            if area:
                qs = qs.filter(primary_area__iexact=area)
            agent = qs.first()
            if not agent:
                messages.error(request, "No agent profile found with that name. Check spelling or add your area.")
            elif agent.claimed_by_id:
                messages.error(request, "This profile has already been claimed.")
            else:
                request.session["agent_claim_id"] = str(agent.id)
                request.session["agent_claim_step"] = "verify"
                phone = normalize_phone(form.cleaned_data["phone"])
                otp = PhoneOTP.create_for_phone(phone)
                try:
                    send_otp_sms(phone, otp.otp_code)
                except SMSError:
                    messages.error(request, "Could not send verification SMS. Try again later.")
                    return redirect("agents:auth")
                request.session["agent_claim_phone"] = phone
                messages.info(request, "Verification code sent to your phone.")
                return redirect("agents:auth")
        elif action == "verify":
            code = request.POST.get("otp", "")
            phone = request.session.get("agent_claim_phone")
            agent = Agent.objects.filter(pk=agent_id).first() if agent_id else None
            record = PhoneOTP.objects.filter(phone=phone, verified=False).order_by("-created_at").first()
            if not agent or not record or not record.is_valid(code):
                messages.error(request, "Invalid verification.")
            else:
                record.verified = True
                record.save()
                if not request.user.is_authenticated:
                    user, _ = User.objects.get_or_create(
                        username=phone, defaults={"first_name": agent.display_name}
                    )
                    if not user.has_usable_password():
                        user.set_unusable_password()
                        user.save()
                    from django.contrib.auth import login

                    login(request, user)
                agent.claimed_by = request.user
                agent.phone = phone
                agent.is_verified = True
                agent.save()
                Role.objects.get_or_create(user=request.user, role=UserRole.AGENT)
                for key in ("agent_claim_step", "agent_claim_id", "agent_claim_phone"):
                    request.session.pop(key, None)
                messages.success(request, "Profile claimed successfully!")
                return redirect("agents:dashboard")

    agent = Agent.objects.filter(pk=agent_id).first() if agent_id else None
    return render(
        request,
        "agents/auth.html",
        {"form": form, "step": verify_step, "agent": agent},
    )


@login_required
def agent_dashboard_view(request):
    agent = Agent.objects.filter(claimed_by=request.user).first()
    if not agent:
        return redirect("agents:auth")

    conversations = build_agent_conversations(agent, request.user)

    selected_id = request.GET.get("id")
    selected = None
    unread_divider = None
    chat_messages = []
    if selected_id:
        selected = get_object_or_404(Conversation, pk=selected_id, agent=agent)

    if not selected:
        clear_all_unread_dividers(request)

    ctx = {}
    if selected:
        chat_ctx = _conversation_chat_context(request, selected)
        chat_messages = chat_ctx["messages"]
        unread_divider = chat_ctx["unread_divider"]
        ctx = _chat_peer_context(request, selected)

    return render(
        request,
        "agents/dashboard.html",
        {
            "agent": agent,
            "conversations": conversations,
            "selected": selected,
            "chat_messages": chat_messages,
            "message_form": MessageForm(),
            "unread_divider": unread_divider,
            "scroll_to_unread": bool(unread_divider),
            **ctx,
        },
    )
