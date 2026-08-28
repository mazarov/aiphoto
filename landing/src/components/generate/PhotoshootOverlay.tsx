"use client";

import { useMemo, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import {
  PHOTOSHOOT_TILE_INDEXES,
  type PhotoshootTileIndex,
} from "@/lib/photoshoot";

type Props = {
  tileUrls: string[] | null;
  capturing: boolean;
  progress: number;
  onClose: () => void;
  onDownloadTile: (tile: PhotoshootTileIndex) => Promise<void>;
};

export function PhotoshootOverlay({
  tileUrls,
  capturing,
  progress,
  onClose,
  onDownloadTile,
}: Props) {
  const [tile, setTile] = useState<PhotoshootTileIndex>(1);
  const [busy, setBusy] = useState(false);
  const activeTileUrl = tileUrls?.[tile - 1] || null;
  const hasFrames = Boolean(activeTileUrl);

  const status = useMemo(() => {
    if (capturing) {
      return `Снимаем фотосессию · ${Math.max(0, Math.min(99, Math.round(progress)))}%`;
    }
    if (hasFrames) return "4 кадра одной съёмки";
    return "Готовим кадры";
  }, [capturing, hasFrames, progress]);

  const railActions: GenerationResultAction[] = [
    {
      id: "exit",
      label: "Выйти",
      disabled: capturing,
      onClick: onClose,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "download-tile",
      label: busy ? "Скачиваем…" : "Скачать кадр",
      disabled: capturing || !hasFrames || busy,
      onClick: () => {
        setBusy(true);
        void onDownloadTile(tile).finally(() => setBusy(false));
      },
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-label="Фотосессия">
      <button
        type="button"
        aria-label="Выйти из фотосессии"
        disabled={capturing}
        onClick={onClose}
        className={`${OVERLAY_BUTTON_UA_RESET} absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/65 disabled:opacity-50`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3">
        {hasFrames && !capturing ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeTileUrl || ""}
            alt=""
            className="max-h-[70%] max-w-[min(100%,28rem)] rounded-2xl object-cover shadow-2xl"
          />
        ) : null}
      </div>

      <p className="pointer-events-none absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-20 w-[min(100%-1.5rem,22rem)] -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-center text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md">
        {status}
      </p>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[11rem] z-20 flex gap-2">
        {PHOTOSHOOT_TILE_INDEXES.map((item) => {
          const active = item === tile;
          const thumbUrl = tileUrls?.[item - 1] || null;
          return (
            <button
              key={item}
              type="button"
              disabled={capturing || !hasFrames}
              onClick={() => setTile(item)}
              className={`${OVERLAY_BUTTON_UA_RESET} relative h-16 shrink-0 overflow-hidden rounded-xl ${
                active ? "ring-2 ring-indigo-400" : "ring-1 ring-white/25"
              }`}
              style={{ width: "48px" }}
              aria-label={`Кадр ${item}`}
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

      <GenerationResultActionRail
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30"
        actions={railActions}
      />
    </div>
  );
}
