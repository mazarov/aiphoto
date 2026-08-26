"use client";

import { useCallback, useEffect, useRef } from "react";
import { GENERACIYA_FOTO_REVIEWS } from "@/lib/generaciya-foto-seo-copy";

function ArrowIcon({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {dir === "prev" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

export function GeneraciyaFotoReviewsCarousel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const root = scrollerRef.current;
    if (!root) return;
    const card = root.querySelector("li");
    const step = (card?.getBoundingClientRect().width ?? 280) + 12;
    const max = root.scrollWidth - root.clientWidth;
    let next = root.scrollLeft + dir * step;
    if (next > max - 4) next = 0;
    if (next < 0) next = max;
    root.scrollTo({ left: next, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const id = window.setInterval(() => {
      const wrap = wrapRef.current;
      if (wrap?.matches(":hover") || wrap?.matches(":focus-within")) return;
      scrollByCard(1);
    }, 5500);

    return () => window.clearInterval(id);
  }, [scrollByCard]);

  return (
    <div ref={wrapRef} className="group/reviews relative mt-5">
      <ul
        ref={scrollerRef}
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none"
        aria-label={GENERACIYA_FOTO_REVIEWS.title}
      >
        {GENERACIYA_FOTO_REVIEWS.items.map((item) => (
          <li
            key={item.name}
            className="w-[min(19rem,85vw)] shrink-0 snap-start sm:w-[calc((100%-0.75rem)/2.15)]"
          >
            <article className="flex h-full flex-col rounded-2xl border border-indigo-100/90 bg-white/80 p-5">
              <p className="text-base font-semibold text-zinc-900">{item.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {item.text}
              </p>
            </article>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
        aria-label="Предыдущие отзывы"
      >
        <ArrowIcon dir="prev" />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
        aria-label="Следующие отзывы"
      >
        <ArrowIcon dir="next" />
      </button>
    </div>
  );
}
