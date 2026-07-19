"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AreaSearch } from "@/components/AreaSearch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { Agent } from "@/lib/types";

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const area = params.get("area") || "";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!area) {
      setAgents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<{ agents: Agent[] }>(`/agents/search/?area=${encodeURIComponent(area)}`)
      .then((data) => {
        if (!cancelled) setAgents(data.agents || []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/search?area=${area}`)}`);
          return;
        }
        setError(err.message || "Could not load agents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [area, router]);

  return (
    <div className="container-app py-8 sm:py-10">
      <h1 className="mb-2 text-center text-3xl font-extrabold text-navy">Find Rental Agents</h1>
      <p className="mb-6 text-center text-navy/60">
        Search by area to find agents who serve your preferred neighborhood
      </p>
      <AreaSearch initialArea={area} buttonLabel="Search" />

      <div className="mt-8">
        {!area && (
          <p className="text-center text-navy/55">Enter an area above to see matching agents.</p>
        )}
        {loading && <p className="text-center text-navy/55">Loading agents…</p>}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-red-700">{error}</p>
        )}
        {!loading && area && !error && (
          <>
            <p className="mb-4 text-navy/60">
              {agents.length} agent{agents.length === 1 ? "" : "s"} serving {area}
            </p>
            {agents.length === 0 ? (
              <Card className="mx-auto max-w-md text-center">
                <h3 className="mb-2 text-lg font-bold">No agents found</h3>
                <p className="text-navy/60">Try a nearby neighborhood.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <Card key={agent.id} className="transition hover:shadow-soft">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold">
                          <Link href={`/agents/${agent.id}`} className="text-navy hover:text-pop">
                            {agent.display_name}
                          </Link>
                        </h2>
                        <p className="text-sm text-navy/55">{agent.primary_area}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {agent.is_verified && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              Verified
                            </span>
                          )}
                          {agent.contacted && (
                            <span className="rounded-full bg-graybg px-2.5 py-0.5 text-xs font-semibold text-navy">
                              Contacted
                            </span>
                          )}
                        </div>
                      </div>
                      {agent.rating_stats.overall_rating != null && (
                        <div className="text-sm">
                          <div className="font-bold text-amber-500">
                            ★ {agent.rating_stats.overall_rating}
                          </div>
                          <div className="text-xs text-navy/50">
                            {agent.rating_stats.total_ratings} reviews
                          </div>
                        </div>
                      )}
                    </div>
                    {agent.short_bio && (
                      <p className="mb-3 text-sm text-navy/70 line-clamp-3">{agent.short_bio}</p>
                    )}
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {agent.covered_areas.slice(0, 5).map((a) => (
                        <span key={a} className="rounded-full bg-graybg px-2.5 py-0.5 text-xs font-semibold">
                          {a}
                        </span>
                      ))}
                    </div>
                    <Button href={`/agents/${agent.id}`} size="sm" className="w-full sm:w-auto">
                      Contact agent
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-navy/55">Loading…</div>}>
      <SearchContent />
    </Suspense>
  );
}
