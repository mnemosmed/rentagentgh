"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<User>("/me/")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    const load = () => {
      apiFetch<{ unread_count: number }>("/me/unread-count/")
        .then((d) => setUnread(d.unread_count || 0))
        .catch(() => setUnread(0));
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [user]);

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    window.location.href = "/";
  }

  const inboxHref = user?.is_agent ? "/dashboard" : "/messages";
  const inboxLabel = user?.is_agent ? "Dashboard" : "Messages";

  function InboxLink({
    className = "",
    onClick,
  }: {
    className?: string;
    onClick?: () => void;
  }) {
    return (
      <Button href={inboxHref} variant="ghost" size="sm" className={className} onClick={onClick}>
        {inboxLabel}
        {unread > 0 && (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-pop px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
    );
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
                <InboxLink />
                {!user.is_agent && (
                  <Button href="/access" variant="ghost" size="sm">
                    Access
                  </Button>
                )}
                {user.is_agent && (
                  <Button href="/dashboard/profile" variant="ghost" size="sm">
                    Profile
                  </Button>
                )}
                <span className="hidden text-sm text-navy/60 lg:inline">
                  {user.display_name}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button href="/agents/claim" variant="ghost" size="sm">
                  For agents
                </Button>
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
                <InboxLink className="w-full justify-start" onClick={() => setOpen(false)} />
                {!user.is_agent && (
                  <Button href="/access" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
                    Access
                  </Button>
                )}
                {user.is_agent && (
                  <Button href="/dashboard/profile" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
                    Profile
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={logout}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button href="/agents/claim" variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
                  For agents
                </Button>
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
