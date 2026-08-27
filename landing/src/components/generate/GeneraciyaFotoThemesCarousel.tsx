"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  GeneraciyaFotoThemeCollage,
  type ThemeCollageItem,
  type ThemeCountKind,
} from "@/components/generate/GeneraciyaFotoThemeCollage";
import {
  LISTING_MASONRY_CAROUSEL_CARD_CLASS,
  LISTING_MASONRY_CAROUSEL_TRACK_CLASS,
} from "@/components/ListingMasonry";
import { GENERACIYA_FOTO_THEMES } from "@/lib/generaciya-foto-seo-copy";

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

export function GeneraciyaFotoThemesCarousel({
  items = GENERACIYA_FOTO_THEMES.items,
  photosByHref,
  countByHref,
  ariaLabel = GENERACIYA_FOTO_THEMES.title,
  countKind = "templates",
}: {
  items?: readonly ThemeCollageItem[];
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
  ariaLabel?: string;
  countKind?: ThemeCountKind;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const root = scrollerRef.current;
    if (!root) return;
    const card = root.querySelector("li");
    const gap = Number.parseFloat(getComputedStyle(root).columnGap) || 12;
    const step = (card?.getBoundingClientRect().width ?? 218) + gap;
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
    }, 4500);

    return () => window.clearInterval(id);
  }, [scrollByCard]);

  return (
    <div ref={wrapRef} className="group/themes relative mt-5">
      <ul
        ref={scrollerRef}
        className={LISTING_MASONRY_CAROUSEL_TRACK_CLASS}
        aria-label={ariaLabel}
      >
        {items.map((item, index) => (
          <li key={item.href} className={LISTING_MASONRY_CAROUSEL_CARD_CLASS}>
            <GeneraciyaFotoThemeCollage
              item={item}
              photos={photosByHref[item.href] ?? []}
              count={countByHref[item.href] ?? 0}
              priority={index === 0}
              countKind={countKind}
            />
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-[#f4f3ff] to-transparent sm:block" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-[#faf7ff] to-transparent sm:block" />
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
        aria-label="Предыдущие шаблоны"
      >
        <ArrowIcon dir="prev" />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
        aria-label="Следующие шаблоны"
      >
        <ArrowIcon dir="next" />
      </button>
    </div>
  );
}
