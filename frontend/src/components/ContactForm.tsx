"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/api";

type Props = {
  agentId: string;
};

export function ContactForm({ agentId }: Props) {
  const router = useRouter();
  const [propertyType, setPropertyType] = useState("Apartment");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [preferences, setPreferences] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ conversation_id: string }>(
        `/agents/${agentId}/contact/`,
        {
          method: "POST",
          body: JSON.stringify({
            property_type: propertyType,
            location,
            budget_min: budgetMin ? Number(budgetMin) : null,
            budget_max: budgetMax ? Number(budgetMax) : null,
            move_in: moveIn,
            preferences,
          }),
        }
      );
      router.push(`/messages/${data.conversation_id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.push(
          `/login?next=${encodeURIComponent(`/agents/${agentId}`)}`
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-semibold">Property type</label>
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="w-full rounded-xl border border-[#d8e0ea] bg-white px-3.5 py-3 text-base outline-none focus:border-pop"
        >
          <option>Apartment</option>
          <option>Chamber & Hall</option>
          <option>Single room</option>
          <option>House</option>
          <option>Office</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">Preferred location</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. East Legon"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-semibold">Budget min (GHS)</label>
          <Input
            type="number"
            min={0}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Budget max (GHS)</label>
          <Input
            type="number"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">Move-in timing</label>
        <Input
          value={moveIn}
          onChange={(e) => setMoveIn(e.target.value)}
          placeholder="e.g. Immediately / Next month"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">Notes</label>
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[#d8e0ea] px-3.5 py-3 text-base outline-none focus:border-pop"
          placeholder="Anything else the agent should know?"
        />
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
