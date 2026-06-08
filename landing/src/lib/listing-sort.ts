export type ListingSort = "popular" | "new";

export const LISTING_SORT_STORAGE_KEY = "promptshot_listing_sort";

export function parseListingSort(raw: string | null | undefined): ListingSort {
  if (raw === "new") return "new";
  return "popular";
}

/** Returns false when raw is present but not popular|new (API → 400). */
export function isListingSortParamValid(raw: string | null): boolean {
  if (raw === null || raw === "") return true;
  return raw === "popular" || raw === "new";
}

export function readListingSortFromSession(): ListingSort | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(LISTING_SORT_STORAGE_KEY);
    if (v === "popular" || v === "new") return v;
  } catch {
    /* private mode */
  }
  return null;
}

export function writeListingSortToSession(sort: ListingSort): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LISTING_SORT_STORAGE_KEY, sort);
  } catch {
    /* ignore */
  }
}
