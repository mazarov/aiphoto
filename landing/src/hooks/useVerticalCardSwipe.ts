"use client";

import { useCallback, useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;
const SWIPE_AXIS_RATIO = 1.2;
/** Cap visual drag so the photo doesn't travel too far. */
const SWIPE_OFFSET_MAX = 72;

/** Interactive controls that should not start a card-swipe gesture.
 * Photo edge tap-zones use `data-swipe-ok` so vertical listing swipe still works there.
 */
const IGNORE_SELECTOR =
  'button:not([data-swipe-ok]), a:not([data-swipe-ok]), input, textarea, select, [data-no-swipe], [role="dialog"]';

type Options = {
  enabled: boolean;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  /** Called when a qualifying vertical swipe is recognized (before navigate). */
  onSwipeRecognized?: () => void;
};

type TouchHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
  swipeOffset: number;
};

/**
 * Vertical swipe (up → next, down → prev) for mobile listing-card navigation.
 * Ignores gestures that start on interactive controls.
 */
export function useVerticalCardSwipe({
  enabled,
  onSwipeUp,
  onSwipeDown,
  onSwipeRecognized,
}: Options): TouchHandlers {
  const startRef = useRef<{
    x: number;
    y: number;
    ignore: boolean;
  } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const reset = useCallback(() => {
    startRef.current = null;
    setSwipeOffset(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      if (!t) return;
      const target = e.target;
      const ignore =
        target instanceof Element && Boolean(target.closest(IGNORE_SELECTOR));
      startRef.current = { x: t.clientX, y: t.clientY, ignore };
      setSwipeOffset(0);
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const start = startRef.current;
      if (!start || start.ignore) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      // Only show offset when the gesture looks vertical.
      if (Math.abs(dy) > Math.abs(dx) * SWIPE_AXIS_RATIO) {
        const clamped = Math.max(
          -SWIPE_OFFSET_MAX,
          Math.min(SWIPE_OFFSET_MAX, dy * 0.35)
        );
        setSwipeOffset(clamped);
      } else {
        setSwipeOffset(0);
      }
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) {
        reset();
        return;
      }
      const start = startRef.current;
      if (!start || start.ignore) {
        reset();
        return;
      }
      const t = e.changedTouches[0];
      if (!t) {
        reset();
        return;
      }
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      const absY = Math.abs(dy);
      const absX = Math.abs(dx);

      if (absY >= SWIPE_THRESHOLD && absY > absX * SWIPE_AXIS_RATIO) {
        onSwipeRecognized?.();
        if (dy < 0) {
          onSwipeUp();
        } else {
          onSwipeDown();
        }
      }
      reset();
    },
    [enabled, onSwipeUp, onSwipeDown, onSwipeRecognized, reset]
  );

  const onTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    swipeOffset,
  };
}
