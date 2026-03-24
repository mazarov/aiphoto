"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";
import { ReactionButtons } from "./ReactionButtons";
import { FavoriteButton } from "./FavoriteButton";
import { useCardInteractions } from "@/context/CardInteractionsContext";
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
  card: PromptCardFull;
  debug?: boolean;
  /** First cells in category grid — eager image + LCP-friendly reveal. */
  priorityLoad?: boolean;
};

function DebugOverlay({ card }: { card: PromptCardFull }) {
  const hasEnOnly = !card.hasRuPrompt && card.promptTexts.length > 0;
  const ruLabel = card.hasRuPrompt ? "RU: есть" : hasEnOnly ? "EN only" : "нет промпта";
  const ruColor = card.hasRuPrompt ? "bg-emerald-600" : hasEnOnly ? "bg-amber-500" : "bg-red-500";
  const scoreColor = card.seoReadinessScore >= 60 ? "bg-emerald-600" : card.seoReadinessScore >= 40 ? "bg-blue-500" : "bg-zinc-500";

  return (
    <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm px-2.5 py-2 space-y-1">
        <div className="text-[9px] text-white/50 font-mono break-all select-all leading-tight pointer-events-auto">{card.id}</div>
        <div className="text-[10px] text-white/70 font-mono leading-tight">
          {card.datasetSlug && <span>{card.datasetSlug}</span>}
          {card.sourceMessageId && <span> · msg {card.sourceMessageId}</span>}
          {card.sourceDate && <span> · {card.sourceDate}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] text-white font-medium">photos: {card.photoCount}</span>
          <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] text-white font-medium">prompts: {card.promptCount}</span>
          <span className={`rounded-full ${scoreColor} px-1.5 py-px text-[9px] text-white font-medium`}>score: {card.seoReadinessScore}</span>
          <span className={`rounded-full ${ruColor} px-1.5 py-px text-[9px] text-white font-medium`}>{ruLabel}</span>
          {card.beforePhotoUrl && (
            <span className="rounded-full bg-teal-600 px-1.5 py-px text-[9px] text-white font-medium">было</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PromptCard({ card, debug = false, priorityLoad = false }: Props) {
  const { reactions, favorites, toggleReaction, toggleFavorite } = useCardInteractions();
  const title = card.title_ru || card.title_en || "Без названия";
  const expandedTitle = splitCardTitle(title);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const photos = card.photoUrls;
  const currentPhoto = photos[photoIndex] || null;
  const promptPreview =
    card.promptTexts[0]?.slice(0, 100) + (card.promptTexts[0]?.length > 100 ? "…" : "") || "";

  const viewCount = card.viewCount ?? 0;

  function nextPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (photos.length > 1) setPhotoIndex((i) => (i + 1) % photos.length);
  }

  function prevPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (photos.length > 1) setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const str = card.promptTexts.join("\n\n");
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

  const userReaction = reactions.get(card.id) ?? null;
  const isFavorited = favorites.has(card.id);

  const mainPhotoClass =
    "listing-card-photo-hover object-cover z-[2] opacity-100";

  return (
    <article
      className={`group relative isolate overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${card.slug ? "cursor-pointer" : ""}`}
    >
      {debug && <DebugOverlay card={card} />}
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-200 aspect-[3/4]">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={title}
            fill
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priorityLoad}
            fetchPriority={priorityLoad ? "high" : undefined}
            className={mainPhotoClass}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-sm">
            Нет фото
          </div>
        )}

        {card.slug && (
          <Link
            href={`/p/${card.slug}`}
            className="absolute inset-0 z-10"
            aria-label={title}
            prefetch
            target="_blank"
            rel="noopener noreferrer"
          />
        )}

        <div className="listing-card-chrome absolute inset-0 z-20">
          <div className="listing-card-chrome-ambient absolute inset-0">
            {card.beforePhotoUrl && (
              <div className="absolute top-0 left-0 w-[28%] min-w-[72px]">
                <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                  <Image
                    src={card.beforePhotoUrl}
                    alt="before"
                    fill
                    className="object-cover"
                    sizes={SIZES_CARD_GRID}
                    quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
                  />
                  <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                    БЫЛО
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5">
              {card.beforePhotoUrl && <div className="w-[28%] min-w-[72px]" />}
              {card.cardSplitTotal > 1 && (
                <div className="rounded-full bg-indigo-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  {card.cardSplitIndex + 1}/{card.cardSplitTotal}
                </div>
              )}
              {card.isPublished === false && (
                <div className="rounded-full bg-amber-500/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  Черновик
                </div>
              )}
            </div>

            {!expanded && (
              <div
                className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 px-3.5 pointer-events-none ${
                  card.promptTexts.length > 0 ? "pb-14 sm:pb-[3.75rem]" : "pb-3.5"
                }`}
              >
                <h3 className="mb-0.5 text-[13px] font-semibold leading-snug text-white line-clamp-1">
                  {title}
                </h3>
                {promptPreview && (
                  <p className="mb-1 text-[11px] leading-relaxed text-white/60 line-clamp-2">
                    {promptPreview}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="listing-card-chrome-controls-fast pointer-events-none absolute inset-0 z-[2]">
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  className={`${OVERLAY_BUTTON_UA_RESET} listing-card-chrome-target absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/60 active:scale-90`}
                  aria-label="Предыдущее фото"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  className={`${OVERLAY_BUTTON_UA_RESET} listing-card-chrome-target absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/60 active:scale-90`}
                  aria-label="Следующее фото"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </>
            )}
            {photos.length > 1 && (
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
                <div className={CARD_OVERLAY_PHOTO_COUNTER_CLASS}>
                  {photoIndex + 1}/{photos.length}
                </div>
              </div>
            )}
            {!expanded && card.promptTexts.length > 0 && (
              <div className="absolute inset-x-0 bottom-0 z-[1] px-3.5 pb-3.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
                  className={`${OVERLAY_BUTTON_APPEARANCE_RESET} listing-card-chrome-target w-full rounded-full border border-white/10 bg-white/15 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-[0.98] sm:px-3 sm:py-2 sm:text-[11px] truncate`}
                >
                  Скопировать
                </button>
              </div>
            )}
          </div>

          <div className="listing-card-chrome-actions-fast pointer-events-none absolute right-3 top-3 z-[3] flex flex-col items-end gap-1.5 sm:right-3.5">
            <CardOverlayMetricsChips viewCount={viewCount} />
            <div className="listing-card-chrome-target flex flex-col items-end gap-1.5">
              <ReactionButtons
                cardId={card.id}
                likesCount={card.likesCount}
                dislikesCount={card.dislikesCount}
                userReaction={userReaction}
                onToggle={toggleReaction}
                variant="overlay"
                stacked
              />
              <FavoriteButton
                cardId={card.id}
                isFavorited={isFavorited}
                onToggle={toggleFavorite}
                variant="overlay"
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
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="mb-2 min-h-0 flex-1 overflow-y-auto rounded-xl bg-white/10 p-3">
              <div className="font-mono text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">
                {card.promptTexts.join("\n\n")}
              </div>
            </div>
            {expandedTitle.rest ? (
              <p className="mb-3 shrink-0 text-[11px] leading-relaxed text-white/50">{expandedTitle.rest}</p>
            ) : null}
            <button
              type="button"
              onClick={handleCopy}
              className={`${OVERLAY_BUTTON_UA_RESET} w-full shrink-0 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-900 transition-all hover:bg-zinc-100 active:scale-[0.98]`}
            >
              {copied ? "Промпт скопирован" : "Скопировать промт"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
