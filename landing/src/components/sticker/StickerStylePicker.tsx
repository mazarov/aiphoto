"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import type { StickerStyle } from "@/lib/sticker";
import { StickerExampleStrip } from "./StickerExampleStrip";

export const STICKER_STYLE_PICKER_TITLE = "Стиль стикера";
export const STICKER_STYLE_PICKER_CONFIRM_CTA = "Выбрать";

type Props = {
  styles: readonly StickerStyle[];
  loading?: boolean;
  selectedId: string;
  onSelect: (style: StickerStyle) => void;
  /** Confirm button — closes the sheet in the parent. */
  onConfirmed?: () => void;
  tone?: "light" | "dark";
  confirmCtaClassName: string;
};

/**
 * Sticker styles from the bot (`style_presets_v2`) inside the dock «Выбрать стиль» sheet.
 * The selection stroke is inset: an outer ring is clipped by the sheet's overflow.
 */
export function StickerStylePicker({
  styles,
  loading = false,
  selectedId,
  onSelect,
  onConfirmed,
  tone = "light",
  confirmCtaClassName,
}: Props) {
  const dark = tone === "dark";

  const cardClass = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} flex min-w-0 max-w-full flex-col items-start rounded-2xl p-3 text-left transition ${
      active
        ? dark
          ? "bg-white/20 ring-2 ring-inset ring-indigo-300"
          : "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
        : dark
          ? "bg-white/10 ring-1 ring-inset ring-white/20"
          : "bg-zinc-50 ring-1 ring-inset ring-zinc-200"
    }`;

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-1">
        {loading && !styles.length ? (
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`h-24 animate-pulse rounded-2xl ${dark ? "bg-white/10" : "bg-zinc-100"}`} />
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={STICKER_STYLE_PICKER_TITLE}>
            {styles.map((style) => {
              const active = style.id === selectedId;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(style)}
                  className={cardClass(active)}
                >
                  <StickerExampleStrip urls={style.exampleUrls} styleLabel={style.label} className="mb-2" />
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${dark ? "text-white" : "text-zinc-900"}`}>
                    {style.emoji ? <span aria-hidden>{style.emoji}</span> : null}
                    {style.label}
                  </span>
                  {style.description || style.hint ? (
                    <span className={`mt-1 line-clamp-2 text-left text-[12px] leading-snug ${dark ? "text-white/70" : "text-zinc-600"}`}>
                      {style.description || style.hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {onConfirmed ? (
        <button type="button" onClick={onConfirmed} className={confirmCtaClassName} disabled={!selectedId}>
          {STICKER_STYLE_PICKER_CONFIRM_CTA}
        </button>
      ) : null}
    </div>
  );
}
