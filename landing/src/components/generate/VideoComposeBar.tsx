"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

type Props = {
  previewUrl: string | null;
  onClearPreview?: () => void;
  modelLabel: string;
  aspectRatio: string;
  durationLabel: string;
  resolution: string;
  quantity: number;
  glass?: boolean;
};

const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold";

export function VideoComposeBar({
  previewUrl,
  onClearPreview,
  modelLabel,
  aspectRatio,
  durationLabel,
  resolution,
  quantity,
  glass = true,
}: Props) {
  const chipClass = glass
    ? `${CHIP} bg-white/10 text-white ring-1 ring-white/15`
    : `${CHIP} bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/15">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-white/40">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
              </svg>
            </span>
          )}
          {previewUrl && onClearPreview ? (
            <button
              type="button"
              aria-label="Убрать фото"
              onClick={onClearPreview}
              className={`${OVERLAY_BUTTON_UA_RESET} absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white`}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <span className={chipClass}>{modelLabel}</span>
          <span className={chipClass}>{aspectRatio}</span>
          <span className={chipClass}>{durationLabel}</span>
          <span className={chipClass}>{resolution}</span>
          <span className={`${chipClass} tabular-nums`}>
            <button type="button" disabled className="opacity-40" aria-label="Меньше">
              −
            </button>
            {quantity}
            <button type="button" disabled className="opacity-40" aria-label="Больше">
              +
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
