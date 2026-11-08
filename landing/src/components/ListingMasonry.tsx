import { type CSSProperties, type ReactNode } from "react";
import {
  buildListingMasonryLayouts,
  FALLBACK_LISTING_ASPECT_RATIOS,
} from "@/lib/listing-masonry";

/** Carousel card width = masonry column (2 / 3 / 4). Keep in this file for Tailwind scan. */
export const LISTING_MASONRY_CAROUSEL_CARD_CLASS =
  "w-[calc((100%-0.5rem)/2)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)]";
export const LISTING_MASONRY_CAROUSEL_TRACK_CLASS =
  "flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto scroll-smooth pb-1 scrollbar-none sm:gap-3";

export type ListingMasonryEntry = {
  key: string;
  aspectRatio: number;
  content: ReactNode;
};

type MasonryCustomProperties = CSSProperties & {
  "--masonry-height-2": string;
  "--masonry-height-3": string;
  "--masonry-height-4": string;
  "--masonry-min-height-2": string;
  "--masonry-min-height-3": string;
  "--masonry-min-height-4": string;
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

type MasonryProps = {
  entries: readonly ListingMasonryEntry[];
  loading?: boolean;
  className?: string;
  /** Clip the canvas to the shortest column while «Ещё» covers the last row. */
  clipToShortestColumn?: boolean;
  /** Rendered first inside the wrapper, e.g. an sr-only label. */
  before?: ReactNode;
  dataAttributes?: Record<`data-${string}`, string | number>;
};

/**
 * SSR-safe masonry shared by every public prompt listing.
 * Order is row-major (left to right, then the next row) on 2 / 3 / 4 lanes.
 * Appending entries extends lane tails; the prefix keeps identical CSS.
 */
export function ListingMasonry({
  entries,
  loading = false,
  className,
  clipToShortestColumn = false,
  before,
  dataAttributes,
}: MasonryProps) {
  const layouts = buildListingMasonryLayouts(
    entries.map((entry) => entry.aspectRatio)
  );
  const containerStyle: MasonryCustomProperties = {
    "--masonry-height-2": layouts.mobile.height,
    "--masonry-height-3": layouts.tablet.height,
    "--masonry-height-4": layouts.desktop.height,
    "--masonry-min-height-2": layouts.mobile.minHeight,
    "--masonry-min-height-3": layouts.tablet.minHeight,
    "--masonry-min-height-4": layouts.desktop.minHeight,
  };

  return (
    <div
      className={`stable-listing-masonry transition-opacity ${
        clipToShortestColumn ? "stable-listing-masonry-teaser " : ""
      }${loading ? "opacity-55" : "opacity-100"}${
        className ? ` ${className}` : ""
      }`}
      style={containerStyle}
      aria-live="polite"
      aria-busy={loading || undefined}
      {...dataAttributes}
    >
      {before}
      <div className="stable-listing-masonry-canvas">
        {entries.map((entry, index) => {
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
              key={entry.key}
              className="stable-listing-masonry-item"
              data-listing-fill-item=""
              style={itemStyle}
            >
              {entry.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SkeletonProps = {
  count?: number;
  className?: string;
};

export function ListingMasonrySkeleton({
  count = 8,
  className,
}: SkeletonProps) {
  const entries = Array.from({ length: count }, (_, index) => {
    const aspectRatio =
      FALLBACK_LISTING_ASPECT_RATIOS[
        index % FALLBACK_LISTING_ASPECT_RATIOS.length
      ];
    return {
      key: `skeleton-${index}`,
      aspectRatio,
      content: (
        <div
          className="w-full animate-pulse rounded-2xl bg-zinc-200/90"
          style={{ aspectRatio }}
        />
      ),
    };
  });
  return (
    <ListingMasonry
      className={className}
      loading
      entries={entries}
      before={<span className="sr-only">Загрузка карточек</span>}
    />
  );
}
