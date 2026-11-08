/**
 * Shared masonry contract for prompt-card listings.
 * Homepage, generation examples, category/search/favorites all use the same
 * first-photo aspect (no 3:4 crop, no split-group cells).
 * Tailwind class strings live in the scanned ListingMasonry component.
 */

export const FALLBACK_LISTING_ASPECT_RATIOS = [
  3 / 4,
  4 / 5,
  2 / 3,
  1,
  5 / 6,
] as const;

export function listingPhotoAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
  index: number
): number {
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }
  return FALLBACK_LISTING_ASPECT_RATIOS[
    index % FALLBACK_LISTING_ASPECT_RATIOS.length
  ];
}

export type StableMasonryPlacement = {
  left: string;
  top: string;
  width: string;
};

export type StableMasonryLayout = {
  /** Tallest lane. The canvas uses this when every card stays visible. */
  height: string;
  /** Shortest lane. A teaser clips here so every column still has a card. */
  minHeight: string;
  placements: StableMasonryPlacement[];
};

function lengthExpression(
  widthFactor: number,
  pixelOffset: number
): string {
  const vw = Number(widthFactor.toFixed(6));
  const px = Number(pixelOffset.toFixed(3));
  if (Math.abs(px) < 0.001) return `calc(${vw}cqw)`;
  return `calc(${vw}cqw ${px >= 0 ? "+" : "-"} ${Math.abs(px)}px)`;
}

/**
 * Row-order lanes: card `i` goes to lane `i % columnCount`, so popularity
 * reads left to right, then top to bottom. Lane heights stay ragged.
 * Placement for an existing prefix never changes when more cards append.
 */
export function buildStableMasonryLayout(
  aspectRatios: readonly number[],
  columnCount: number,
  gapPx: number
): StableMasonryLayout {
  const safeColumns = Math.max(1, Math.floor(columnCount));
  const columnWidthFactor = 1 / safeColumns;
  const columnWidthPixelOffset =
    -((safeColumns - 1) * gapPx) / safeColumns;
  const laneFactors = Array.from({ length: safeColumns }, () => 0);
  const laneCounts = Array.from({ length: safeColumns }, () => 0);
  const placements: StableMasonryPlacement[] = [];

  aspectRatios.forEach((rawAspect, index) => {
    const aspect =
      Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 3 / 4;
    const lane = index % safeColumns;

    const topFactor = laneFactors[lane];
    const gapsBefore = laneCounts[lane];
    placements.push({
      width: lengthExpression(
        columnWidthFactor * 100,
        columnWidthPixelOffset
      ),
      left: lengthExpression(
        (lane / safeColumns) * 100,
        (lane * gapPx) / safeColumns
      ),
      top: lengthExpression(
        (topFactor / safeColumns) * 100,
        gapsBefore * gapPx +
          topFactor * columnWidthPixelOffset
      ),
    });

    laneFactors[lane] += 1 / aspect;
    laneCounts[lane] += 1;
  });

  const laneHeightExpressions = laneFactors.map((factor, lane) =>
    lengthExpression(
      (factor / safeColumns) * 100,
      Math.max(0, laneCounts[lane] - 1) * gapPx +
        factor * columnWidthPixelOffset
    )
  );

  const joinedLanes = laneHeightExpressions.join(", ");
  return {
    height:
      laneHeightExpressions.length === 1
        ? laneHeightExpressions[0]
        : `max(${joinedLanes})`,
    minHeight:
      laneHeightExpressions.length === 1
        ? laneHeightExpressions[0]
        : `min(${joinedLanes})`,
    placements,
  };
}

export type ListingMasonryLayouts = {
  mobile: StableMasonryLayout;
  tablet: StableMasonryLayout;
  desktop: StableMasonryLayout;
};

/** 2 / 3 / 4 lanes; breakpoints and gaps mirror `.stable-listing-masonry` in globals.css. */
export function buildListingMasonryLayouts(
  aspectRatios: readonly number[]
): ListingMasonryLayouts {
  return {
    mobile: buildStableMasonryLayout(aspectRatios, 2, 8),
    tablet: buildStableMasonryLayout(aspectRatios, 3, 12),
    desktop: buildStableMasonryLayout(aspectRatios, 4, 12),
  };
}
