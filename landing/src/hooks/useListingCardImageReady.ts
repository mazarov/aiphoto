"use client";

import { useCallback, useState, type SyntheticEvent } from "react";

type Options = {
  /** Resets reveal when this identity changes (photo URL, active split id, etc.). */
  resetKey: string | null;
};

/**
 * Listing card photo reveal.
 *
 * Race-condition fix: instead of a useEffect that resets imageReady asynchronously
 * (which could fire AFTER onLoad already set it to true for cached images), we use
 * React's "derived state" pattern — reset synchronously during render when resetKey changes.
 *
 * Defense in depth: the skeleton now lives at z-[1] under the photo (z-[2]). Once the
 * photo is painted and opaque, the skeleton is naturally hidden even if imageReady is stale.
 * imageReady is only needed to gate hover-chrome visibility.
 */
export function useListingCardImageReady({ resetKey }: Options) {
  const [prevKey, setPrevKey] = useState(resetKey);
  const [imageReady, setImageReady] = useState(false);

  // Synchronous reset during render — avoids the race where useEffect fires
  // after onLoad has already set imageReady=true for browser-cached images.
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setImageReady(false);
  }

  const onImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (typeof img.decode === "function") {
      img.decode().then(() => setImageReady(true)).catch(() => setImageReady(true));
    } else {
      setImageReady(true);
    }
  }, []);

  // Callback ref: fires synchronously when the img element mounts.
  // Handles images already in browser cache (img.complete=true before React's onLoad fires).
  const imageRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) {
      setImageReady(true);
    }
  }, []);

  return { imageReady, onImageLoad, imageRef };
}
