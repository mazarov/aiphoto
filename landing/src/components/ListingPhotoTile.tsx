"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhotoshootListingBadge } from "@/components/PhotoshootListingBadge";
import { PhotoshootListingGrid } from "@/components/PhotoshootListingGrid";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import type { GenerationExampleCard } from "@/lib/generation/example-card";

type Props = {
  card: GenerationExampleCard;
  aspectRatio: number;
  priority?: boolean;
  debugOverlay?: ReactNode;
};

export function ListingPhotoTile({
  card,
  aspectRatio,
  priority = false,
  debugOverlay,
}: Props) {
  const { open, prefetchCard } = usePromptCardModal();
  const photoshootUrls =
    card.isPhotoshoot && card.photoUrls.length === 4 ? card.photoUrls : null;

  return (
    <article
      className="group relative isolate overflow-hidden rounded-2xl bg-zinc-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
      style={{ aspectRatio }}
    >
      {photoshootUrls ? (
        <PhotoshootListingGrid
          urls={photoshootUrls}
          alt={card.title}
          priority={priority}
          onPrefetch={() => prefetchCard(card.slug)}
          onSelect={(url, index) => {
            open(card.slug, {
              photoUrl: url,
              photoIndex: index,
              photoCount: card.photoCount,
              hasPrompts: card.hasPrompt,
            });
          }}
        />
      ) : card.photoUrl ? (
        <Image
          src={card.photoUrl}
          alt={card.title}
          fill
          sizes={SIZES_CARD_GRID}
          quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100"
          aria-hidden
        />
      )}

      {debugOverlay}

      {card.isPhotoshoot ? <PhotoshootListingBadge /> : null}

      <Link
        href={`/p/${card.slug}`}
        className={`absolute inset-0 z-10${photoshootUrls ? " pointer-events-none" : ""}`}
        aria-label={card.title}
        prefetch
        onPointerEnter={() => prefetchCard(card.slug)}
        onTouchStart={() => prefetchCard(card.slug)}
        onClick={(event) => {
          event.preventDefault();
          open(card.slug, {
            photoUrl: card.photoUrl,
            photoCount: card.photoCount,
            hasPrompts: card.hasPrompt,
          });
        }}
      />
    </article>
  );
}
