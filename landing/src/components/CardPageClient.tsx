"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CardPageData } from "@/lib/supabase";
import { CardInteractionsProvider, useCardInteractions } from "@/context/CardInteractionsContext";
import { ReactionButtons } from "./ReactionButtons";
import { FavoriteButton } from "./FavoriteButton";
import { GenerateButton } from "./GenerateButton";
import { useDebug } from "./DebugFAB";

type TagEntry = { slug: string; label: string; href: string | null };
type BreadcrumbTag = { labelRu: string; urlPath: string } | null;

type Props = {
  data: CardPageData;
  tagEntries: TagEntry[];
  breadcrumbTag: BreadcrumbTag;
};

export function CardPageClient({ data, tagEntries, breadcrumbTag }: Props) {
  const cardIds = useMemo(() => [data.id], [data.id]);
  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <CardPageClientInner data={data} tagEntries={tagEntries} breadcrumbTag={breadcrumbTag} />
    </CardInteractionsProvider>
  );
}

function CardPageClientInner({ data, tagEntries, breadcrumbTag }: Props) {
  const title = data.title_ru || data.title_en || "Без названия";
  const { reactions, favorites, toggleReaction, toggleFavorite } = useCardInteractions();
  const userReaction = reactions.get(data.id) ?? null;
  const isFavorited = favorites.has(data.id);
  const debugCtx = useDebug();
  const debugMode = debugCtx?.debugOpen ?? false;

  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const photos = data.photoUrls;
  const currentPhoto = photos[photoIndex] || null;
  const hasPrompts = data.promptTexts.length > 0;
  const hasPhotos = photos.length > 0;

  const groupCards = useMemo(() => {
    if (data.siblings.length === 0) return [];
    const current = {
      id: data.id,
      slug: data.slug,
      title_ru: data.title_ru,
      card_split_index: data.card_split_index,
      mainPhotoUrl: data.mainPhotoUrl,
    };
    return [current, ...data.siblings].sort(
      (a, b) => a.card_split_index - b.card_split_index
    );
  }, [data]);

  function prevPhoto() {
    if (photos.length > 1) setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function nextPhoto() {
    if (photos.length > 1) setPhotoIndex((i) => (i + 1) % photos.length);
  }

  async function handleCopy() {
    const str = data.promptTexts.join("\n\n");
    if (!str) return;
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleCopySingle(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {}
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:py-10 pb-28">
      {/* Breadcrumb — hidden on mobile */}
      <nav className="mb-6 hidden sm:flex items-center gap-1.5 text-sm text-zinc-400">
        <Link href="/" className="transition-colors hover:text-zinc-700">
          Главная
        </Link>
        <Chevron />
        {breadcrumbTag ? (
          <>
            <Link
              href={breadcrumbTag.urlPath}
              className="transition-colors hover:text-zinc-700"
            >
              {breadcrumbTag.labelRu}
            </Link>
            <Chevron />
            <span className="text-zinc-600 line-clamp-1">{title}</span>
          </>
        ) : (
          <span className="text-zinc-600 line-clamp-1">{title}</span>
        )}
      </nav>

      {/* Debug panel */}
      {debugMode && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 font-mono text-xs text-zinc-700 space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">DEBUG</span>
          </div>
          <div><span className="text-zinc-400">id:</span> <span className="select-all">{data.id}</span></div>
          <div><span className="text-zinc-400">slug:</span> {data.slug}</div>
          <div><span className="text-zinc-400">dataset:</span> {data.source_dataset_slug || "—"}</div>
          <div><span className="text-zinc-400">source_msg:</span> {data.source_message_id || "—"}</div>
          <div><span className="text-zinc-400">source_date:</span> {data.source_date || "—"}</div>
          <div><span className="text-zinc-400">split:</span> {data.card_split_index}/{data.card_split_total}</div>
          <div><span className="text-zinc-400">photos:</span> {data.photoUrls.length} · <span className="text-zinc-400">prompts:</span> {data.promptTexts.length}</div>
          <div><span className="text-zinc-400">seo_score:</span> {data.seo_readiness_score ?? "—"}</div>
          {data.seo_tags && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"].map((dim) => {
                const arr = ((data.seo_tags as Record<string, string[]>)?.[dim] || []);
                return arr.map((slug: string) => (
                  <span key={`${dim}:${slug}`} className="rounded-full bg-zinc-200 px-1.5 py-px text-[9px] text-zinc-600">
                    {dim.replace("_tag", "")}:{slug}
                  </span>
                ));
              })}
            </div>
          )}
          {data.beforePhotoUrl && (
            <div><span className="text-zinc-400">before:</span> <span className="text-teal-600">есть</span></div>
          )}
        </div>
      )}

      {/* ── Hero Image with Blur Backdrop ── */}
      {hasPhotos && (
        <div className="relative overflow-hidden rounded-3xl bg-zinc-100 mb-8">
          {/* Blurred photo layer */}
          {currentPhoto && (
            <>
              <div className="absolute inset-0 scale-150">
                <Image
                  src={currentPhoto}
                  alt=""
                  fill
                  className="object-cover opacity-50 blur-3xl saturate-150 brightness-110"
                  sizes="100vw"
                  priority
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/15" />
            </>
          )}

          {/* Photo content */}
          <div className="group relative flex flex-col items-center justify-center gap-4 px-6 py-8 sm:px-10 sm:py-10">
            {currentPhoto ? (
              <div className="relative w-full max-w-[260px] sm:max-w-[300px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                <Image
                  src={currentPhoto}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 260px, 300px"
                  className="object-cover"
                  priority
                />

                {/* Nav arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevPhoto}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/50 active:scale-90"
                      aria-label="Previous photo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={nextPhoto}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/50 active:scale-90"
                      aria-label="Next photo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </>
                )}

                {/* Before badge */}
                {data.beforePhotoUrl && (
                  <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[56px]">
                    <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-lg ring-1 ring-black/10">
                      <Image src={data.beforePhotoUrl} alt="before" fill className="object-cover" sizes="80px" />
                      <div className="absolute inset-x-0 bottom-0 text-[7px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                        БЫЛО
                      </div>
                    </div>
                  </div>
                )}

                {/* Top badges: photo counter + split */}
                <div className="absolute top-2 left-2 right-2 z-20 flex items-start justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5">
                    {photos.length > 1 && (
                      <div className="rounded-full bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
                        {photoIndex + 1}/{photos.length}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {data.card_split_total > 1 && (
                      <div className="rounded-full bg-indigo-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        {data.card_split_index + 1}/{data.card_split_total}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group variant pills — on photo */}
                {groupCards.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 pointer-events-auto">
                    {groupCards.map((card) => {
                      const isActive = card.id === data.id;
                      return (
                        <Link
                          key={card.id}
                          href={`/p/${card.slug}`}
                          className={`flex items-center gap-1 rounded-full backdrop-blur-md px-2 py-1 transition-all flex-shrink-0 ${
                            isActive
                              ? "bg-white/30 ring-1 ring-white/40"
                              : "bg-black/30 hover:bg-black/40"
                          }`}
                        >
                          {card.mainPhotoUrl && (
                            <div className="h-4 w-4 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/20">
                              <Image
                                src={card.mainPhotoUrl}
                                alt=""
                                width={16}
                                height={16}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <span className={`text-[10px] font-medium ${
                            isActive ? "text-white" : "text-white/80"
                          }`}>
                            {card.card_split_index + 1}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Photo dots — on photo */}
                {photos.length > 1 && (
                  <div className={`absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 ${
                    groupCards.length > 1 ? "bottom-8" : "bottom-2"
                  }`}>
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPhotoIndex(i)}
                        className={`rounded-full transition-all ${
                          i === photoIndex
                            ? "w-2 h-2 bg-white shadow-sm"
                            : "w-1.5 h-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-zinc-400 text-sm">
                Нет фото
              </div>
            )}

            {/* Tags — glass pills overlay */}
            {tagEntries.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {tagEntries.map(({ slug, label, href }) =>
                  href ? (
                    <Link
                      key={slug}
                      href={href}
                      className="rounded-full bg-black/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white/90 transition-colors hover:bg-black/25"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span
                      key={slug}
                      className="rounded-full bg-black/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white/80"
                    >
                      {label}
                    </span>
                  )
                )}
              </div>
            )}

            {/* Action buttons — glass pill overlay */}
            <div className="flex items-center gap-1 rounded-full bg-black/15 backdrop-blur-md px-3 py-1.5">
              <ReactionButtons
                cardId={data.id}
                likesCount={data.likesCount}
                dislikesCount={data.dislikesCount}
                userReaction={userReaction}
                onToggle={toggleReaction}
                variant="overlay"
              />
              <div className="w-px h-4 bg-white/20 mx-1" />
              <FavoriteButton
                cardId={data.id}
                isFavorited={isFavorited}
                onToggle={toggleFavorite}
                variant="overlay"
              />
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full p-1.5 text-white/70 transition-colors hover:text-white active:scale-95"
                title="Поделиться"
              >
                <ShareIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Title ── */}
      <h1 className="text-2xl sm:text-3xl font-bold text-center text-zinc-900 leading-tight mb-2">
        {title}
      </h1>

      {/* ── Prompt Content ── */}
      {hasPrompts && (
        <div className="space-y-3 mb-4">
          {data.promptTexts.map((text, i) => (
            <div
              key={i}
              className="group/prompt relative rounded-2xl bg-zinc-50/80 border border-zinc-100 p-5 sm:p-6"
            >
              {data.promptTexts.length > 1 && (
                <div className="mb-3 text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                  Промпт {i + 1}
                </div>
              )}
              <div className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                {text}
              </div>
              <button
                type="button"
                onClick={() => handleCopySingle(text, i)}
                className="absolute top-3 right-3 rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 opacity-0 shadow-sm transition-all group-hover/prompt:opacity-100 hover:text-zinc-700 hover:border-zinc-300"
                title="Скопировать"
              >
                {copiedIdx === i ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Subtitle ── */}
      {hasPrompts && (
        <p className="text-center text-sm text-zinc-400 mb-6 max-w-md mx-auto">
          Готовый промт для генерации фото с помощью ИИ. Скопируй и используй в нейросети.
        </p>
      )}

      {/* ── Sticky CTA — floating ── */}
      {hasPrompts && (
        <div className="fixed inset-x-0 bottom-0 z-40 safe-area-pb pointer-events-none">
          <div className="mx-auto max-w-2xl px-4 py-4 flex gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <CheckIcon size={16} />
                  Скопировано!
                </>
              ) : (
                <>
                  <CopyIcon size={16} />
                  {data.promptTexts.length > 1
                    ? "Скопировать все промпты"
                    : "Копировать промпт"}
                </>
              )}
            </button>
            <GenerateButton
              cardId={data.id}
              initialPrompt={data.promptTexts[0] || ""}
              variant="mobile"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icons ── */

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="flex-shrink-0 text-zinc-300"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
