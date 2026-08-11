"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCardViewBeacon } from "@/hooks/useCardViewBeacon";
import Image from "next/image";
import Link from "next/link";
import type { CardPageData } from "@/lib/supabase";
import { CardInteractionsProvider, useCardInteractions } from "@/context/CardInteractionsContext";
import { ReactionButtons } from "./ReactionButtons";
import { FavoriteButton } from "./FavoriteButton";
import { LexyGptGenerateButton } from "./LexyGptGenerateButton";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { isDebugToolsSessionEnabled, dispatchDebugCardDeleted } from "@/lib/debug-tools-session";
import { formatCompactCount } from "@/lib/format-view-count";
import {
  CARD_OVERLAY_ACTION_PILL,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import { CARD_OVERLAY_PHOTO_COUNTER_CLASS } from "@/lib/card-overlay-photo-counter";
import {
  CARD_IMAGE_NEXT_QUALITY,
  SIZES_CARD_GRID,
  SIZES_CARD_HERO,
} from "@/lib/card-image-presets";
import { copyTextSyncFallback, copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { buildCardImageAlt, buildBeforeAlt } from "@/lib/image-alt";
import {
  requestListingNavigationLoadMore,
  resolveListingNavNeighbors,
  subscribeListingNavigationUpdates,
  type ListingCardNavNeighbors,
} from "@/lib/listing-card-navigation-context";
import {
  hasSeenCardSwipeOnboarding,
  markCardSwipeOnboardingSeen,
} from "@/lib/card-swipe-onboarding";
import { useMobileCardSnapFeed } from "@/hooks/useMobileCardSnapFeed";
import {
  getFirstTagFromSeoTags,
  getSeoSlugsWithTags,
} from "@/lib/tag-registry";
import { trackPromptCardOpen } from "@/lib/yandex-metrika";

/** Desktop editorial panel chips (tier A = 13px). */
const DESKTOP_PANEL_CHIP =
  "shrink-0 text-[13px] font-medium rounded-full border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5 text-indigo-700 transition-colors hover:border-indigo-200 hover:bg-indigo-100/70";
const DESKTOP_PANEL_CHIP_MUTED =
  "shrink-0 text-[13px] font-medium rounded-full border border-zinc-200 bg-zinc-100/80 px-2.5 py-1.5 text-zinc-500";

/** Glass как у «тегов» на этом экране: chip-подложка без отдельной нижней панели (tier A = 13px для mobile SEO). */
const MOBILE_FS_CHIP =
  "text-[13px] font-medium bg-black/15 text-white/90 backdrop-blur-md shadow-none transition-colors hover:bg-black/25";
/** То же — приглушённый текст для нессылочных чипов */
const MOBILE_FS_CHIP_MUTED =
  "text-[13px] font-medium bg-black/15 text-white/80 backdrop-blur-md shadow-none transition-colors hover:bg-black/25";
/** Кнопки поверх фото (копировать) — без «полосы», тот же glass. */
const MOBILE_FS_ACTION = `${MOBILE_FS_CHIP} rounded-xl font-semibold`;
const MOBILE_FS_EXPAND = `${MOBILE_FS_CHIP} rounded-2xl px-4 py-3 leading-snug`;

/** Mobile has-photos bottom bar: copy + Lexy only (listing arrows live in the right stack). */
const MOBILE_PHOTO_ACTIONS_GRID =
  "grid w-full grid-cols-2 items-stretch gap-2";

/** No-photos sticky bar still uses listing prev/next on the sides. */
const LISTING_STICKY_ACTIONS_GRID =
  "grid w-full grid-cols-[minmax(0,2.75rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.75rem)] items-stretch gap-2";

type TagEntry = { slug: string; label: string; href: string | null };
type BreadcrumbTag = { labelRu: string; urlPath: string } | null;

type Props = {
  data: CardPageData;
  tagEntries: TagEntry[];
  breadcrumbTag: BreadcrumbTag;
  isModal?: boolean;
  /** When provided (client-side modal), neighbor navigation stays inside the same modal instance. */
  onListingNeighborGo?: (slug: string) => void;
  /** Optional explicit close handler for the client-side single-instance modal.
   * When present, the mobile photo header "Закрыть" button will use this instead of router.back().
   */
  onCloseModal?: () => void;
};

type InnerProps = Props & {
  onMobileNeighborCommit: (data: CardPageData) => void;
};

export function CardPageClient({ data, tagEntries, breadcrumbTag, isModal = false, onListingNeighborGo, onCloseModal }: Props) {
  const router = useRouter();
  const [activeData, setActiveData] = useState(data);

  useEffect(() => {
    setActiveData(data);
  }, [data]);

  const activePresentation = useMemo(() => {
    if (activeData.id === data.id) {
      return { tagEntries, breadcrumbTag };
    }
    const activeTagEntries = getSeoSlugsWithTags(activeData.seo_tags);
    const firstTag = getFirstTagFromSeoTags(activeData.seo_tags);
    return {
      tagEntries: activeTagEntries,
      breadcrumbTag: firstTag
        ? { labelRu: firstTag.labelRu, urlPath: firstTag.urlPath }
        : null,
    };
  }, [activeData, breadcrumbTag, data.id, tagEntries]);

  const handleMobileNeighborCommit = useCallback(
    (nextData: CardPageData) => {
      setActiveData(nextData);
      if (onListingNeighborGo) {
        onListingNeighborGo(nextData.slug);
      } else {
        router.push(`/p/${encodeURIComponent(nextData.slug)}`);
      }
    },
    [onListingNeighborGo, router]
  );

  const cardIds = useMemo(() => [activeData.id], [activeData.id]);
  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <CardPageClientInner
        data={activeData}
        tagEntries={activePresentation.tagEntries}
        breadcrumbTag={activePresentation.breadcrumbTag}
        isModal={isModal}
        onListingNeighborGo={onListingNeighborGo}
        onCloseModal={onCloseModal}
        onMobileNeighborCommit={handleMobileNeighborCommit}
      />
    </CardInteractionsProvider>
  );
}

function CardPageClientInner({ data, tagEntries, breadcrumbTag, isModal, onListingNeighborGo, onCloseModal, onMobileNeighborCommit }: InnerProps) {
  const router = useRouter();
  const { promptCardGenerationEnabled } = useFeatureAccess();
  const { seedFromCard } = useGenerateDock();
  const { close: closeCardModal } = usePromptCardModal();
  const canInlineGenerate = promptCardGenerationEnabled;
  const title = data.title_ru || data.title_en || "Без названия";
  const [publishedLocal, setPublishedLocal] = useState(data.isPublished);
  const [pubSaving, setPubSaving] = useState(false);
  const [pubStatus, setPubStatus] = useState<string | null>(null);
  const { reactions, favorites, toggleReaction, toggleFavorite } = useCardInteractions();
  const userReaction = reactions.get(data.id) ?? null;
  const isFavorited = favorites.has(data.id);
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => {
    setDebugMode(isDebugToolsSessionEnabled());
  }, []);

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
  const [showSwipeOnboarding, setShowSwipeOnboarding] = useState(false);
  const openInlineGenerate = useCallback(() => {
    if (!canInlineGenerate) return;
    setMobilePromptOverlay(false);
    const promptText = data.promptTexts.join("\n\n");
    // Seed global listing dock, then close card so dock is visible on the listing.
    seedFromCard(
      { promptText, cardId: data.id },
      { entrySource: "card" }
    );
    if (isModal) {
      closeCardModal();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [
    canInlineGenerate,
    closeCardModal,
    data.id,
    data.promptTexts,
    isModal,
    router,
    seedFromCard,
  ]);

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
    const refreshNeighbors = () => {
      setListingNavNeighbors(resolveListingNavNeighbors(data.slug));
    };
    refreshNeighbors();
    return subscribeListingNavigationUpdates(refreshNeighbors);
  }, [data.slug]);

  useEffect(() => {
    // Don't scroll to top in modal view — modal handles its own positioning
    if (!isModal) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [data.slug, isModal]);

  useEffect(() => {
    if (isModal) return;
    trackPromptCardOpen(data.slug, { entry: "page" });
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

  const handleCloseMobileViewer = useCallback(() => {
    if (onCloseModal) {
      onCloseModal();
      return;
    }

    const fallbackHref = breadcrumbTag?.urlPath ?? "/";

    // Intercepting @modal route: pop soft-nav stack (listing → card).
    if (isModal) {
      router.back();
      return;
    }

    // Full-page /p/[slug]: back when user arrived from same site; else category or home.
    if (typeof window !== "undefined") {
      let sameOriginReferrer = false;
      try {
        sameOriginReferrer = Boolean(
          document.referrer &&
            new URL(document.referrer).origin === window.location.origin
        );
      } catch {
        sameOriginReferrer = false;
      }
      if (sameOriginReferrer && window.history.length > 1) {
        router.back();
        return;
      }
    }

    router.replace(fallbackHref);
  }, [router, onCloseModal, isModal, breadcrumbTag]);



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

  /**
   * Mobile immersive chrome gate: hide all glass UI until the hero photo is fully decoded,
   * then reveal with a single smooth fade. Mirrors the listing grid's imageReady pattern
   * (PromptCard.tsx) to eliminate the "black buttons → transparent glass" flash.
   */
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

  /** In client modal, group variant links must not use Next `<Link>` — it mounts `@modal` on top of `ClientCardModal`. */
  function handleGroupVariantNav(
    e: React.MouseEvent,
    slug: string,
    isActive: boolean
  ) {
    if (isActive) {
      e.preventDefault();
      return;
    }
    if (onListingNeighborGo) {
      e.preventDefault();
      e.stopPropagation();
      onListingNeighborGo(slug);
    }
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
      if (isDebugToolsSessionEnabled()) {
        dispatchDebugCardDeleted({ cardId: data.id, slug: data.slug });
        onCloseModal?.();
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
  const authorLabel = data.authorDisplayName || "Promptshot";
  const hasListingNeighbors = Boolean(listingPrev || listingNext);

  useEffect(() => {
    if (
      hasPhotos &&
      listingNavNeighbors !== null &&
      listingNavNeighbors.nextSlug === null
    ) {
      requestListingNavigationLoadMore();
    }
  }, [data.slug, hasPhotos, listingNavNeighbors]);

  useEffect(() => {
    if (!hasPhotos || !hasListingNeighbors) {
      setShowSwipeOnboarding(false);
      return;
    }
    // Mobile-only hint; desktop already has ↑↓ on the photo.
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) {
      setShowSwipeOnboarding(false);
      return;
    }
    setShowSwipeOnboarding(!hasSeenCardSwipeOnboarding());
  }, [hasPhotos, hasListingNeighbors, data.slug]);

  const dismissSwipeOnboarding = useCallback(() => {
    markCardSwipeOnboardingSeen();
    setShowSwipeOnboarding(false);
  }, []);

  const swipeEnabled =
    hasPhotos && hasListingNeighbors && !mobilePromptOverlay;

  const snapFeed = useMobileCardSnapFeed({
    currentData: data,
    prevSlug: listingPrev,
    nextSlug: listingNext,
    enabled: swipeEnabled,
    onCommit: onMobileNeighborCommit,
  });
  const mobileChromeClass = snapFeed.isInteracting
    ? "pointer-events-none opacity-0 transition-none"
    : "opacity-100 transition-none";

  return (
    <div
      className={
        hasPhotos
          ? isModal
            ? "max-md:mx-auto max-md:max-w-2xl max-md:px-5 max-md:py-6 max-md:pb-6"
            : "mx-auto w-full max-w-7xl px-5 py-6 max-md:max-w-2xl max-md:pb-6 md:px-6 md:py-8 lg:py-10"
          : "mx-auto max-w-2xl px-5 py-6 pb-28 lg:py-10"
      }
    >
      {/* Breadcrumb — direct /p page only (not in modal); hidden on mobile */}
      {!isModal && (
        <nav
          className={`mb-6 hidden items-center gap-1.5 text-sm text-zinc-500 sm:flex ${
            hasPhotos ? "md:mb-4 md:text-zinc-400" : ""
          }`}
        >
          <Link
            href="/"
            className={`transition-colors ${hasPhotos ? "hover:text-zinc-600" : "hover:text-zinc-700"}`}
          >
            Главная
          </Link>
          <Chevron />
          {breadcrumbTag ? (
            <>
              <Link
                href={breadcrumbTag.urlPath}
                className={`transition-colors ${hasPhotos ? "hover:text-zinc-600" : "hover:text-zinc-700"}`}
              >
                {breadcrumbTag.labelRu}
              </Link>
              <Chevron />
              <span className="line-clamp-1 text-zinc-600">{title}</span>
            </>
          ) : (
            <span className="line-clamp-1 text-zinc-600">{title}</span>
          )}
        </nav>
      )}

      {/* Debug panel */}
      {debugMode && (
        <div
          data-card-modal-surface={isModal ? "" : undefined}
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

      {/* ── Hero (desktop split / mobile immersive) ── */}
      {hasPhotos && (
        <>
          {/* Desktop split: compact photo + editorial details panel — LCP for md+ */}
          <div className="relative mx-auto hidden w-fit max-w-full md:flex md:h-[clamp(30rem,min(85vh,calc(100vw-30rem)),57.5rem)] md:items-stretch md:gap-4 lg:gap-5">
            {/* Left: photo */}
            <div className="group relative flex h-full min-h-0 min-w-0 shrink items-start justify-center">
              {currentPhoto ? (
                <div
                  data-card-modal-surface={isModal ? "" : undefined}
                  className="relative mx-auto h-full aspect-[3/4] w-auto max-w-none overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10"
                >
                  <Image
                    key={`desktop-hero-blur-${currentPhoto}`}
                    src={currentPhoto}
                    alt=""
                    fill
                    sizes={SIZES_CARD_HERO}
                    quality={CARD_IMAGE_NEXT_QUALITY}
                    className="scale-110 object-cover opacity-60 blur-2xl"
                    aria-hidden
                  />
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" aria-hidden />
                  <Image
                    key={`desktop-hero-${currentPhoto}`}
                    src={currentPhoto}
                    alt={buildCardImageAlt(title, [], photoIndex)}
                    fill
                    sizes={SIZES_CARD_HERO}
                    quality={CARD_IMAGE_NEXT_QUALITY}
                    className="z-[2] animate-fade-in object-contain"
                    priority
                    fetchPriority="high"
                    decoding="async"
                  />

                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevPhoto}
                        className={`${OVERLAY_BUTTON_UA_RESET} absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 backdrop-blur-md transition-all hover:bg-black/55 active:scale-90 group-hover:opacity-100`}
                        aria-label="Предыдущее фото"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={nextPhoto}
                        className={`${OVERLAY_BUTTON_UA_RESET} absolute right-16 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 backdrop-blur-md transition-all hover:bg-black/55 active:scale-90 group-hover:opacity-100`}
                        aria-label="Следующее фото"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </>
                  )}

                  {beforePhotoUrl && (
                    <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[56px]">
                      <div className="relative aspect-square overflow-hidden rounded-br-xl bg-zinc-800 shadow-lg ring-1 ring-black/10">
                        <Image
                          src={beforePhotoUrl}
                          alt={buildBeforeAlt(title)}
                          fill
                          className="object-cover"
                          sizes={SIZES_CARD_GRID}
                          quality={CARD_IMAGE_NEXT_QUALITY}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent py-0.5 text-center text-[10px] font-bold tracking-wider text-white">
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
                              onClick={(e) => handleGroupVariantNav(e, card.slug, isActive)}
                              className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold transition-colors ${
                                isActive
                                  ? "bg-white/30 text-white ring-1 ring-white/40"
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
                  <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
                    <StickyListingNavButton
                      slug={listingPrev}
                      direction="prev"
                      onGo={goListingNeighbor}
                      orientation="vertical"
                    />
                    <StickyListingNavButton
                      slug={listingNext}
                      direction="next"
                      onGo={goListingNeighbor}
                      orientation="vertical"
                    />
                  </div>
                </div>
              ) : (
                <div
                  data-card-modal-surface={isModal ? "" : undefined}
                  className="flex h-64 w-full max-w-sm items-center justify-center rounded-2xl bg-zinc-900 text-sm text-zinc-500"
                >
                  Нет фото
                </div>
              )}
            </div>

            {/* Right: light editorial details panel */}
            <aside
              data-card-modal-surface={isModal ? "" : undefined}
              className="flex h-full min-h-0 w-[min(100%,510px)] shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-[0_18px_55px_-28px_rgba(24,24,27,0.32)] lg:w-[540px]"
            >
              <div className="flex items-start gap-3 border-b border-zinc-100 px-4 pb-4 pt-4">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-indigo-50 ring-1 ring-indigo-100">
                  {data.authorAvatarUrl ? (
                    <Image
                      src={data.authorAvatarUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                      quality={60}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-indigo-600">
                      {authorLabel.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-zinc-900">
                    {authorLabel}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-500">
                    {title}
                  </div>
                  {!publishedLocal && data.viewerIsOwner && (
                    <div className="mt-1 text-[13px] text-amber-700">
                      Черновик — виден только вам
                    </div>
                  )}
                </div>
                {data.viewerIsOwner && (
                  <button
                    type="button"
                    disabled={pubSaving}
                    onClick={() => handleVisibilityChange(!publishedLocal)}
                    className={`${OVERLAY_BUTTON_UA_RESET} shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50`}
                  >
                    {pubSaving ? "…" : publishedLocal ? "Скрыть" : "Опубл."}
                  </button>
                )}
              </div>
              {pubStatus && (
                <p className="px-4 pb-2 pt-2 text-[13px] text-red-600">{pubStatus}</p>
              )}

              {hasPrompts && (
                <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-zinc-700">Промпт</span>
                    <span className="text-[13px] text-zinc-400">готов к использованию</span>
                  </div>
                  <div
                    id="card-prompt-full"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 shadow-inner shadow-zinc-950/[0.02] [-webkit-overflow-scrolling:touch]"
                  >
                    {data.promptTexts.map((text, i) => (
                      <div key={i} className={i > 0 ? "mt-4 border-t border-zinc-200 pt-4" : ""}>
                        {data.promptTexts.length > 1 && (
                          <div className="mb-2 text-[13px] font-medium text-zinc-500">
                            Промпт {i + 1}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleCopy();
                    }}
                    className={`${OVERLAY_BUTTON_UA_RESET} mt-2.5 flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-4 py-2.5 text-[13px] font-semibold text-indigo-700 shadow-sm shadow-indigo-500/[0.08] transition-[background,border-color,box-shadow,transform] hover:border-indigo-300 hover:bg-indigo-100/80 hover:shadow-md hover:shadow-indigo-500/[0.12] active:scale-[0.98]`}
                  >
                    {stickyCopy === "ok" ? (
                      <>
                        <CheckIcon size={16} />
                        Скопировано
                      </>
                    ) : stickyCopy === "fail" ? (
                      <>
                        <span className="text-amber-600" aria-hidden>!</span>
                        Не удалось
                      </>
                    ) : (
                      <>
                        <CopyIcon size={16} />
                        Скопировать промпт
                      </>
                    )}
                  </button>
                </div>
              )}

              {tagEntries.length > 0 && (
                <DesktopPanelTags
                  tags={tagEntries}
                  resetKey={data.id}
                  openInNewTab={isModal}
                />
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">
                <h2 className="sr-only">Отклики и шаринг</h2>
                <ReactionButtons
                  cardId={data.id}
                  likesCount={data.likesCount}
                  dislikesCount={data.dislikesCount}
                  userReaction={userReaction}
                  onToggle={toggleReaction}
                  variant="surface"
                />
                <FavoriteButton
                  cardId={data.id}
                  isFavorited={isFavorited}
                  onToggle={toggleFavorite}
                  variant="surface"
                />
                <button
                  type="button"
                  onClick={handleShare}
                  className={`${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:scale-95`}
                  title="Поделиться"
                  aria-label="Поделиться ссылкой на карточку"
                >
                  <ShareIcon className="block shrink-0" size={16} />
                </button>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-zinc-500">
                  <EyeIcon
                    className={`shrink-0 ${viewCount > 0 ? "text-zinc-500" : "text-zinc-300"}`}
                    size={16}
                    aria-hidden
                  />
                  <span className={`tabular-nums ${viewCount > 0 ? "text-zinc-600" : "text-zinc-400"}`}>
                    {formatCompactCount(viewCount)}
                  </span>
                </span>
              </div>

              <div className="mt-auto flex flex-col gap-2 border-t border-zinc-100 px-4 pb-4 pt-3">
                {hasPrompts && (
                  <LexyGptGenerateButton
                    promptText={data.promptTexts.join("\n\n")}
                    cardId={data.id}
                    sourceImageUrl={currentPhoto ?? undefined}
                    variant="desktop-panel"
                    onInternalGenerate={canInlineGenerate ? openInlineGenerate : undefined}
                  />
                )}
              </div>
            </aside>
          </div>

          {/* Mobile: fullscreen-карточка (Chrome скрыт через CardPageLayout при наличии фото).
              This block is rendered both for direct /p/[slug] pages and for the client-side single-instance
              modal (when opened from a listing or search). The close button inside the photo header
              respects onCloseModal (client modal), router.back() (soft modal), or category/home fallback (direct entry). */}
          {hasPhotos && (
          <div
            data-card-modal-surface={isModal ? "" : undefined}
            className="fixed inset-0 z-[245] min-h-[100dvh] select-none overflow-hidden overscroll-none bg-zinc-950 [-webkit-touch-callout:none] [-webkit-user-drag:none] md:hidden"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <div
              ref={snapFeed.viewportRef}
              data-card-snap-viewport
              className={`scrollbar-none h-[100dvh] w-full overscroll-contain ${
                swipeEnabled
                  ? "snap-y snap-mandatory overflow-y-auto"
                  : "overflow-hidden"
              }`}
              style={{ touchAction: swipeEnabled ? "pan-y" : "auto" }}
              onScroll={snapFeed.onScroll}
              onPointerDown={snapFeed.onPointerDown}
              onPointerUp={snapFeed.onPointerUp}
              onPointerCancel={snapFeed.onPointerCancel}
              onClickCapture={snapFeed.onClickCapture}
            >
            {listingPrev ? (
              <MobileSnapNeighborSlide
                data={snapFeed.prevCard}
                direction="prev"
                fallbackPhotoUrl={currentPhoto}
              />
            ) : null}
            <div
              data-card-snap-slide="current"
              className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-zinc-950"
            >
              {currentPhoto ? (
              <>
                <div className="pointer-events-none absolute inset-0 z-[1] bg-zinc-950" aria-hidden />

                {/* Полноэкранное фото (как в референсе), без framed 3:4 */}
                <div className="absolute inset-0 z-[2]">
                  <Image
                    src={currentPhoto}
                    alt={buildCardImageAlt(title, [], photoIndex)}
                    fill
                    sizes="100vw"
                    quality={CARD_IMAGE_NEXT_QUALITY}
                    className="object-cover object-center"
                    priority
                    fetchPriority="high"
                    decoding="async"
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
                      data-swipe-ok
                      onClick={prevPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-[calc(env(safe-area-inset-bottom)+5.875rem)] left-0 top-[calc(env(safe-area-inset-top)+9rem)] z-[58] w-[34%] touch-manipulation ${mobileChromeClass}`}
                      aria-label="Предыдущее фото"
                    />
                    <button
                      type="button"
                      data-swipe-ok
                      onClick={nextPhoto}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-[calc(env(safe-area-inset-bottom)+5.875rem)] right-0 top-[calc(env(safe-area-inset-top)+9rem)] z-[58] w-[34%] touch-manipulation ${mobileChromeClass}`}
                      aria-label="Следующее фото"
                    />
                  </>
                ) : null}

                {beforePhotoUrl ? (
                  <div className={`pointer-events-auto absolute left-4 top-[calc(env(safe-area-inset-top)+8.25rem)] z-[61] w-[26%] min-w-[52px] max-w-[92px] ${mobileChromeClass}`}>
                    <div
                      className="relative aspect-square overflow-hidden rounded-br-xl bg-zinc-800 shadow-md ring-1 ring-black/35"
                      aria-label="Фото «было»"
                    >
                      <Image
                        src={beforePhotoUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes={SIZES_CARD_GRID}
                        quality={CARD_IMAGE_NEXT_QUALITY}
                      />
                      <div
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-white"
                        aria-hidden
                      >
                        БЫЛО
                      </div>
                    </div>
                  </div>
                ) : null}

                <header className={`pointer-events-none relative z-[60] shrink-0 px-4 pt-[max(12px,env(safe-area-inset-top))] ${mobileChromeClass}`}>
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
                        className={`inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full px-3 py-2 ${MOBILE_FS_CHIP}`}
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
                        className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-black/15 p-2 text-white/90 backdrop-blur-md shadow-none transition-colors hover:bg-black/25 active:scale-[0.97]`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </header>

                {groupCards.length > 1 ? (
                  <aside className={`pointer-events-none absolute left-3 top-1/2 z-[73] flex max-h-[min(76dvh,100dvh-8rem)] -translate-y-1/2 flex-col items-start justify-center ${mobileChromeClass}`}>
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
                            onClick={(e) => handleGroupVariantNav(e, card.slug, isActive)}
                            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-2 text-[13px] font-semibold transition-colors touch-manipulation ${
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

                <aside className={`pointer-events-none absolute right-3 top-1/2 z-[73] flex max-h-[min(76dvh,100dvh-8rem)] -translate-y-1/2 flex-col items-end justify-center gap-2 ${mobileChromeClass}`}>
                  <div className="pointer-events-auto relative flex flex-col items-center gap-2">
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
                    {hasListingNeighbors ? (
                      <>
                        <div
                          className="my-0.5 h-px w-6 bg-white/25"
                          aria-hidden
                        />
                        <div className="relative flex flex-col items-center gap-2">
                          <StickyListingNavButton
                            slug={listingPrev}
                            direction="prev"
                            onGo={() => {
                              dismissSwipeOnboarding();
                              snapFeed.scrollToPrev();
                            }}
                            orientation="vertical"
                          />
                          <StickyListingNavButton
                            slug={listingNext}
                            direction="next"
                            onGo={() => {
                              dismissSwipeOnboarding();
                              snapFeed.scrollToNext();
                            }}
                            orientation="vertical"
                          />
                          {showSwipeOnboarding ? (
                            <CardSwipeOnboarding
                              onDismiss={dismissSwipeOnboarding}
                            />
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                </aside>
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[80] flex max-h-[min(56dvh,calc(100dvh-env(safe-area-inset-bottom)-env(safe-area-inset-top)-6rem)] flex-col justify-end gap-3 overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+6.125rem)] pt-28 ${mobileChromeClass}`}>
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
                            className={`${OVERLAY_BUTTON_UA_RESET} touch-manipulation rounded-full px-2.5 py-2 ${MOBILE_FS_CHIP}`}
                          >
                            Посмотреть промт
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>

                {/* Низ: копировать + Lexy — стрелки листинга в правом стеке */}
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[99] pb-[max(14px,env(safe-area-inset-bottom))] pt-6 md:hidden ${mobileChromeClass}`}>
                  <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2 px-3">
                    {hasPrompts ? (
                      <div className={`${MOBILE_PHOTO_ACTIONS_GRID} shadow-none`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleCopy();
                          }}
                          className={`${OVERLAY_BUTTON_UA_RESET} shadow-none flex min-h-11 flex-1 items-center justify-center gap-1 px-2 py-2 text-white ${MOBILE_FS_ACTION}`}
                        >
                          {stickyCopy === "ok" ? (
                            <>
                              <CheckIcon size={18} />
                              <span className="truncate">Готово</span>
                            </>
                          ) : stickyCopy === "fail" ? (
                            <>
                              <span className="text-amber-200" aria-hidden>
                                !
                              </span>
                              <span className="truncate">Не удалось</span>
                            </>
                          ) : (
                            <span className="truncate">
                              {data.promptTexts.length > 1 ? "Все промпты" : "Скопировать"}
                            </span>
                          )}
                        </button>
                        <LexyGptGenerateButton
                          promptText={data.promptTexts.join("\n\n")}
                          cardId={data.id}
                          sourceImageUrl={currentPhoto ?? undefined}
                          variant="sticky"
                          className="h-full min-h-11 min-w-0 w-full truncate px-2 text-[13px] shadow-none ring-2 ring-black/35"
                          onInternalGenerate={canInlineGenerate ? openInlineGenerate : undefined}
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
                      className={`pointer-events-auto absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[106] flex max-h-[min(68dvh,calc(100dvh-env(safe-area-inset-top)-8rem-env(safe-area-inset-bottom)))] flex-col overflow-hidden shadow-none ${MOBILE_FS_EXPAND}`}
                    >
                      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/92">{data.promptTexts.join("\n\n")}</p>
                      </div>
                      <button
                        type="button"
                        aria-live="polite"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleCopy();
                        }}
                        className={`${OVERLAY_BUTTON_UA_RESET} shadow-none mt-3 flex min-h-11 w-full shrink-0 items-center justify-center gap-2 px-4 py-3 font-semibold text-white ${MOBILE_FS_ACTION}`}
                      >
                        {stickyCopy === "ok" ? (
                          <>
                            <CheckIcon size={18} />
                            <span>Готово</span>
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
                    </div>
                  </>
                ) : null}

              </>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-zinc-500">Нет фото</div>
              )}
            </div>
            {listingNext ? (
              <MobileSnapNeighborSlide
                data={snapFeed.nextCard}
                direction="next"
                fallbackPhotoUrl={currentPhoto}
              />
            ) : null}
            </div>
          </div>
          )}
        </>
      )}

      {/* SEO h1: visually in desktop panel / mobile overlay; keep in DOM for crawlers */}
      <h1 className={hasPhotos ? "sr-only" : "mb-2 text-center text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl"}>
        {title}
      </h1>

      {/* Light column layout — cards without photos (desktop + mobile) */}
      {!hasPhotos && (
        <>
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

          {hasPrompts && (
            <div id="card-prompt-full" className="mb-4 space-y-3 scroll-mt-36">
              {data.promptTexts.map((text, i) => (
                <div
                  key={i}
                  className="group/prompt relative rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5 sm:p-6"
                >
                  {data.promptTexts.length > 1 && (
                    <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Промпт {i + 1}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                    {text}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleCopySingle(text, i);
                    }}
                    className="absolute top-3 right-3 z-[2] rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 opacity-100 shadow-sm transition-all hover:border-zinc-300 hover:text-zinc-700 md:opacity-0 md:group-hover/prompt:opacity-100 md:group-focus-within/prompt:opacity-100"
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

          {hasPrompts && (
            <p className="mx-auto mb-6 hidden max-w-md text-center text-sm text-zinc-500 sm:block">
              Готовый промт для генерации фото с помощью ИИ. Скопируй и используй в нейросети.
            </p>
          )}

          {hasPrompts && (
            <div
              className={`pointer-events-none fixed inset-x-0 bottom-0 z-[240] safe-area-pb${isModal ? "" : " lg:left-60"}`}
            >
              <div className="pointer-events-auto mx-auto w-full max-w-2xl px-5 py-4">
                <div className={LISTING_STICKY_ACTIONS_GRID}>
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
                    className="flex min-h-12 min-w-0 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-2 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.98] sm:gap-2 sm:px-3 sm:text-sm"
                  >
                    {stickyCopy === "ok" ? (
                      <>
                        <CheckIcon size={16} className="shrink-0" />
                        <span className="truncate max-sm:hidden">Скопировано!</span>
                        <span className="truncate sm:hidden">Готово</span>
                      </>
                    ) : stickyCopy === "fail" ? (
                      <>
                        <span className="shrink-0 text-amber-300" aria-hidden>
                          !
                        </span>
                        <span className="truncate">Не удалось</span>
                      </>
                    ) : (
                      <span className="truncate">
                        {data.promptTexts.length > 1 ? "Все промпты" : "Скопировать"}
                      </span>
                    )}
                  </button>
                  <LexyGptGenerateButton
                    promptText={data.promptTexts.join("\n\n")}
                    cardId={data.id}
                    variant="sticky"
                    className="h-full min-h-12 min-w-0 w-full truncate px-2 sm:px-3"
                    onInternalGenerate={canInlineGenerate ? openInlineGenerate : undefined}
                  />
                  <StickyListingNavButton
                    slug={listingNext}
                    direction="next"
                    onGo={goListingNeighbor}
                    floatingGlass
                  />
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

/** Desktop dark panel: tags capped to 2 rows, rest behind «Ещё». */
function DesktopPanelTags({
  tags,
  resetKey,
  openInNewTab = false,
}: {
  tags: TagEntry[];
  resetKey: string;
  /** Modal over listing: open category pages in a new tab so the overlay stays put. */
  openInNewTab?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsMore, setNeedsMore] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gapPx = 6; // gap-1.5

  useLayoutEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const chip = el.querySelector<HTMLElement>("[data-tag-chip]");
      if (!chip) {
        setNeedsMore(false);
        el.style.maxHeight = "";
        return;
      }
      const maxH = chip.offsetHeight * 2 + gapPx;
      if (expanded) {
        el.style.maxHeight = "";
        setNeedsMore(el.scrollHeight > maxH + 1);
        return;
      }
      el.style.maxHeight = `${maxH}px`;
      setNeedsMore(el.scrollHeight > maxH + 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tags, expanded, gapPx]);

  return (
    <div className="mt-3 px-4">
      <h2 className="sr-only">Теги</h2>
      <div
        ref={wrapRef}
        className={`flex flex-wrap gap-1.5 max-lg:scrollbar-none max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:pb-1 ${
          expanded ? "" : "overflow-hidden"
        }`}
      >
        {tags.map(({ slug, label, href }) =>
          href ? (
            <Link
              key={slug}
              href={href}
              data-tag-chip
              className={DESKTOP_PANEL_CHIP}
              {...(openInNewTab
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {label}
            </Link>
          ) : (
            <span key={slug} data-tag-chip className={DESKTOP_PANEL_CHIP_MUTED}>
              {label}
            </span>
          )
        )}
      </div>
      {needsMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`${OVERLAY_BUTTON_UA_RESET} mt-1.5 ${DESKTOP_PANEL_CHIP}`}
          aria-expanded={expanded}
        >
          {expanded ? "Свернуть" : "Ещё"}
        </button>
      )}
    </div>
  );
}

function MobileSnapNeighborSlide({
  data,
  direction,
  fallbackPhotoUrl,
}: {
  data: CardPageData | null;
  direction: "prev" | "next";
  fallbackPhotoUrl: string | null;
}) {
  const photoUrl = data?.photoUrls?.[0] ?? null;
  return (
    <div
      data-card-snap-slide={direction}
      className="pointer-events-none relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-zinc-950"
      aria-hidden
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes="100vw"
          quality={CARD_IMAGE_NEXT_QUALITY}
          className="object-cover object-center"
        />
      ) : fallbackPhotoUrl ? (
        <Image
          src={fallbackPhotoUrl}
          alt=""
          fill
          sizes="100vw"
          quality={CARD_IMAGE_NEXT_QUALITY}
          className="scale-105 object-cover object-center opacity-45 blur-sm"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-3xl text-white/35">
          {direction === "next" ? "↑" : "↓"}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent" />
    </div>
  );
}

/** One-time mobile tooltip next to ↑↓ listing arrows. */
function CardSwipeOnboarding({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-card-swipe-onboarding]")) return;
      onDismiss();
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onDismiss]);

  return (
    <div
      data-card-swipe-onboarding
      role="status"
      className="pointer-events-auto absolute right-full top-1/2 z-[80] mr-2 w-[min(12.5rem,calc(100vw-5.5rem))] -translate-y-1/2 animate-in fade-in slide-in-from-right-2 duration-300"
    >
      <div
        className={`relative rounded-2xl px-3 py-2.5 leading-snug shadow-lg ring-1 ring-white/20 ${MOBILE_FS_CHIP}`}
      >
        <p className="text-[13px] font-medium text-white/95">
          Свайпай вверх/вниз или жми ↑/↓ — перелистывай карточки
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className={`${OVERLAY_BUTTON_UA_RESET} mt-2 text-[11px] font-semibold text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white`}
        >
          Понятно
        </button>
        {/* Caret pointing at the arrow stack */}
        <span
          className="absolute top-1/2 -right-1.5 h-3 w-3 -translate-y-1/2 rotate-45 bg-black/15 ring-1 ring-white/20"
          aria-hidden
        />
      </div>
    </div>
  );
}

/** Предыдущая / следующая карточка листинга (localStorage контекст). */
function StickyListingNavButton({
  slug,
  direction,
  onGo,
  floatingGlass = false,
  orientation = "horizontal",
}: {
  slug: string | null;
  direction: "prev" | "next";
  onGo: (slug: string) => void;
  /** Мобила fullscreen над фото: круг-пилюля без «полосы-дока» (как тег‑glass). */
  floatingGlass?: boolean;
  /** Desktop split: ↑/↓ between photo and panel. */
  orientation?: "horizontal" | "vertical";
}) {
  const enabled = slug != null;
  const vertical = orientation === "vertical";
  const bar = `${OVERLAY_BUTTON_UA_RESET} flex h-auto min-h-12 w-full items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg transition-colors motion-reduce:transition-none`;
  const chip = `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/15 text-white/88 backdrop-blur-md shadow-none transition-colors motion-reduce:transition-none`;
  const verticalChip = `${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900/85 text-white ring-1 ring-white/15 backdrop-blur-md transition-colors motion-reduce:transition-none`;
  const base = vertical ? verticalChip : floatingGlass ? chip : bar;
  const accent = vertical
    ? "hover:bg-zinc-800 active:scale-[0.97]"
    : floatingGlass
      ? "hover:bg-black/26 active:scale-[0.97]"
      : "hover:bg-zinc-700 active:scale-[0.97]";
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
      {vertical ? (
        direction === "prev" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
            <path d="M18 15l-6-6-6 6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        )
      ) : direction === "prev" ? (
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

function CopyIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
