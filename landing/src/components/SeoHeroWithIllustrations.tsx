"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CARD_IMAGE_LISTING_NEXT_QUALITY } from "@/lib/card-image-presets";
import type { ResolvedSeoIllustration } from "@/lib/seo-illustrations";
import type { SeoPopularLink } from "@/lib/seo-content";
import { ListingPromptCountBadge } from "@/components/ListingPromptCountBadge";

function illustrationLabel(ill: ResolvedSeoIllustration): string {
  if (ill.label) return ill.label;
  const dash = ill.caption.indexOf("—");
  const raw = dash > 0 ? ill.caption.slice(0, dash) : ill.caption;
  return raw.trim().slice(0, 28);
}

type Props = {
  h1: string;
  intro: string;
  totalCount: number;
  illustrations: ResolvedSeoIllustration[];
  popularLinks?: SeoPopularLink[];
};

/** Единый hero L1: текст + карусель примеров в одной панели. */
export function SeoHeroWithIllustrations({
  h1,
  intro,
  totalCount,
  illustrations,
  popularLinks,
}: Props) {
  const [index, setIndex] = useState(0);
  const count = illustrations.length;
  const touchXRef = useRef(0);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  const carouselProps = {
    onTouchStart: (e: React.TouchEvent) => {
      touchXRef.current = e.changedTouches[0]?.clientX ?? 0;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (count < 2) return;
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchXRef.current;
      if (Math.abs(dx) < 36) return;
      go(dx < 0 ? 1 : -1);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (count < 2) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    },
    tabIndex: count > 1 ? 0 : undefined,
    "aria-roledescription": "carousel" as const,
  };

  // Фото целиком (object-contain) поверх размытого дубля — без кропа и без серых полей.
  const Slide = ({ sizes }: { sizes: string }) => (
    <div
      className="flex h-full motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transition-none"
      style={{ transform: `translateX(-${index * 100}%)` }}
    >
      {illustrations.map((ill) => (
        <figure key={ill.cardSlug} className="relative h-full w-full shrink-0 overflow-hidden">
          <Image
            src={ill.photoUrl}
            alt=""
            aria-hidden
            fill
            sizes="64px"
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            className="scale-110 object-cover blur-2xl"
          />
          <div className="absolute inset-0 bg-white/30" aria-hidden />
          <Image
            src={ill.photoUrl}
            alt={ill.alt}
            fill
            sizes={sizes}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            className="object-contain"
          />
          <figcaption className="sr-only">{ill.caption}</figcaption>
        </figure>
      ))}
    </div>
  );

  const Counter = () =>
    count > 1 ? (
      <p className="mt-1.5 text-center text-xs tabular-nums text-zinc-400">
        {index + 1} / {count}
      </p>
    ) : null;

  const Thumbnail = ({ ill, i }: { ill: ResolvedSeoIllustration; i: number }) => {
    const active = i === index;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={`${illustrationLabel(ill)}, слайд ${i + 1}`}
        onClick={() => setIndex(i)}
        className={`relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          active
            ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-zinc-50"
            : "opacity-60 hover:opacity-100"
        }`}
      >
        <Image
          src={ill.photoUrl}
          alt=""
          aria-hidden
          fill
          sizes="64px"
          quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          className="object-cover"
        />
      </button>
    );
  };

  const Thumbnails = ({ orientation }: { orientation: "col" | "row" }) =>
    count > 1 ? (
      <div
        role="tablist"
        aria-label="Сценарии примеров"
        className={
          orientation === "col"
            ? "flex w-14 shrink-0 flex-col gap-1.5"
            : "flex flex-wrap gap-1.5"
        }
      >
        {illustrations.map((ill, i) =>
          orientation === "col" ? (
            <Thumbnail key={ill.cardSlug} ill={ill} i={i} />
          ) : (
            <div key={ill.cardSlug} className="w-12">
              <Thumbnail ill={ill} i={i} />
            </div>
          ),
        )}
      </div>
    ) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-stretch">

        {/* ── Text column (unchanged) ── */}
        <div className="min-w-0 p-5 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {h1}
            </h1>
            <ListingPromptCountBadge count={totalCount} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            {intro}
          </p>
          {popularLinks?.length ? (
            <nav className="mt-4" aria-label="Популярные подборки">
              <p className="mb-2 text-sm font-medium text-zinc-700">Популярные сценарии</p>
              <div className="flex flex-wrap gap-1.5">
                {popularLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}
        </div>

        {/* ── Photo column ── */}
        <div
          className="bg-zinc-50/60 px-2 py-2 sm:flex sm:flex-col sm:gap-1 sm:self-stretch sm:px-2 sm:pb-2 sm:pt-2"
          aria-label="Примеры промтов"
        >
          {/* Mobile: thumbnails left / photo right */}
          <div className="flex gap-2 sm:hidden">
            <Thumbnails orientation="col" />
            <div className="min-w-0 flex-1" {...carouselProps}>
              <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-100">
                <Slide sizes="(max-width: 639px) calc(100vw - 5rem), 216px" />
              </div>
              <Counter />
            </div>
          </div>

          {/* Desktop: full-height photo */}
          <div className="hidden min-h-0 flex-1 sm:block" {...carouselProps}>
            <div className="h-full min-h-[200px] overflow-hidden rounded-lg bg-zinc-100">
              <Slide sizes="216px" />
            </div>
            <Counter />
          </div>
        </div>
      </div>

      {/* Desktop thumbnails row */}
      {count > 1 ? (
        <div className="hidden border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 sm:block sm:px-6 lg:px-8">
          <Thumbnails orientation="row" />
        </div>
      ) : null}
    </article>
  );
}
