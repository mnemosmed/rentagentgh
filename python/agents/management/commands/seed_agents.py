import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand

from agents.models import Agent

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "agents.json"


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    return slug or "agent"


def _compact_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").casefold())


def _merge_areas(*lists) -> list[str]:
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


def _row_score(row: dict) -> tuple:
    handle = (row.get("tiktok_handle") or "").strip()
    areas = row.get("covered_areas") or []
    bio = (row.get("short_bio") or "") or ""
    return (
        1 if handle else 0,
        1 if (row.get("tiktok_profile_url") or "").strip() else 0,
        len(areas),
        len(bio),
        1 if row.get("is_verified") else 0,
    )


def _dedupe_rows(rows: list[dict]) -> list[dict]:
    """Keep one row per compact display name, merging covered areas."""
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for row in rows:
        if not row.get("display_name"):
            continue
        key = _compact_name(row["display_name"])
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(row)

    merged: list[dict] = []
    for key in order:
        items = groups[key]
        if len(items) == 1:
            merged.append(items[0])
            continue
        items_sorted = sorted(items, key=_row_score, reverse=True)
        keep = dict(items_sorted[0])
        keep["covered_areas"] = _merge_areas(
            *(r.get("covered_areas") for r in items_sorted),
            [r.get("primary_area") for r in items_sorted],
        )
        for donor in items_sorted[1:]:
            for field in (
                "tiktok_handle",
                "tiktok_profile_url",
                "short_bio",
                "phone",
                "whatsapp",
            ):
                if not (keep.get(field) or "").strip() and (donor.get(field) or "").strip():
                    keep[field] = donor[field]
            keep["is_verified"] = bool(keep.get("is_verified")) or bool(
                donor.get("is_verified")
            )
        merged.append(keep)
    return merged


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
            rows = _dedupe_rows(json.load(f))

        if options["reset"]:
            deleted, _ = Agent.objects.all().delete()
            self.stdout.write(f"Removed {deleted} existing agents.")

        used_handles = set(Agent.objects.values_list("tiktok_handle", flat=True))
        by_name = {
            _compact_name(a.display_name): a
            for a in Agent.objects.all().order_by("created_at")
        }
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
                # Prefer matching an existing same-named agent so re-seeds
                # don't create duplicates when tiktok handles differ.
                existing = by_name.get(_compact_name(data["display_name"]))
                if existing:
                    lookup["id"] = existing.id
                    handle = data["tiktok_handle"]
                    conflict = (
                        Agent.objects.filter(tiktok_handle=handle)
                        .exclude(pk=existing.pk)
                        .exists()
                    )
                    if conflict:
                        data["tiktok_handle"] = existing.tiktok_handle
                else:
                    lookup["tiktok_handle"] = data["tiktok_handle"]
            agent, was_created = Agent.objects.update_or_create(
                **lookup,
                defaults=data,
            )
            by_name[_compact_name(agent.display_name)] = agent
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
