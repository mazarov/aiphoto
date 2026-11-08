export type ListingSort = "popular" | "new";

export const LISTING_SORT_STORAGE_KEY = "promptshot_listing_sort";

/** Public listings. `/trends` is the only feed that passes `new` explicitly. */
export const LISTING_DEFAULT_SORT: ListingSort = "popular";

export function parseListingSort(raw: string | null | undefined): ListingSort {
  if (raw === "new" || raw === "popular") return raw;
  return LISTING_DEFAULT_SORT;
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
