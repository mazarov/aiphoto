"use client";

import {
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import {
  buildStableMasonryLayout,
  listingPhotoAspectRatio,
} from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";

type Props = {
  cardPages: readonly (readonly PromptCardFull[])[];
  lcpPriorityCount?: number;
  loading?: boolean;
  debugOverlay?: (card: PromptCardFull) => ReactNode;
};

type MasonryCustomProperties = CSSProperties & {
  "--masonry-height-2": string;
  "--masonry-height-3": string;
  "--masonry-height-4": string;
};

type ItemCustomProperties = CSSProperties & {
  "--masonry-left-2": string;
  "--masonry-top-2": string;
  "--masonry-width-2": string;
  "--masonry-left-3": string;
  "--masonry-top-3": string;
  "--masonry-width-3": string;
  "--masonry-left-4": string;
  "--masonry-top-4": string;
  "--masonry-width-4": string;
};

/**
 * SSR-safe masonry with deterministic lanes for every breakpoint.
 * Appending a page extends the lane tails; the prefix keeps identical CSS.
 */
export function StableListingMasonry({
  cardPages,
  lcpPriorityCount = 0,
  loading = false,
  debugOverlay,
}: Props) {
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const aspects = useMemo(
    () =>
      cards.map((card, index) => {
        const example = toGenerationExampleCard(card);
        return listingPhotoAspectRatio(
          example.photoWidth,
          example.photoHeight,
          index
        );
      }),
    [cards]
  );
  const layouts = useMemo(
    () => ({
      mobile: buildStableMasonryLayout(aspects, 2, 8, 390),
      tablet: buildStableMasonryLayout(aspects, 3, 12, 800),
      desktop: buildStableMasonryLayout(aspects, 4, 12, 1228),
    }),
    [aspects]
  );
  const containerStyle: MasonryCustomProperties = {
    "--masonry-height-2": layouts.mobile.height,
    "--masonry-height-3": layouts.tablet.height,
    "--masonry-height-4": layouts.desktop.height,
  };

  return (
    <div
      className={`stable-listing-masonry transition-opacity ${
        loading ? "opacity-55" : "opacity-100"
      }`}
      style={containerStyle}
      aria-live="polite"
      aria-busy={loading || undefined}
      data-masonry-pages={cardPages.length}
    >
      {cards.map((card, index) => {
        const example = toGenerationExampleCard(card);
        const mobile = layouts.mobile.placements[index];
        const tablet = layouts.tablet.placements[index];
        const desktop = layouts.desktop.placements[index];
        const itemStyle: ItemCustomProperties = {
          "--masonry-left-2": mobile.left,
          "--masonry-top-2": mobile.top,
          "--masonry-width-2": mobile.width,
          "--masonry-left-3": tablet.left,
          "--masonry-top-3": tablet.top,
          "--masonry-width-3": tablet.width,
          "--masonry-left-4": desktop.left,
          "--masonry-top-4": desktop.top,
          "--masonry-width-4": desktop.width,
        };

        return (
          <div
            key={card.id}
            className="stable-listing-masonry-item"
            data-listing-fill-item=""
            style={itemStyle}
          >
            <ListingPhotoTile
              card={example}
              aspectRatio={aspects[index]}
              priority={index < lcpPriorityCount}
              debugOverlay={debugOverlay?.(card)}
            />
          </div>
        );
      })}
    </div>
  );
}
