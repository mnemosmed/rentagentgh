"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { AccessPlan, User } from "@/lib/types";

export default function AccessPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<AccessPlan[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState<"weekly" | "monthly">("weekly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ plans: AccessPlan[] }>("/payments/plans/")
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
    apiFetch<User>("/me/")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const selected = plans.find((p) => p.id === active) || plans[0];

  async function purchase() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{
        status: string;
        authorization_url?: string | null;
        expires_at?: string;
      }>("/payments/unlock/", {
        method: "POST",
        body: JSON.stringify({
          plan: selected.id,
          callback_url: `${window.location.origin}/access/callback`,
        }),
      });
      if (data.status === "paid") {
        router.push("/search");
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setError("Could not start payment.");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.push("/login?next=/access");
        return;
      }
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-app grid max-w-5xl items-center gap-8 py-12 lg:grid-cols-2 lg:py-16">
      <div>
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          Simple pricing. Full access.
        </h1>
        <ul className="mb-4 list-disc space-y-2 pl-5 text-navy/60">
          <li>Unlock all agent contacts and messaging</li>
          <li>Choose weekly or monthly access</li>
          <li>Renew anytime — time stacks on your plan</li>
          <li>Secure checkout with Paystack</li>
        </ul>
        {user?.has_active_access && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Access active until{" "}
            {user.access_expires_at
              ? new Date(user.access_expires_at).toLocaleDateString()
              : "—"}
            . Renewing extends it.
          </p>
        )}
      </div>

      <Card className="shadow-soft">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-graybg p-1">
          {(["weekly", "monthly"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`rounded-full px-3 py-2 text-sm font-bold ${
                active === id ? "bg-pop text-white" : "text-navy"
              }`}
            >
              {id === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-navy">{selected.label} access</p>
              <p className="mt-1 inline-block rounded-full bg-pop/15 px-2 py-0.5 text-xs font-bold text-pop">
                {selected.days} days
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-navy">GHS {selected.amount_ghs}</p>
              <p className="text-xs text-navy/50">Paystack checkout</p>
            </div>
          </div>
        )}

        <ul className="mb-5 space-y-2 text-sm text-navy">
          {[
            "All agent phone & WhatsApp contacts",
            "Send rental requests",
            "Full messaging while active",
            "Chats stay readable after expiry",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="font-bold text-pop">✓</span>
              {item}
            </li>
          ))}
        </ul>

        {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
        <Button className="w-full" onClick={purchase} disabled={loading || !selected}>
          {loading ? "Starting…" : "Continue to Paystack"}
        </Button>
      </Card>
    </div>
  );
}
