"use client";

import Image from "next/image";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

type Props = {
  urls: string[];
  alt: string;
  priority?: boolean;
  onSelect?: (url: string, index: number) => void;
  onPrefetch?: () => void;
  selectedIndex?: number;
  sizes?: string;
};

/** Same 2×2 flush sheet as `/generations`: hover dims siblings, click opens that frame. */
export function PhotoshootListingGrid({
  urls,
  alt,
  priority = false,
  onSelect,
  onPrefetch,
  selectedIndex,
  sizes = SIZES_CARD_GRID,
}: Props) {
  const interactive = Boolean(onSelect);

  return (
    <div
      className={`photoshoot-history-grid absolute inset-0 z-[2] grid grid-cols-2 grid-rows-2 bg-zinc-900${
        interactive ? " is-interactive" : ""
      }`}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
    >
      {urls.slice(0, 4).map((url, index) => {
        const label = `Кадр ${index + 1}`;
        const media = (
          <Image
            src={url}
            alt={index === 0 ? alt : ""}
            fill
            sizes={sizes}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priority && index === 0}
            fetchPriority={priority && index === 0 ? "high" : undefined}
            className="photoshoot-history-tile__img object-cover"
            draggable={false}
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
