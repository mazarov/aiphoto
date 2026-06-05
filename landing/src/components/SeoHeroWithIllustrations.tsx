"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { CARD_IMAGE_LISTING_NEXT_QUALITY } from "@/lib/card-image-presets";
import type { ResolvedSeoIllustration } from "@/lib/seo-illustrations";
import { ListingPromptCountBadge } from "@/components/ListingPromptCountBadge";

function illustrationLabel(ill: ResolvedSeoIllustration): string {
  if (ill.label) return ill.label;
  const dash = ill.caption.indexOf("—");
  const raw = dash > 0 ? ill.caption.slice(0, dash) : ill.caption;
  return raw.trim().slice(0, 32);
}

type Props = {
  h1: string;
  intro: string;
  totalCount: number;
  illustrations: ResolvedSeoIllustration[];
};

/** Единый hero L1: текст + карусель примеров в одной панели. */
export function SeoHeroWithIllustrations({ h1, intro, totalCount, illustrations }: Props) {
  const [index, setIndex] = useState(0);
  const count = illustrations.length;
  const touchXRef = useRef(0);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-stretch">
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
        </div>

        <div
          className="flex min-h-[200px] flex-col bg-zinc-50/40 px-2 pb-1.5 pt-2 sm:min-h-[120%] sm:px-2 sm:pb-1.5 sm:pt-2"
          aria-label="Примеры промтов"
        >
          <div
            className="relative min-h-0 flex-1"
            aria-roledescription="carousel"
            onTouchStart={(e) => {
              touchXRef.current = e.changedTouches[0]?.clientX ?? 0;
            }}
            onTouchEnd={(e) => {
              if (count < 2) return;
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchXRef.current;
              if (Math.abs(dx) < 36) return;
              go(dx < 0 ? 1 : -1);
            }}
            onKeyDown={(e) => {
              if (count < 2) return;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                go(-1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                go(1);
              }
            }}
            tabIndex={count > 1 ? 0 : undefined}
          >
            <div className="h-full min-h-[180px] overflow-hidden rounded-lg bg-zinc-100 sm:min-h-0">
              <div
                className="flex h-full motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transition-none"
                style={{ transform: `translateX(-${index * 100}%)` }}
              >
                {illustrations.map((ill) => (
                  <figure key={ill.cardSlug} className="h-full w-full flex-shrink-0">
                    <div className="relative h-full min-h-[180px] sm:min-h-0">
                      <Image
                        src={ill.photoUrl}
                        alt={ill.alt}
                        fill
                        sizes="216px"
                        quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="sr-only">{ill.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>

          {count > 1 && (
            <p className="mt-1 text-center text-xs tabular-nums text-zinc-400">
              {index + 1} / {count}
            </p>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="bg-zinc-50/60 px-5 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Сценарии примеров">
            {illustrations.map((ill, i) => {
              const active = i === index;
              return (
                <button
                  key={ill.cardSlug}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${illustrationLabel(ill)}, слайд ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    active
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-white text-zinc-500 ring-1 ring-zinc-200/80 hover:text-zinc-700"
                  }`}
                >
                  {illustrationLabel(ill)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
