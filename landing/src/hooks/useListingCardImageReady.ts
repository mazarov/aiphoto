"use client";

import { useCallback, useEffect, useState } from "react";

type Options = {
  /** Resets reveal when this identity changes (photo URL, active split id, etc.). */
  resetKey: string | null;
};

/**
 * Listing card photo reveal: always starts hidden, then shows after decode().
 * `priorityLoad` only affects next/image priority — not shimmer/shell skip.
 */
export function useListingCardImageReady({ resetKey }: Options) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setImageReady(false);
  }, [resetKey]);

  const onImageLoadingComplete = useCallback((img: HTMLImageElement) => {
    if (typeof img.decode === "function") {
      img.decode().then(() => setImageReady(true)).catch(() => setImageReady(true));
    } else {
      setImageReady(true);
    }
  }, []);

  return { imageReady, onImageLoadingComplete };
}
