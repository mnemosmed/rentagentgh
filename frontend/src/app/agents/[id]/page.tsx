"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ContactForm } from "@/components/ContactForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { AccessPlan, Agent, User } from "@/lib/types";

function StarSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-xl ${n <= value ? "text-amber-500" : "text-navy/20"}`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [helpfulness, setHelpfulness] = useState(5);
  const [responsiveness, setResponsiveness] = useState(5);
  const [trustworthiness, setTrustworthiness] = useState(5);
  const [comment, setComment] = useState("");
  const [ratingMsg, setRatingMsg] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);

  useEffect(() => {
    apiFetch<User>("/me/")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    apiFetch<Agent>(`/agents/${id}/`)
      .then(setAgent)
      .catch((err) => setError(err.message || "Could not load agent."));
  }, [id]);

  async function buyPlan(plan: AccessPlan["id"]) {
    setBuying(plan);
    setError("");
    try {
      const data = await apiFetch<{
        status: string;
        authorization_url?: string | null;
      }>("/payments/unlock/", {
        method: "POST",
        body: JSON.stringify({
          plan,
          callback_url: `${window.location.origin}/access/callback`,
        }),
      });
      if (data.status === "paid") {
        const refreshed = await apiFetch<Agent>(`/agents/${id}/`);
        setAgent(refreshed);
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setError("Could not start payment.");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/agents/${id}`)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBuying(null);
    }
  }

  async function submitRating(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setRatingBusy(true);
    setRatingMsg("");
    setError("");
    try {
      await apiFetch(`/agents/${id}/ratings/`, {
        method: "POST",
        body: JSON.stringify({
          helpfulness,
          responsiveness,
          trustworthiness,
          comment,
        }),
      });
      setRatingMsg("Thanks — your rating was saved.");
      const refreshed = await apiFetch<Agent>(`/agents/${id}/`);
      setAgent(refreshed);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/agents/${id}`)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not save rating.");
    } finally {
      setRatingBusy(false);
    }
  }

  if (error && !agent) {
    return <div className="container-app py-16 text-center text-red-600">{error}</div>;
  }
  if (!agent) {
    return <div className="container-app py-16 text-center text-navy/55">Loading profile…</div>;
  }

  const plans = agent.access_plans || [];

  return (
    <div className="container-app max-w-2xl py-8">
      <Link href="/search" className="mb-4 inline-block text-sm font-semibold text-navy/60 hover:text-pop">
        ← Back to search
      </Link>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{agent.display_name}</h1>
            <p className="text-navy/55">{agent.primary_area}</p>
            {agent.is_verified && (
              <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Verified agent
              </span>
            )}
          </div>
          {agent.rating_stats.overall_rating != null && (
            <div className="text-left sm:text-right">
              <div className="text-lg font-bold text-amber-500">★ {agent.rating_stats.overall_rating}</div>
              <div className="text-xs text-navy/50">{agent.rating_stats.total_ratings} reviews</div>
            </div>
          )}
        </div>
        {agent.short_bio && <p className="mt-4 text-navy/70">{agent.short_bio}</p>}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.covered_areas.map((a) => (
            <span key={a} className="rounded-full bg-graybg px-2.5 py-0.5 text-xs font-semibold">
              {a}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-1 text-xl font-bold">Contact {agent.display_name}</h2>
        <p className="mb-4 text-sm text-navy/55">
          Send a request and see phone/WhatsApp with weekly or monthly access.
        </p>

        {!agent.contact_unlocked ? (
          <div className="rounded-xl border border-dashed border-[#d8e0ea] bg-graybg/70 p-5 text-center">
            <p className="mb-4 font-semibold">
              Get access to contact any agent and send messages.
            </p>
            <div className="mx-auto flex max-w-sm flex-col gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  disabled={buying !== null}
                  onClick={() => buyPlan(plan.id)}
                  className="flex flex-col items-stretch rounded-xl border border-[#d8e0ea] bg-white px-4 py-4 text-left shadow-card transition hover:shadow-soft disabled:opacity-60"
                >
                  <span className="text-sm text-navy/55">{plan.label}</span>
                  <span className="mb-2 text-2xl font-extrabold">GHS {plan.amount_ghs}</span>
                  <span className="inline-flex justify-center rounded-full bg-pop px-4 py-2 text-sm font-bold text-white">
                    {buying === plan.id
                      ? "Starting…"
                      : plan.id === "weekly"
                        ? "Unlock for 1 week"
                        : "Unlock for 1 month"}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-navy/50">
              Secure payment via Paystack. Access covers all agents until it expires.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {(agent.phone || agent.whatsapp) && (
              <div className="rounded-xl border border-[#d8e0ea] bg-emerald-50/50 p-4 text-sm">
                {agent.phone && (
                  <p>
                    <strong>Phone:</strong>{" "}
                    <a className="text-pop" href={`tel:${agent.phone}`}>
                      {agent.phone}
                    </a>
                  </p>
                )}
                {agent.whatsapp && (
                  <p>
                    <strong>WhatsApp:</strong>{" "}
                    <a
                      className="text-pop"
                      href={`https://wa.me/${agent.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {agent.whatsapp}
                    </a>
                  </p>
                )}
              </div>
            )}
            <div>
              <h3 className="mb-3 font-bold text-navy">Send a rental request</h3>
              <ContactForm agentId={agent.id} />
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </Card>

      {user && (
        <Card className="mb-5">
          <h2 className="mb-1 text-xl font-bold">Rate this agent</h2>
          <p className="mb-4 text-sm text-navy/55">Your rating helps other renters.</p>
          <form onSubmit={submitRating} className="space-y-4">
            <StarSelect label="Helpfulness" value={helpfulness} onChange={setHelpfulness} />
            <StarSelect
              label="Responsiveness"
              value={responsiveness}
              onChange={setResponsiveness}
            />
            <StarSelect
              label="Trustworthiness"
              value={trustworthiness}
              onChange={setTrustworthiness}
            />
            <div>
              <label className="mb-1 block text-sm font-semibold">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#d8e0ea] px-3.5 py-3 text-base outline-none focus:border-pop"
              />
            </div>
            {ratingMsg && (
              <p className="text-sm font-semibold text-emerald-700">{ratingMsg}</p>
            )}
            <Button type="submit" disabled={ratingBusy}>
              {ratingBusy ? "Saving…" : "Submit rating"}
            </Button>
          </form>
        </Card>
      )}

      {agent.reviews && agent.reviews.length > 0 && (
        <Card>
          <h2 className="mb-4 text-xl font-bold">Reviews</h2>
          <div className="space-y-4">
            {agent.reviews.map((r) => (
              <div key={r.id} className="border-b border-[#edf2f7] pb-3 last:border-0">
                <div className="text-amber-500">★ {r.overall}</div>
                {r.comment && <p className="mt-1 text-sm text-navy/70">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
