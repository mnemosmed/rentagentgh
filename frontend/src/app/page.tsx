import Link from "next/link";

import { AreaSearch } from "@/components/AreaSearch";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(255,90,95,0.12),transparent_42%),radial-gradient(circle_at_85%_100%,rgba(11,19,43,0.06),transparent_45%),#fff] px-4 pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-up mb-4 text-3xl font-extrabold tracking-tight text-navy sm:text-5xl">
            RentAgentGhana
          </p>
          <h1 className="animate-fade-up mb-4 text-3xl font-extrabold tracking-tight text-navy [animation-delay:80ms] sm:text-5xl">
            Find rental agents who actually work in your area
          </h1>
          <p className="animate-fade-up mx-auto mb-6 max-w-xl text-lg text-navy/60 [animation-delay:140ms]">
            Search Accra by neighborhood, unlock contacts, and message agents — all in one place.
          </p>
          <div className="animate-fade-up mb-7 flex flex-wrap justify-center gap-3 [animation-delay:200ms]">
            <Button href="/search" size="lg">
              Find agents
            </Button>
            <Button href="/login" variant="outline" size="lg">
              Get started
            </Button>
          </div>
          <div className="animate-fade-up [animation-delay:260ms]">
            <AreaSearch />
          </div>
        </div>
      </section>

      <section className="bg-navy py-5 text-center">
        <p className="container-app text-[0.98rem] font-semibold text-white/90">
          Built for Accra renters tired of chasing agents across WhatsApp and Facebook.
        </p>
      </section>

      <section className="section-pad py-16 sm:py-20">
        <div className="container-app">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Everything you need to find and contact rental agents
            </h2>
            <p className="text-navy/60">
              Search by area, compare ratings, then unlock phone numbers and chat for a week or a month.
            </p>
          </div>

          <div className="grid gap-10 lg:gap-14">
            <article className="grid items-center gap-7 lg:grid-cols-2 lg:gap-12">
              <div>
                <h3 className="mb-3 text-2xl font-bold text-navy">Discover agents by neighborhood</h3>
                <p className="text-lg text-navy/60">
                  Enter East Legon, Osu, Cantonments, or any Accra suburb and see agents who actually serve that area — sorted by ratings.
                </p>
              </div>
              <div className="rounded-2xl border border-[#d8e0ea] bg-graybg p-5 shadow-soft">
                <div className="mb-3 h-10 rounded-full border border-[#d8e0ea] bg-white" />
                <div className="space-y-2">
                  {["East Legon", "Verified agents nearby", "Sorted by rating"].map((label, i) => (
                    <div
                      key={label}
                      className={`flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm ${
                        i === 1 ? "border border-pop/30 bg-pop/10" : ""
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${i === 1 ? "bg-pop" : "bg-graybg border border-[#d8e0ea]"}`} />
                      <strong className="text-navy">{label}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="grid items-center gap-7 lg:grid-cols-2 lg:gap-12">
              <div className="order-2 lg:order-1">
                <div className="flex min-h-44 flex-col justify-end gap-2.5 rounded-2xl border border-[#d8e0ea] bg-gradient-to-b from-graybg/80 to-white p-5 shadow-soft">
                  <div className="max-w-[85%] self-start rounded-2xl border border-[#d8e0ea] bg-white px-3.5 py-2.5 text-sm text-navy">
                    Looking for a 2-bedroom in Airport Residential…
                  </div>
                  <div className="max-w-[85%] self-end rounded-2xl bg-pop px-3.5 py-2.5 text-sm text-white">
                    I have two options. When can you view?
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="mb-3 text-2xl font-bold text-navy">Message with a clear request</h3>
                <p className="text-lg text-navy/60">
                  Send budget, rooms, and move-in date in one structured message. Keep every conversation in one inbox.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-graybg py-16 sm:py-20">
        <div className="container-app">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Finding a place in Accra shouldn’t feel like a full-time job
            </h2>
            <p className="text-navy/60">
              Stop repeating yourself across platforms. RentAgentGhana puts area-focused agents and messaging in one workspace.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Search by area", "Find agents who work where you want to live — not random city-wide listings."],
              ["Structured requests", "Budget, rooms, and move-in date sent clearly the first time."],
              ["One inbox", "Keep chats with agents together instead of scattered WhatsApp threads."],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-[#d8e0ea] bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-pop/15 font-bold text-pop">
                  ◆
                </div>
                <h3 className="mb-2 text-lg font-bold text-navy">{title}</h3>
                <p className="text-navy/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-20">
        <div className="container-app grid items-center gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
          <div>
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Simple pricing. Full access.
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-navy/60">
              <li>Unlock all agent contacts and messaging</li>
              <li>Choose weekly or monthly access</li>
              <li>Renew anytime — time stacks on your plan</li>
              <li>Secure checkout with Paystack</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#d8e0ea] bg-white p-5 shadow-soft">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-graybg p-1">
              <span className="rounded-full bg-pop px-3 py-2 text-center text-sm font-bold text-white">
                Weekly GHS 5
              </span>
              <span className="rounded-full px-3 py-2 text-center text-sm font-bold text-navy">
                Monthly GHS 18
              </span>
            </div>
            <ul className="mb-5 space-y-2 text-sm text-navy">
              {["All agent phone & WhatsApp", "Send rental requests", "Full messaging while active", "Chats stay readable after expiry"].map(
                (item) => (
                  <li key={item} className="flex gap-2">
                    <span className="font-bold text-pop">✓</span>
                    {item}
                  </li>
                )
              )}
            </ul>
            <Button href="/access" className="w-full">
              Get access
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-graybg py-16 sm:py-20">
        <div className="container-app max-w-3xl">
          <h2 className="mb-7 text-center text-3xl font-extrabold tracking-tight text-navy">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {[
              ["What is RentAgentGhana?", "A simple way for Accra renters to find agents by the neighborhoods they serve, then contact and message them in one place."],
              ["Do I pay per agent?", "No. You pay for weekly (GHS 5) or monthly (GHS 18) access to all agent contacts and messaging."],
              ["What happens when my access expires?", "You can still read your chats, but sending messages and viewing phone numbers stays locked until you renew."],
            ].map(([q, a], idx) => (
              <details
                key={q}
                open={idx === 0}
                className="rounded-2xl border border-[#d8e0ea] bg-white px-4 shadow-card"
              >
                <summary className="cursor-pointer list-none py-4 pr-10 font-bold text-navy marker:content-none">
                  {q}
                </summary>
                <p className="border-t border-[#d8e0ea] pb-4 pt-3 text-navy/60">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[radial-gradient(circle_at_20%_0%,rgba(255,90,95,0.14),transparent_45%),#EDF2F7] py-16 text-center sm:py-20">
        <div className="container-app">
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-navy">
            Ready to find your agent?
          </h2>
          <p className="mb-6 text-navy/60">
            Search by neighborhood and message agents who actually work there.
          </p>
          <Button href="/search" size="lg">
            Start searching
          </Button>
          <p className="mt-4 text-sm text-navy/45">
            Prefer the classic site?{" "}
            <Link href={process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"} className="text-pop underline-offset-2 hover:underline">
              Open Django app
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
