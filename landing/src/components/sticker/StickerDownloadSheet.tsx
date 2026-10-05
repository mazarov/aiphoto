"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import { STICKER_PLATFORMS, type StickerPlatform } from "@/lib/sticker";
import { STICKER_ACTION_EXIT } from "@/lib/sticker-action-sheet";

export const STICKER_DOWNLOAD_TITLE = "Скачать стикер";
export const STICKER_DOWNLOAD_LEAD = "Файл уже в формате и размере, которые принимает мессенджер.";

type Props = {
  /** Platform whose file is being prepared, or null. */
  busyPlatform: StickerPlatform["id"] | null;
  error?: string | null;
  onClose: () => void;
  onPick: (platform: StickerPlatform) => void;
};

/**
 * Overlay on the sticker result plate: one row per messenger from `STICKER_PLATFORMS`.
 * Adding a platform = one entry in that array; this sheet and the API follow.
 */
export function StickerDownloadSheet({ busyPlatform, error = null, onClose, onPick }: Props) {
  const busy = busyPlatform !== null;
  const exitAction: GenerationResultAction = {
    id: "exit",
    label: STICKER_ACTION_EXIT,
    disabled: busy,
    onClick: onClose,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-label={STICKER_DOWNLOAD_TITLE}>
      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[11rem] z-30 max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl bg-black/55 p-3 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md">
        <h3 className="text-[15px] font-semibold">{STICKER_DOWNLOAD_TITLE}</h3>
        <p className="mt-0.5 text-[12px] text-white/75">{STICKER_DOWNLOAD_LEAD}</p>
        <ul className="mt-3 flex flex-col gap-2" aria-label="Платформа">
          {STICKER_PLATFORMS.map((platform) => {
            const active = busyPlatform === platform.id;
            return (
              <li key={platform.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-busy={active || undefined}
                  onClick={() => onPick(platform)}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition disabled:opacity-60 ${
                    active ? "bg-white text-zinc-900" : "bg-white/15 ring-1 ring-white/20 hover:bg-white/25"
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="text-[14px] font-semibold">{platform.label}</span>
                    <span className={`text-[11px] ${active ? "text-zinc-600" : "text-white/65"}`}>{platform.note}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-medium" aria-hidden>
                    {active ? "Готовим…" : "Скачать"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {error ? (
          <p className="mt-2 text-[13px] font-medium text-rose-200" role="status">
            {error}
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30 flex w-[9.5rem] flex-col gap-2">
        <GenerationResultActionRail className="w-full" actions={[exitAction]} />
      </div>
    </div>
  );
}
