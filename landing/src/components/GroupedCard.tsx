"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";
import { useCardInteractions } from "@/context/CardInteractionsContext";
import { ReactionButtons } from "./ReactionButtons";
import { splitCardTitle } from "@/lib/format-view-count";
import { CARD_OVERLAY_PHOTO_COUNTER_CLASS } from "@/lib/card-overlay-photo-counter";
import {
  OVERLAY_BUTTON_APPEARANCE_RESET,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { CardOverlayMetricsChips } from "./CardOverlayMetricsChips";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";

type Props = {
  cards: PromptCardFull[];
  debug?: boolean;
  priorityLoad?: boolean;
};

export function GroupedCard({ cards, debug = false, priorityLoad = false }: Props) {
  const sorted = [...cards].sort((a, b) => a.cardSplitIndex - b.cardSplitIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const activeCard = sorted[activeCardIdx];
  const { reactions, toggleReaction } = useCardInteractions();

  const title = activeCard.title_ru || activeCard.title_en || "Без названия";
  const expandedTitle = splitCardTitle(title);
  const allPrompts = sorted.flatMap((c) => c.promptTexts);
  const groupBeforeUrl = sorted.find((c) => c.beforePhotoUrl)?.beforePhotoUrl ?? null;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const photos = activeCard.photoUrls;
  const currentPhotoUrl = photos[activePhotoIdx] || photos[0] || null;

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptPreview =
    allPrompts[0]?.slice(0, 100) + (allPrompts[0]?.length > 100 ? "…" : "") || "";

  const userReaction = reactions.get(activeCard.id) ?? null;
  const viewCount = activeCard.viewCount ?? 0;

  const mainPhotoClass =
    "listing-card-photo-hover object-cover z-[2] opacity-100";

  function handleCardSwitch(idx: number, photoIdx = 0) {
    setActiveCardIdx(idx);
    setActivePhotoIdx(photoIdx);
  }

  function nextPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    if (photos.length > 1) setActivePhotoIdx((i) => (i + 1) % photos.length);
  }

  function prevPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    if (photos.length > 1) setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const str = allPrompts.join("\n\n");
    if (!str) return;
    setCopied(true);
    try {
      await navigator.clipboard.writeText(str);
    } catch {
      setCopied(false);
      return;
    }
    setTimeout(() => setCopied(false), 2000);
  }

  const secondPhoto = sorted.length > 1
    ? (sorted[activeCardIdx === 0 ? 1 : 0].photoUrls[0] || null)
    : null;

  const activeSlug = activeCard.slug;

  const totalPhotos = sorted.reduce((s, c) => s + c.photoCount, 0);
  const totalPrompts = sorted.reduce((s, c) => s + c.promptCount, 0);
  const hasEnOnly = !activeCard.hasRuPrompt && activeCard.promptTexts.length > 0;
  const ruLabel = activeCard.hasRuPrompt ? "RU: есть" : hasEnOnly ? "EN only" : "нет промпта";
  const ruColor = activeCard.hasRuPrompt ? "bg-emerald-600" : hasEnOnly ? "bg-amber-500" : "bg-red-500";
  const scoreColor = activeCard.seoReadinessScore >= 60 ? "bg-emerald-600" : activeCard.seoReadinessScore >= 40 ? "bg-blue-500" : "bg-zinc-500";

  const articleEl = (
      <article
        className={`relative z-10 isolate overflow-hidden rounded-2xl transition-all duration-200 group-hover:shadow-xl group-hover:shadow-zinc-900/10 group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 ${activeSlug ? "cursor-pointer" : ""}`}
      >
        {debug && (
          <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
            <div className="bg-black/70 backdrop-blur-sm px-2.5 py-2 space-y-1">
              <div className="text-[9px] text-white/50 font-mono break-all select-all leading-tight pointer-events-auto">{activeCard.id}</div>
              <div className="text-[10px] text-white/70 font-mono leading-tight">
                {activeCard.datasetSlug && <span>{activeCard.datasetSlug}</span>}
                {activeCard.sourceMessageId && <span> · msg {activeCard.sourceMessageId}</span>}
                {activeCard.sourceDate && <span> · {activeCard.sourceDate}</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] text-white font-medium">photos: {totalPhotos}</span>
                <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] text-white font-medium">prompts: {totalPrompts}</span>
                <span className={`rounded-full ${scoreColor} px-1.5 py-px text-[9px] text-white font-medium`}>score: {activeCard.seoReadinessScore}</span>
                <span className={`rounded-full ${ruColor} px-1.5 py-px text-[9px] text-white font-medium`}>{ruLabel}</span>
                {groupBeforeUrl && (
                  <span className="rounded-full bg-teal-600 px-1.5 py-px text-[9px] text-white font-medium">было</span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-200 aspect-[3/4]">
          {currentPhotoUrl ? (
            <Image
              src={currentPhotoUrl}
              alt={title}
              fill
              sizes={SIZES_CARD_GRID}
              quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
              priority={priorityLoad}
              fetchPriority={priorityLoad ? "high" : undefined}
              className={mainPhotoClass}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-sm">Нет фото</div>
          )}

          {activeSlug && (
            <Link
              href={`/p/${activeSlug}`}
              className="absolute inset-0 z-10"
              aria-label={title}
              prefetch
              target="_blank"
              rel="noopener noreferrer"
            />
          )}

          <div className="listing-card-chrome absolute inset-0 z-20">
            <div className="listing-card-chrome-ambient absolute inset-0">
              {(activeCard.beforePhotoUrl || groupBeforeUrl) && (
                <div className="absolute top-0 left-0 w-[28%] min-w-[72px]">
                  <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                    <Image
                      src={(activeCard.beforePhotoUrl || groupBeforeUrl)!}
                      alt="before"
                      fill
                      className="object-cover"
                      sizes={SIZES_CARD_GRID}
                      quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
                    />
                    <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">БЫЛО</div>
                  </div>
                </div>
              )}

              {!expanded && (
                <div
                  className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 px-3.5 pointer-events-none ${
                    allPrompts.length > 0 ? "pb-14 sm:pb-[3.75rem]" : "pb-3.5"
                  }`}
                >
                  <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-1 mb-0.5">{title}</h3>
                  {promptPreview && (
                    <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2 mb-1">{promptPreview}</p>
                  )}
                </div>
              )}
            </div>

            <div className="listing-card-chrome-controls-fast pointer-events-none absolute inset-0 z-[2]">
              {sorted.length > 1 && (
                <button
                  type="button"
                  aria-label={`Переключить вариант карточки: ${activeCardIdx + 1} из ${sorted.length}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleCardSwitch((activeCardIdx + 1) % sorted.length);
                  }}
                  className={`${OVERLAY_BUTTON_UA_RESET} listing-card-chrome-target absolute top-3 left-3 z-[1] sm:left-3.5 ${CARD_OVERLAY_PHOTO_COUNTER_CLASS} transition-colors hover:bg-black/55 active:scale-[0.98] touch-manipulation`}
                >
                  {activeCardIdx + 1}/{sorted.length}
                </button>
              )}
              <button
                type="button"
                aria-label="Предыдущее фото"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (activePhotoIdx > 0) {
                    setActivePhotoIdx(activePhotoIdx - 1);
                  } else {
                    const prev = (activeCardIdx - 1 + sorted.length) % sorted.length;
                    handleCardSwitch(prev, sorted[prev].photoUrls.length - 1);
                  }
                }}
                className={`${OVERLAY_BUTTON_UA_RESET} listing-card-chrome-target absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/60 active:scale-90`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                type="button"
                aria-label="Следующее фото"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (activePhotoIdx < photos.length - 1) {
                    setActivePhotoIdx(activePhotoIdx + 1);
                  } else {
                    handleCardSwitch((activeCardIdx + 1) % sorted.length);
                  }
                }}
                className={`${OVERLAY_BUTTON_UA_RESET} listing-card-chrome-target absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/60 active:scale-90`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
              </button>
              {photos.length > 1 && (
                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
                  <div className={CARD_OVERLAY_PHOTO_COUNTER_CLASS}>{activePhotoIdx + 1}/{photos.length}</div>
                </div>
              )}
              {!expanded && allPrompts.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 z-[1] px-3.5 pb-3.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
                    className={`${OVERLAY_BUTTON_APPEARANCE_RESET} listing-card-chrome-target w-full rounded-full bg-white/15 backdrop-blur-md border border-white/10 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-white/25 active:scale-[0.98] truncate`}
                  >Скопировать</button>
                </div>
              )}
            </div>

            <div className="listing-card-chrome-actions-fast pointer-events-none absolute right-3 top-3 z-[3] flex flex-col items-end gap-1.5 sm:right-3.5">
              <CardOverlayMetricsChips viewCount={viewCount} />
              <div className="listing-card-chrome-target flex flex-col items-end gap-1.5">
                <ReactionButtons
                  cardId={activeCard.id}
                  likesCount={activeCard.likesCount}
                  dislikesCount={activeCard.dislikesCount}
                  userReaction={userReaction}
                  onToggle={toggleReaction}
                  variant="overlay"
                  stacked
                />
              </div>
            </div>
          </div>

          {expanded && (
            <div className="absolute inset-0 z-30 flex flex-col bg-black/70 backdrop-blur-sm p-4">
              <div className="mb-2 flex shrink-0 items-start justify-between">
                <h3 className="mr-2 min-w-0 flex-1 text-[13px] font-semibold leading-snug text-white line-clamp-1">
                  {expandedTitle.first}
                </h3>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(false); }}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex-shrink-0 rounded-full bg-white/15 p-1.5 text-white/70 transition-colors hover:bg-white/25 hover:text-white`}
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
              <div className="mb-2 min-h-0 flex-1 overflow-y-auto rounded-xl bg-white/10 p-3">
                <div className="font-mono text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">{allPrompts.join("\n\n")}</div>
              </div>
              {expandedTitle.rest ? (
                <p className="mb-3 shrink-0 text-[11px] leading-relaxed text-white/50">{expandedTitle.rest}</p>
              ) : null}
              <button type="button" onClick={handleCopy}
                className={`${OVERLAY_BUTTON_UA_RESET} w-full shrink-0 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-900 transition-all hover:bg-zinc-100 active:scale-[0.98]`}
              >{copied ? "Промпт скопирован" : "Скопировать промт"}</button>
            </div>
          )}
        </div>
      </article>
  );

  return (
    <div className="group relative pb-2 pr-2">
      <div className="absolute top-3 left-3 right-0 bottom-0 rounded-2xl bg-zinc-300 overflow-hidden rotate-[2deg] shadow-md transition-transform duration-300 group-hover:rotate-[4deg] group-hover:translate-x-1 group-hover:translate-y-1">
        {secondPhoto && (
          <Image
            src={secondPhoto}
            alt=""
            fill
            loading="lazy"
            fetchPriority="low"
            className="object-cover opacity-60"
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          />
        )}
      </div>
      <div className="relative z-10">
        {articleEl}
      </div>
    </div>
  );
}
