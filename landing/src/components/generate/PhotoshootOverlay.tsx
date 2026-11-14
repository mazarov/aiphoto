"use client";

import { useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import {
  PHOTOSHOOT_CREDIT_COST,
  PHOTOSHOOT_FRAME_COUNT,
  photoshootOverlayChromeState,
} from "@/lib/photoshoot";

/**
 * Thumb strip under the result: 4 photoshoot frames, or 16 stickers of a pack (scrolls horizontally).
 * `activeTile` / `onSelect` are 1-based like `photoshoot_tile_paths`.
 */
export function PhotoshootFrameFilm({
  tileUrls,
  activeTile,
  disabled = false,
  className = "",
  tileLabel = "Кадр",
  onSelect,
}: {
  tileUrls: string[] | null;
  activeTile: number;
  disabled?: boolean;
  className?: string;
  tileLabel?: string;
  onSelect: (tile: number) => void;
}) {
  const count = Math.max(tileUrls?.length ?? 0, PHOTOSHOOT_FRAME_COUNT);
  const compact = count > PHOTOSHOOT_FRAME_COUNT;
  return (
    <div
      className={`flex gap-2 ${compact ? "overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""} ${className}`.trim()}
      role="tablist"
      aria-label={compact ? "Стикеры пака" : "Кадры фотосессии"}
    >
      {Array.from({ length: count }, (_, index) => index + 1).map((item) => {
        const active = item === activeTile;
        const thumbUrl = tileUrls?.[item - 1] || null;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || !thumbUrl}
            onClick={() => onSelect(item)}
            className={`${OVERLAY_BUTTON_UA_RESET} relative shrink-0 overflow-hidden rounded-xl ${
              compact ? "h-12 w-12 bg-white/10" : "h-16 w-12"
            } ${active ? "ring-2 ring-indigo-400" : "ring-1 ring-white/25"}`}
            aria-label={`${tileLabel} ${item}`}
          >
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="block h-full w-full bg-white/10" />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-center text-[10px] font-semibold text-white">
              {item}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  capturing: boolean;
  progress: number;
  v2Chrome?: boolean;
  onClose: () => void;
  onCreate: () => Promise<boolean>;
};

export function PhotoshootOverlay({
  capturing,
  progress,
  v2Chrome = false,
  onClose,
  onCreate,
}: Props) {
  const [starting, setStarting] = useState(false);
  const chrome = photoshootOverlayChromeState({ capturing, starting });

  const handleCreate = async () => {
    if (chrome.createDisabled) return;
    setStarting(true);
    try {
      await onCreate();
    } finally {
      setStarting(false);
    }
  };

  const createLabel = chrome.createIsProgress
    ? progress > 0
      ? `Снимаем… ${Math.round(progress)}%`
      : "Снимаем…"
    : `Создать ${PHOTOSHOOT_CREDIT_COST}✦`;

  if (v2Chrome) {
    return (
      <div
        className="absolute inset-0 z-40 flex flex-col justify-end"
        role="dialog"
        aria-label="Фотосессия"
        onClick={(event) => {
          if (event.target === event.currentTarget && !chrome.exitDisabled) {
            onClose();
          }
        }}
      >
        <div className="mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-2xl bg-zinc-950/75 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.52)] ring-1 ring-inset ring-white/15 backdrop-blur-xl">
          <button
            type="button"
            disabled={chrome.createDisabled}
            aria-label={
              chrome.createIsProgress
                ? createLabel
                : `Создать фотосессию, ${PHOTOSHOOT_CREDIT_COST} кредитов`
            }
            onClick={() => void handleCreate()}
            className={`${OVERLAY_BUTTON_UA_RESET} inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 text-[13px] font-semibold leading-none text-white shadow-md shadow-indigo-950/35 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {chrome.createIsProgress ? (
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            ) : (
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden
              >
                <path
                  d="M4 7h4l1.2-2h5.6L16 7h4v12H4V7Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.1" />
              </svg>
            )}
            <span className="truncate">
              {chrome.createIsProgress ? createLabel : "Создать фотосессию"}
            </span>
            {!chrome.createIsProgress ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-white">
                {PHOTOSHOOT_CREDIT_COST}✦
              </span>
            ) : null}
          </button>
          <button
            type="button"
            disabled={chrome.exitDisabled}
            aria-label="Отмена"
            onClick={onClose}
            className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/90 ring-1 ring-inset ring-white/15 transition hover:bg-white/20 hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const exitAction: GenerationResultAction = {
    id: "exit",
    label: "Выйти",
    disabled: chrome.exitDisabled,
    onClick: onClose,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    ),
  };

  const createAction: GenerationResultAction = {
    id: "create",
    label: createLabel,
    ariaLabel: chrome.createIsProgress
      ? createLabel
      : `Создать фотосессию, ${PHOTOSHOOT_CREDIT_COST} кредитов`,
    primary: true,
    wrap: true,
    disabled: chrome.createDisabled,
    onClick: () => void handleCreate(),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M4 7h4l1.2-2h5.6L16 7h4v12H4V7Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="13" r="3.1" />
      </svg>
    ),
  };

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-label="Фотосессия">
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30 flex w-[9.5rem] flex-col gap-2">
        <GenerationResultActionRail className="w-full" actions={[exitAction]} />
        <GenerationResultActionRail className="w-full" actions={[createAction]} />
      </div>
    </div>
  );
}
