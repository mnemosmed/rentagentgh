"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

type Tokens = {
  access: string;
  refresh: string;
  user: User;
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/search";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await apiFetch<{ phone: string; detail: string }>("/auth/phone/send/", {
        method: "POST",
        body: JSON.stringify({ phone, first_name: firstName }),
      });
      setPhone(data.phone || phone);
      setStep("otp");
      setInfo("Verification code sent.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await apiFetch<Tokens>("/auth/phone/verify/", {
        method: "POST",
        body: JSON.stringify({ phone, otp, first_name: firstName }),
      });
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens),
      });
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not verify code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-app max-w-md py-12 sm:py-16">
      <h1 className="mb-2 text-center text-3xl font-extrabold text-navy">Sign in</h1>
      <p className="mb-6 text-center text-navy/60">Use your Ghana phone number and SMS code.</p>
      <Card>
        {step === "phone" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">First name (optional)</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ama" />
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
              {loading ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-navy/60">
              Code sent to <strong className="text-navy">{phone}</strong>
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Verification code</label>
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
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError("");
              }}
            >
              Change number
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
