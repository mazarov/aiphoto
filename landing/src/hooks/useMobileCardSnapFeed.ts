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
import { resolveListingNavNeighbors } from "@/lib/listing-card-navigation-context";
import {
  canCommitMobileCardSnap,
  mobileCardScrollBehavior,
  rebaseMobileCardScrollTop,
  resolveMobileCardSnapDirection,
  resolveMobileCardSnapTargetSlug,
} from "@/lib/mobile-card-snap";

const SETTLE_DEBOUNCE_MS = 110;
const STABLE_SCROLL_FRAMES = 2;
const STABLE_SCROLL_EPSILON_PX = 0.5;
const CLICK_SUPPRESS_DISTANCE_PX = 8;
const CLICK_SUPPRESS_MS = 400;
const SNAP_BUFFER_PER_DIRECTION = 8;
const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [data-no-swipe]";

type Options = {
  currentData: CardPageData;
  prevSlug: string | null;
  nextSlug: string | null;
  enabled: boolean;
  onCommit: (data: CardPageData) => void;
};

type NeighborCards = {
  prevPrev: CardPageData | null;
  prev: CardPageData | null;
  next: CardPageData | null;
  nextNext: CardPageData | null;
};

type Direction = "prev" | "next";
type InteractionPhase = "idle" | "interacting" | "settling" | "committing";
type PendingTargetLoad = {
  direction: Direction;
  slug: string;
  sourceSlug: string;
  generation: number;
};
function collectListingSlugs(
  currentSlug: string,
  direction: Direction,
  limit: number
): string[] {
  const slugs: string[] = [];
  let cursor = currentSlug;
  for (let index = 0; index < limit; index += 1) {
    const neighbors = resolveListingNavNeighbors(cursor);
    const slug =
      direction === "prev" ? neighbors?.prevSlug : neighbors?.nextSlug;
    if (!slug) break;
    slugs.push(slug);
    cursor = slug;
  }
  return slugs;
}

function readVisibleHeightPx(): number {
  const visual = window.visualViewport;
  if (visual && visual.height > 0) return Math.round(visual.height);
  return Math.round(window.innerHeight);
}

export function useMobileCardSnapFeed({
  currentData,
  prevSlug,
  nextSlug,
  enabled,
  onCommit,
}: Options) {
  const { getCardFromCache, setCardInCache, loadCard } = usePromptCardModal();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const snapRestoreRafRef = useRef<number | null>(null);
  const restoreSnapStylesRef = useRef<(() => void) | null>(null);
  const settleTokenRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const pendingTargetLoadRef = useRef<PendingTargetLoad | null>(null);
  const pendingTargetGenerationRef = useRef(0);
  const currentSlugRef = useRef(currentData.slug);
  currentSlugRef.current = currentData.slug;
  const committingRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const pointerStartScrollTopRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const lastHeightPxRef = useRef(0);
  const phaseRef = useRef<InteractionPhase>("idle");
  const prefersReducedMotionRef = useRef(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [neighbors, setNeighbors] = useState<NeighborCards>({
    prevPrev: null,
    prev: null,
    next: null,
    nextNext: null,
  });

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

  const cancelPendingTargetLoad = useCallback(() => {
    pendingTargetGenerationRef.current += 1;
    pendingTargetLoadRef.current = null;
  }, []);

  const setPhase = useCallback((phase: InteractionPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    const nextInteracting = phase !== "idle";
    setIsInteracting((current) =>
      current === nextInteracting ? current : nextInteracting
    );
  }, []);

  const prevBufferSlugs = useMemo(
    () =>
      collectListingSlugs(
        currentData.slug,
        "prev",
        SNAP_BUFFER_PER_DIRECTION
      ),
    [currentData.slug]
  );
  const nextBufferSlugs = useMemo(
    () =>
      collectListingSlugs(
        currentData.slug,
        "next",
        SNAP_BUFFER_PER_DIRECTION
      ),
    [currentData.slug]
  );
  const prevPrevSlug = prevBufferSlugs[1] ?? null;
  const nextNextSlug = nextBufferSlugs[1] ?? null;
  const currentSlideIndex = prevBufferSlugs.length;
  const extraPrevSlides = prevBufferSlugs
    .slice(2)
    .reverse()
    .map((slug) => ({ slug, data: getCardFromCache(slug) }));
  const extraNextSlides = nextBufferSlugs
    .slice(2)
    .map((slug) => ({ slug, data: getCardFromCache(slug) }));

  const slideHeightPx = useCallback(() => {
    const viewport = viewportRef.current;
    return Math.max(1, viewport?.clientHeight || readVisibleHeightPx());
  }, []);

  const syncSlideMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const height = Math.max(1, readVisibleHeightPx());
    if (lastHeightPxRef.current !== height) {
      lastHeightPxRef.current = height;
      const stage = viewport.parentElement;
      if (stage instanceof HTMLElement) {
        stage.style.height = `${height}px`;
      }
      viewport.style.height = `${height}px`;
      viewport.style.setProperty("--card-snap-slide-h", `${height}px`);
    }
    return height;
  }, []);

  const restoreSnapStyles = useCallback(() => {
    if (snapRestoreRafRef.current !== null) {
      window.cancelAnimationFrame(snapRestoreRafRef.current);
      snapRestoreRafRef.current = null;
    }
    const restore = restoreSnapStylesRef.current;
    restoreSnapStylesRef.current = null;
    restore?.();
  }, []);

  const scrollToCenter = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      restoreSnapStyles();
      const height = syncSlideMetrics() || slideHeightPx();
      const top = height * currentSlideIndex;

      if (behavior === "smooth") {
        viewport.scrollTo({ top, behavior });
        return;
      }

      // Keep the WebKit scroll layer alive: toggling overflow forces a visible
      // compositor repaint on physical iOS devices.
      const scrollSnapType = viewport.style.scrollSnapType;
      const scrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollSnapType = "none";
      viewport.style.scrollBehavior = "auto";
      viewport.scrollTop = top;
      restoreSnapStylesRef.current = () => {
        viewport.style.scrollSnapType = scrollSnapType;
        viewport.style.scrollBehavior = scrollBehavior;
      };
      snapRestoreRafRef.current = window.requestAnimationFrame(() => {
        snapRestoreRafRef.current = null;
        const restore = restoreSnapStylesRef.current;
        restoreSnapStylesRef.current = null;
        restore?.();
      });
    },
    [
      currentSlideIndex,
      restoreSnapStyles,
      slideHeightPx,
      syncSlideMetrics,
    ]
  );

  useLayoutEffect(() => {
    cancelPendingTargetLoad();
    committingRef.current = false;
    scrollToCenter("auto");
    setPhase("idle");
  }, [
    cancelPendingTargetLoad,
    currentData.id,
    scrollToCenter,
    setPhase,
  ]);

  useEffect(() => {
    setCardInCache(currentData.slug, currentData);
  }, [currentData, setCardInCache]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotionRef.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (enabled) return;
    settleTokenRef.current += 1;
    cancelPendingTargetLoad();
    clearSettleWork();
    pointerActiveRef.current = false;
    pointerStartScrollTopRef.current = null;
    scrollToCenter("auto");
    setPhase("idle");
  }, [
    enabled,
    cancelPendingTargetLoad,
    clearSettleWork,
    scrollToCenter,
    setPhase,
  ]);

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    setNeighbors({
      prevPrev: prevPrevSlug
        ? getCardFromCache(prevPrevSlug)
        : null,
      prev: prevSlug ? getCardFromCache(prevSlug) : null,
      next: nextSlug ? getCardFromCache(nextSlug) : null,
      nextNext: nextNextSlug
        ? getCardFromCache(nextNextSlug)
        : null,
    });

    async function loadNeighbor(
      slot: keyof NeighborCards,
      slug: string | null
    ) {
      if (!slug) return;
      const data = await loadCard(slug);
      if (!data || generation !== loadGenerationRef.current) return;
      setNeighbors((current) => ({ ...current, [slot]: data }));
    }

    void loadNeighbor("prevPrev", prevPrevSlug);
    void loadNeighbor("prev", prevSlug);
    void loadNeighbor("next", nextSlug);
    void loadNeighbor("nextNext", nextNextSlug);
  }, [
    prevPrevSlug,
    prevSlug,
    nextSlug,
    nextNextSlug,
    getCardFromCache,
    loadCard,
  ]);

  const finishScroll = useCallback(() => {
    settleTokenRef.current += 1;
    clearSettleWork();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const height = Math.max(1, viewport.clientHeight);
    const settledSlideIndex = Math.round(viewport.scrollTop / height);
    const direction = resolveMobileCardSnapDirection({
      scrollTop: viewport.scrollTop,
      slideHeight: height,
      currentSlideIndex,
      hasPrev: Boolean(prevSlug),
      hasNext: Boolean(nextSlug),
    });
    const targetSlug = resolveMobileCardSnapTargetSlug({
      settledSlideIndex,
      currentSlideIndex,
      prevSlugs: prevBufferSlugs,
      nextSlugs: nextBufferSlugs,
    });
    const target = targetSlug ? getCardFromCache(targetSlug) : null;

    if (
      canCommitMobileCardSnap({
        direction,
        targetAvailable: Boolean(target),
        alreadyCommitting: committingRef.current,
      }) &&
      target
    ) {
      cancelPendingTargetLoad();
      committingRef.current = true;
      setPhase("committing");
      onCommit(target);
      return;
    }
    if (committingRef.current) return;

    if (direction !== "current" && targetSlug && !target) {
      const sourceSlug = currentSlugRef.current;
      const pending = pendingTargetLoadRef.current;
      if (
        pending?.direction === direction &&
        pending.slug === targetSlug &&
        pending.sourceSlug === sourceSlug
      ) {
        return;
      }

      const generation = ++pendingTargetGenerationRef.current;
      pendingTargetLoadRef.current = {
        direction,
        slug: targetSlug,
        sourceSlug,
        generation,
      };
      setPhase("settling");
      void loadCard(targetSlug).then((loadedTarget) => {
        const activePending = pendingTargetLoadRef.current;
        if (
          !activePending ||
          activePending.generation !== generation ||
          pendingTargetGenerationRef.current !== generation ||
          currentSlugRef.current !== sourceSlug
        ) {
          return;
        }
        pendingTargetLoadRef.current = null;
        if (loadedTarget) {
          setNeighbors((current) => ({
            ...current,
            [direction]: loadedTarget,
          }));
        }
        if (pointerActiveRef.current) {
          setPhase("interacting");
          return;
        }

        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const currentHeight = Math.max(1, currentViewport.clientHeight);
        const settledSlideIndex = Math.round(
          currentViewport.scrollTop / currentHeight
        );
        const settledDirection = resolveMobileCardSnapDirection({
          scrollTop: currentViewport.scrollTop,
          slideHeight: currentHeight,
          currentSlideIndex,
          hasPrev: Boolean(prevSlug),
          hasNext: Boolean(nextSlug),
        });
        if (settledDirection !== direction) {
          setPhase(
            pointerActiveRef.current ? "interacting" : "idle"
          );
          return;
        }

        if (loadedTarget) {
          committingRef.current = true;
          setPhase("committing");
          onCommit(loadedTarget);
          return;
        }

        const behavior = mobileCardScrollBehavior(
          prefersReducedMotionRef.current
        );
        scrollToCenter(behavior);
        if (behavior === "auto") {
          setPhase("idle");
        } else {
          settleTimerRef.current = window.setTimeout(
            finishScroll,
            SETTLE_DEBOUNCE_MS * 2
          );
        }
      });
      return;
    }

    if (direction !== "current") {
      cancelPendingTargetLoad();
      setPhase("settling");
      const behavior = mobileCardScrollBehavior(
        prefersReducedMotionRef.current
      );
      scrollToCenter(behavior);
      if (behavior === "auto") {
        setPhase("idle");
      } else {
        settleTimerRef.current = window.setTimeout(
          finishScroll,
          SETTLE_DEBOUNCE_MS * 2
        );
      }
      return;
    }

    cancelPendingTargetLoad();
    setPhase(pointerActiveRef.current ? "interacting" : "idle");
  }, [
    cancelPendingTargetLoad,
    clearSettleWork,
    currentSlideIndex,
    getCardFromCache,
    loadCard,
    nextBufferSlugs,
    nextSlug,
    onCommit,
    prevBufferSlugs,
    prevSlug,
    scrollToCenter,
    setPhase,
  ]);

  const scheduleFinish = useCallback(() => {
    const token = ++settleTokenRef.current;
    clearSettleWork();
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (token !== settleTokenRef.current || pointerActiveRef.current) return;

      setPhase("settling");
      const viewport = viewportRef.current;
      if (!viewport) {
        setPhase("idle");
        return;
      }

      let stableFrames = 0;
      let lastScrollTop = viewport.scrollTop;
      const checkStablePosition = () => {
        settleRafRef.current = null;
        if (token !== settleTokenRef.current || pointerActiveRef.current) return;
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const currentScrollTop = currentViewport.scrollTop;
        if (
          Math.abs(currentScrollTop - lastScrollTop) <=
          STABLE_SCROLL_EPSILON_PX
        ) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
          lastScrollTop = currentScrollTop;
        }
        if (stableFrames >= STABLE_SCROLL_FRAMES) {
          finishScroll();
          return;
        }
        settleRafRef.current =
          window.requestAnimationFrame(checkStablePosition);
      };
      settleRafRef.current =
        window.requestAnimationFrame(checkStablePosition);
    }, SETTLE_DEBOUNCE_MS);
  }, [clearSettleWork, finishScroll, setPhase]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onScrollEnd = () => {
      if (pointerActiveRef.current) {
        scheduleFinish();
        return;
      }
      finishScroll();
    };
    viewport.addEventListener("scrollend", onScrollEnd);
    return () => viewport.removeEventListener("scrollend", onScrollEnd);
  }, [finishScroll, scheduleFinish]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onResize = () => {
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const previousHeight =
          lastHeightPxRef.current ||
          currentViewport.clientHeight ||
          readVisibleHeightPx();
        const nextHeight = Math.max(1, readVisibleHeightPx());
        if (nextHeight === lastHeightPxRef.current) return;
        const previousScrollTop = currentViewport.scrollTop;
        lastHeightPxRef.current = nextHeight;
        const stage = currentViewport.parentElement;
        if (stage instanceof HTMLElement) {
          stage.style.height = `${nextHeight}px`;
        }
        currentViewport.style.height = `${nextHeight}px`;
        currentViewport.style.setProperty(
          "--card-snap-slide-h",
          `${nextHeight}px`
        );
        currentViewport.scrollTop = rebaseMobileCardScrollTop({
          scrollTop: previousScrollTop,
          previousHeight,
          nextHeight,
          currentSlideIndex,
          interacting:
            pointerActiveRef.current || phaseRef.current !== "idle",
        });
      });
    };

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
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
  }, [currentSlideIndex]);

  useEffect(
    () => () => {
      settleTokenRef.current += 1;
      cancelPendingTargetLoad();
      clearSettleWork();
      restoreSnapStyles();
      loadGenerationRef.current += 1;
    },
    [cancelPendingTargetLoad, clearSettleWork, restoreSnapStyles]
  );

  const onScroll = useCallback(
    (_event: UIEvent<HTMLDivElement>) => {
      if (!enabled || committingRef.current) return;
      setPhase("interacting");
      scheduleFinish();
    },
    [enabled, scheduleFinish, setPhase]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || event.pointerType === "mouse") return;
      const target = event.target;
      if (target instanceof Element) {
        const interactiveTarget = target.closest(INTERACTIVE_SELECTOR);
        if (
          interactiveTarget &&
          !interactiveTarget.hasAttribute("data-swipe-ok")
        ) {
          return;
        }
      }
      pointerActiveRef.current = true;
      pointerStartScrollTopRef.current =
        viewportRef.current?.scrollTop ?? null;
    },
    [enabled]
  );

  const finishPointer = useCallback(() => {
    const startScrollTop = pointerStartScrollTopRef.current;
    if (!pointerActiveRef.current && startScrollTop === null) return;
    const distance =
      startScrollTop === null
        ? 0
        : Math.abs(
            (viewportRef.current?.scrollTop ?? startScrollTop) - startScrollTop
          );
    if (distance >= CLICK_SUPPRESS_DISTANCE_PX) {
      suppressClickUntilRef.current =
        performance.now() + CLICK_SUPPRESS_MS;
    }
    pointerActiveRef.current = false;
    pointerStartScrollTopRef.current = null;
    if (committingRef.current || pendingTargetLoadRef.current !== null) {
      return;
    }
    if (phaseRef.current !== "idle") {
      setPhase("settling");
      scheduleFinish();
    }
  }, [scheduleFinish, setPhase]);

  useEffect(() => {
    if (!enabled) return;
    const onUp = () => {
      if (
        !pointerActiveRef.current &&
        pointerStartScrollTopRef.current === null
      ) {
        return;
      }
      finishPointer();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, [enabled, finishPointer]);

  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (performance.now() >= suppressClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const scrollToDirection = useCallback(
    async (direction: Direction) => {
      if (!enabled) return;
      const sourceSlug = currentData.slug;
      const slug = direction === "prev" ? prevSlug : nextSlug;
      if (!slug) return;
      const cached = direction === "prev" ? neighbors.prev : neighbors.next;
      const target = cached ?? (await loadCard(slug));
      if (
        !target ||
        !viewportRef.current ||
        currentSlugRef.current !== sourceSlug
      ) {
        return;
      }

      setNeighbors((current) => ({ ...current, [direction]: target }));
      setPhase("settling");
      window.requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const height = slideHeightPx();
        const behavior = mobileCardScrollBehavior(
          prefersReducedMotionRef.current
        );
        viewport.scrollTo({
          top:
            height *
            (direction === "prev"
              ? currentSlideIndex - 1
              : currentSlideIndex + 1),
          behavior,
        });
        scheduleFinish();
      });
    },
    [
      enabled,
      currentData.slug,
      currentSlideIndex,
      loadCard,
      neighbors.next,
      neighbors.prev,
      nextSlug,
      prevSlug,
      scheduleFinish,
      setPhase,
      slideHeightPx,
    ]
  );

  return {
    viewportRef,
    extraPrevSlides,
    prevPrevSlug,
    prevPrevCard: neighbors.prevPrev,
    prevCard: neighbors.prev,
    nextCard: neighbors.next,
    nextNextSlug,
    nextNextCard: neighbors.nextNext,
    extraNextSlides,
    isInteracting,
    onScroll,
    onPointerDown,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onClickCapture,
    scrollToPrev: () => void scrollToDirection("prev"),
    scrollToNext: () => void scrollToDirection("next"),
  };
}
