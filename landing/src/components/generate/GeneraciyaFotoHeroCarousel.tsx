"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  type GenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import { GENERACIYA_FOTO_SEO } from "@/lib/generaciya-foto-seo-copy";

const TILE_ASPECT = 3 / 4;

function CarouselTile({
  card,
  copy,
  index,
}: {
  card: GenerationExampleCard;
  copy: "a" | "b";
  index: number;
}) {
  return (
    <div
      data-hero-card-slug={card.slug}
      className={`w-[7.25rem] shrink-0 pr-2.5 sm:w-[9.25rem] sm:pr-3 ${
        copy === "b" ? "generaciya-foto-marquee-dup" : ""
      }`}
      aria-hidden={copy === "b" ? true : undefined}
    >
      <ListingPhotoTile
        card={card}
        aspectRatio={TILE_ASPECT}
        priority={copy === "a" && index < 4}
      />
    </div>
  );
}

function pickCenteredCard(
  root: HTMLElement,
  photos: GenerationExampleCard[]
): GenerationExampleCard {
  const mid = root.getBoundingClientRect().left + root.clientWidth / 2;
  let best = photos[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const tile of root.querySelectorAll<HTMLElement>("[data-hero-card-slug]")) {
    const slug = tile.dataset.heroCardSlug;
    const card = photos.find((item) => item.slug === slug);
    if (!card) continue;
    const rect = tile.getBoundingClientRect();
    const dist = Math.abs(rect.left + rect.width / 2 - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = card;
    }
  }

  return best;
}

function scrollToPageHash(href: string) {
  const id = href.startsWith("#") ? href.slice(1) : "";
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", href);
}

export function GeneraciyaFotoHeroCarousel({
  cards,
  ctaLabel = GENERACIYA_FOTO_SEO.secondaryCta,
  ctaHref,
  ariaLabel = "Новые ИИ-фото",
}: {
  cards: GenerationExampleCard[];
  ctaLabel?: string | null;
  /** Hash or path. When set, the overlay scrolls / navigates there instead of opening a card. */
  ctaHref?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { open, prefetchCard } = usePromptCardModal();
  const photos = useMemo(
    () => cards.filter((card) => card.photoUrl),
    [cards]
  );
  const featured = photos[0];
  const canLoop = photos.length >= 2;

  const bindCarouselNav = useCallback(() => {
    if (photos.length > 0) writeGenerationExampleNavigation(photos);
  }, [photos]);

  useLayoutEffect(() => {
    bindCarouselNav();
  }, [bindCarouselNav]);

  if (!featured) return null;

  return (
    <div
      ref={wrapRef}
      className="group/marquee relative mt-6 -mx-3 overflow-hidden sm:mt-8 sm:-mx-5 xl:-mx-6"
      aria-label={ariaLabel}
      onPointerDownCapture={bindCarouselNav}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent sm:w-12"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent sm:w-12"
        aria-hidden
      />
      <div className="generaciya-foto-marquee">
        <div
          className={`flex w-max ${
            canLoop ? "generaciya-foto-marquee-track" : ""
          }`}
        >
          {photos.map((card, index) => (
            <CarouselTile
              key={`a-${card.id}`}
              card={card}
              copy="a"
              index={index}
            />
          ))}
          {canLoop
            ? photos.map((card, index) => (
                <CarouselTile
                  key={`b-${card.id}`}
                  card={card}
                  copy="b"
                  index={index}
                />
              ))
            : null}
        </div>
      </div>
      {ctaLabel ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Link
            href={ctaHref || `/p/${featured.slug}`}
            className="pointer-events-auto inline-flex min-h-11 items-center justify-center rounded-full border border-indigo-200 bg-white px-5 text-sm font-semibold text-indigo-700 shadow-lg shadow-zinc-900/10 hover:bg-indigo-50"
            prefetch={!ctaHref}
            onPointerEnter={() => {
              if (ctaHref) return;
              bindCarouselNav();
              const target = wrapRef.current
                ? pickCenteredCard(wrapRef.current, photos)
                : featured;
              prefetchCard(target.slug);
            }}
            onClick={(event) => {
              if (ctaHref?.startsWith("#")) {
                event.preventDefault();
                scrollToPageHash(ctaHref);
                return;
              }
              if (ctaHref) return;
              event.preventDefault();
              bindCarouselNav();
              const target = wrapRef.current
                ? pickCenteredCard(wrapRef.current, photos)
                : featured;
              open(target.slug, {
                photoUrl: target.photoUrl,
                photoCount: target.photoCount,
                hasPrompts: target.hasPrompt,
              });
            }}
          >
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
