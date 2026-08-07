"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  GenerationCardMenu,
  type GenerationMenuAction,
} from "@/components/GenerationCardMenu";
import {
  downloadGenerationResult,
  shareGenerationResult,
} from "@/lib/generation-result-client-actions";

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
  cardId: string | null;
  cardSlug: string | null;
  isPublished: boolean;
};

type Props = {
  generation: GenerationHistoryItem;
  selectMode: boolean;
  selected: boolean;
  onEnterSelectMode: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  onCardMetadataUpdated: (
    id: string,
    metadata: Pick<GenerationHistoryItem, "cardId" | "cardSlug" | "isPublished">
  ) => void;
  onToast?: (message: string) => void;
};

const STATUS_LABELS: Record<GenerationHistoryItem["status"], string> = {
  pending: "В очереди",
  processing: "Генерируется",
  completed: "Готово",
  failed: "Ошибка",
};

export function GenerationHistoryCard({
  generation,
  selectMode,
  selected,
  onEnterSelectMode,
  onToggleSelect,
  onDeleted,
  onCardMetadataUpdated,
  onToast,
}: Props) {
  const { open, prefetchCard } = usePromptCardModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [openingCard, setOpeningCard] = useState(false);
  const hasResult = Boolean(generation.resultUrl);
  const hasPrompt = Boolean(generation.prompt?.trim());
  const canOpenCard = generation.status === "completed" && hasResult;

  const toast = (message: string) => onToast?.(message);

  const openCard = (slug: string) => {
    open(slug, {
      photoUrl: generation.resultUrl,
      photoCount: generation.resultUrl ? 1 : 0,
      hasPrompts: hasPrompt,
    });
  };

  const ensureCard = async () => {
    if (generation.cardSlug && generation.cardId) {
      return {
        cardId: generation.cardId,
        cardSlug: generation.cardSlug,
        isPublished: generation.isPublished,
      };
    }

    const res = await fetch(`/api/generations/${generation.id}/ensure-card`, {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      cardId?: string;
      slug?: string;
      isPublished?: boolean;
    };
    if (!res.ok || !data.cardId || !data.slug) {
      throw new Error(data.error || "Не удалось подготовить карточку");
    }

    const metadata = {
      cardId: data.cardId,
      cardSlug: data.slug,
      isPublished: Boolean(data.isPublished),
    };
    onCardMetadataUpdated(generation.id, metadata);
    return metadata;
  };

  const handleOpenMissingCard = async () => {
    if (!canOpenCard || openingCard) return;
    setOpeningCard(true);
    try {
      const card = await ensureCard();
      openCard(card.cardSlug);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось открыть карточку");
    } finally {
      setOpeningCard(false);
    }
  };

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
        const mode = await shareGenerationResult(generation.resultUrl);
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
        await downloadGenerationResult(
          generation.resultUrl,
          `promptshot-${generation.id}.jpg`
        );
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

    if (action === "publish") {
      if (!canOpenCard || generation.isPublished) return;
      setBusyAction("publish");
      try {
        const res = await fetch(`/api/generations/${generation.id}/publish`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          cardId?: string;
          slug?: string;
          isPublished?: boolean;
        };
        if (!res.ok || !data.cardId || !data.slug) {
          throw new Error(data.error || "Не удалось опубликовать");
        }
        onCardMetadataUpdated(generation.id, {
          cardId: data.cardId,
          cardSlug: data.slug,
          isPublished: true,
        });
        setMenuOpen(false);
        toast("Карточка опубликована");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Не удалось опубликовать");
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
      className={`group relative isolate rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${menuOpen ? "z-40" : ""} ${
        selectMode || canOpenCard ? "cursor-pointer" : ""
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

        {!selectMode && canOpenCard && generation.cardSlug ? (
          <Link
            href={`/p/${generation.cardSlug}`}
            className="absolute inset-0 z-10"
            aria-label="Открыть карточку"
            prefetch
            onPointerEnter={() => prefetchCard(generation.cardSlug!)}
            onTouchStart={() => prefetchCard(generation.cardSlug!)}
            onClick={(event) => {
              event.preventDefault();
              openCard(generation.cardSlug!);
            }}
          />
        ) : !selectMode && canOpenCard ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer appearance-none border-0 bg-transparent p-0"
            aria-label={openingCard ? "Подготавливаем карточку" : "Открыть карточку"}
            disabled={openingCard}
            onClick={() => void handleOpenMissingCard()}
          />
        ) : null}

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
        ) : null}

        {selected && selectMode ? (
          <div className="pointer-events-none absolute inset-0 z-[3] rounded-2xl ring-2 ring-inset ring-indigo-500" />
        ) : null}
      </div>

      {!selectMode ? (
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
              canPublish={canOpenCard}
              isPublished={generation.isPublished}
              busyAction={busyAction}
              onAction={(action) => {
                void handleAction(action);
              }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
