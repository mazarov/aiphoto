"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";
import { CopyPromptButton } from "./CopyPromptButton";

type Props = {
  cards: PromptCardFull[];
  debug?: boolean;
};

function getSeoTagSlugs(seoTags: unknown): string[] {
  const t = seoTags as Record<string, string[]> | null;
  if (!t) return [];
  return ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"].flatMap(
    (d) => (t[d] || []) as string[]
  );
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

export function GroupedCard({ cards, debug = false }: Props) {
  const router = useRouter();
  const sorted = [...cards].sort((a, b) => a.cardSplitIndex - b.cardSplitIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const activeCard = sorted[activeCardIdx];

  const title = activeCard.title_ru || activeCard.title_en || "Без названия";
  const allSeoSlugs = Array.from(new Set(sorted.flatMap((c) => getSeoTagSlugs(c.seo_tags))));
  const allWarnings = Array.from(new Set(sorted.flatMap((c) => c.warnings)));
  const allHashtags = Array.from(new Set(sorted.flatMap((c) => c.hashtags)));
  const allPrompts = sorted.flatMap((c) => c.promptTexts);
  const groupBeforeUrl = sorted.find((c) => c.beforePhotoUrl)?.beforePhotoUrl ?? null;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const photos = activeCard.photoUrls;
  const currentPhotoUrl = photos[activePhotoIdx] || photos[0] || null;

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptPreview =
    allPrompts[0]?.slice(0, 100) + (allPrompts[0]?.length > 100 ? "…" : "") || "";

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
    const str = allPrompts.join("\n\n");
    if (!str) return;
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // === Debug mode ===
  if (debug) {
    return (
      <article className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-indigo-300 bg-white shadow-sm">
        <div className="flex bg-indigo-50 border-b border-indigo-200">
          {sorted.map((c, i) => (
            <button key={c.id} type="button" onClick={() => handleCardSwitch(i)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${i === activeCardIdx ? "bg-indigo-500 text-white" : "text-indigo-600 hover:bg-indigo-100"} ${i > 0 ? "border-l border-indigo-200" : ""}`}
            >{i + 1} / {sorted.length}</button>
          ))}
        </div>
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
            {currentPhotoUrl ? (
              <>
                <Image src={currentPhotoUrl} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover scale-110 blur-2xl brightness-75" aria-hidden />
                <Image src={currentPhotoUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain relative" />
              </>
            ) : (<div className="flex h-full items-center justify-center text-zinc-400 text-sm">Нет фото</div>)}
            <div className="absolute top-2 right-2 rounded-full bg-indigo-500 text-white px-2 py-0.5 text-[10px] font-bold shadow">Группа {sorted.length}</div>
            {(activeCard.beforePhotoUrl || groupBeforeUrl) && (
              <div className="absolute top-0 left-0 z-10 w-[28%] min-w-[72px]">
                <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                  <Image src={(activeCard.beforePhotoUrl || groupBeforeUrl)!} alt="before" fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">БЫЛО</div>
                </div>
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-zinc-50 border-t border-zinc-100">
              {photos.map((url, i) => (
                <button key={i} type="button" onClick={() => setActivePhotoIdx(i)}
                  className={`flex-shrink-0 w-11 h-11 rounded-md overflow-hidden border-2 transition ${i === activePhotoIdx ? "border-blue-500 shadow-sm" : "border-zinc-200 hover:border-zinc-400"}`}
                ><Image src={url} alt={`thumb ${i + 1}`} width={44} height={44} className="object-cover w-full h-full" /></button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4 gap-3">
          <h3 className="text-base font-semibold text-zinc-900 leading-tight">{title}</h3>
          <div className="text-[10px] text-zinc-400 font-mono break-all select-all">
            {sorted.map((c, i) => (<span key={c.id}>{i > 0 && " · "}<span className={i === activeCardIdx ? "text-indigo-500 font-bold" : ""}>{c.id.slice(0, 8)}</span></span>))}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            {activeCard.datasetSlug && <span>{activeCard.datasetSlug}</span>}
            {activeCard.sourceMessageId && <span> · msg {activeCard.sourceMessageId}</span>}
            {activeCard.sourceDate && <span> · {activeCard.sourceDate}</span>}
            <span> · split {activeCard.cardSplitIndex + 1}/{activeCard.cardSplitTotal}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 font-medium">группа: {sorted.length} карт</span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">photos: {sorted.reduce((s, c) => s + c.photoCount, 0)}</span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">prompts: {sorted.reduce((s, c) => s + c.promptCount, 0)}</span>
            {allWarnings.length > 0 && (<span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">warnings: {allWarnings.length}</span>)}
            {groupBeforeUrl && (<span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700">было/стало</span>)}
          </div>
          {allWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {allWarnings.map((w, i) => (<div key={i}>• {WARNING_LABELS[w] || w}</div>))}
            </div>
          )}
          {allSeoSlugs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allSeoSlugs.map((slug) => (<span key={slug} className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[11px] text-violet-700">{slug}</span>))}
            </div>
          )}
          {allHashtags.length > 0 && (<div className="text-xs text-zinc-500">{allHashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</div>)}
          {allPrompts.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs text-zinc-600 whitespace-pre-wrap">{allPrompts.join("\n\n")}</div>
          )}
          <div className="mt-auto pt-1"><CopyPromptButton texts={allPrompts} className="w-full" /></div>
        </div>
      </article>
    );
  }

  // === Normal mode — diagonal offset photo stack ===
  const secondPhoto = sorted.length > 1
    ? (sorted[activeCardIdx === 0 ? 1 : 0].photoUrls[0] || null)
    : null;

  const activeSlug = activeCard.slug;

  const handleCardClick = (e: React.MouseEvent) => {
    if (activeSlug) router.push(`/p/${activeSlug}`);
  };

  const articleEl = (
      <article
        className={`relative z-10 overflow-hidden rounded-2xl transition-all duration-200 group-hover:shadow-xl group-hover:shadow-zinc-900/10 group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 ${activeSlug ? "cursor-pointer" : ""}`}
        role={activeSlug ? "link" : undefined}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200">
          {/* Photo — object-cover */}
          {currentPhotoUrl ? (
            <Image
              src={currentPhotoUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-sm">Нет фото</div>
          )}

          {/* Transparent click overlay — above image, below buttons */}
          {activeSlug && (
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={handleCardClick}
              aria-hidden
            />
          )}

          {/* Arrow buttons — photos first, then next group card */}
          <button type="button" onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (activePhotoIdx > 0) { setActivePhotoIdx(activePhotoIdx - 1); }
            else { const prev = (activeCardIdx - 1 + sorted.length) % sorted.length; handleCardSwitch(prev, sorted[prev].photoUrls.length - 1); }
          }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
          ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button type="button" onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (activePhotoIdx < photos.length - 1) { setActivePhotoIdx(activePhotoIdx + 1); }
            else { handleCardSwitch((activeCardIdx + 1) % sorted.length); }
          }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
          ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>

          {/* Group paging — same style as photo counter but indigo, centered */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCardSwitch((activeCardIdx + 1) % sorted.length); }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-indigo-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums cursor-pointer hover:bg-indigo-500 transition-colors"
          >
            {activeCardIdx + 1}/{sorted.length}
          </button>

          {/* Before badge — flush left */}
          {(activeCard.beforePhotoUrl || groupBeforeUrl) && (
            <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[72px]">
              <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                <Image src={(activeCard.beforePhotoUrl || groupBeforeUrl)!} alt="before" fill className="object-cover" sizes="120px" />
                <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">БЫЛО</div>
              </div>
            </div>
          )}

          {/* Photo counter */}
          {photos.length > 1 && (
            <div className="absolute top-3 right-3 z-20 rounded-full bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
              {activePhotoIdx + 1}/{photos.length}
            </div>
          )}

          {/* Photo dots */}
          {photos.length > 1 && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
              {photos.map((_, i) => (
                <button key={i} type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setActivePhotoIdx(i); }}
                  className={`rounded-full transition-all ${i === activePhotoIdx ? "w-2 h-2 bg-white shadow-sm" : "w-1.5 h-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          )}

          {/* Default overlay — pointer-events-none so clicks pass through to navigation overlay */}
          {!expanded && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-3.5 px-3.5 pointer-events-none">
              <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1">{title}</h3>
              {promptPreview && (
                <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
                  className="hidden sm:block text-left text-[11px] text-white/60 leading-relaxed line-clamp-1 hover:text-white/80 transition-colors w-full pointer-events-auto"
                >{promptPreview}</button>
              )}
              {allPrompts.length > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
                  className="mt-2 w-full rounded-lg bg-white/15 backdrop-blur-md border border-white/10 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-white/25 active:scale-[0.98] pointer-events-auto"
                >Скопировать промт</button>
              )}
            </div>
          )}

          {/* Expanded overlay */}
          {expanded && (
            <div className="absolute inset-0 z-30 flex flex-col bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-white leading-snug flex-1 mr-2">{title}</h3>
                <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(false); }}
                  className="flex-shrink-0 rounded-full bg-white/15 p-1.5 text-white/70 hover:bg-white/25 hover:text-white transition-colors"
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
              <div className="flex-1 overflow-y-auto mb-3 rounded-xl bg-white/10 p-3">
                <div className="font-mono text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">{allPrompts.join("\n\n")}</div>
              </div>
              {allSeoSlugs.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {allSeoSlugs.slice(0, 5).map((slug) => (<span key={slug} className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/60">{slug}</span>))}
                </div>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCopy(e); }}
                className="w-full rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-900 transition-all hover:bg-zinc-100 active:scale-[0.98]"
              >{copied ? "Скопировано!" : "Скопировать промт"}</button>
            </div>
          )}
        </div>
      </article>
  );

  return (
    <div className="group relative pb-2 pr-2">
      {/* Back card — offset right & down, slightly rotated */}
      <div className="absolute top-3 left-3 right-0 bottom-0 rounded-2xl bg-zinc-300 overflow-hidden rotate-[2deg] shadow-md transition-transform duration-300 group-hover:rotate-[4deg] group-hover:translate-x-1 group-hover:translate-y-1">
        {secondPhoto && (
          <Image src={secondPhoto} alt="" fill className="object-cover opacity-60" sizes="(max-width: 640px) 50vw, 25vw" />
        )}
      </div>
      <div className="relative z-10">
        {articleEl}
      </div>
    </div>
  );
}
