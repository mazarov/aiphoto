"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import type { StickerStyle } from "@/lib/sticker";
import {
  STICKER_STYLE_PICKER_CONFIRM_CTA,
  STICKER_STYLE_PICKER_TITLE,
} from "@/lib/sticker-action-sheet";
import { StickerExampleStrip } from "./StickerExampleStrip";

export { STICKER_STYLE_PICKER_CONFIRM_CTA, STICKER_STYLE_PICKER_TITLE };

type Props = {
  styles: readonly StickerStyle[];
  loading?: boolean;
  selectedId: string;
  onSelect: (style: StickerStyle) => void;
  /** Confirm button — closes the sheet in the parent. */
  onConfirmed?: () => void;
  tone?: "light" | "dark";
  confirmCtaClassName: string;
  /** Sheet already scrolls and draws «Готово» — used when the pack set sits under the styles. */
  embedded?: boolean;
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
  embedded = false,
}: Props) {
  const dark = tone === "dark";
  const hasLiveExamples = styles.some(
    (style) => (style.exampleUrls?.length ?? 0) > 0,
  );
  const showSkeleton = loading && !hasLiveExamples;

  const cardClass = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} relative flex min-w-0 max-w-full flex-col items-start rounded-2xl p-3 text-left transition ${
      active
        ? dark
          ? "bg-indigo-500/20 ring-2 ring-inset ring-indigo-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
          : "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
        : dark
          ? "bg-white/[0.06] ring-1 ring-inset ring-white/15 hover:bg-white/[0.11] hover:ring-white/25"
          : "bg-zinc-50 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100"
    }`;

  return (
    <div className={embedded ? "min-w-0 w-full" : "flex min-h-0 min-w-0 w-full flex-[1_1_auto] flex-col"}>
      <div className={embedded ? "min-w-0" : "min-h-0 min-w-0 flex-[1_1_auto] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
        {showSkeleton ? (
          <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`flex h-32 animate-pulse flex-col justify-between rounded-2xl p-3 ${
                  dark ? "bg-white/[0.06] ring-1 ring-inset ring-white/10" : "bg-zinc-100"
                }`}
              >
                <div className="flex gap-1.5">
                  <span className={`h-14 w-14 rounded-xl ${dark ? "bg-white/15" : "bg-zinc-200"}`} />
                  <span className={`h-14 w-14 rounded-xl ${dark ? "bg-white/15" : "bg-zinc-200"}`} />
                </div>
                <span className={`h-3.5 w-20 rounded-full ${dark ? "bg-white/20" : "bg-zinc-200"}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={STICKER_STYLE_PICKER_TITLE}>
            {styles.map((style, index) => {
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
                  {active ? (
                    <span
                      className="pointer-events-none absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm"
                      aria-hidden
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                      >
                        <path
                          d="m5 12.5 4.5 4.5L19 7.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                  <StickerExampleStrip
                    urls={style.exampleUrls}
                    styleLabel={style.label}
                    fallbackEmoji={style.emoji || "✨"}
                    dark={dark}
                    viewport={index < 4 ? "eager" : undefined}
                    className="mb-2.5"
                  />
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${dark ? "text-white" : "text-zinc-900"}`}>
                    {style.emoji ? <span aria-hidden>{style.emoji}</span> : null}
                    {style.label}
                  </span>
                  {style.description || style.hint ? (
                    <span className={`mt-1 line-clamp-2 text-left text-[12px] leading-snug ${dark ? "text-white/65" : "text-zinc-600"}`}>
                      {style.description || style.hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!embedded && onConfirmed ? (
        <button type="button" onClick={onConfirmed} className={confirmCtaClassName} disabled={!selectedId}>
          {STICKER_STYLE_PICKER_CONFIRM_CTA}
        </button>
      ) : null}
    </div>
  );
}
