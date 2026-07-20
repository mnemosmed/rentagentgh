"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "/hero/house-1.jpg",
    alt: "Modern two-story home with balconies at dusk",
  },
  {
    src: "/hero/house-2.jpg",
    alt: "Contemporary villa with warm exterior lighting",
  },
  {
    src: "/hero/house-3.jpg",
    alt: "Luxury hillside home with large windows",
  },
  {
    src: "/hero/house-4.jpg",
    alt: "Bright modern residence with open living spaces",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const count = SLIDES.length;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 5200);
    return () => window.clearInterval(id);
  }, [count]);

  function go(delta: number) {
    setIndex((i) => (i + delta + count) % count);
  }

  const prev = (index - 1 + count) % count;
  const next = (index + 1) % count;

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative mx-auto aspect-[5/4] w-full max-w-[28rem] sm:max-w-[32rem] lg:max-w-none">
        {/* Depth layers */}
        <div
          aria-hidden
          className="absolute left-0 top-1/2 z-0 h-[72%] w-[42%] -translate-y-1/2 overflow-hidden rounded-[1.4rem] opacity-55 shadow-card sm:rounded-[1.75rem]"
        >
          <Image
            src={SLIDES[prev].src}
            alt=""
            fill
            className="object-cover"
            sizes="200px"
          />
          <div className="absolute inset-0 bg-navy/10" />
        </div>
        <div
          aria-hidden
          className="absolute right-0 top-1/2 z-0 h-[72%] w-[42%] -translate-y-1/2 overflow-hidden rounded-[1.4rem] opacity-55 shadow-card sm:rounded-[1.75rem]"
        >
          <Image
            src={SLIDES[next].src}
            alt=""
            fill
            className="object-cover"
            sizes="200px"
          />
          <div className="absolute inset-0 bg-navy/10" />
        </div>

        {/* Active slide */}
        <div className="absolute left-1/2 top-0 z-10 h-full w-[78%] -translate-x-1/2 overflow-hidden rounded-[1.5rem] shadow-soft ring-1 ring-black/5 sm:rounded-[1.85rem]">
          {SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-500 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                className="object-cover"
                sizes="(max-width: 1024px) 80vw, 420px"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous image"
          onClick={() => go(-1)}
          className="absolute left-[2%] top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#e2e8f0] bg-white text-navy shadow-card transition hover:border-pop/40 hover:text-pop sm:h-11 sm:w-11"
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          aria-label="Next image"
          onClick={() => go(1)}
          className="absolute right-[2%] top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#e2e8f0] bg-white text-navy shadow-card transition hover:border-pop/40 hover:text-pop sm:h-11 sm:w-11"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show image ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-pop" : "w-2 bg-navy/15 hover:bg-navy/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6L9 12L15 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
