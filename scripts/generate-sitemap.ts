// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://rentagentghana.com";
const SUPABASE_URL = "https://akjenvsitwnrnqcyqvou.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFramVudnNpdHducm5xY3lxdm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzg2MDgsImV4cCI6MjA4MjcxNDYwOH0.JCsLs5yVkN_LhiGd-qKqRuWJV0s_44eFcTuBMMhocSA";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const AREAS = [
  "East Legon",
  "Cantonments",
  "Airport Residential",
  "Osu",
  "Labone",
  "Dzorwulu",
  "Tema",
  "Spintex",
  "Roman Ridge",
  "Adenta",
];

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/search", changefreq: "daily", priority: "0.9" },
  { path: "/agent-auth", changefreq: "monthly", priority: "0.6" },
  ...AREAS.map((a) => ({
    path: `/search?area=${encodeURIComponent(a)}`,
    changefreq: "daily" as const,
    priority: "0.8",
  })),
];

async function fetchAgentIds(): Promise<string[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agents_public?select=id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`sitemap: agents fetch failed (${res.status})`);
      return [];
    }
    const rows = (await res.json()) as { id: string }[];
    return rows.map((r) => r.id);
  } catch (err) {
    console.warn("sitemap: agents fetch error", err);
    return [];
  }
}

function render(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const agentIds = await fetchAgentIds();
  const agentEntries: SitemapEntry[] = agentIds.map((id) => ({
    path: `/agent/${id}`,
    changefreq: "weekly",
    priority: "0.7",
  }));
  const all = [...staticEntries, ...agentEntries];
  writeFileSync(resolve("public/sitemap.xml"), render(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
}

main();
