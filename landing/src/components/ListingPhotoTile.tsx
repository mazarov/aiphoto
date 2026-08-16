"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
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
  repeating?: boolean;
  onRepeat?: (card: GenerationExampleCard) => void;
};

export function ListingPhotoTile({
  card,
  aspectRatio,
  priority = false,
  debugOverlay,
  repeating = false,
  onRepeat,
}: Props) {
  const { open, prefetchCard } = usePromptCardModal();
  const showRepeat = Boolean(onRepeat && card.hasPrompt);

  return (
    <article
      className="group relative isolate overflow-hidden rounded-2xl bg-zinc-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
      style={{ aspectRatio }}
    >
      {card.photoUrl ? (
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

      <Link
        href={`/p/${card.slug}`}
        className="absolute inset-0 z-10"
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

      {showRepeat ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-zinc-950/65 to-transparent px-3.5 pb-3.5 pt-14 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            disabled={repeating}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRepeat?.(card);
            }}
            className="pointer-events-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75"
          >
            {repeating ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                aria-hidden
              />
            ) : null}
            {repeating ? "Открываем…" : "Повторить"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
