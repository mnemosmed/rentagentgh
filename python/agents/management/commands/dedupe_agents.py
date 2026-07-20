from django.core.management.base import BaseCommand
from django.db import transaction

from agents.dedupe import compact_name, merge_duplicate_agents
from agents.models import Agent


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

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            groups: dict[str, list[Agent]] = {}
            for agent in Agent.objects.all().order_by("created_at"):
                key = compact_name(agent.display_name)
                if not key:
                    continue
                groups.setdefault(key, []).append(agent)
            would_remove = 0
            for key, agents in sorted(groups.items()):
                if len(agents) < 2:
                    continue
                names = [a.display_name for a in agents]
                self.stdout.write(f"Would merge {names!r}")
                would_remove += len(agents) - 1
            if would_remove == 0:
                self.stdout.write(self.style.SUCCESS("No duplicate agent names found."))
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"Dry run complete. Would remove {would_remove} duplicate agents."
                    )
                )
            return

        with transaction.atomic():
            removed, remaining = merge_duplicate_agents()
        if removed == 0:
            self.stdout.write(self.style.SUCCESS("No duplicate agent names found."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Removed {removed} duplicates. {remaining} agents remain."
                )
            )
