import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand

from agents.models import Agent

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "agents.json"


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    return slug or "agent"


def _normalize_row(row: dict, used_handles: set[str]) -> dict:
    handle = (row.get("tiktok_handle") or "").lstrip("@").strip()
    if not handle:
        base = _slug(row.get("display_name", ""))
        area = _slug(row.get("primary_area", ""))
        handle = f"{base}_{area}" if area else base
        n = 2
        while handle in used_handles:
            handle = f"{base}_{area}_{n}" if area else f"{base}_{n}"
            n += 1

    used_handles.add(handle)

    profile_url = (row.get("tiktok_profile_url") or "").strip()
    if not profile_url and handle:
        profile_url = f"https://www.tiktok.com/@{handle}"
    elif not profile_url:
        profile_url = "https://www.tiktok.com/@rentagentghana"

    covered = row.get("covered_areas") or []
    primary = (row.get("primary_area") or "").strip() or "Accra"
    if not covered:
        covered = [primary]

    data = {
        "display_name": row["display_name"].strip(),
        "tiktok_handle": handle,
        "tiktok_profile_url": profile_url,
        "primary_area": primary,
        "covered_areas": covered,
        "short_bio": (row.get("short_bio") or "").strip(),
        "is_verified": bool(row.get("is_verified")),
        "phone": (row.get("phone") or "").strip(),
        "whatsapp": (row.get("whatsapp") or "").strip(),
    }
    if row.get("id"):
        data["id"] = row["id"]
    return data


class Command(BaseCommand):
    help = "Load rental agents from agents/data/agents.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all existing agents before importing",
        )

    def handle(self, *args, **options):
        if not DATA_FILE.exists():
            self.stderr.write(self.style.ERROR(f"Missing data file: {DATA_FILE}"))
            return

        with DATA_FILE.open(encoding="utf-8") as f:
            rows = json.load(f)

        if options["reset"]:
            deleted, _ = Agent.objects.all().delete()
            self.stdout.write(f"Removed {deleted} existing agents.")

        used_handles = set(Agent.objects.values_list("tiktok_handle", flat=True))
        created = 0
        updated = 0

        for row in rows:
            if not row.get("display_name"):
                continue
            data = _normalize_row(row, used_handles)
            lookup = {}
            if data.get("id"):
                lookup["id"] = data.pop("id")
            else:
                lookup["tiktok_handle"] = data["tiktok_handle"]
            _, was_created = Agent.objects.update_or_create(
                **lookup,
                defaults=data,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        total = Agent.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created} created, {updated} updated. {total} agents in database."
            )
        )
