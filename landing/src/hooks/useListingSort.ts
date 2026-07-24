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

export function useListingSort(options?: { disabled?: boolean }) {
  const disabled = options?.disabled === true;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sort = useMemo(
    () => (disabled ? ("popular" as ListingSort) : parseListingSort(searchParams.get("sort"))),
    [disabled, searchParams]
  );

  // Restore session preference when landing on a category without ?sort=
  useLayoutEffect(() => {
    if (disabled) return;

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
  }, [disabled, pathname, router, searchParams]);

  const setSort = useCallback(
    (next: ListingSort) => {
      if (disabled || next === sort) return;
      writeListingSortToSession(next);
      resetListingScroll();
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "popular") sp.delete("sort");
      else sp.set("sort", next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [disabled, pathname, router, searchParams, sort]
  );

  return { sort, setSort };
}
