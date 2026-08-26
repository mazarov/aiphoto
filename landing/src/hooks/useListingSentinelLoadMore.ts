"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  LISTING_FILL_ITEM_SELECTOR,
  LISTING_FILL_LOOKAHEAD_PX,
  listingContentRemainingPx,
  listingScrollRootRect,
  shouldFillListingPage,
} from "@/lib/listing-pagination";
import {
  getListingScrollRoot,
  isListingScrollRestoreInProgress,
  notifyListingScrollFillContentChanged,
  peekListingScrollFillTargetY,
  readListingMaxScrollY,
  resolveListingScrollFillAction,
  subscribeListingScrollFill,
} from "@/lib/scroll-preservation";

function readListingContentBottom(scope: ParentNode): number | null {
  const items = scope.querySelectorAll(LISTING_FILL_ITEM_SELECTOR);
  if (items.length === 0) return null;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    bottom = Math.max(bottom, item.getBoundingClientRect().bottom);
  }
  return Number.isFinite(bottom) ? bottom : null;
}

/**
 * Viewport-fill controller for listing/search infinite scroll.
 * Wake-ups (scroll, resize, mount, request settle) only call ensureFilled.
 * The decision uses the last card bottom, not a 1px sentinel crossing.
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
  const pagesThisPassRef = useRef(0);
  loadMoreRef.current = loadMore;
  isBusyRef.current = isBusy;
  hasMoreRef.current = hasMore;

  const ensureFilled = useCallback(() => {
    if (triggeringRef.current) return;
    if (isBusyRef.current()) return;

    const fillTarget = peekListingScrollFillTargetY();
    if (fillTarget !== null) {
      if (!hasMoreRef.current()) {
        notifyListingScrollFillContentChanged({ hasMore: false });
        return;
      }
      const action = resolveListingScrollFillAction({
        targetY: fillTarget,
        maxScrollY: readListingMaxScrollY(),
        hasMore: true,
      });
      if (action !== "load") {
        notifyListingScrollFillContentChanged({ hasMore: true });
        return;
      }
      triggeringRef.current = true;
      void Promise.resolve(loadMoreRef.current()).finally(() => {
        triggeringRef.current = false;
        notifyListingScrollFillContentChanged({
          hasMore: hasMoreRef.current(),
        });
      });
      return;
    }

    if (isListingScrollRestoreInProgress()) return;
    if (!hasMoreRef.current()) return;

    const scrollRoot = getListingScrollRoot();
    const viewport = listingScrollRootRect(scrollRoot);
    const scope =
      scrollRoot instanceof HTMLElement ? scrollRoot : document;
    const contentBottom =
      readListingContentBottom(scope) ??
      sentinelRef.current?.getBoundingClientRect().bottom ??
      viewport.bottom;
    const remainingPx = listingContentRemainingPx(
      contentBottom,
      viewport.bottom
    );

    if (remainingPx >= LISTING_FILL_LOOKAHEAD_PX) {
      pagesThisPassRef.current = 0;
      return;
    }

    if (
      !shouldFillListingPage({
        hasMore: true,
        loading: false,
        restoreInProgress: false,
        remainingPx,
        pagesLoadedThisPass: pagesThisPassRef.current,
      })
    ) {
      return;
    }

    pagesThisPassRef.current += 1;
    triggeringRef.current = true;
    void Promise.resolve(loadMoreRef.current()).finally(() => {
      triggeringRef.current = false;
    });
  }, []);

  const scheduleDrain = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(ensureFilled);
    });
  }, [ensureFilled]);

  useEffect(() => {
    const scrollRoot = getListingScrollRoot();
    const scrollTarget =
      scrollRoot instanceof HTMLElement ? scrollRoot : window;
    const onScroll = () => {
      pagesThisPassRef.current = 0;
      if (scrollCheckRafRef.current != null) return;
      scrollCheckRafRef.current = requestAnimationFrame(() => {
        scrollCheckRafRef.current = null;
        ensureFilled();
      });
    };
    const onResize = () => {
      pagesThisPassRef.current = 0;
      scheduleDrain();
    };

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    const unsubscribeFill = subscribeListingScrollFill(() => {
      pagesThisPassRef.current = 0;
      scheduleDrain();
    });
    scheduleDrain();

    return () => {
      unsubscribeFill();
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      if (scrollCheckRafRef.current != null) {
        cancelAnimationFrame(scrollCheckRafRef.current);
        scrollCheckRafRef.current = null;
      }
    };
  }, [ensureFilled, scheduleDrain]);

  return { sentinelRef, scheduleDrain };
}
