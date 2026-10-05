"use client";

import { useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import {
  STICKER_BORDER_MAX_PX,
  STICKER_BORDER_MIN_PX,
  STICKER_BORDER_PRESETS_PX,
  STICKER_BORDER_PX,
  clampStickerBorderPx,
} from "@/lib/sticker";
import { STICKER_ACTION_EXIT, STICKER_BORDER_COPY } from "@/lib/sticker-action-sheet";

type Props = {
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { borderPx: number }) => Promise<boolean> | boolean | void;
};

/**
 * Overlay on the sticker result plate: white die-cut width in px of the 512 canvas.
 * Slider + number field + quick picks; the API clamps to the same bounds.
 */
export function StickerBorderSheet({ busy, error = null, onClose, onSubmit }: Props) {
  const [borderPx, setBorderPx] = useState<number>(STICKER_BORDER_PX);
  /** Raw text of the number field so the user can clear it while typing. */
  const [draft, setDraft] = useState<string>(String(STICKER_BORDER_PX));
  const [starting, setStarting] = useState(false);

  const submitting = busy || starting;
  const pick = (value: number) => {
    const next = clampStickerBorderPx(value);
    setBorderPx(next);
    setDraft(String(next));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setStarting(true);
    try {
      await onSubmit({ borderPx });
    } finally {
      setStarting(false);
    }
  };

  const exitAction: GenerationResultAction = {
    id: "exit",
    label: STICKER_ACTION_EXIT,
    disabled: submitting,
    onClick: onClose,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    ),
  };
  const ctaLabel = submitting ? STICKER_BORDER_COPY.busy : `${STICKER_BORDER_COPY.cta} ${borderPx} px`;
  const submitAction: GenerationResultAction = {
    id: "submit",
    label: ctaLabel,
    ariaLabel: ctaLabel,
    primary: true,
    wrap: true,
    disabled: submitting,
    onClick: () => void handleSubmit(),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 12 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const chip = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-10 items-center rounded-full px-3 text-[13px] font-medium tabular-nums transition disabled:opacity-50 ${
      active ? "bg-white text-zinc-900 ring-2 ring-indigo-300" : "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"
    }`;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-label={STICKER_BORDER_COPY.title}>
      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[11rem] z-30 max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl bg-black/55 p-3 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md">
        <h3 className="text-[15px] font-semibold">{STICKER_BORDER_COPY.title}</h3>
        <p className="mt-0.5 text-[12px] text-white/75">{STICKER_BORDER_COPY.lead}</p>

        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Быстрый выбор">
          {STICKER_BORDER_PRESETS_PX.map((preset) => {
            const active = borderPx === preset;
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={submitting}
                className={chip(active)}
                onClick={() => pick(preset)}
              >
                {preset} px
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={STICKER_BORDER_MIN_PX}
            max={STICKER_BORDER_MAX_PX}
            step={1}
            value={borderPx}
            disabled={submitting}
            aria-label={STICKER_BORDER_COPY.sliderLabel}
            onChange={(event) => pick(Number(event.target.value))}
            className="h-10 min-w-0 flex-1 cursor-pointer accent-white disabled:opacity-60"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-white/80">
            <input
              type="number"
              inputMode="numeric"
              min={STICKER_BORDER_MIN_PX}
              max={STICKER_BORDER_MAX_PX}
              step={1}
              value={draft}
              disabled={submitting}
              aria-label={STICKER_BORDER_COPY.sliderLabel}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim() !== "") setBorderPx(clampStickerBorderPx(event.target.value));
              }}
              onBlur={() => pick(borderPx)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  pick(borderPx);
                  void handleSubmit();
                }
              }}
              className="w-16 rounded-xl bg-white/10 px-2.5 py-2 text-center text-[14px] tabular-nums text-white ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
            />
            px
          </label>
        </div>
        <p className="mt-1 text-[11px] text-white/55">
          От {STICKER_BORDER_MIN_PX} до {STICKER_BORDER_MAX_PX} px на холсте 512. Обычно {STICKER_BORDER_PX} px.
        </p>
        {error ? (
          <p className="mt-2 text-[13px] font-medium text-rose-200" role="status">
            {error}
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30 flex w-[9.5rem] flex-col gap-2">
        <GenerationResultActionRail className="w-full" actions={[exitAction]} />
        <GenerationResultActionRail className="w-full" actions={[submitAction]} />
      </div>
    </div>
  );
}
