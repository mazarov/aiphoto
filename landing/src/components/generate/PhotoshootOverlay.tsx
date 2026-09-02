"use client";

import { useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import {
  PHOTOSHOOT_CREDIT_COST,
  PHOTOSHOOT_TILE_INDEXES,
  photoshootOverlayChromeState,
  type PhotoshootTileIndex,
} from "@/lib/photoshoot";

export function PhotoshootFrameFilm({
  tileUrls,
  activeTile,
  disabled = false,
  className = "",
  onSelect,
}: {
  tileUrls: string[] | null;
  activeTile: PhotoshootTileIndex;
  disabled?: boolean;
  className?: string;
  onSelect: (tile: PhotoshootTileIndex) => void;
}) {
  return (
    <div className={`flex gap-2 ${className}`.trim()}>
      {PHOTOSHOOT_TILE_INDEXES.map((item) => {
        const active = item === activeTile;
        const thumbUrl = tileUrls?.[item - 1] || null;
        return (
          <button
            key={item}
            type="button"
            disabled={disabled || !thumbUrl}
            onClick={() => onSelect(item)}
            className={`${OVERLAY_BUTTON_UA_RESET} relative h-16 shrink-0 overflow-hidden rounded-xl ${
              active ? "ring-2 ring-indigo-400" : "ring-1 ring-white/25"
            }`}
            style={{ width: "48px" }}
            aria-label={`Кадр ${item}`}
            aria-pressed={active}
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
  onClose: () => void;
  onCreate: () => Promise<boolean>;
};

export function PhotoshootOverlay({
  capturing,
  progress,
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
