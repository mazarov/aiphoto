"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  getActiveListingNavigationSourceId,
  subscribeListingNavigationLoadMore,
  syncListingNavigationPaginationState,
  writeListingNavigationContext,
} from "@/lib/listing-card-navigation-context";

type Options = {
  slugs: readonly string[];
  hasMore?: boolean;
  onLoadMore?: () => void | Promise<unknown>;
  onPrimeCards?: () => void;
  /**
   * Primary page listings bind automatically on mount/update (`true`).
   * Secondary carousels / teaser strips pass `false` so they never clobber the
   * page's main paginated listing until the user actually clicks inside them.
   */
  bindOnMount?: boolean;
  enabled?: boolean;
};

export function useListingNavigationFeed({
  slugs,
  hasMore = false,
  onLoadMore,
  onPrimeCards,
  bindOnMount = true,
  enabled = true,
}: Options) {
  const sourceId = useId();
  const slugsRef = useRef(slugs);
  slugsRef.current = slugs;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const onPrimeCardsRef = useRef(onPrimeCards);
  onPrimeCardsRef.current = onPrimeCards;
  const mountedOnceRef = useRef(false);

  const bindNavigation = useCallback(() => {
    if (!enabled) return;
    const currentSlugs = slugsRef.current.filter((slug) => Boolean(slug));
    if (currentSlugs.length === 0) return;
    onPrimeCardsRef.current?.();
    writeListingNavigationContext(currentSlugs, {
      sourceId,
      hasMore: hasMoreRef.current,
    });
  }, [enabled, sourceId]);

  const onKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        bindNavigation();
      }
    },
    [bindNavigation]
  );

  useLayoutEffect(() => {
    if (!enabled || !bindOnMount) return;
    const currentSlugs = slugs.filter((slug) => Boolean(slug));
    if (currentSlugs.length === 0) return;

    const activeOwner = getActiveListingNavigationSourceId();
    // Write on first mount of the primary feed, or whenever this feed already
    // owns navigation (e.g. when `loadMore` appends the next page!).
    if (!mountedOnceRef.current || activeOwner === null || activeOwner === sourceId) {
      mountedOnceRef.current = true;
      onPrimeCardsRef.current?.();
      writeListingNavigationContext(currentSlugs, {
        sourceId,
        hasMore,
      });
    }
  }, [bindOnMount, enabled, hasMore, slugs, sourceId]);

  useLayoutEffect(() => {
    if (!enabled) return;
    syncListingNavigationPaginationState({ sourceId, hasMore });
  }, [enabled, hasMore, sourceId]);

  useEffect(() => {
    if (!enabled || !onLoadMore) return;
    return subscribeListingNavigationLoadMore(
      () => onLoadMoreRef.current?.(),
      { sourceId }
    );
  }, [enabled, Boolean(onLoadMore), sourceId]);

  return {
    sourceId,
    bindNavigation,
    navigationContainerProps: {
      onPointerDownCapture: bindNavigation,
      onKeyDownCapture,
    },
  };
}
