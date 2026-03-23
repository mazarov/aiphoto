import type { CSSProperties } from "react";

/**
 * Card image framing: use DB dimensions as source of truth (prompt_card_media.width/height).
 * Container aspect-ratio matches the photo (within clamp) + object-cover → no crop when exact;
 * legacy rows without dimensions fall back to fixed 3/4 + cover.
 *
 * Clamp keeps grid stable (no ultra-panoramas) while minimizing crop vs a single global aspect.
 */

const RATIO_MIN = 2 / 3; // ~ portrait 2:3
const RATIO_MAX = 3 / 2; // ~ landscape 3:2

/** width/height; null if unknown or invalid */
export function clampedAspectWidthOverHeight(
  width: number | null | undefined,
  height: number | null | undefined
): number | null {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const r = w / h;
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, r));
}

/** CSS aspect-ratio value (width/height), or null → caller uses Tailwind aspect-[3/4] */
export function cardPhotoAspectRatioStyle(
  width: number | null | undefined,
  height: number | null | undefined
): CSSProperties | undefined {
  const r = clampedAspectWidthOverHeight(width, height);
  if (r == null) return undefined;
  return { aspectRatio: r };
}

/** After `Image` load — same clamp as DB path; invalid → 3/4 */
export function clampMeasuredAspectRatio(
  naturalWidth: number,
  naturalHeight: number
): number {
  const r = naturalWidth / naturalHeight;
  if (!Number.isFinite(r) || r <= 0) return 3 / 4;
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, r));
}
