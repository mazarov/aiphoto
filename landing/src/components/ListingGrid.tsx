import { type ReactNode } from "react";

/**
 * Canonical grid classes for all prompt-card listings (catalog, search, favorites, generations).
 * Single source of truth — keeps breakpoints in sync across every listing surface.
 */
export const LISTING_GRID_CLASSES =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

type Props = {
  children: ReactNode;
  /**
   * When true, adds `listing-grid-clamp` — hides the incomplete last row via CSS nth-child
   * selectors (see globals.css). Use while hasMore=true so the next batch fills the row.
   * When the list is exhausted (hasMore=false), remove clamp to reveal the final partial row.
   */
  clamp?: boolean;
  className?: string;
};

/**
 * Shared grid wrapper for all prompt-card listing surfaces (catalog, search, favorites, debug).
 * Provides canonical column breakpoints and optional incomplete-row clamping.
 */
export function ListingGrid({ children, clamp = false, className }: Props) {
  return (
    <div
      className={`${LISTING_GRID_CLASSES}${clamp ? " listing-grid-clamp" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
