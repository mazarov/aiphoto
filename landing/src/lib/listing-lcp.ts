/**
 * First N items in `FilterableGrid` DOM order (CSS grid: row-major, left-to-right)
 * get eager `next/image` + high fetch priority — fixes LCP when tools flag `loading=lazy` on hero image.
 */
export const LISTING_LCP_PRIORITY_GRID_ITEMS = 12;

export function hasListingPhotoDbAspect(
  meta: { width?: number | null; height?: number | null } | null | undefined
): boolean {
  const w = meta?.width;
  const h = meta?.height;
  return typeof w === "number" && typeof h === "number" && w > 0 && h > 0;
}
