"use client";

import { useState } from "react";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import {
  GenerationCardMenu,
  type GenerationMenuAction,
} from "@/components/GenerationCardMenu";

export type GenerationHistoryItem = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  model: string;
  aspectRatio: string;
  creditsSpent: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
};

type Props = {
  generation: GenerationHistoryItem;
  selectMode: boolean;
  selected: boolean;
  onEnterSelectMode: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  onToast?: (message: string) => void;
};

const STATUS_LABELS: Record<GenerationHistoryItem["status"], string> = {
  pending: "В очереди",
  processing: "Генерируется",
  completed: "Готово",
  failed: "Ошибка",
};

async function downloadResult(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

async function shareResult(url: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

export function GenerationHistoryCard({
  generation,
  selectMode,
  selected,
  onEnterSelectMode,
  onToggleSelect,
  onDeleted,
  onToast,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const hasResult = Boolean(generation.resultUrl);
  const hasPrompt = Boolean(generation.prompt?.trim());

  const toast = (message: string) => onToast?.(message);

  const handleAction = async (action: GenerationMenuAction) => {
    if (action === "select") {
      setMenuOpen(false);
      onEnterSelectMode(generation.id);
      return;
    }

    if (action === "share") {
      if (!generation.resultUrl) return;
      setMenuOpen(false);
      try {
        const mode = await shareResult(generation.resultUrl);
        if (mode === "copied") toast("Ссылка скопирована");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast("Не удалось поделиться");
      }
      return;
    }

    if (action === "download") {
      if (!generation.resultUrl) return;
      setBusyAction("download");
      try {
        await downloadResult(generation.resultUrl, `promptshot-${generation.id}.jpg`);
        setMenuOpen(false);
      } catch {
        toast("Не удалось скачать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "copyPrompt") {
      if (!hasPrompt) return;
      setMenuOpen(false);
      const ok = await copyTextUniversal(generation.prompt);
      toast(ok ? "Промпт скопирован" : "Не удалось скопировать");
      return;
    }

    if (action === "use") {
      setBusyAction("use");
      try {
        const res = await fetch(`/api/generations/${generation.id}/save-to-library`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Save failed");
        setMenuOpen(false);
        toast("Сохранено для генерации");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Не удалось сохранить");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Удалить эту генерацию?")) return;
      setBusyAction("delete");
      try {
        const res = await fetch(`/api/generations/${generation.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Delete failed");
        setMenuOpen(false);
        onDeleted(generation.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Не удалось удалить");
      } finally {
        setBusyAction(null);
      }
    }
  };

  return (
    <article
      className={`group relative isolate overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${
        selectMode ? "cursor-pointer" : ""
      }`}
      onClick={() => {
        if (selectMode) onToggleSelect(generation.id);
      }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-200 aspect-[3/4]">
        {generation.resultUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={generation.resultUrl}
            alt="Результат генерации"
            className="listing-card-photo-hover absolute inset-0 z-[2] h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center">
            {generation.status === "failed" ? (
              <span className="text-[13px] font-medium text-rose-600">Ошибка</span>
            ) : (
              <span className="animate-pulse text-[13px] font-medium text-zinc-500">
                {STATUS_LABELS[generation.status]}…
              </span>
            )}
          </div>
        )}

        {selectMode ? (
          <div className="absolute left-2 top-2 z-30">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                selected
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-white/90 bg-black/20 backdrop-blur-md"
              }`}
              aria-hidden
            >
              {selected ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="sr-only">{selected ? "Выбрано" : "Не выбрано"}</span>
          </div>
        ) : (
          <div
            className="absolute right-2 top-2 z-30"
            data-generation-menu-root
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
              <GenerationCardMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                hasResult={hasResult}
                hasPrompt={hasPrompt}
                busyAction={busyAction}
                onAction={(action) => {
                  void handleAction(action);
                }}
              />
            </div>
          </div>
        )}

        {selected && selectMode ? (
          <div className="pointer-events-none absolute inset-0 z-[3] rounded-2xl ring-2 ring-inset ring-indigo-500" />
        ) : null}
      </div>
    </article>
  );
}
