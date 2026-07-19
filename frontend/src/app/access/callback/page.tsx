"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";

function CallbackContent() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [status, setStatus] = useState<"loading" | "paid" | "failed">("loading");
  const [message, setMessage] = useState("Confirming your payment…");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      setMessage("Missing payment reference.");
      return;
    }
    apiFetch<{ status: string; expires_at?: string; detail?: string }>(
      `/payments/confirm/?reference=${encodeURIComponent(reference)}`
    )
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid");
          setExpiresAt(data.expires_at || null);
          setMessage("Payment received. Your access is active.");
        } else {
          setStatus("failed");
          setMessage(data.detail || "Payment was not completed.");
        }
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(err.message || "Could not confirm payment.");
      });
  }, [reference]);

  return (
    <div className="container-app max-w-md py-16">
      <Card className="text-center shadow-soft">
        <h1 className="mb-2 text-2xl font-extrabold text-navy">
          {status === "loading" ? "Confirming…" : status === "paid" ? "You're in" : "Payment issue"}
        </h1>
        <p className="mb-2 text-navy/60">{message}</p>
        {expiresAt && (
          <p className="mb-6 text-sm font-semibold text-navy">
            Access until {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}
        {status !== "loading" && (
          <div className="flex flex-col gap-2">
            <Button href="/search" className="w-full">
              Find agents
            </Button>
            <Link href="/access" className="text-sm font-semibold text-pop hover:underline">
              Back to access plans
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AccessCallbackPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center">Confirming…</div>}>
      <CallbackContent />
    </Suspense>
  );
}
