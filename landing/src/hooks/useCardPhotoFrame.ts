"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  cardPhotoAspectRatioStyle,
  clampMeasuredAspectRatio,
  clampedAspectWidthOverHeight,
} from "@/lib/card-photo-aspect";

/**
 * Frame for card photos: prefer `prompt_card_media.width/height`; if missing (common for
 * legacy ingest), derive aspect from `next/image` `onLoadingComplete` (natural dimensions).
 */
export function useCardPhotoFrame(
  dbWidth: number | null | undefined,
  dbHeight: number | null | undefined,
  imageKey: string
) {
  const dbStyle = useMemo(
    () => cardPhotoAspectRatioStyle(dbWidth, dbHeight),
    [dbWidth, dbHeight]
  );
  const hasDb = clampedAspectWidthOverHeight(dbWidth, dbHeight) != null;

  const [measuredStyle, setMeasuredStyle] = useState<CSSProperties | undefined>(
    undefined
  );

  useEffect(() => {
    setMeasuredStyle(undefined);
  }, [imageKey]);

  const containerStyle = dbStyle ?? measuredStyle;
  /** @deprecated Always apply `aspect-[3/4]` on the wrapper; inline `containerStyle` overrides it. Columns layout needs a stable class-based ratio. */
  const showTailwindFallback = containerStyle == null;

  const onLoadingComplete = useCallback(
    (img: HTMLImageElement) => {
      if (hasDb) return;
      const r = clampMeasuredAspectRatio(img.naturalWidth, img.naturalHeight);
      setMeasuredStyle({ aspectRatio: r });
    },
    [hasDb]
  );

  return { containerStyle, showTailwindFallback, onLoadingComplete };
}
