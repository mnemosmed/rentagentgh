"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { Agent, User } from "@/lib/types";

type Tokens = {
  access: string;
  refresh: string;
  user: User;
  agent?: Agent;
  detail?: string;
};

export default function ClaimAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState<"search" | "otp">("search");
  const [displayName, setDisplayName] = useState("");
  const [primaryArea, setPrimaryArea] = useState("");
  const [phone, setPhone] = useState("");
  const [agentId, setAgentId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function startClaim(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await apiFetch<{
        agent_id: string;
        phone: string;
        display_name: string;
        detail: string;
      }>("/agents/claim/start/", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName,
          primary_area: primaryArea,
          phone,
        }),
      });
      setAgentId(data.agent_id);
      setPhone(data.phone || phone);
      setStep("otp");
      setInfo(data.detail || "Verification code sent.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not start claim.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyClaim(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await apiFetch<Tokens>("/agents/claim/verify/", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId, phone, otp }),
      });
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not verify claim.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-app max-w-md py-12">
      <h1 className="mb-2 text-center text-3xl font-extrabold text-navy">
        Claim your profile
      </h1>
      <p className="mb-6 text-center text-navy/60">
        Find your listing, verify your phone, and start answering renters.
      </p>
      <Card>
        {step === "search" ? (
          <form onSubmit={startClaim} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Display name on listing
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Exact name as listed"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Primary area (optional)
              </label>
              <Input
                value={primaryArea}
                onChange={(e) => setPrimaryArea(e.target.value)}
                placeholder="e.g. Osu"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Phone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024XXXXXXX"
                required
                inputMode="tel"
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Searching…" : "Send verification code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyClaim} className="space-y-4">
            <p className="text-sm text-navy/60">
              Code sent to <strong className="text-navy">{phone}</strong>
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Verification code
              </label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                required
                inputMode="numeric"
                maxLength={6}
              />
            </div>
            {info && <p className="text-sm font-semibold text-emerald-700">{info}</p>}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Claim profile"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("search");
                setOtp("");
                setError("");
              }}
            >
              Back
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
