"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardViewBeacon } from "@/hooks/useCardViewBeacon";
import Image from "next/image";
import Link from "next/link";
import type { CardPageData } from "@/lib/supabase";
import { CardInteractionsProvider, useCardInteractions } from "@/context/CardInteractionsContext";
import { ReactionButtons } from "./ReactionButtons";
import { FavoriteButton } from "./FavoriteButton";
import { GenerateButton } from "./GenerateButton";
import { useDebug } from "./DebugFAB";
import { formatCompactCount } from "@/lib/format-view-count";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { useCardPhotoFrame } from "@/hooks/useCardPhotoFrame";
import { CARD_OVERLAY_PHOTO_COUNTER_CLASS } from "@/lib/card-overlay-photo-counter";
import {
  CARD_IMAGE_NEXT_QUALITY,
  SIZES_CARD_GRID,
  SIZES_CARD_HERO,
} from "@/lib/card-image-presets";

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
  const router = useRouter();
  const title = data.title_ru || data.title_en || "Без названия";
  const [publishedLocal, setPublishedLocal] = useState(data.isPublished);
  const [pubSaving, setPubSaving] = useState(false);
  const [pubStatus, setPubStatus] = useState<string | null>(null);
  const { reactions, favorites, toggleReaction, toggleFavorite } = useCardInteractions();
  const userReaction = reactions.get(data.id) ?? null;
  const isFavorited = favorites.has(data.id);
  const debugCtx = useDebug();
  const debugMode = debugCtx?.debugOpen ?? false;

  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [photos, setPhotos] = useState(data.photoUrls);
  const [photoMeta, setPhotoMeta] = useState(data.photoMeta);
  const [photoDimensions, setPhotoDimensions] = useState(data.photoDimensions);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState(data.beforePhotoUrl);
  const [setBeforeSaving, setSetBeforeSaving] = useState(false);
  const [setBeforeStatus, setSetBeforeStatus] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  // Reset local media only when opening another card (`id`), not on every `data` reference change.
  useEffect(() => {
    setPhotos(data.photoUrls);
    setPhotoMeta(data.photoMeta);
    setPhotoDimensions(data.photoDimensions);
    setBeforePhotoUrl(data.beforePhotoUrl);
    setPhotoIndex(0);
    setSetBeforeStatus(null);
    setDeleteStatus(null);
    setPubStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: [data.id] only
  }, [data.id]);

  useEffect(() => {
    setPublishedLocal(data.isPublished);
  }, [data.isPublished, data.id]);

  async function handleVisibilityChange(nextPublished: boolean) {
    setPubSaving(true);
    setPubStatus(null);
    try {
      const res = await fetch(`/api/my-cards/${encodeURIComponent(data.slug)}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ published: nextPublished }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPubStatus(j.error || res.statusText);
        return;
      }
      setPublishedLocal(nextPublished);
      router.refresh();
    } catch (e) {
      setPubStatus((e as Error).message);
    } finally {
      setPubSaving(false);
    }
  }

  const currentPhoto = photos[photoIndex] || null;
  const currentDims =
    photoDimensions[photoIndex] ?? photoDimensions[0];
  const {
    containerStyle: heroFrameStyle,
    showTailwindFallback: heroFrameFallback,
    onLoadingComplete: onHeroFrameFromHook,
  } = useCardPhotoFrame(
    currentDims?.width ?? null,
    currentDims?.height ?? null,
    currentPhoto || ""
  );

  /** Defer blur backdrop until hero `img` loaded so LCP is the main photo, not a full-bleed duplicate `<img>`. */
  const [blurBackdropReady, setBlurBackdropReady] = useState(false);
  useEffect(() => {
    setBlurBackdropReady(false);
  }, [currentPhoto]);

  const onHeroFrameLoad = useCallback(
    (img: HTMLImageElement) => {
      onHeroFrameFromHook(img);
      setBlurBackdropReady(true);
    },
    [onHeroFrameFromHook]
  );

  const hasPrompts = data.promptTexts.length > 0;
  const hasPhotos = photos.length > 0;
  const viewCount = useCardViewBeacon(data.slug, data.viewCount ?? 0);

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

  async function handleDebugSetBefore() {
    const meta = photoMeta[photoIndex];
    if (!meta) return;
    setSetBeforeSaving(true);
    setSetBeforeStatus(null);
    try {
      const res = await fetch("/api/set-before", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: data.id,
          storageBucket: meta.bucket,
          storagePath: meta.path,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setSetBeforeStatus(`Ошибка: ${j.error || res.statusText}`);
        return;
      }
      const idx = photoIndex;
      setBeforePhotoUrl(meta.url);
      const nextPhotos = photos.filter((_, i) => i !== idx);
      const nextIdx =
        nextPhotos.length === 0 ? 0 : Math.min(idx, nextPhotos.length - 1);
      setPhotos(nextPhotos);
      setPhotoMeta(photoMeta.filter((_, i) => i !== idx));
      setPhotoDimensions(photoDimensions.filter((_, i) => i !== idx));
      setPhotoIndex(nextIdx);
      setSetBeforeStatus("Сохранено");
    } catch (e) {
      setSetBeforeStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSetBeforeSaving(false);
    }
  }

  async function handleDebugDeleteCard() {
    if (
      !window.confirm(
        `Удалить карточку из базы без восстановления?\n\nslug:\n${data.slug}`
      )
    ) {
      return;
    }
    setDeleteSaving(true);
    setDeleteStatus(null);
    try {
      const res = await fetch("/api/debug-delete-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: data.id,
          confirmSlug: data.slug,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteStatus(`Ошибка: ${j.error || res.statusText}`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setDeleteStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setDeleteSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:py-10 pb-28">
      {/* Breadcrumb — hidden on mobile */}
      <nav className="mb-6 hidden sm:flex items-center gap-1.5 text-sm text-zinc-500">
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
          <div><span className="text-zinc-400">photos:</span> {photos.length} · <span className="text-zinc-400">prompts:</span> {data.promptTexts.length}</div>
          <div><span className="text-zinc-400">seo_score:</span> {data.seo_readiness_score ?? "—"}</div>
          <div><span className="text-zinc-400">view_count:</span> {viewCount}</div>
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
          {beforePhotoUrl && (
            <div><span className="text-zinc-400">before:</span> <span className="text-teal-600">есть</span></div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/80">
            <button
              type="button"
              onClick={handleDebugSetBefore}
              disabled={setBeforeSaving || photos.length === 0 || !photoMeta[photoIndex]}
              className="rounded-lg bg-amber-200/90 border border-amber-400 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-300/90 disabled:opacity-50"
            >
              {setBeforeSaving ? "Сохраняю…" : "Сделать «Было»"}
            </button>
            <span className="text-[10px] text-zinc-500">
              текущее фото {photos.length ? photoIndex + 1 : 0}/{photos.length}
            </span>
            {setBeforeStatus && (
              <span
                className={`text-[11px] ${
                  setBeforeStatus.startsWith("Ошибка") ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {setBeforeStatus}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-200/80">
            <button
              type="button"
              onClick={handleDebugDeleteCard}
              disabled={deleteSaving}
              className="rounded-lg bg-red-100 border border-red-300 px-2.5 py-1.5 text-[11px] font-semibold text-red-900 transition-colors hover:bg-red-200/90 disabled:opacity-50"
            >
              {deleteSaving ? "Удаляю…" : "Удалить карточку"}
            </button>
            {deleteStatus && (
              <span
                className={`text-[11px] ${
                  deleteStatus.startsWith("Ошибка") ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {deleteStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Hero Image with Blur Backdrop ── */}
      {hasPhotos && (
        <div className="relative overflow-hidden rounded-3xl bg-zinc-100 mb-8">
          {/* Blurred backdrop: CSS only, after hero loads — avoids second `<img>` winning LCP over the card photo */}
          {blurBackdropReady && currentPhoto && (
            <>
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <div
                  className="absolute inset-0 scale-150 bg-cover bg-center opacity-50 blur-3xl saturate-150 brightness-110"
                  style={{
                    backgroundImage: `url(${JSON.stringify(currentPhoto)})`,
                  }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/15" />
            </>
          )}

          {/* Photo content */}
          <div className="group relative flex flex-col items-center justify-center gap-4 px-6 py-8 sm:px-10 sm:py-10">
            {currentPhoto ? (
              <div
                className={`relative w-full max-w-[260px] sm:max-w-[300px] rounded-2xl overflow-hidden bg-zinc-200 shadow-2xl ring-1 ring-black/5${heroFrameFallback ? " aspect-[3/4]" : ""}`}
                style={heroFrameStyle}
              >
                <Image
                  src={currentPhoto}
                  alt={title}
                  fill
                  sizes={SIZES_CARD_HERO}
                  quality={CARD_IMAGE_NEXT_QUALITY}
                  className="object-cover"
                  priority
                  fetchPriority="high"
                  decoding="async"
                  onLoadingComplete={onHeroFrameLoad}
                />

                {/* Nav arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/50 active:scale-90`}
                      aria-label="Предыдущее фото"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={nextPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/50 active:scale-90`}
                      aria-label="Следующее фото"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </>
                )}

                {/* Before badge */}
                {beforePhotoUrl && (
                  <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[56px]">
                    <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-lg ring-1 ring-black/10">
                      <Image
                        src={beforePhotoUrl}
                        alt="before"
                        fill
                        className="object-cover"
                        sizes={SIZES_CARD_GRID}
                        quality={CARD_IMAGE_NEXT_QUALITY}
                      />
                      <div className="absolute inset-x-0 bottom-0 text-[7px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                        БЫЛО
                      </div>
                    </div>
                  </div>
                )}

                {photos.length > 1 && (
                  <div className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2">
                    <div className={CARD_OVERLAY_PHOTO_COUNTER_CLASS}>
                      {photoIndex + 1}/{photos.length}
                    </div>
                  </div>
                )}
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
                                sizes={SIZES_CARD_GRID}
                                quality={CARD_IMAGE_NEXT_QUALITY}
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

            {/* Action buttons — one chip per control (same as photo counter) */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <ReactionButtons
                cardId={data.id}
                likesCount={data.likesCount}
                dislikesCount={data.dislikesCount}
                userReaction={userReaction}
                onToggle={toggleReaction}
                variant="overlay"
              />
              <FavoriteButton
                cardId={data.id}
                isFavorited={isFavorited}
                onToggle={toggleFavorite}
                variant="overlay"
              />
              <button
                type="button"
                onClick={handleShare}
                className={`${CARD_OVERLAY_ACTION_PILL} min-w-[2.75rem] text-white/70 transition-colors hover:text-white active:scale-95`}
                title="Поделиться"
                aria-label="Поделиться ссылкой на карточку"
              >
                <ShareIcon className="block shrink-0" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Title ── */}
      <h1 className="text-2xl sm:text-3xl font-bold text-center text-zinc-900 leading-tight mb-2">
        {title}
      </h1>

      {data.authorUserId && (
        <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200 ring-2 ring-zinc-100">
              {data.authorAvatarUrl ? (
                <Image
                  src={data.authorAvatarUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="44px"
                  quality={60}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                  {(data.authorDisplayName || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-zinc-800">
                {data.authorDisplayName || "Автор"}
              </div>
              {!publishedLocal && data.viewerIsOwner && (
                <div className="text-xs text-amber-800">Черновик — виден только вам</div>
              )}
            </div>
          </div>
          {data.viewerIsOwner && (
            <div className="flex flex-col items-center gap-1 sm:items-start">
              <button
                type="button"
                disabled={pubSaving}
                onClick={() => handleVisibilityChange(!publishedLocal)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {pubSaving
                  ? "Сохранение…"
                  : publishedLocal
                    ? "Скрыть"
                    : "Опубликовать"}
              </button>
              {pubStatus && (
                <span className="text-center text-xs text-red-600 sm:text-left">{pubStatus}</span>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mb-6 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <EyeIcon
          className={`shrink-0 ${viewCount > 0 ? "text-zinc-500" : "text-zinc-300"}`}
          size={16}
          aria-hidden
        />
        <span className={`tabular-nums ${viewCount > 0 ? "text-zinc-600" : "text-zinc-400"}`}>
          {formatCompactCount(viewCount)}
        </span>
        <span className="font-normal text-zinc-500">просмотров</span>
      </p>

      {/* ── Prompt Content ── */}
      {hasPrompts && (
        <div className="space-y-3 mb-4">
          {data.promptTexts.map((text, i) => (
            <div
              key={i}
              className="group/prompt relative rounded-2xl bg-zinc-50/80 border border-zinc-100 p-5 sm:p-6"
            >
              {data.promptTexts.length > 1 && (
                <div className="mb-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
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
                aria-label={`Скопировать промпт ${i + 1}`}
              >
                {copiedIdx === i ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Subtitle ── */}
      {hasPrompts && (
        <p className="text-center text-sm text-zinc-500 mb-6 max-w-md mx-auto">
          Готовый промт для генерации фото с помощью ИИ. Скопируй и используй в нейросети.
        </p>
      )}

      {/* ── Sticky CTA — floating ── */}
      {hasPrompts && (
        <div className="fixed inset-x-0 bottom-0 z-40 safe-area-pb pointer-events-none lg:left-60">
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
              sourceImageUrl={currentPhoto || undefined}
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

function EyeIcon({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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

function ShareIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
