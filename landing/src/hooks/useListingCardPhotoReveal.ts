"use client";

import { useEffect, useRef, type RefObject } from "react";

const HIDE_DEBOUNCE_MS = 200;

type Options = {
  frameRef: RefObject<HTMLDivElement | null>;
  photoUrl: string | null;
  setReady: (ready: boolean) => void;
};

/**
 * Lazy `next/image` cells: after scroll-away the decoded bitmap may be dropped while React
 * still has `imageReady === true` → skeleton stays off and the user sees `bg-zinc-200`.
 * On re-entry after a sustained hide, `setReady(false)` only if `rAF` shows the img is not
 * yet drawable — avoids flashing the skeleton when `complete` is already true.
 * Debounced hide reduces IO edge chatter (rootMargin + threshold 0).
 */
export function useListingCardPhotoReveal({
  frameRef,
  photoUrl,
  setReady,
}: Options) {
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    wasHiddenRef.current = false;
    const el = frameRef.current;
    if (!el || !photoUrl) return;

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const clearHideTimer = () => {
      if (hideTimer !== undefined) {
        clearTimeout(hideTimer);
        hideTimer = undefined;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        const vis = Boolean(entry?.isIntersecting);
        if (!vis) {
          clearHideTimer();
          hideTimer = setTimeout(() => {
            hideTimer = undefined;
            wasHiddenRef.current = true;
          }, HIDE_DEBOUNCE_MS);
          return;
        }
        clearHideTimer();
        if (wasHiddenRef.current) {
          wasHiddenRef.current = false;
          requestAnimationFrame(() => {
            const img = el.querySelector("img");
            if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
              return;
            }
            setReady(false);
          });
        }
      },
      { root: null, rootMargin: "160px", threshold: 0 }
    );

    io.observe(el);
    return () => {
      clearHideTimer();
      io.disconnect();
    };
  }, [photoUrl, setReady, frameRef]);
}
