"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  initialArea?: string;
  buttonLabel?: string;
  variant?: "default" | "hero";
};

export function AreaSearch({
  initialArea = "",
  buttonLabel = "Search agents",
  variant = "default",
}: Props) {
  const router = useRouter();
  const [area, setArea] = useState(initialArea);
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ areas: string[] }>("/areas/")
      .then((data) => setAreas(data.areas || []))
      .catch(() => setAreas([]));
  }, []);

  const suggestions = useMemo(() => {
    const q = area.trim().toLowerCase();
    if (!q) return areas.slice(0, 8);
    return areas.filter((a) => a.toLowerCase().includes(q)).slice(0, 8);
  }, [area, areas]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = area.trim();
    if (!value) return;
    router.push(`/search?area=${encodeURIComponent(value)}`);
  }

  const isHero = variant === "hero";

  return (
    <form
      onSubmit={onSubmit}
      className={
        isHero
          ? "flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-[#d8e0ea] bg-white p-1.5 shadow-card sm:flex-row sm:items-center"
          : "mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      }
    >
      <div className={`relative min-w-0 flex-1 ${isHero ? "" : ""}`}>
        {isHero && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-pop">
            <PinIcon />
          </span>
        )}
        <Input
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Enter area, e.g. East Legon"
          aria-autocomplete="list"
          required
          className={
            isHero
              ? "border-0 bg-transparent py-3 pl-10 shadow-none focus:border-transparent focus:shadow-none"
              : ""
          }
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto rounded-xl border border-[#d8e0ea] bg-white py-1.5 shadow-soft">
            {suggestions.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-graybg"
                  onMouseDown={() => {
                    setArea(item);
                    setOpen(false);
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        type="submit"
        className={isHero ? "shrink-0 sm:self-auto" : "shrink-0 sm:self-stretch"}
      >
        {buttonLabel}
      </Button>
    </form>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}
