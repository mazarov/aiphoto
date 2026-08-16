import { ListingMasonrySkeleton } from "./ListingMasonry";

type Props = {
  count?: number;
  /** Kept for callers; masonry placeholders are photo-only. */
  photoOnly?: boolean;
};

/**
 * Placeholders while fetching the next listing page — same masonry shape as
 * homepage / generation example tiles.
 */
export function ListingGridLoadingSkeleton({ count = 8 }: Props) {
  return <ListingMasonrySkeleton count={count} className="py-6" />;
}
