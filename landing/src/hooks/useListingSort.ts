"use client";

import { useCallback, useLayoutEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseListingSort,
  writeListingSortToSession,
  readListingSortFromSession,
  type ListingSort,
} from "@/lib/listing-sort";
import { resetListingScroll } from "@/lib/scroll-preservation";

export function useListingSort() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sort = useMemo(
    () => parseListingSort(searchParams.get("sort")),
    [searchParams]
  );

  // Restore session preference when landing on a category without ?sort=
  useLayoutEffect(() => {
    const urlRaw = searchParams.get("sort");
    if (urlRaw === "new" || urlRaw === "popular") {
      writeListingSortToSession(urlRaw);
      return;
    }
    if (urlRaw !== null && urlRaw !== "") return;

    const stored = readListingSortFromSession();
    if (stored === "new") {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("sort", "new");
      router.replace(`${pathname}?${sp}`, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const setSort = useCallback(
    (next: ListingSort) => {
      if (next === sort) return;
      writeListingSortToSession(next);
      resetListingScroll();
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "popular") sp.delete("sort");
      else sp.set("sort", next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, sort]
  );

  return { sort, setSort };
}
