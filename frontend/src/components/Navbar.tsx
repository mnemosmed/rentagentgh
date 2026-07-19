"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<User>("/me/")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    window.location.href = "/";
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#d8e0ea] bg-white/95 backdrop-blur">
        <div className="container-app flex min-h-14 items-center justify-between gap-3 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-3 font-bold text-navy">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-pop text-xs font-extrabold text-white">
              RG
            </span>
            <span className="hidden sm:inline">RentAgentGhana</span>
            <span className="sm:hidden">RentAgent</span>
          </Link>

          <button
            type="button"
            className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-[#d8e0ea] md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block h-0.5 w-4 rounded bg-navy" />
            <span className="block h-0.5 w-4 rounded bg-navy" />
            <span className="block h-0.5 w-4 rounded bg-navy" />
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <Button href="/search" variant="ghost" size="sm">
              Find Agents
            </Button>
            {user ? (
              <>
                <Button href="/access" variant="ghost" size="sm">
                  Access
                </Button>
                <span className="hidden text-sm text-navy/60 lg:inline">
                  {user.display_name}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button href="/login" size="sm">
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-2 border-t border-[#d8e0ea] px-4 py-3 md:hidden">
            <Button href="/search" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
              Find Agents
            </Button>
            {user ? (
              <>
                <Button href="/access" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
                  Access
                </Button>
                <Button variant="outline" className="w-full" onClick={logout}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button href="/login" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
                  Sign in
                </Button>
                <Button href="/login" className="w-full" onClick={() => setOpen(false)}>
                  Get started
                </Button>
              </>
            )}
          </div>
        )}
      </nav>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy/30 md:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
