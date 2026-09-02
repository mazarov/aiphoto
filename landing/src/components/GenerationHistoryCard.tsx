"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { DEFAULT_VIDEO_PROMPT } from "@/lib/generation/image-options";
import {
  GenerationCardMenu,
  type GenerationMenuAction,
} from "@/components/GenerationCardMenu";
import {
  downloadGenerationResult,
  shareGenerationResult,
} from "@/lib/generation-result-client-actions";
import { ListingCardVideo } from "@/components/ListingCardVideo";
import { PhotoshootListingBadge } from "@/components/PhotoshootListingBadge";
import { PhotoshootListingGrid } from "@/components/PhotoshootListingGrid";
import { isPhotoshootEditKind } from "@/lib/photoshoot";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import {
  generationGridDisplay,
  type GenerationHistoryItem,
} from "@/lib/generations-list";
import {
  publishRewardAmount,
  publishRewardKindForGeneration,
  publishRewardToastMessage,
  visiblePublishRewardCredits,
  type PublishRewardConfig,
  type PublishRewardResult,
} from "@/lib/publish-reward";

export type { GenerationHistoryItem };

type Props = {
  generation: GenerationHistoryItem;
  selectMode: boolean;
  selected: boolean;
  videoEnabled?: boolean;
  publishReward?: PublishRewardConfig;
  publishRewardRemaining?: number;
  priority?: boolean;
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
  videoEnabled = false,
  publishReward,
  publishRewardRemaining = 0,
  priority = false,
  onEnterSelectMode,
  onToggleSelect,
  onDeleted,
  onCardMetadataUpdated,
  onToast,
}: Props) {
  const { seedAnimate, seedCompletedResult } = useGenerateDock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [tilesOk, setTilesOk] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const { fullTiles, displayTiles, displaySrc } = generationGridDisplay(generation);
  const sheetDisplay =
    generation.photoshootSheetThumbUrl || generation.photoshootSheetUrl || null;
  const showTileGrid = Boolean(displayTiles) && !tilesFailed;
  const hasResult = Boolean(
    generation.resultUrl || fullTiles || generation.photoshootSheetUrl,
  );
  const hasPrompt = Boolean(generation.prompt?.trim());
  const isVideo = generation.modality === "video" || generation.resultMimeType === "video/mp4";
  const isPhotoshoot = isPhotoshootEditKind(generation.editKind);
  const canOpenCard = generation.status === "completed" && hasResult;
  const canOpenResult = generation.status === "completed" && hasResult;
  const canAnimate =
    videoEnabled &&
    !isVideo &&
    !isPhotoshoot &&
    generation.status === "completed" &&
    hasResult;
  const publishRewardVisible = publishReward
    ? visiblePublishRewardCredits({
        enabled: publishReward.enabled,
        isPublished: generation.isPublished,
        amount: publishRewardAmount(
          publishRewardKindForGeneration({
            modality: generation.modality,
            editKind: generation.editKind,
          }),
          publishReward,
        ),
        remainingToday: publishRewardRemaining,
      })
    : null;

  const toast = (message: string) => onToast?.(message);

  const openResult = (previewUrl?: string) => {
    const url =
      previewUrl ||
      (!tilesFailed ? generation.resultUrl : null) ||
      (!tilesFailed ? fullTiles?.[0] : null) ||
      generation.photoshootSheetUrl ||
      generation.resultUrl ||
      fullTiles?.[0];
    if (!url) return;
    seedCompletedResult(
      {
        generationId: generation.id,
        resultUrl: url,
        promptText: generation.prompt,
        modality: isVideo ? "video" : "image",
        isPublished: generation.isPublished,
        editKind: generation.editKind,
        photoshootTileUrls: tilesFailed ? null : fullTiles,
      },
      { entrySource: "card" }
    );
  };

  const handleAction = async (action: GenerationMenuAction) => {
    if (action === "select") {
      setMenuOpen(false);
      onEnterSelectMode(generation.id);
      return;
    }

    if (action === "share") {
      const shareUrl = tilesFailed
        ? generation.photoshootSheetUrl || generation.resultUrl
        : generation.resultUrl;
      if (!shareUrl) return;
      setMenuOpen(false);
      try {
        const mode = await shareGenerationResult(shareUrl);
        if (mode === "copied") toast("Ссылка скопирована");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast("Не удалось поделиться");
      }
      return;
    }

    if (action === "download") {
      if (!generation.resultUrl && !fullTiles && !generation.photoshootSheetUrl) return;
      setBusyAction("download");
      try {
        if (fullTiles && !tilesFailed) {
          for (const [index, url] of fullTiles.entries()) {
            await downloadGenerationResult(url, `promptshot-${generation.id}-${index + 1}.jpg`);
          }
        } else if (generation.photoshootSheetUrl) {
          await downloadGenerationResult(
            generation.photoshootSheetUrl,
            `promptshot-${generation.id}.jpg`,
          );
        } else if (generation.resultUrl) {
          await downloadGenerationResult(
            generation.resultUrl,
            isVideo ? `promptshot-${generation.id}.mp4` : `promptshot-${generation.id}.jpg`
          );
        }
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

    if (action === "animate") {
      if (!generation.resultUrl || isVideo) return;
      setMenuOpen(false);
      seedAnimate({
        promptText: DEFAULT_VIDEO_PROMPT,
        parentGenerationId: generation.id,
        previewUrl: generation.resultUrl,
      });
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
      if (!canOpenCard || (generation.isPublished && !isPhotoshoot)) return;
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
          promptsReady?: boolean;
          reward?: PublishRewardResult | null;
        };
        if (!res.ok || !data.cardId || !data.slug) {
          throw new Error(
            data.error === "unauthorized"
              ? "Войдите, чтобы опубликовать"
              : data.error === "generation_result_not_available"
                ? "Результат ещё не готов"
                : "Не удалось опубликовать",
          );
        }
        onCardMetadataUpdated(generation.id, {
          cardId: data.cardId,
          cardSlug: data.slug,
          isPublished: true,
        });
        setMenuOpen(false);
        if (typeof data.reward?.credits === "number" && data.reward.credits > 0) {
          requestCreditBalanceRefresh();
        }
        toast(
          publishRewardToastMessage({
            promptsReady: data.promptsReady,
            wasPublished: generation.isPublished,
            reward: data.reward,
          }),
        );
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
      data-listing-fill-item=""
      className={`group relative isolate rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${menuOpen ? "z-40" : ""} ${
        selectMode || canOpenResult ? "cursor-pointer" : ""
      }`}
      onClick={() => {
        if (selectMode) onToggleSelect(generation.id);
      }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-900 aspect-[3/4]">
        {sheetDisplay ? (
          <Image
            src={sheetDisplay}
            alt=""
            fill
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priority}
            className={`object-cover ${showTileGrid && tilesOk ? "opacity-0" : ""}`}
            draggable={false}
          />
        ) : null}
        {showTileGrid && displayTiles ? (
          <PhotoshootListingGrid
            urls={displayTiles}
            alt="Кадры фотосессии"
            priority={priority}
            className={tilesOk || !sheetDisplay ? "" : "opacity-0"}
            onLoad={() => setTilesOk(true)}
            onError={() => setTilesFailed(true)}
            onSelect={
              !selectMode && canOpenResult
                ? (_, index) => openResult(fullTiles?.[index])
                : undefined
            }
          />
        ) : displaySrc && isVideo && generation.resultUrl ? (
          <ListingCardVideo
            src={generation.resultUrl}
            className="listing-card-photo-hover"
          />
        ) : displaySrc && !isPhotoshoot ? (
          <Image
            src={displaySrc}
            alt="Результат генерации"
            fill
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priority}
            fetchPriority={priority ? "high" : undefined}
            className="listing-card-photo-hover object-cover"
            draggable={false}
          />
        ) : !sheetDisplay ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            {generation.status === "failed" ? (
              <span className="text-[13px] font-medium text-rose-600">Ошибка</span>
            ) : (
              <span className="animate-pulse text-[13px] font-medium text-zinc-500">
                {generation.status === "completed" && isPhotoshoot
                  ? "Собираем кадры…"
                  : `${STATUS_LABELS[generation.status]}…`}
              </span>
            )}
          </div>
        ) : null}

        {!selectMode && (isPhotoshoot || displayTiles || sheetDisplay) ? (
          <PhotoshootListingBadge className="bottom-14" />
        ) : null}

        {!selectMode && canOpenResult && !(showTileGrid && tilesOk) ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer appearance-none border-0 bg-transparent p-0"
            aria-label={isVideo ? "Открыть видео" : "Открыть результат"}
            onClick={() => openResult()}
          />
        ) : null}

        {!selectMode && canOpenCard ? (
          <div
            className="absolute inset-x-2 bottom-2 z-20 flex gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {canAnimate ? (
              <button
                type="button"
                className={`${OVERLAY_BUTTON_UA_RESET} ${CARD_OVERLAY_ACTION_PILL} min-w-0 flex-1 px-2 text-[13px] font-semibold text-white`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleAction("animate");
                }}
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 6.8v10.4L17.2 12 8 6.8Z" />
                </svg>
                <span className="truncate">Оживить</span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={Boolean(busyAction) || (generation.isPublished && !generation.cardSlug && !isPhotoshoot)}
              className={`${OVERLAY_BUTTON_UA_RESET} ${CARD_OVERLAY_ACTION_PILL} min-w-0 flex-1 px-2 text-[13px] font-semibold text-white`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (generation.isPublished && generation.cardSlug && !isPhotoshoot) {
                  window.location.assign(`/p/${generation.cardSlug}`);
                  return;
                }
                void handleAction("publish");
              }}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="min-w-0 truncate">
                {busyAction === "publish"
                  ? "Публикация…"
                  : generation.isPublished
                    ? isPhotoshoot
                      ? "Обновить"
                      : "В каталоге"
                    : "Опубликовать"}
              </span>
              {typeof publishRewardVisible === "number" ? (
                <span className="shrink-0 text-emerald-300">+{publishRewardVisible}✦</span>
              ) : null}
            </button>
          </div>
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
              allowRepublish={isPhotoshoot}
              canAnimate={false}
              canSaveToLibrary={!isVideo}
              publishRewardCredits={publishRewardVisible}
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
