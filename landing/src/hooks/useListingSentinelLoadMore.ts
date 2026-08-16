"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  LISTING_SENTINEL_ROOT_MARGIN_PX,
  isListingSentinelInLoadRange,
  listingScrollRootRect,
  shouldDrainListingPage,
} from "@/lib/listing-pagination";
import {
  getListingScrollRoot,
  isListingScrollRestoreInProgress,
} from "@/lib/scroll-preservation";

/**
 * Shared listing/search infinite-scroll trigger.
 * IO only fires on crossing; after a page lands we drain if the sentinel
 * is still inside rootMargin (first-page fold, duplicate-ranked appends).
 */
export function useListingSentinelLoadMore(
  loadMore: () => void,
  isBusy: () => boolean,
  hasMore: () => boolean
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  const isBusyRef = useRef(isBusy);
  const hasMoreRef = useRef(hasMore);
  loadMoreRef.current = loadMore;
  isBusyRef.current = isBusy;
  hasMoreRef.current = hasMore;

  const drainIfNeeded = useCallback(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (
      !shouldDrainListingPage({
        hasMore: hasMoreRef.current(),
        loading: isBusyRef.current(),
        restoreInProgress: isListingScrollRestoreInProgress(),
        sentinelInRange: isListingSentinelInLoadRange(
          el,
          listingScrollRootRect(getListingScrollRoot())
        ),
      })
    ) {
      return;
    }
    loadMoreRef.current();
  }, []);

  const scheduleDrain = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(drainIfNeeded);
    });
  }, [drainIfNeeded]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const scrollRoot = getListingScrollRoot();
    const observer = new IntersectionObserver(
      (entries) => {
        if (isListingScrollRestoreInProgress()) return;
        if (
          entries[0]?.isIntersecting &&
          !isBusyRef.current() &&
          hasMoreRef.current()
        ) {
          loadMoreRef.current();
        }
      },
      {
        root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
        rootMargin: `${LISTING_SENTINEL_ROOT_MARGIN_PX}px`,
        threshold: 0,
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, scheduleDrain };
}
