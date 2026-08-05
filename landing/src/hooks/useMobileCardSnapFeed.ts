"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from "react";
import type { CardPageData } from "@/lib/supabase";
import { usePromptCardModal } from "@/context/PromptCardModalContext";

const SETTLE_DEBOUNCE_MS = 90;
const LONG_PRESS_MS = 350;
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
  prev: CardPageData | null;
  next: CardPageData | null;
};

type Direction = "prev" | "next";

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
  const loadGenerationRef = useRef(0);
  const currentSlugRef = useRef(currentData.slug);
  currentSlugRef.current = currentData.slug;
  const committingRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [neighbors, setNeighbors] = useState<NeighborCards>({
    prev: null,
    next: null,
  });

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const currentSlideIndex = prevSlug ? 1 : 0;

  const scrollToCenter = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.clientHeight * currentSlideIndex,
      behavior,
    });
  }, [currentSlideIndex]);

  useLayoutEffect(() => {
    committingRef.current = false;
    scrollToCenter("auto");
    setIsInteracting(false);
  }, [currentData.id, scrollToCenter]);

  useEffect(() => {
    setCardInCache(currentData.slug, currentData);
  }, [currentData, setCardInCache]);

  useEffect(() => {
    if (enabled) return;
    clearSettleTimer();
    pointerActiveRef.current = false;
    scrollToCenter("auto");
    setIsInteracting(false);
  }, [enabled, clearSettleTimer, scrollToCenter]);

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    setNeighbors({
      prev: prevSlug ? getCardFromCache(prevSlug) : null,
      next: nextSlug ? getCardFromCache(nextSlug) : null,
    });

    async function loadNeighbor(
      direction: Direction,
      slug: string | null
    ) {
      if (!slug) return;
      const data = await loadCard(slug);
      if (!data || generation !== loadGenerationRef.current) return;
      setNeighbors((current) => ({ ...current, [direction]: data }));
    }

    void loadNeighbor("prev", prevSlug);
    void loadNeighbor("next", nextSlug);
  }, [prevSlug, nextSlug, getCardFromCache, loadCard]);

  const finishScroll = useCallback(() => {
    clearSettleTimer();
    const viewport = viewportRef.current;
    if (!viewport || committingRef.current) return;

    const height = Math.max(1, viewport.clientHeight);
    const slideIndex = Math.round(viewport.scrollTop / height);
    const target = slideIndex < currentSlideIndex
      ? neighbors.prev
      : slideIndex > currentSlideIndex
        ? neighbors.next
        : null;

    if (slideIndex !== currentSlideIndex && target) {
      committingRef.current = true;
      onCommit(target);
      return;
    }

    if (slideIndex !== currentSlideIndex) {
      scrollToCenter("smooth");
      settleTimerRef.current = window.setTimeout(
        () => {
          settleTimerRef.current = null;
          if (!pointerActiveRef.current) setIsInteracting(false);
        },
        SETTLE_DEBOUNCE_MS * 2
      );
      return;
    }

    if (!pointerActiveRef.current) setIsInteracting(false);
  }, [
    clearSettleTimer,
    currentSlideIndex,
    neighbors.next,
    neighbors.prev,
    onCommit,
    scrollToCenter,
  ]);

  const scheduleFinish = useCallback(() => {
    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(
      finishScroll,
      SETTLE_DEBOUNCE_MS
    );
  }, [clearSettleTimer, finishScroll]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onScrollEnd = () => finishScroll();
    viewport.addEventListener("scrollend", onScrollEnd);
    return () => viewport.removeEventListener("scrollend", onScrollEnd);
  }, [finishScroll]);

  useEffect(
    () => () => {
      clearSettleTimer();
      loadGenerationRef.current += 1;
    },
    [clearSettleTimer]
  );

  const onScroll = useCallback(
    (_event: UIEvent<HTMLDivElement>) => {
      if (!enabled || committingRef.current) return;
      setIsInteracting(true);
      scheduleFinish();
    },
    [enabled, scheduleFinish]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || event.pointerType === "mouse") return;
      pressStartedAtRef.current = performance.now();
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(INTERACTIVE_SELECTOR)
      ) {
        return;
      }
      pointerActiveRef.current = true;
      setIsInteracting(true);
    },
    [enabled]
  );

  const finishPointer = useCallback(() => {
    if (
      pressStartedAtRef.current > 0 &&
      performance.now() - pressStartedAtRef.current >= LONG_PRESS_MS
    ) {
      suppressClickUntilRef.current = performance.now() + 500;
    }
    pressStartedAtRef.current = 0;
    pointerActiveRef.current = false;
    scheduleFinish();
  }, [scheduleFinish]);

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
      setIsInteracting(true);
      window.requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        viewport.scrollTo({
          top:
            viewport.clientHeight *
            (direction === "prev"
              ? currentSlideIndex - 1
              : currentSlideIndex + 1),
          behavior: "smooth",
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
    ]
  );

  return {
    viewportRef,
    prevCard: neighbors.prev,
    nextCard: neighbors.next,
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
