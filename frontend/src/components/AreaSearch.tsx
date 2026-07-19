"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  initialArea?: string;
  buttonLabel?: string;
};

export function AreaSearch({ initialArea = "", buttonLabel = "Search agents" }: Props) {
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

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1">
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
      <Button type="submit" className="shrink-0 sm:self-stretch">
        {buttonLabel}
      </Button>
    </form>
  );
}
