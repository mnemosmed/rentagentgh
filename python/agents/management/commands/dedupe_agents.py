import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from agents.models import Agent, AgentAccessToken, AgentRating
from messaging.models import Conversation, Message
from payments.models import ContactUnlock


def compact_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").casefold())


def merge_areas(*lists) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for lst in lists:
        for area in lst or []:
            text = (area or "").strip()
            key = text.casefold()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(text)
    return out


def agent_score(agent: Agent) -> tuple:
    return (
        1 if agent.claimed_by_id else 0,
        1 if agent.is_verified else 0,
        1 if (agent.tiktok_handle or "").strip() else 0,
        len(agent.covered_areas or []),
        len(agent.short_bio or ""),
        1 if (agent.phone or "").strip() else 0,
        agent.created_at.timestamp() if agent.created_at else 0,
    )


class Command(BaseCommand):
    help = (
        "Merge agents that share the same display name (case/punctuation-insensitive). "
        "Keeps the richest/claimed profile and reassigns related chats where needed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without changing the database",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        groups: dict[str, list[Agent]] = defaultdict(list)
        for agent in Agent.objects.all().order_by("created_at"):
            key = compact_name(agent.display_name)
            if key:
                groups[key].append(agent)

        dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
        if not dup_groups:
            self.stdout.write(self.style.SUCCESS("No duplicate agent names found."))
            return

        deleted = 0
        for key, agents in sorted(dup_groups.items(), key=lambda item: item[0]):
            keep = max(agents, key=agent_score)
            drop = [a for a in agents if a.pk != keep.pk]
            names = [a.display_name for a in agents]
            self.stdout.write(
                f"{'Would merge' if dry_run else 'Merging'} {names!r} → keep {keep.display_name} ({keep.pk})"
            )

            areas = merge_areas(
                keep.covered_areas,
                *[a.covered_areas for a in drop],
                [keep.primary_area],
                *[a.primary_area for a in drop],
            )
            if not dry_run:
                keep.covered_areas = areas
                for donor in drop:
                    if not keep.tiktok_handle and donor.tiktok_handle:
                        keep.tiktok_handle = donor.tiktok_handle
                    if not keep.tiktok_profile_url and donor.tiktok_profile_url:
                        keep.tiktok_profile_url = donor.tiktok_profile_url
                    if not keep.short_bio and donor.short_bio:
                        keep.short_bio = donor.short_bio
                    if not keep.phone and donor.phone:
                        keep.phone = donor.phone
                    if not keep.whatsapp and donor.whatsapp:
                        keep.whatsapp = donor.whatsapp
                    if donor.is_verified:
                        keep.is_verified = True
                    if donor.claimed_by_id and not keep.claimed_by_id:
                        keep.claimed_by_id = donor.claimed_by_id
                keep.save()

                for donor in drop:
                    self._reassign_related(keep, donor)
                    donor.delete()
                    deleted += 1
            else:
                deleted += len(drop)

        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(
                self.style.WARNING(f"Dry run complete. Would remove {deleted} duplicate agents.")
            )
        else:
            remaining = Agent.objects.count()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Removed {deleted} duplicates. {remaining} agents remain."
                )
            )

    def _reassign_related(self, keep: Agent, donor: Agent) -> None:
        for conv in Conversation.objects.filter(agent=donor):
            existing = Conversation.objects.filter(user_id=conv.user_id, agent=keep).first()
            if existing:
                Message.objects.filter(conversation=conv).update(conversation=existing)
                AgentAccessToken.objects.filter(conversation=conv).update(conversation=existing)
                if conv.updated_at > existing.updated_at:
                    existing.updated_at = conv.updated_at
                    existing.save(update_fields=["updated_at"])
                conv.delete()
            else:
                conv.agent = keep
                conv.save(update_fields=["agent"])

        for rating in AgentRating.objects.filter(agent=donor):
            if AgentRating.objects.filter(agent=keep, user_id=rating.user_id).exists():
                rating.delete()
            else:
                rating.agent = keep
                rating.save(update_fields=["agent"])

        ContactUnlock.objects.filter(agent=donor).update(agent=keep)
        AgentAccessToken.objects.filter(agent=donor).update(agent=keep)
