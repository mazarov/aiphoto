"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";
import { PhotoCarousel } from "./PhotoCarousel";
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

const WARNING_LABELS: Record<string, string> = {
  missing_date: "Нет даты",
  missing_ru_prompt_text: "Нет RU промпта",
  ambiguous_prompt_photo_mapping: "Неоднозначная связка фото-промпт",
  split_mapping_no_explicit_markers: "Нет разметки Кадр 1/2/3",
  split_mapping_remainder_distribution: "Неравномерное распределение",
  split_mapping_photo_reuse: "Фото переиспользованы",
  photo_prompt_count_mismatch: "Кол-во фото ≠ промптов",
};

function PromptCardDebug({ card }: { card: PromptCardFull }) {
  const title = card.title_ru || card.title_en || "Без названия";
  const seoSlugs = getSeoTagSlugs(card.seo_tags);
  const hasRuPrompt = card.promptTexts.length > 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <PhotoCarousel
        photoUrls={card.photoUrls}
        photoMeta={card.photoMeta}
        beforePhotoUrl={card.beforePhotoUrl}
        alt={title}
        cardId={card.id}
      />
      <div className="flex flex-1 flex-col p-4 gap-3">
        <h3 className="text-base font-semibold text-zinc-900 leading-tight">{title}</h3>
        <div className="text-[10px] text-zinc-400 font-mono break-all select-all">{card.id}</div>
        <div className="text-xs text-zinc-500 font-mono">
          {card.datasetSlug && <span>{card.datasetSlug}</span>}
          {card.sourceMessageId && <span> · msg {card.sourceMessageId}</span>}
          {card.sourceDate && <span> · {card.sourceDate}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">photos: {card.photoCount}</span>
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">prompts: {card.promptCount}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${card.seoReadinessScore >= 60 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : card.seoReadinessScore >= 40 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>
            score: {card.seoReadinessScore}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${hasRuPrompt ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            RU: {hasRuPrompt ? "есть" : "нет"}
          </span>
          {card.warnings.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">warnings: {card.warnings.length}</span>
          )}
          {card.beforePhotoUrl && (
            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700">было/стало</span>
          )}
        </div>
        {card.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {card.warnings.map((w, i) => (<div key={i}>• {WARNING_LABELS[w] || w}</div>))}
          </div>
        )}
        {seoSlugs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seoSlugs.map((slug) => (<span key={slug} className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[11px] text-violet-700">{slug}</span>))}
          </div>
        )}
        {card.hashtags.length > 0 && (
          <div className="text-xs text-zinc-500">{card.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</div>
        )}
        {card.promptTexts.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs text-zinc-600 whitespace-pre-wrap">{card.promptTexts.join("\n\n")}</div>
        )}
      </div>
    </article>
  );
}

export function PromptCard({ card, debug = false }: Props) {
  const router = useRouter();
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

  if (debug) {
    return <PromptCardDebug card={card} />;
  }

  const userReaction = reactions.get(card.id) ?? null;
  const isFavorited = favorites.has(card.id);

  const handleCardClick = () => {
    if (card.slug) {
      router.push(`/p/${card.slug}`);
    }
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/10 hover:-translate-y-0.5 ${card.slug ? "cursor-pointer" : ""}`}
      role={card.slug ? "link" : undefined}
    >
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
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={handleCardClick}
            aria-hidden
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
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-3.5 px-3.5">
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
