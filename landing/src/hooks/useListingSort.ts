"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LISTING_DEFAULT_SORT,
  parseListingSort,
  writeListingSortToSession,
  readListingSortFromSession,
  type ListingSort,
} from "@/lib/listing-sort";
import {
  isListingOverlayPath,
  resetListingScroll,
} from "@/lib/scroll-preservation";

export function useListingSort(options?: { disabled?: boolean }) {
  const disabled = options?.disabled === true;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const overlayOpen = isListingOverlayPath(pathname);

  const liveSort = useMemo(
    () =>
      disabled
        ? ("new" as ListingSort)
        : parseListingSort(searchParams.get("sort")),
    [disabled, searchParams]
  );
  const frozenSortRef = useRef<ListingSort>(liveSort);
  if (!overlayOpen) {
    frozenSortRef.current = liveSort;
  }
  const sort = overlayOpen ? frozenSortRef.current : liveSort;

  // Restore session preference when landing on a category without ?sort=
  // Ignore overlay pushState URLs (`/p/<slug>`, `/pricing`, `/generate`, `/foto-v-promt`)
  // so opening a prompt card on `?sort=new` never remounts `InfiniteGrid` or triggers RSC `/p/?sort=new`.
  useLayoutEffect(() => {
    if (disabled || overlayOpen) return;

    const urlRaw = searchParams.get("sort");
    if (urlRaw === "new" || urlRaw === "popular") {
      writeListingSortToSession(urlRaw);
      return;
    }
    if (urlRaw !== null && urlRaw !== "") return;

    const stored = readListingSortFromSession();
    // Default is popular (no query param); only an explicit `new` choice is written into the URL.
    if (stored && stored !== LISTING_DEFAULT_SORT) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("sort", stored);
      router.replace(`${pathname}?${sp}`, { scroll: false });
    }
  }, [disabled, overlayOpen, pathname, router, searchParams]);

  const setSort = useCallback(
    (next: ListingSort) => {
      if (disabled || overlayOpen || next === sort) return;
      writeListingSortToSession(next);
      resetListingScroll();
      const sp = new URLSearchParams(searchParams.toString());
      if (next === LISTING_DEFAULT_SORT) sp.delete("sort");
      else sp.set("sort", next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [disabled, overlayOpen, pathname, router, searchParams, sort]
  );

  return { sort, setSort };
}
