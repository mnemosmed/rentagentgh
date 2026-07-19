"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { Agent } from "@/lib/types";

export default function AgentProfileEditPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [primaryArea, setPrimaryArea] = useState("");
  const [coveredAreas, setCoveredAreas] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Agent>("/agents/me/")
      .then((agent) => {
        setDisplayName(agent.display_name || "");
        setShortBio(agent.short_bio || "");
        setPhone(agent.phone || "");
        setWhatsapp(agent.whatsapp || "");
        setPrimaryArea(agent.primary_area || "");
        setCoveredAreas((agent.covered_areas || []).join(", "));
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) {
          router.replace("/login?next=/dashboard/profile");
          return;
        }
        if (err instanceof ApiRequestError && err.status === 404) {
          router.replace("/agents/claim");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load profile.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      await apiFetch("/agents/me/", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName,
          short_bio: shortBio,
          phone,
          whatsapp,
          primary_area: primaryArea,
          covered_areas: coveredAreas
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setSaved("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app py-16 text-center text-navy/55">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="container-app max-w-lg py-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm font-semibold text-navy/60 hover:text-pop"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mb-2 text-2xl font-extrabold text-navy">Edit profile</h1>
      <p className="mb-5 text-sm text-navy/55">
        Update how renters see your listing.
      </p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Display name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Primary area</label>
            <Input
              value={primaryArea}
              onChange={(e) => setPrimaryArea(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">
              Covered areas (comma-separated)
            </label>
            <Input
              value={coveredAreas}
              onChange={(e) => setCoveredAreas(e.target.value)}
              placeholder="Osu, Labone, Cantonments"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">WhatsApp</label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Short bio</label>
            <textarea
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[#d8e0ea] px-3.5 py-3 text-base outline-none focus:border-pop"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          {saved && <p className="text-sm font-semibold text-emerald-700">{saved}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
