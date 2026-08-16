"use client";

import { useEffect, useRef, useState } from "react";
import { useGenerateDock } from "@/context/GenerateDockContext";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { downloadGenerationResult } from "@/lib/generation-result-client-actions";

export type AnalysisHistoryItem = {
  id: string;
  created_at: string;
  kind: "analyze" | "remix";
  prompt: string;
  change_request: string | null;
  image_url: string | null;
};

type Props = {
  item: AnalysisHistoryItem;
  onToast?: (message: string) => void;
};

const ITEM =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

export function AnalysisHistoryCard({ item, onToast }: Props) {
  const { seedBlankPrompt } = useGenerateDock();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasImage = Boolean(item.image_url);
  const hasPrompt = Boolean(item.prompt?.trim());

  const toast = (message: string) => onToast?.(message);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && menuRootRef.current && !menuRootRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [menuOpen]);

  const openGenerate = () => {
    if (!hasPrompt) return;
    seedBlankPrompt(item.prompt, {
      entrySource: "analyses",
      intent: "photo_prompt",
      dockSurface: "prompt",
    });
  };

  return (
    <article
      className={`group relative isolate rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10 ${
        menuOpen ? "z-40" : ""
      } ${hasPrompt ? "cursor-pointer" : ""}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            className="listing-card-photo-hover absolute inset-0 z-[2] h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <span className="text-[13px] font-medium text-zinc-500">
              {item.kind === "remix" ? "Remix" : "Нет фото"}
            </span>
          </div>
        )}

        {hasPrompt ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer appearance-none border-0 bg-transparent p-0"
            aria-label="Сгенерировать по этому промту"
            onClick={openGenerate}
          />
        ) : null}

        {item.kind === "remix" && hasImage ? (
          <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[13px] font-medium text-white backdrop-blur-md">
            Remix
          </span>
        ) : null}
      </div>

      <div
        ref={menuRootRef}
        className="absolute right-2 top-2 z-30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <button
            type="button"
            aria-label="Действия"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${OVERLAY_BUTTON_UA_RESET} ${CARD_OVERLAY_ACTION_PILL} h-11 w-11 px-0 text-white`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-2xl bg-zinc-900 p-1.5 shadow-xl ring-1 ring-white/10"
            >
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                disabled={!hasPrompt || busy}
                onClick={async () => {
                  setMenuOpen(false);
                  const ok = await copyTextUniversal(item.prompt);
                  toast(ok ? "Промпт скопирован" : "Не удалось скопировать");
                }}
              >
                Скопировать промпт
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                disabled={!hasImage || busy}
                onClick={async () => {
                  if (!item.image_url) return;
                  setBusy(true);
                  try {
                    await downloadGenerationResult(item.image_url, `promptshot-analyze-${item.id}.jpg`);
                    setMenuOpen(false);
                  } catch {
                    toast("Не удалось скачать");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Скачать
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                disabled={!hasPrompt || busy}
                onClick={() => {
                  setMenuOpen(false);
                  openGenerate();
                }}
              >
                Сгенерировать
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
