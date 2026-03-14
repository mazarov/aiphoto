"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";
import { ReactionButtons } from "./ReactionButtons";
import { FavoriteButton } from "./FavoriteButton";
import { useCardInteractions } from "@/context/CardInteractionsContext";

type Props = {
  card: PromptCardFull;
  debug?: boolean;
};

function getSeoTagSlugs(seoTags: unknown): string[] {
  const t = seoTags as Record<string, string[]> | null;
  if (!t) return [];
  return [
    "audience_tag",
    "style_tag",
    "occasion_tag",
    "object_tag",
  ].flatMap((d) => (t[d] || []) as string[]);
}

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

export function PromptCard({ card, debug = false }: Props) {
  const { reactions, favorites, toggleReaction, toggleFavorite } = useCardInteractions();
  const title = card.title_ru || card.title_en || "Без названия";
  const seoSlugs = getSeoTagSlugs(card.seo_tags);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const photos = card.photoUrls;
  const currentPhoto = photos[photoIndex] || null;
  const promptPreview =
    card.promptTexts[0]?.slice(0, 100) + (card.promptTexts[0]?.length > 100 ? "…" : "") || "";


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
    const str = card.promptTexts.join("\n\n");
    if (!str) return;
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const userReaction = reactions.get(card.id) ?? null;
  const isFavorited = favorites.has(card.id);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${card.slug ? "cursor-pointer" : ""}`}
    >
      {debug && <DebugOverlay card={card} />}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
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
          />
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
              aria-label="Previous photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
              aria-label="Next photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        )}

        {card.beforePhotoUrl && (
          <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[72px]">
            <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
              <Image src={card.beforePhotoUrl} alt="before" fill className="object-cover" sizes="120px" />
              <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                БЫЛО
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between">
          <div className="flex items-center gap-1.5 pointer-events-none">
            {card.beforePhotoUrl && <div className="w-[28%] min-w-[72px]" />}
            {card.cardSplitTotal > 1 && (
              <div className="rounded-full bg-indigo-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow">
                {card.cardSplitIndex + 1}/{card.cardSplitTotal}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {photos.length > 1 && (
              <div className="rounded-full bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums pointer-events-none">
                {photoIndex + 1}/{photos.length}
              </div>
            )}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
              <FavoriteButton
                cardId={card.id}
                isFavorited={isFavorited}
                onToggle={toggleFavorite}
                variant="overlay"
              />
            </div>
          </div>
        </div>

        {photos.length > 1 && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPhotoIndex(i); }}
                className={`rounded-full transition-all ${
                  i === photoIndex ? "w-2 h-2 bg-white shadow-sm" : "w-1.5 h-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {!expanded && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-3.5 px-3.5 pointer-events-none">
            <div className="flex items-end justify-between gap-2 pointer-events-none">
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-0.5">
                  {title}
                </h3>
                {promptPreview && (
                  <p className="text-[11px] text-white/60 leading-relaxed line-clamp-1">
                    {promptPreview}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <ReactionButtons
                  cardId={card.id}
                  likesCount={card.likesCount}
                  dislikesCount={card.dislikesCount}
                  userReaction={userReaction}
                  onToggle={toggleReaction}
                  variant="overlay"
                />
              </div>
            </div>
            {card.promptTexts.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
                className="mt-2 w-full rounded-lg bg-white/15 backdrop-blur-md border border-white/10 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-white/25 active:scale-[0.98] pointer-events-auto truncate"
              >
                Скопировать
              </button>
            )}
          </div>
        )}

        {expanded && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-white leading-snug flex-1 mr-2">{title}</h3>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(false); }}
                className="flex-shrink-0 rounded-full bg-white/15 p-1.5 text-white/70 hover:bg-white/25 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mb-3 rounded-xl bg-white/10 p-3">
              <div className="font-mono text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">
                {card.promptTexts.join("\n\n")}
              </div>
            </div>
            {seoSlugs.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {seoSlugs.slice(0, 5).map((slug) => (
                  <span key={slug} className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/60">{slug}</span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCopy(e); }}
              className="w-full rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-900 transition-all hover:bg-zinc-100 active:scale-[0.98]"
            >
              {copied ? "Скопировано!" : "Скопировать промт"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
