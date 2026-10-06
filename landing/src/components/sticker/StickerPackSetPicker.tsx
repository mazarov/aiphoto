"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { stickerExampleThumbUrl } from "@/lib/sticker-examples";
import type { StickerPackExampleClient } from "@/lib/sticker-pack-examples-client";

export const STICKER_PACK_SET_PICKER_TITLE = "Набор";

type Props = {
  packs: readonly StickerPackExampleClient[] | null;
  selectedId: string | null;
  onSelect: (pack: StickerPackExampleClient) => void;
  tone?: "light" | "dark";
};

/**
 * Pack sets (`pack_content_sets`) inside the «Стиль» sheet.
 * The drawing style stays the sticker style picker above this grid.
 */
export function StickerPackSetPicker({ packs, selectedId, onSelect, tone = "light" }: Props) {
  const dark = tone === "dark";
  const cardClass = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} flex min-w-0 flex-col items-start rounded-2xl p-2 text-left transition ${
      active
        ? dark
          ? "bg-white/20 ring-2 ring-inset ring-indigo-300"
          : "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
        : dark
          ? "bg-white/10 ring-1 ring-inset ring-white/20"
          : "bg-zinc-50 ring-1 ring-inset ring-zinc-200"
    }`;

  if (!packs) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`h-28 animate-pulse rounded-2xl ${dark ? "bg-white/10" : "bg-zinc-100"}`} />
        ))}
      </div>
    );
  }

  if (!packs.length) {
    return (
      <p className={`px-1 text-[13px] font-medium ${dark ? "text-white/70" : "text-zinc-600"}`}>
        Наборы пока не загрузились.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={STICKER_PACK_SET_PICKER_TITLE}>
      {packs.map((pack) => {
        const active = pack.id === selectedId;
        return (
          <button
            key={pack.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(pack)}
            className={cardClass(active)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- resized WebP with alpha, not a JPEG thumb */}
            <img
              src={stickerExampleThumbUrl(pack.exampleUrl, "lg")}
              alt=""
              width={384}
              height={384}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="aspect-square w-full rounded-xl object-cover"
            />
            <span className={`mt-2 line-clamp-2 text-left text-[13px] font-semibold ${dark ? "text-white" : "text-zinc-900"}`}>
              {pack.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
