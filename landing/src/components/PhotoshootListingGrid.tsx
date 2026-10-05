"use client";

import Image from "next/image";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

type SeoFrame = {
  src: string;
  srcSet?: string;
  alt: string;
  width: number | null;
  height: number | null;
};

type Props = {
  urls: string[];
  alt: string;
  /** Per-frame alt. When set, index 0 is no longer the only described frame. */
  alts?: readonly string[] | null;
  frames?: readonly (SeoFrame | null)[] | null;
  priority?: boolean;
  onSelect?: (url: string, index: number) => void;
  onPrefetch?: () => void;
  onError?: () => void;
  onLoad?: () => void;
  selectedIndex?: number;
  sizes?: string;
  className?: string;
  /** Grid side: 2 = photoshoot (4 frames), 4 = sticker pack (16 stickers). */
  columns?: 2 | 4;
  /** Accessible per-tile noun: «Кадр» for photos, «Стикер» for a pack. */
  tileLabel?: string;
};

/** Same flush sheet as `/generations` (2×2 photoshoot or 4×4 sticker pack): hover dims siblings, click opens that tile. */
export function PhotoshootListingGrid({
  urls,
  alt,
  alts = null,
  frames = null,
  priority = false,
  onSelect,
  onPrefetch,
  onError,
  onLoad,
  selectedIndex,
  sizes = SIZES_CARD_GRID,
  className = "",
  columns = 2,
  tileLabel = "Кадр",
}: Props) {
  const interactive = Boolean(onSelect);
  const gridClass = columns === 4 ? "grid-cols-4 grid-rows-4" : "grid-cols-2 grid-rows-2";

  return (
    <div
      className={`photoshoot-history-grid absolute inset-0 z-[2] grid ${gridClass} bg-zinc-900${
        interactive ? " is-interactive" : ""
      }${className ? ` ${className}` : ""}`}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
    >
      {urls.slice(0, columns * columns).map((url, index) => {
        const label = `${tileLabel} ${index + 1}`;
        const frameAlt = alts ? (alts[index] ?? "") : index === 0 ? alt : "";
        const frame = frames?.[index];
        const media = frame ? (
          <img
            src={frame.src}
            srcSet={frame.srcSet}
            alt={frame.alt}
            sizes={sizes}
            width={frame.width && frame.width > 0 ? frame.width : undefined}
            height={frame.height && frame.height > 0 ? frame.height : undefined}
            decoding="async"
            loading={priority && index === 0 ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : undefined}
            className="photoshoot-history-tile__img absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <Image
            src={url}
            alt={frameAlt}
            fill
            sizes={sizes}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priority && index === 0}
            fetchPriority={priority && index === 0 ? "high" : undefined}
            className="photoshoot-history-tile__img object-cover"
            draggable={false}
            onLoad={index === 0 ? onLoad : undefined}
            onError={index === 0 ? onError : undefined}
          />
        );
        const tileClass =
          index === selectedIndex
            ? "photoshoot-history-tile is-selected relative overflow-hidden"
            : "photoshoot-history-tile relative overflow-hidden";
        if (!interactive || !onSelect) {
          return (
            <div key={`${url}-${index}`} className={tileClass}>
              {media}
              <span className="sr-only">{label}</span>
            </div>
          );
        }
        return (
          <button
            key={`${url}-${index}`}
            type="button"
            aria-label={`Открыть ${label}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(url, index);
            }}
            className={`${OVERLAY_BUTTON_UA_RESET} ${tileClass} z-[11] cursor-pointer touch-manipulation`}
          >
            {media}
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Four thumbs to switch frames on the mobile photoshoot card. */
export function PhotoshootFrameStrip({
  urls,
  activeIndex,
  onSelect,
}: {
  urls: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className="pointer-events-auto flex items-center justify-center gap-1.5"
      role="tablist"
      aria-label="Кадры фотосессии"
    >
      {urls.slice(0, 4).map((url, index) => {
        const selected = index === activeIndex;
        return (
          <button
            key={`${url}-${index}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`Кадр ${index + 1}`}
            onClick={() => onSelect(index)}
            className={`${OVERLAY_BUTTON_UA_RESET} relative h-9 w-9 overflow-hidden rounded-lg ring-2 touch-manipulation ${
              selected ? "ring-white" : "ring-white/30"
            }`}
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="36px"
              quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
              className="object-cover"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
