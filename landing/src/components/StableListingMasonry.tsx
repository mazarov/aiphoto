"use client";

import { useMemo, type ReactNode } from "react";
import {
  ListingMasonry,
  type ListingMasonryEntry,
} from "@/components/ListingMasonry";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import { listingHeadingImageAlt } from "@/lib/hero-carousel-alt";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";

type Props = {
  cardPages: readonly (readonly PromptCardFull[])[];
  lcpPriorityCount?: number;
  loading?: boolean;
  debugOverlay?: (card: PromptCardFull) => ReactNode;
  headingAltSlots?: readonly string[];
  /** Clip the canvas to the shortest column while «Ещё» covers the last row. */
  clipToShortestColumn?: boolean;
};

/** Paged `PromptCardFull` feed on top of the shared row-order `ListingMasonry`. */
export function StableListingMasonry({
  cardPages,
  lcpPriorityCount = 0,
  loading = false,
  debugOverlay,
  headingAltSlots,
  clipToShortestColumn = false,
}: Props) {
  const entries = useMemo<ListingMasonryEntry[]>(
    () =>
      cardPages.flat().map((card, index) => {
        const example = toGenerationExampleCard(card);
        const aspectRatio = listingPhotoAspectRatio(
          example.photoWidth,
          example.photoHeight,
          index
        );
        return {
          key: card.id,
          aspectRatio,
          content: (
            <ListingPhotoTile
              card={example}
              aspectRatio={aspectRatio}
              priority={index < lcpPriorityCount}
              debugOverlay={debugOverlay?.(card)}
              imageAlt={listingHeadingImageAlt(
                index,
                headingAltSlots,
                example.title
              )}
            />
          ),
        };
      }),
    [cardPages, lcpPriorityCount, debugOverlay, headingAltSlots]
  );

  return (
    <ListingMasonry
      entries={entries}
      loading={loading}
      clipToShortestColumn={clipToShortestColumn}
      dataAttributes={{ "data-masonry-pages": cardPages.length }}
    />
  );
}
