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
import { LexyGptGenerateButton } from "./LexyGptGenerateButton";
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
import { copyTextSyncFallback, copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import {
  resolveListingNavNeighbors,
  type ListingCardNavNeighbors,
} from "@/lib/listing-card-navigation-context";

/** Glass как у «тегов» на этом экране: chip-подложка без отдельной нижней панели. */
const MOBILE_FS_CHIP =
  "bg-black/15 text-white/90 backdrop-blur-md shadow-none transition-colors hover:bg-black/25";
/** То же — приглушённый текст для нессылочных чипов */
const MOBILE_FS_CHIP_MUTED =
  "bg-black/15 text-white/80 backdrop-blur-md shadow-none transition-colors hover:bg-black/25";
/** Кнопки поверх фото (копировать) — без «полосы», тот же glass. */
const MOBILE_FS_ACTION = `${MOBILE_FS_CHIP} rounded-xl font-semibold`;
const MOBILE_FS_EXPAND = `${MOBILE_FS_CHIP} rounded-2xl px-4 py-3 text-[13px] font-medium leading-snug`;

type TagEntry = { slug: string; label: string; href: string | null };
type BreadcrumbTag = { labelRu: string; urlPath: string } | null;

type Props = {
  data: CardPageData;
  tagEntries: TagEntry[];
  breadcrumbTag: BreadcrumbTag;
  isModal?: boolean;
  /** When provided (client-side modal), neighbor navigation stays inside the same modal instance. */
  onListingNeighborGo?: (slug: string) => void;
};

export function CardPageClient({ data, tagEntries, breadcrumbTag, isModal = false, onListingNeighborGo }: Props) {
  const cardIds = useMemo(() => [data.id], [data.id]);
  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <CardPageClientInner
        data={data}
        tagEntries={tagEntries}
        breadcrumbTag={breadcrumbTag}
        isModal={isModal}
        onListingNeighborGo={onListingNeighborGo}
      />
    </CardInteractionsProvider>
  );
}

function CardPageClientInner({ data, tagEntries, breadcrumbTag, isModal, onListingNeighborGo }: Props) {
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
  const [stickyCopy, setStickyCopy] = useState<"idle" | "ok" | "fail">("idle");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copyErrIdx, setCopyErrIdx] = useState<number | null>(null);

  const [photos, setPhotos] = useState(data.photoUrls);
  const [photoMeta, setPhotoMeta] = useState(data.photoMeta);
  const [photoDimensions, setPhotoDimensions] = useState(data.photoDimensions);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState(data.beforePhotoUrl);
  const [setBeforeSaving, setSetBeforeSaving] = useState(false);
  const [setBeforeStatus, setSetBeforeStatus] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [listingNavNeighbors, setListingNavNeighbors] =
    useState<ListingCardNavNeighbors | null>(null);
  const [mobilePromptOverlay, setMobilePromptOverlay] = useState(false);

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

  useEffect(() => {
    setListingNavNeighbors(resolveListingNavNeighbors(data.slug));
  }, [data.slug]);

  useEffect(() => {
    // Don't scroll to top in modal view — modal handles its own positioning
    if (!isModal) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [data.slug, isModal]);

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


  const handleCloseMobileViewer = useCallback(() => {
    if (onListingNeighborGo) {
      // In client-side single-instance modal the parent (ClientCardModal) owns the close via CardModal.
      // The actual close is triggered by the CardModal's own X / overlay / Escape.
      return;
    }
    // Server-rendered full page or intercepting modal: go back to listing
    router.back();
  }, [router, onListingNeighborGo]);



  useEffect(() => {
    if (!mobilePromptOverlay || typeof window === "undefined") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobilePromptOverlay(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePromptOverlay]);

  useEffect(() => {
    setMobilePromptOverlay(false);
  }, [data.slug]);

  const goListingNeighbor = useCallback(
    (slug: string) => {
      if (onListingNeighborGo) {
        onListingNeighborGo(slug);
      } else {
        router.push(`/p/${encodeURIComponent(slug)}`);
      }
    },
    [router, onListingNeighborGo]
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
    if (copyTextSyncFallback(str)) {
      setStickyCopy("ok");
      window.setTimeout(() => setStickyCopy("idle"), 2200);
      return;
    }
    const ok = await copyTextUniversal(str);
    setStickyCopy(ok ? "ok" : "fail");
    window.setTimeout(() => setStickyCopy("idle"), 2200);
  }

  async function handleCopySingle(text: string, idx: number) {
    if (copyTextSyncFallback(text)) {
      setCopiedIdx(idx);
      setCopyErrIdx(null);
      window.setTimeout(() => setCopiedIdx(null), 2000);
      return;
    }
    const ok = await copyTextUniversal(text);
    if (ok) {
      setCopiedIdx(idx);
      setCopyErrIdx(null);
      window.setTimeout(() => setCopiedIdx(null), 2000);
    } else {
      setCopyErrIdx(idx);
      setCopiedIdx(null);
      window.setTimeout(() => setCopyErrIdx(null), 2200);
    }
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

  const listingPrev = listingNavNeighbors?.prevSlug ?? null;
  const listingNext = listingNavNeighbors?.nextSlug ?? null;
  const listingNavInStickyBar = !!(listingPrev || listingNext);

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
        <div
          className={`mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 font-mono text-xs text-zinc-700 space-y-1.5 ${hasPhotos ? "max-md:hidden" : ""}`}
        >
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

      {/* ── Hero (desktop framed / mobile immersive) ── */}
      {hasPhotos && (
        <>
          {/* Desktop первым — LCP для md+, mobile блок скрыт */}
          <div className="relative mb-8 hidden overflow-hidden rounded-3xl bg-zinc-100 md:block">
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

                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevPhoto}
                        className={`${OVERLAY_BUTTON_UA_RESET} absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all hover:bg-black/50 active:scale-90 max-md:opacity-100 md:group-hover:opacity-100`}
                        aria-label="Предыдущее фото"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={nextPhoto}
                        className={`${OVERLAY_BUTTON_UA_RESET} absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur-md transition-all hover:bg-black/50 active:scale-90 max-md:opacity-100 md:group-hover:opacity-100`}
                        aria-label="Следующее фото"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </>
                  )}

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
                  {groupCards.length > 1 && (
                    <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1">
                      <div className="pointer-events-auto flex items-center gap-1">
                        {groupCards.map((card) => {
                          const isActive = card.id === data.id;
                          return (
                            <Link
                              key={card.id}
                              href={`/p/${card.slug}`}
                              className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
                                isActive
                                  ? "bg-white/30 ring-1 ring-white/40 text-white"
                                  : `${MOBILE_FS_CHIP_MUTED} ring-1 ring-transparent`
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
                              <span
                                className={`tabular-nums font-semibold ${
                                  isActive ? "text-white" : "text-white/85"
                                }`}
                              >
                                {card.card_split_index + 1}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
                  Нет фото
                </div>
              )}

              {tagEntries.length > 0 && (
                <div className="w-full space-y-2">
                  <h2 className="sr-only">Теги</h2>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {tagEntries.map(({ slug, label, href }) =>
                      href ? (
                        <Link
                          key={slug}
                          href={href}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${MOBILE_FS_CHIP}`}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span
                          key={slug}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${MOBILE_FS_CHIP_MUTED}`}
                        >
                          {label}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="flex w-full flex-col items-center gap-3">
                <h2 className="sr-only">Отклики и шаринг</h2>
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
                  <ShareIcon className="block shrink-0" size={16} />
                </button>
              </div>
              </div>
            </div>
          </div>

          {/* Mobile: fullscreen-карточка (Chrome скрыт через CardPageLayout при наличии фото). */}
          <div className="fixed inset-0 z-[245] flex min-h-[100dvh] flex-col bg-transparent md:hidden motion-reduce:transition-none">
            {currentPhoto ? (
              <>
                <div className="pointer-events-none absolute inset-0 z-[1] bg-zinc-950" aria-hidden />

                {/* Полноэкранное фото (как в референсе), без framed 3:4 */}
                <div className="absolute inset-0 z-[2]">
                  <Image
                    src={currentPhoto}
                    alt={title}
                    fill
                    sizes="100vw"
                    quality={CARD_IMAGE_NEXT_QUALITY}
                    className="object-cover object-center"
                    priority
                    fetchPriority="high"
                    decoding="async"
                    onLoadingComplete={onHeroFrameLoad}
                  />
                </div>

                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[70%] bg-gradient-to-t from-black/78 via-black/38 to-transparent"
                  aria-hidden
                />

                {/* Тап по краям */}
                {photos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={prevPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-[calc(env(safe-area-inset-bottom)+5.875rem)] left-0 top-[calc(env(safe-area-inset-top)+6rem)] z-[58] w-[34%] touch-manipulation`}
                      aria-label="Предыдущее фото"
                    />
                    <button
                      type="button"
                      onClick={nextPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-[calc(env(safe-area-inset-bottom)+5.875rem)] right-0 top-[calc(env(safe-area-inset-top)+6rem)] z-[58] w-[34%] touch-manipulation`}
                      aria-label="Следующее фото"
                    />
                  </>
                ) : null}

                {beforePhotoUrl ? (
                  <div className="pointer-events-auto absolute left-4 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[61] w-[26%] min-w-[52px] max-w-[92px]">
                    <div className="relative aspect-square overflow-hidden rounded-br-xl bg-zinc-800 shadow-md ring-1 ring-black/35">
                      <Image
                        src={beforePhotoUrl}
                        alt="before"
                        fill
                        className="object-cover"
                        sizes={SIZES_CARD_GRID}
                        quality={CARD_IMAGE_NEXT_QUALITY}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent py-px text-center text-[6px] font-bold uppercase tracking-wide text-white">
                        БЫЛО
                      </div>
                    </div>
                  </div>
                ) : null}

                <header className="pointer-events-none relative z-[60] shrink-0 px-4 pt-[max(12px,env(safe-area-inset-top))]">
                  {photos.length > 1 ? (
                    <div className="pointer-events-none flex gap-1 px-1 pb-2 pt-0" aria-hidden>
                      {photos.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1 min-h-1 min-w-[12px] flex-1 rounded-full ${idx === photoIndex ? "bg-white shadow-[0_0_12px_rgb(255_255_255/0.55)]" : "bg-white/32"}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="pointer-events-auto grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 pb-2">
                    <div className="h-11 w-11 shrink-0 justify-self-start" aria-hidden />
                    <div className="flex min-h-[2.75rem] shrink-0 items-center justify-center px-1">
                      <div
                        className={`inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${MOBILE_FS_CHIP}`}
                        aria-label={`Просмотров: ${formatCompactCount(viewCount)}`}
                      >
                        <EyeIcon size={16} className="shrink-0 text-white/85" aria-hidden />
                        <span className={`tabular-nums font-semibold tracking-tight ${viewCount > 0 ? "text-white/95" : "text-white/55"}`}>
                          {formatCompactCount(viewCount)}
                        </span>
                        <span className="truncate font-normal text-white/75">просмотров</span>
                      </div>
                    </div>
                    <div className="flex h-11 items-center justify-end justify-self-end">
                      <button
                        type="button"
                        aria-label="Закрыть"
                        onClick={handleCloseMobileViewer}
                        className={`${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 items-center justify-center rounded-full bg-black/15 p-2 text-white/90 backdrop-blur-md shadow-none transition-colors hover:bg-black/25 active:scale-[0.97]`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </header>

                {groupCards.length > 1 ? (
                  <aside className="pointer-events-none absolute left-3 top-1/2 z-[73] flex max-h-[min(76dvh,100dvh-8rem)] -translate-y-1/2 flex-col items-start justify-center">
                    <nav
                      className="pointer-events-auto scrollbar-none flex flex-col gap-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] py-px"
                      aria-label="Варианты подборки"
                    >
                      {groupCards.map((card) => {
                        const isActive = card.id === data.id;
                        return (
                          <Link
                            key={card.id}
                            href={`/p/${card.slug}`}
                            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors touch-manipulation ${
                              isActive
                                ? "bg-white/30 ring-1 ring-white/45 text-white"
                                : `${MOBILE_FS_CHIP_MUTED} ring-1 ring-transparent`
                            }`}
                          >
                            {card.mainPhotoUrl ? (
                              <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-white/25">
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
                            ) : null}
                            <span className="tabular-nums font-semibold">{card.card_split_index + 1}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </aside>
                ) : null}

                <aside className="pointer-events-none absolute right-3 top-1/2 z-[73] flex max-h-[min(76dvh,100dvh-8rem)] -translate-y-1/2 flex-col items-end justify-center gap-2">
                  <div className="pointer-events-auto flex flex-col items-center gap-2">
                    <ReactionButtons
                      cardId={data.id}
                      likesCount={data.likesCount}
                      dislikesCount={data.dislikesCount}
                      userReaction={userReaction}
                      onToggle={toggleReaction}
                      variant="overlay"
                      stacked
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
                      <ShareIcon className="block shrink-0" size={16} />
                    </button>
                  </div>
                </aside>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[80] flex max-h-[min(56dvh,calc(100dvh-env(safe-area-inset-bottom)-env(safe-area-inset-top)-6rem)] flex-col justify-end gap-3 overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+6.125rem)] pt-28">
                  <div className="pointer-events-auto min-h-0 w-full flex-1 space-y-3 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                    {hasPrompts ? (
                      <section aria-labelledby="mobile-prompt-cta-label">
                        <h2 id="mobile-prompt-cta-label" className="sr-only">
                          Промпт
                        </h2>
                        <div className="flex w-full flex-wrap justify-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMobilePromptOverlay(true)}
                            className={`${OVERLAY_BUTTON_UA_RESET} touch-manipulation rounded-full px-2.5 py-1 text-[11px] font-medium text-white/90 ${MOBILE_FS_CHIP}`}
                          >
                            Посмотреть промпт
                          </button>
                        </div>
                      </section>
                    ) : null}
                    {tagEntries.length > 0 ? (
                      <section className="" aria-label="Теги">
                        <h2 className="sr-only">Теги</h2>
                        <div className="flex flex-wrap gap-1.5">
                          {tagEntries.map(({ slug, label, href }) =>
                            href ? (
                              <Link
                                key={slug}
                                href={href}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium text-white/90 ${MOBILE_FS_CHIP}`}
                              >
                                {label}
                              </Link>
                            ) : (
                              <span
                                key={slug}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${MOBILE_FS_CHIP_MUTED}`}
                              >
                                {label}
                              </span>
                            )
                          )}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>

                {/* Низ: только лента / Lexy / копировать — без общей подложки, поверх фото */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[99] pb-[max(14px,env(safe-area-inset-bottom))] pt-6 md:hidden">
                  <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2 px-3">

                    {!hasPrompts && listingNavInStickyBar ? (
                      <div className="grid grid-cols-2 gap-2">
                        <StickyListingNavButton
                          slug={listingPrev}
                          direction="prev"
                          onGo={goListingNeighbor}
                          floatingGlass
                        />
                        <StickyListingNavButton
                          slug={listingNext}
                          direction="next"
                          onGo={goListingNeighbor}
                          floatingGlass
                        />
                      </div>
                    ) : null}

                    {hasPrompts && listingNavInStickyBar ? (
                      <div className="grid grid-cols-[minmax(0,2.75rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.75rem)] items-stretch gap-2 shadow-none">
                        <StickyListingNavButton
                          slug={listingPrev}
                          direction="prev"
                          onGo={goListingNeighbor}
                          floatingGlass
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleCopy();
                          }}
                          className={`${OVERLAY_BUTTON_UA_RESET} shadow-none flex min-h-11 flex-1 items-center justify-center gap-1 px-2 py-2 text-[11px] text-white ${MOBILE_FS_ACTION}`}
                        >
                          {stickyCopy === "ok" ? (
                            <>
                              <CheckIcon size={18} />
                              <span className="sr-only sm:not-sr-only">Готово</span>
                            </>
                          ) : stickyCopy === "fail" ? (
                            <>
                              <span className="text-amber-200" aria-hidden>
                                !
                              </span>
                              <span className="truncate">Не удалось</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon size={18} />
                              <span className="max-sm:sr-only">
                                {data.promptTexts.length > 1 ? "Все промпты" : "Копировать"}
                              </span>
                            </>
                          )}
                        </button>
                        <LexyGptGenerateButton
                          promptText={data.promptTexts.join("\n\n")}
                          variant="sticky"
                          className="h-full min-h-11 min-w-0 !flex-initial px-2 text-[11px] shadow-none ring-2 ring-black/35 w-full"
                        />
                        <StickyListingNavButton
                          slug={listingNext}
                          direction="next"
                          onGo={goListingNeighbor}
                          floatingGlass
                        />
                      </div>
                    ) : null}

                    {hasPrompts && !listingNavInStickyBar ? (
                      <div className="flex flex-col gap-2 shadow-none">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleCopy();
                          }}
                          className={`${OVERLAY_BUTTON_UA_RESET} shadow-none flex min-h-11 flex-1 items-center justify-center gap-2 px-4 py-3 text-[11px] text-white ${MOBILE_FS_ACTION}`}
                        >
                          {stickyCopy === "ok" ? (
                            <>
                              <CheckIcon size={18} />
                              <span className="max-sm:hidden">Скопировано!</span>
                              <span className="sm:hidden">Готово</span>
                            </>
                          ) : stickyCopy === "fail" ? (
                            <>
                              <span className="text-amber-200" aria-hidden>
                                !
                              </span>
                              Не удалось скопировать
                            </>
                          ) : (
                            <>
                              <CopyIcon size={18} />
                              {data.promptTexts.length > 1 ? "Скопировать все промпты" : "Скопировать промпт"}
                            </>
                          )}
                        </button>
                        <LexyGptGenerateButton
                          promptText={data.promptTexts.join("\n\n")}
                          variant="sticky"
                          className="min-h-11 text-[11px] shadow-none ring-2 ring-black/35"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                {hasPrompts && mobilePromptOverlay ? (
                  <>
                    <button
                      type="button"
                      aria-label="Закрыть полный промт"
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 z-[104] bg-black/48 backdrop-blur-[2px]`}
                      onClick={() => setMobilePromptOverlay(false)}
                    />
                    <div
                      className={`absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[106] max-h-[min(68dvh,calc(100dvh-env(safe-area-inset-top)-8rem-env(safe-area-inset-bottom)))] overflow-hidden shadow-none ${MOBILE_FS_EXPAND}`}
                    >
                      <div className="scrollbar-none max-h-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/92">{data.promptTexts.join("\n\n")}</p>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-zinc-500">Нет фото</div>
            )}
          </div>
        </>
      )}

      {/* ── Title: на мобиле без фото в герое — один видимый h1; если герой full-bleed, заголовок sr-only до md (SEO сохранён) ── */}
      <h1
        className={
          hasPhotos
            ? "mb-2 text-center text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl max-md:sr-only"
            : "mb-2 text-center text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl"
        }
      >
        {title}
      </h1>

      {data.authorUserId && (
        <div
          className={`mb-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center ${hasPhotos ? "max-md:hidden" : ""}`}
        >
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

      <p
        className={`mb-6 flex items-center justify-center gap-2 text-sm text-zinc-500 ${hasPhotos ? "max-md:hidden" : ""}`}
      >
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
        <div
          id="card-prompt-full"
          className={`mb-4 space-y-3 scroll-mt-36 ${hasPhotos ? "hidden md:block" : ""}`}
        >
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleCopySingle(text, i);
                }}
                className="absolute top-3 right-3 z-[2] rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 opacity-100 shadow-sm transition-all md:opacity-0 md:group-hover/prompt:opacity-100 md:group-focus-within/prompt:opacity-100 hover:text-zinc-700 hover:border-zinc-300"
                title="Скопировать"
                aria-label={`Скопировать промпт ${i + 1}`}
              >
                {copiedIdx === i ? (
                  <CheckIcon size={14} />
                ) : copyErrIdx === i ? (
                  <span className="block min-w-[14px] text-center text-xs font-bold text-red-500" aria-hidden>
                    !
                  </span>
                ) : (
                  <CopyIcon size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Subtitle ── */}
      {hasPrompts && (
        <p className="mx-auto mb-6 hidden max-w-md text-center text-sm text-zinc-500 sm:block">
          Готовый промт для генерации фото с помощью ИИ. Скопируй и используй в нейросети.
        </p>
      )}

      {/* ── Sticky CTA — floating ── */}
      {hasPrompts && (
        <div className="fixed inset-x-0 bottom-0 z-[240] safe-area-pb pointer-events-none lg:left-60">
          <div className="mx-auto max-w-2xl px-4 py-4 pointer-events-auto">
            {listingNavInStickyBar ? (
              <div className="grid grid-cols-[minmax(0,3rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3rem)] items-stretch gap-2">
                <StickyListingNavButton slug={listingPrev} direction="prev" onGo={goListingNeighbor} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleCopy();
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.98] sm:text-sm sm:px-4"
                >
                  {stickyCopy === "ok" ? (
                    <>
                      <CheckIcon size={16} />
                      <span className="max-sm:hidden">Скопировано!</span>
                      <span className="sm:hidden">Готово</span>
                    </>
                  ) : stickyCopy === "fail" ? (
                    <>
                      <span className="text-amber-300" aria-hidden>
                        !
                      </span>
                      Не удалось
                    </>
                  ) : (
                    <>
                      <CopyIcon size={16} />
                      <span className="max-sm:sr-only">
                        {data.promptTexts.length > 1 ? "Все промпты" : "Копировать"}
                      </span>
                    </>
                  )}
                </button>
                <LexyGptGenerateButton
                  promptText={data.promptTexts.join("\n\n")}
                  variant="sticky"
                  className="h-full min-w-0 !flex-initial px-2.5 w-full sm:px-3"
                />
                <StickyListingNavButton slug={listingNext} direction="next" onGo={goListingNeighbor} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleCopy();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.98]"
                >
                  {stickyCopy === "ok" ? (
                    <>
                      <CheckIcon size={16} />
                      <span className="max-sm:hidden">Скопировано!</span>
                      <span className="sm:hidden">Готово</span>
                    </>
                  ) : stickyCopy === "fail" ? (
                    <>
                      <span className="text-amber-300" aria-hidden>
                        !
                      </span>
                      Не удалось скопировать
                    </>
                  ) : (
                    <>
                      <CopyIcon size={16} />
                      {data.promptTexts.length > 1 ? "Скопировать все промпты" : "Копировать промпт"}
                    </>
                  )}
                </button>
                <LexyGptGenerateButton
                  promptText={data.promptTexts.join("\n\n")}
                  variant="sticky"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Предыдущая / следующая карточка листинга (localStorage контекст) — в нижнем sticky-баре. */
function StickyListingNavButton({
  slug,
  direction,
  onGo,
  floatingGlass = false,
}: {
  slug: string | null;
  direction: "prev" | "next";
  onGo: (slug: string) => void;
  /** Мобила fullscreen над фото: круг-пилюля без «полосы-дока» (как тег‑glass). */
  floatingGlass?: boolean;
}) {
  const enabled = slug != null;
  const bar = `${OVERLAY_BUTTON_UA_RESET} flex h-auto min-h-12 w-full items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg transition-colors motion-reduce:transition-none`;
  const chip = `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/15 text-white/88 backdrop-blur-md shadow-none transition-colors motion-reduce:transition-none`;
  const base = floatingGlass ? chip : bar;
  const accent = floatingGlass ? "hover:bg-black/26 active:scale-[0.97]" : "hover:bg-zinc-700 active:scale-[0.97]";
  return (
    <button
      type="button"
      disabled={!enabled}
      className={`${base} ${enabled ? accent : "opacity-35"}`}
      aria-label={
        direction === "prev"
          ? "Предыдущая карточка из листинга"
          : "Следующая карточка из листинга"
      }
      title={direction === "prev" ? "Предыдущая в ленте" : "Следующая в ленте"}
      onClick={() => slug && onGo(slug)}
    >
      {direction === "prev" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-95"
          aria-hidden
        >
          <path d="M14 18L8 12l6-6" />
          <path d="M20 12H8.5" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-95"
          aria-hidden
        >
          <path d="M10 18l6-6-6-6" />
          <path d="M4 12h11.5" />
        </svg>
      )}
    </button>
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
