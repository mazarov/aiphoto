"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Дольше на десктопе: шире viewport → больше карточек на границе rootMargin, меньше ложных «скрытий». */
const HIDE_DEBOUNCE_MS = 320;

type Options = {
  frameRef: RefObject<HTMLDivElement | null>;
  photoUrl: string | null;
  setReady: (ready: boolean) => void;
};

function afterNextPaint(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

/**
 * Lazy `next/image` cells: after scroll-away the decoded bitmap may be dropped while React
 * still has `imageReady === true` → skeleton stays off and the user sees `bg-zinc-200`.
 * On re-entry after a sustained hide: two rAF (layout/paint), then if `<img>` looks loaded,
 * `decode()` — `complete` alone is not enough on desktop when the GPU dropped the frame.
 * On decode failure or missing drawable data → `setReady(false)` until `onLoad` again.
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
          afterNextPaint(() => {
            const img = el.querySelector("img");
            if (!(img instanceof HTMLImageElement)) {
              setReady(false);
              return;
            }
            if (!img.complete || img.naturalWidth === 0) {
              setReady(false);
              return;
            }
            if (typeof img.decode === "function") {
              void img.decode().then(
                () => setReady(true),
                () => setReady(false)
              );
            } else {
              setReady(true);
            }
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
