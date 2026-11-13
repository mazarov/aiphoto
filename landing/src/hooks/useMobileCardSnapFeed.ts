"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from "react";
import type { CardPageData } from "@/lib/supabase";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  readListingNavigationContext,
  requestListingNavigationLoadMore,
  subscribeListingNavigationUpdates,
} from "@/lib/listing-card-navigation-context";
import {
  buildInitialSessionSlugs,
  freezeMobileCardSnapOnUnmount,
  isMobileCardSnapViewportUsable,
  mergeSessionListingSlugs,
  mobileCardScrollBehavior,
  MOBILE_CARD_SNAP_MAX_WIDTH_MQ,
  rebaseMobileCardScrollTop,
  replaceSessionSlugInPlace,
  resolveVirtualCardSnapWindow,
  resolveVirtualCardVisualIndex,
  shouldRecenterMobileCardSnapOnResize,
} from "@/lib/mobile-card-snap";
import {
  canMutateAuthReturnCardSlug,
  isAuthReturnCardPinned,
  peekAuthReturnCardPin,
} from "@/lib/auth-return-card-pin";

const SETTLE_POLL_DELAY_MS = 48;
const STABLE_SCROLL_FRAMES = 2;
const STABLE_SCROLL_EPSILON_PX = 0.5;
const CLICK_SUPPRESS_DISTANCE_PX = 8;
const CLICK_SUPPRESS_MS = 380;
const INFINITE_SCROLL_LOOKAHEAD = 14;
const INTERACTION_PREFETCH_BEHIND = 2;
const INTERACTION_PREFETCH_AHEAD = 5;

export type VirtualMobileCardSlide = {
  slug: string;
  index: number;
  data: CardPageData | null;
  isActive: boolean;
  isSettled: boolean;
};

type Options = {
  currentData: CardPageData;
  enabled: boolean;
  promptSheetOpen?: boolean;
  /** Switches the sibling HUD at the 50% scroll midpoint. */
  onVisualChange: (data: CardPageData) => void;
  /** Commits URL sync, sliding prefetch, and analytics once scrolling settles. */
  onSettledCommit: (data: CardPageData) => void;
};

function readVisibleHeightPx(): number {
  const visual = window.visualViewport;
  if (visual && visual.height > 0) return Math.round(visual.height);
  return Math.round(window.innerHeight);
}

export function useMobileCardSnapFeed({
  currentData,
  enabled,
  promptSheetOpen = false,
  onVisualChange,
  onSettledCommit,
}: Options) {
  const {
    getCardFromCache,
    setCardInCache,
    loadCard,
    prefetchCardWindow,
  } = usePromptCardModal();

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const settleTokenRef = useRef(0);

  const onVisualChangeRef = useRef(onVisualChange);
  onVisualChangeRef.current = onVisualChange;
  const onSettledCommitRef = useRef(onSettledCommit);
  onSettledCommitRef.current = onSettledCommit;

  const pointerActiveRef = useRef(false);
  const pointerStartScrollTopRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const programmaticTargetIndexRef = useRef<number | null>(null);
  const ignoreProgrammaticJumpRef = useRef(false);

  const slideHeightRef = useRef(0);
  const lastUsableRef = useRef(false);
  const lastMobileMqRef = useRef(false);
  const hydratedTrackRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [slideHeight, setSlideHeight] = useState(0);
  const [sessionSlugs, setSessionSlugs] = useState<string[]>(() => [
    currentData.slug,
  ]);
  const [visualIndex, setVisualIndex] = useState(0);
  const [settledIndex, setSettledIndex] = useState(0);
  const [snapInitialized, setSnapInitialized] = useState(false);
  const [, setCacheRevision] = useState(0);

  const sessionSlugsRef = useRef(sessionSlugs);
  sessionSlugsRef.current = sessionSlugs;
  const visualIndexRef = useRef(visualIndex);
  visualIndexRef.current = visualIndex;
  const settledIndexRef = useRef(settledIndex);
  settledIndexRef.current = settledIndex;
  const lastInternalSlugRef = useRef(currentData.slug);

  const hasNeighbors = sessionSlugs.length > 1;
  const snapActive = enabled && isMobileViewport;
  const snapScrollEnabled =
    snapActive && snapInitialized && hasNeighbors && !promptSheetOpen;

  const clearSettleWork = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (settleRafRef.current !== null) {
      window.cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
  }, []);

  const syncViewportHeightPx = useCallback((): number => {
    const viewport = viewportRef.current;
    const measured = Math.max(
      1,
      Math.round(viewport?.clientHeight || readVisibleHeightPx())
    );
    if (viewport) {
      const visible = Math.max(1, readVisibleHeightPx());
      if (slideHeightRef.current !== visible) {
        slideHeightRef.current = visible;
        const stage = viewport.parentElement;
        if (stage instanceof HTMLElement) {
          stage.style.height = `${visible}px`;
        }
        viewport.style.height = `${visible}px`;
        viewport.style.setProperty("--card-snap-slide-h", `${visible}px`);
        setSlideHeight(visible);
      }
      return visible;
    }
    return measured;
  }, []);

  const jumpToSlideIndexInstant = useCallback(
    (targetIndex: number, explicitHeight?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const height =
        explicitHeight && explicitHeight > 0
          ? explicitHeight
          : slideHeightRef.current || syncViewportHeightPx();
      if (height <= 0) return;

      const targetTop = Math.max(0, targetIndex) * height;
      ignoreProgrammaticJumpRef.current = true;
      const prevSnap = viewport.style.scrollSnapType;
      const prevBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollSnapType = "none";
      viewport.style.scrollBehavior = "auto";
      viewport.scrollTop = targetTop;
      // Target is an exact snap boundary (`index * height`), so restoring snap
      // immediately after forcing layout keeps native snap armed from frame 0.
      void viewport.offsetHeight;
      viewport.style.scrollSnapType = prevSnap;
      viewport.style.scrollBehavior = prevBehavior;
      window.requestAnimationFrame(() => {
        ignoreProgrammaticJumpRef.current = false;
      });
    },
    [syncViewportHeightPx]
  );

  // Prime current card data into the shared LRU cache immediately.
  useEffect(() => {
    setCardInCache(currentData.slug, currentData);
  }, [currentData, setCardInCache]);

  // Track reduced-motion & mobile viewport media queries.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotionRef.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const media = window.matchMedia(MOBILE_CARD_SNAP_MAX_WIDTH_MQ);
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Hydrate the monotonic session track synchronously before first browser paint.
  useLayoutEffect(() => {
    if (!enabled) return;
    if (hydratedTrackRef.current) return;
    hydratedTrackRef.current = true;

    const initial = buildInitialSessionSlugs({
      currentSlug: currentData.slug,
      listingSlugs: readListingNavigationContext(),
    });
    const height = syncViewportHeightPx();

    sessionSlugsRef.current = initial.slugs;
    visualIndexRef.current = initial.initialIndex;
    settledIndexRef.current = initial.initialIndex;
    lastInternalSlugRef.current = currentData.slug;

    setSessionSlugs(initial.slugs);
    setVisualIndex(initial.initialIndex);
    setSettledIndex(initial.initialIndex);
    setSnapInitialized(true);

    prefetchCardWindow(currentData.slug);
    if (initial.initialIndex > 0) {
      jumpToSlideIndexInstant(initial.initialIndex, height);
    }
  }, [
    currentData.slug,
    enabled,
    jumpToSlideIndexInstant,
    prefetchCardWindow,
    syncViewportHeightPx,
  ]);

  // Ensure scrollTop matches `visualIndex * slideHeight` right after initial track commit.
  useLayoutEffect(() => {
    if (!snapActive || !snapInitialized) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const height = slideHeightRef.current || syncViewportHeightPx();
    const expectedTop = visualIndexRef.current * height;
    if (
      programmaticTargetIndexRef.current === null &&
      !pointerActiveRef.current &&
      Math.abs(viewport.scrollTop - expectedTop) > 2
    ) {
      jumpToSlideIndexInstant(visualIndexRef.current, height);
    }
    // Only re-verify when initialization or mobile activation flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapActive, snapInitialized]);

  // Append-only updates from infinite scroll on the underlying listing.
  useEffect(() => {
    if (!enabled) return;
    const mergeFromListing = () => {
      const merged = mergeSessionListingSlugs({
        sessionSlugs: sessionSlugsRef.current,
        incomingSlugs: readListingNavigationContext(),
      });
      if (merged !== sessionSlugsRef.current && merged.length !== sessionSlugsRef.current.length) {
        sessionSlugsRef.current = merged;
        setSessionSlugs(merged);
      }
    };
    mergeFromListing();
    return subscribeListingNavigationUpdates(mergeFromListing);
  }, [enabled]);

  // Sync external slug changes (split-group sibling pills `1 / 2 / 3` or OAuth pin revert).
  useLayoutEffect(() => {
    if (!hydratedTrackRef.current) return;
    if (currentData.slug === lastInternalSlugRef.current) return;

    const updated = replaceSessionSlugInPlace({
      sessionSlugs: sessionSlugsRef.current,
      activeIndex: visualIndexRef.current,
      nextSlug: currentData.slug,
    });
    lastInternalSlugRef.current = currentData.slug;
    programmaticTargetIndexRef.current = null;

    if (updated.mode === "replace-in-place") {
      sessionSlugsRef.current = updated.slugs;
      setSessionSlugs(updated.slugs);
      return;
    }
    if (updated.mode === "jump") {
      visualIndexRef.current = updated.index;
      settledIndexRef.current = updated.index;
      setVisualIndex(updated.index);
      setSettledIndex(updated.index);
      jumpToSlideIndexInstant(updated.index);
    }
  }, [currentData.slug, jumpToSlideIndexInstant]);

  // Ensure every slide in the virtual + prefetch window is loaded into cache.
  useEffect(() => {
    if (!snapInitialized) return;
    let cancelled = false;
    const slugs = sessionSlugsRef.current;
    const start = Math.max(0, visualIndex - INTERACTION_PREFETCH_BEHIND);
    const end = Math.min(
      slugs.length - 1,
      visualIndex + INTERACTION_PREFETCH_AHEAD
    );
    for (let idx = start; idx <= end; idx += 1) {
      const slug = slugs[idx];
      if (!slug || getCardFromCache(slug)) continue;
      void loadCard(slug).then((loaded) => {
        if (cancelled || !loaded) return;
        setCacheRevision((rev) => rev + 1);
        if (sessionSlugsRef.current[visualIndexRef.current] === slug) {
          onVisualChangeRef.current(loaded);
        }
        if (sessionSlugsRef.current[settledIndexRef.current] === slug) {
          onSettledCommitRef.current(loaded);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [getCardFromCache, loadCard, sessionSlugs, snapInitialized, visualIndex]);

  const commitSettledPosition = useCallback(() => {
    settleTokenRef.current += 1;
    clearSettleWork();
    programmaticTargetIndexRef.current = null;

    const viewport = viewportRef.current;
    if (!viewport || !snapActive) return;

    const slugs = sessionSlugsRef.current;
    if (slugs.length === 0) return;
    const height = Math.max(
      1,
      slideHeightRef.current || viewport.clientHeight || readVisibleHeightPx()
    );

    if (isAuthReturnCardPinned()) {
      const pinSlug = peekAuthReturnCardPin();
      const pinIndex = pinSlug ? slugs.indexOf(pinSlug) : -1;
      const targetPinIdx = pinIndex >= 0 ? pinIndex : visualIndexRef.current;
      jumpToSlideIndexInstant(targetPinIdx, height);
      return;
    }

    const nextIndex = resolveVirtualCardVisualIndex({
      scrollTop: viewport.scrollTop,
      slideHeight: height,
      totalSlides: slugs.length,
      fallbackIndex: visualIndexRef.current,
    });
    const nextSlug = slugs[nextIndex];
    if (!nextSlug || !canMutateAuthReturnCardSlug(nextSlug)) {
      return;
    }

    if (visualIndexRef.current !== nextIndex) {
      visualIndexRef.current = nextIndex;
      setVisualIndex(nextIndex);
    }
    if (settledIndexRef.current !== nextIndex) {
      settledIndexRef.current = nextIndex;
      setSettledIndex(nextIndex);
    }
    lastInternalSlugRef.current = nextSlug;

    prefetchCardWindow(nextSlug);
    if (
      slugs.length > 1 &&
      slugs.length - 1 - nextIndex < INFINITE_SCROLL_LOOKAHEAD
    ) {
      requestListingNavigationLoadMore();
    }

    const cached =
      nextSlug === currentData.slug ? currentData : getCardFromCache(nextSlug);
    if (cached) {
      onVisualChangeRef.current(cached);
      onSettledCommitRef.current(cached);
      return;
    }

    void loadCard(nextSlug).then((loaded) => {
      if (!loaded) return;
      setCacheRevision((rev) => rev + 1);
      if (sessionSlugsRef.current[visualIndexRef.current] === nextSlug) {
        onVisualChangeRef.current(loaded);
      }
      if (sessionSlugsRef.current[settledIndexRef.current] === nextSlug) {
        onSettledCommitRef.current(loaded);
      }
    });
  }, [
    clearSettleWork,
    currentData,
    getCardFromCache,
    jumpToSlideIndexInstant,
    loadCard,
    prefetchCardWindow,
    snapActive,
  ]);

  const scheduleSettleCheck = useCallback(() => {
    const token = ++settleTokenRef.current;
    clearSettleWork();
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (token !== settleTokenRef.current || pointerActiveRef.current) return;
      const viewport = viewportRef.current;
      if (!viewport) return;

      let stableFrames = 0;
      let lastTop = viewport.scrollTop;
      const pollStable = () => {
        settleRafRef.current = null;
        if (token !== settleTokenRef.current || pointerActiveRef.current) {
          return;
        }
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const nowTop = currentViewport.scrollTop;
        if (Math.abs(nowTop - lastTop) <= STABLE_SCROLL_EPSILON_PX) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
          lastTop = nowTop;
        }
        if (stableFrames >= STABLE_SCROLL_FRAMES) {
          commitSettledPosition();
          return;
        }
        settleRafRef.current = window.requestAnimationFrame(pollStable);
      };
      settleRafRef.current = window.requestAnimationFrame(pollStable);
    }, SETTLE_POLL_DELAY_MS);
  }, [clearSettleWork, commitSettledPosition]);

  const syncVisualMidpointFromScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !snapActive || ignoreProgrammaticJumpRef.current) return;

    const slugs = sessionSlugsRef.current;
    if (slugs.length <= 1) return;

    const height = Math.max(
      1,
      slideHeightRef.current || viewport.clientHeight || readVisibleHeightPx()
    );

    if (isAuthReturnCardPinned()) {
      const pinSlug = peekAuthReturnCardPin();
      const pinIdx = pinSlug ? slugs.indexOf(pinSlug) : -1;
      if (pinIdx >= 0) {
        jumpToSlideIndexInstant(pinIdx, height);
      }
      return;
    }

    const nextVisual = resolveVirtualCardVisualIndex({
      scrollTop: viewport.scrollTop,
      slideHeight: height,
      totalSlides: slugs.length,
      fallbackIndex: visualIndexRef.current,
    });

    if (nextVisual === visualIndexRef.current) return;
    const nextSlug = slugs[nextVisual];
    if (!nextSlug || !canMutateAuthReturnCardSlug(nextSlug)) return;

    visualIndexRef.current = nextVisual;
    lastInternalSlugRef.current = nextSlug;
    setVisualIndex(nextVisual);

    const cached =
      nextSlug === currentData.slug ? currentData : getCardFromCache(nextSlug);
    if (cached) {
      onVisualChangeRef.current(cached);
    }
  }, [currentData, getCardFromCache, jumpToSlideIndexInstant, snapActive]);

  const onScroll = useCallback(
    (_event: UIEvent<HTMLDivElement>) => {
      if (!snapActive || ignoreProgrammaticJumpRef.current) return;
      if (scrollRafRef.current === null) {
        scrollRafRef.current = window.requestAnimationFrame(() => {
          scrollRafRef.current = null;
          syncVisualMidpointFromScroll();
        });
      }
      if (!pointerActiveRef.current) {
        scheduleSettleCheck();
      }
    },
    [scheduleSettleCheck, snapActive, syncVisualMidpointFromScroll]
  );

  // Native `scrollend` fast-path (iOS 17.4+, Chrome, Firefox).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !snapActive) return;
    const onScrollEnd = () => {
      if (ignoreProgrammaticJumpRef.current) return;
      if (pointerActiveRef.current) {
        scheduleSettleCheck();
        return;
      }
      commitSettledPosition();
    };
    viewport.addEventListener("scrollend", onScrollEnd);
    return () => viewport.removeEventListener("scrollend", onScrollEnd);
  }, [commitSettledPosition, scheduleSettleCheck, snapActive]);

  // Passive pointer tracking — only used to know when finger is down and to
  // suppress accidental clicks on multi-photo / 2x2 grid tap zones after a drag.
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!snapActive || event.pointerType === "mouse") return;
      programmaticTargetIndexRef.current = null;
      pointerActiveRef.current = true;
      pointerStartScrollTopRef.current = viewportRef.current?.scrollTop ?? null;
    },
    [snapActive]
  );

  const finishPointer = useCallback(() => {
    const startTop = pointerStartScrollTopRef.current;
    if (!pointerActiveRef.current && startTop === null) return;
    const currentTop = viewportRef.current?.scrollTop ?? startTop ?? 0;
    if (
      startTop !== null &&
      Math.abs(currentTop - startTop) >= CLICK_SUPPRESS_DISTANCE_PX
    ) {
      suppressClickUntilRef.current = performance.now() + CLICK_SUPPRESS_MS;
    }
    pointerActiveRef.current = false;
    pointerStartScrollTopRef.current = null;
    scheduleSettleCheck();
  }, [scheduleSettleCheck]);

  useEffect(() => {
    if (!snapActive) return;
    const onUp = () => {
      if (!pointerActiveRef.current && pointerStartScrollTopRef.current === null) {
        return;
      }
      finishPointer();
    };
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, [finishPointer, snapActive]);

  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (performance.now() >= suppressClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // ResizeObserver + iOS dynamic toolbar (`visualViewport`) height sync.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onResize = () => {
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const stage = currentViewport.parentElement;
        const stageDisplayNone =
          stage instanceof HTMLElement &&
          getComputedStyle(stage).display === "none";
        const mobileMq = window.matchMedia(
          MOBILE_CARD_SNAP_MAX_WIDTH_MQ
        ).matches;
        const crossedToMobileViewport = mobileMq && !lastMobileMqRef.current;
        lastMobileMqRef.current = mobileMq;

        const nextUsable = isMobileCardSnapViewportUsable({
          clientHeight: currentViewport.clientHeight,
          displayNone: getComputedStyle(currentViewport).display === "none",
          stageDisplayNone,
        });
        const previousUsable = lastUsableRef.current;
        lastUsableRef.current = nextUsable;
        const nextHeight = Math.max(1, readVisibleHeightPx());

        if (
          shouldRecenterMobileCardSnapOnResize({
            previousUsable,
            nextUsable,
            crossedToMobileViewport,
          })
        ) {
          slideHeightRef.current = nextHeight;
          if (stage instanceof HTMLElement) {
            stage.style.height = `${nextHeight}px`;
          }
          currentViewport.style.height = `${nextHeight}px`;
          currentViewport.style.setProperty(
            "--card-snap-slide-h",
            `${nextHeight}px`
          );
          setSlideHeight(nextHeight);
          jumpToSlideIndexInstant(visualIndexRef.current, nextHeight);
          return;
        }

        if (!nextUsable || nextHeight === slideHeightRef.current) return;

        const previousHeight =
          slideHeightRef.current || currentViewport.clientHeight || nextHeight;
        const previousScrollTop = currentViewport.scrollTop;
        slideHeightRef.current = nextHeight;
        if (stage instanceof HTMLElement) {
          stage.style.height = `${nextHeight}px`;
        }
        currentViewport.style.height = `${nextHeight}px`;
        currentViewport.style.setProperty(
          "--card-snap-slide-h",
          `${nextHeight}px`
        );
        setSlideHeight(nextHeight);
        currentViewport.scrollTop = rebaseMobileCardScrollTop({
          scrollTop: previousScrollTop,
          previousHeight,
          nextHeight,
          currentSlideIndex: visualIndexRef.current,
          interacting: pointerActiveRef.current,
        });
      });
    };

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    if (viewport.parentElement) observer.observe(viewport.parentElement);
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [jumpToSlideIndexInstant]);

  // Freeze WebKit momentum scroll before unmount so underlying listing stays tappable.
  useEffect(
    () => () => {
      const viewport = viewportRef.current;
      if (viewport) {
        const targetTop = freezeMobileCardSnapOnUnmount({
          scrollTop: viewport.scrollTop,
          slideHeight: viewport.clientHeight || slideHeightRef.current,
          style: viewport.style,
        });
        viewport.scrollTop = targetTop;
      }
      settleTokenRef.current += 1;
      clearSettleWork();
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    },
    [clearSettleWork]
  );

  // Re-entrant arrow & keyboard navigation (`↑ / ↓` can be tapped rapidly without lockout).
  const scrollToDirection = useCallback(
    (direction: "prev" | "next") => {
      if (!snapActive || promptSheetOpen) return;
      const viewport = viewportRef.current;
      const slugs = sessionSlugsRef.current;
      if (!viewport || slugs.length <= 1) return;

      const baseIndex =
        programmaticTargetIndexRef.current ?? visualIndexRef.current;
      const targetIndex =
        direction === "prev" ? baseIndex - 1 : baseIndex + 1;
      if (targetIndex < 0 || targetIndex >= slugs.length) return;

      const targetSlug = slugs[targetIndex];
      if (!targetSlug || !canMutateAuthReturnCardSlug(targetSlug)) return;

      programmaticTargetIndexRef.current = targetIndex;
      void loadCard(targetSlug);

      const height = Math.max(
        1,
        slideHeightRef.current || viewport.clientHeight || readVisibleHeightPx()
      );
      const behavior = mobileCardScrollBehavior(
        prefersReducedMotionRef.current
      );
      viewport.scrollTo({
        top: targetIndex * height,
        behavior,
      });
      if (behavior === "auto") {
        window.requestAnimationFrame(() => {
          syncVisualMidpointFromScroll();
          commitSettledPosition();
        });
      } else {
        scheduleSettleCheck();
      }
    },
    [
      commitSettledPosition,
      loadCard,
      promptSheetOpen,
      scheduleSettleCheck,
      snapActive,
      syncVisualMidpointFromScroll,
    ]
  );

  // Keyboard ArrowUp / ArrowDown support on mobile/tablet/narrow viewports.
  useEffect(() => {
    if (!snapScrollEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        scrollToDirection("next");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        scrollToDirection("prev");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scrollToDirection, snapScrollEnabled]);

  const virtualWindow = useMemo(
    () =>
      resolveVirtualCardSnapWindow({
        totalSlides: sessionSlugs.length,
        centerIndex: visualIndex,
      }),
    [sessionSlugs.length, visualIndex]
  );

  const virtualSlides: VirtualMobileCardSlide[] = [];
  for (
    let idx = virtualWindow.startIndex;
    idx <= virtualWindow.endIndex;
    idx += 1
  ) {
    const slug = sessionSlugs[idx];
    if (!slug) continue;
    const resolvedData =
      slug === currentData.slug ? currentData : getCardFromCache(slug);
    virtualSlides.push({
      slug,
      index: idx,
      data: resolvedData,
      isActive: idx === visualIndex,
      isSettled: idx === settledIndex,
    });
  }

  const windowCardIds = useMemo(() => {
    const ids = new Set<string>([currentData.id]);
    const start = Math.max(0, settledIndex - INTERACTION_PREFETCH_BEHIND);
    const end = Math.min(
      sessionSlugs.length - 1,
      settledIndex + INTERACTION_PREFETCH_AHEAD
    );
    for (let idx = start; idx <= end; idx += 1) {
      const slug = sessionSlugs[idx];
      if (!slug) continue;
      const card =
        slug === currentData.slug ? currentData : getCardFromCache(slug);
      if (card?.id) ids.add(card.id);
    }
    return [...ids];
  }, [currentData, getCardFromCache, sessionSlugs, settledIndex]);

  const prevSlug =
    visualIndex > 0 ? (sessionSlugs[visualIndex - 1] ?? null) : null;
  const nextSlug =
    visualIndex < sessionSlugs.length - 1
      ? (sessionSlugs[visualIndex + 1] ?? null)
      : null;

  return {
    viewportRef,
    virtualSlides,
    totalSlides: sessionSlugs.length,
    slideHeight,
    visualIndex,
    settledIndex,
    prevSlug,
    nextSlug,
    hasNeighbors,
    neighborsAttached: snapInitialized && hasNeighbors,
    snapScrollEnabled,
    windowCardIds,
    onScroll,
    onPointerDown,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onClickCapture,
    scrollToPrev: () => scrollToDirection("prev"),
    scrollToNext: () => scrollToDirection("next"),
  };
}
