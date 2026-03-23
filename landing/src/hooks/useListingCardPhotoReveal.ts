"use client";

import { useEffect, useRef, type RefObject } from "react";

type Options = {
  frameRef: RefObject<HTMLDivElement | null>;
  photoUrl: string | null;
  setReady: (ready: boolean) => void;
};

/**
 * Lazy `next/image` cells: after scroll-away the decoded bitmap may be dropped while React
 * still has `imageReady === true` → skeleton stays off and the user sees `bg-zinc-200`.
 * On re-entry, hide the photo placeholder until `onLoad` fires, unless `<img>.complete` already.
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

    const io = new IntersectionObserver(
      ([entry]) => {
        const vis = Boolean(entry?.isIntersecting);
        if (!vis) {
          wasHiddenRef.current = true;
          return;
        }
        if (wasHiddenRef.current) {
          wasHiddenRef.current = false;
          setReady(false);
          requestAnimationFrame(() => {
            const img = el.querySelector("img");
            if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
              setReady(true);
            }
          });
        }
      },
      { root: null, rootMargin: "160px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [photoUrl, setReady, frameRef]);
}
