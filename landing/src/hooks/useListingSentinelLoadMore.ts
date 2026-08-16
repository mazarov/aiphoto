"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  hasListingSentinelReachedLoadRange,
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
  loadMore: () => void | Promise<void>,
  isBusy: () => boolean,
  hasMore: () => boolean
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  const isBusyRef = useRef(isBusy);
  const hasMoreRef = useRef(hasMore);
  const triggeringRef = useRef(false);
  const scrollCheckRafRef = useRef<number | null>(null);
  const fallbackPausedUntilRef = useRef(0);
  loadMoreRef.current = loadMore;
  isBusyRef.current = isBusy;
  hasMoreRef.current = hasMore;

  const triggerLoadMore = useCallback(async () => {
    if (triggeringRef.current) return;
    triggeringRef.current = true;
    try {
      await loadMoreRef.current();
    } finally {
      triggeringRef.current = false;
      // Ignore the scroll event produced by browser scroll anchoring after append.
      // IntersectionObserver remains active during this short fallback-only pause.
      fallbackPausedUntilRef.current = performance.now() + 250;
    }
  }, []);

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
    void triggerLoadMore();
  }, [triggerLoadMore]);

  const recoverSkippedSentinel = useCallback(() => {
    if (performance.now() < fallbackPausedUntilRef.current) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (
      isListingScrollRestoreInProgress() ||
      isBusyRef.current() ||
      !hasMoreRef.current()
    ) {
      return;
    }
    const scrollRoot = getListingScrollRoot();
    if (
      !hasListingSentinelReachedLoadRange(
        el,
        listingScrollRootRect(scrollRoot)
      )
    ) {
      return;
    }
    void triggerLoadMore();
  }, [triggerLoadMore]);

  const scheduleDrain = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(drainIfNeeded);
    });
  }, [drainIfNeeded]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const scrollRoot = getListingScrollRoot();
    const scrollTarget =
      scrollRoot instanceof HTMLElement ? scrollRoot : window;
    const onScroll = () => {
      if (scrollCheckRafRef.current != null) return;
      scrollCheckRafRef.current = requestAnimationFrame(() => {
        scrollCheckRafRef.current = null;
        recoverSkippedSentinel();
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (isListingScrollRestoreInProgress()) return;
        if (
          entries[0]?.isIntersecting &&
          !isBusyRef.current() &&
          hasMoreRef.current()
        ) {
          void triggerLoadMore();
        }
      },
      {
        root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
        rootMargin: `${LISTING_SENTINEL_ROOT_MARGIN_PX}px`,
        threshold: 0,
      }
    );
    observer.observe(el);
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", onScroll);
      if (scrollCheckRafRef.current != null) {
        cancelAnimationFrame(scrollCheckRafRef.current);
        scrollCheckRafRef.current = null;
      }
    };
  }, [recoverSkippedSentinel, triggerLoadMore]);

  return { sentinelRef, scheduleDrain };
}
