"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { CardPageData } from "@/lib/supabase";
import { CardModal } from "@/components/CardModal";
import { CardPageClient } from "@/components/CardPageClient";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { getSeoSlugsWithTags, getFirstTagFromSeoTags } from "@/lib/tag-registry";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";

type LoadedCard = {
  data: CardPageData;
  tagEntries: { slug: string; label: string; href: string | null }[];
  breadcrumbTag: { labelRu: string; urlPath: string } | null;
};

export function ClientCardModal() {
  const { currentSlug, currentSeed, close, goToNeighbor, cardCache, setCardInCache } = usePromptCardModal();
  const [loaded, setLoaded] = useState<LoadedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async (slug: string) => {
    // Fast path: use cache for instant neighbor switches inside the modal (no network, no loading flash).
    const cached = cardCache.get(slug);
    if (cached) {
      const tagEntries = getSeoSlugsWithTags(cached.seo_tags);
      const firstTag = getFirstTagFromSeoTags(cached.seo_tags);
      const loadedCard: LoadedCard = {
        data: cached,
        tagEntries,
        breadcrumbTag: firstTag ? { labelRu: firstTag.labelRu, urlPath: firstTag.urlPath } : null,
      };
      setLoaded(loadedCard);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/card/${encodeURIComponent(slug)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: CardPageData = json.data;

      // Enrich with tags exactly like the server /p/[slug] pages do.
      // This ensures tags (and breadcrumb) appear on first open from the listing grid.
      const tagEntries = getSeoSlugsWithTags(data.seo_tags);
      const firstTag = getFirstTagFromSeoTags(data.seo_tags);
      const breadcrumbTag = firstTag
        ? { labelRu: firstTag.labelRu, urlPath: firstTag.urlPath }
        : null;

      const loadedCard: LoadedCard = { data, tagEntries, breadcrumbTag };
      setLoaded(loadedCard);
      setCardInCache(slug, data);
    } catch (e) {
      console.error("ClientCardModal fetch failed", e);
      setError("Не удалось загрузить карточку");
      setLoaded(null);
    } finally {
      setLoading(false);
    }
  }, [cardCache, setCardInCache]);

  // When the slug in context changes, load the corresponding card
  useEffect(() => {
    if (!currentSlug) {
      setLoaded(null);
      setError(null);
      return;
    }
    fetchCard(currentSlug);
  }, [currentSlug, fetchCard]);

  if (!currentSlug) return null;

  const handleClose = () => {
    close();
  };

  // Match the direct /p/[slug] behavior: photo cards on mobile get full immersive viewport.
  // Switch to immersive immediately if seed already tells us the card has photos —
  // avoids the white-box flash before data arrives.
  const hasSeedPhoto = !!(currentSeed?.photoUrl);
  const immersiveMobile = !!(loaded?.data?.photoUrls?.length || hasSeedPhoto);

  return (
    <CardModal onClose={handleClose} immersiveMobile={immersiveMobile}>
      <div className={immersiveMobile ? "h-[100dvh] overflow-y-auto" : "max-h-[85vh] overflow-y-auto"}>
        {loading && !loaded && !hasSeedPhoto && (
          <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-zinc-500">
            Загрузка…
          </div>
        )}

        {loading && !loaded && hasSeedPhoto && (
          // Dark fullscreen shell using the grid-sized photo — same URL the browser already cached
          // from the listing, so the image appears instantly with no extra network round-trip.
          // Shown only on mobile (md:hidden) — desktop falls through to the white modal box.
          <div className="fixed inset-0 z-[244] md:hidden" aria-hidden>
            <div className="absolute inset-0 bg-zinc-950" />
            <div className="absolute inset-0">
              <Image
                src={currentSeed!.photoUrl!}
                alt=""
                fill
                sizes={SIZES_CARD_GRID}
                quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
                className="object-cover object-center"
                priority
                fetchPriority="high"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-sm text-red-600">
            {error}
            <button
              onClick={() => currentSlug && fetchCard(currentSlug)}
              className="ml-3 underline"
            >
              Повторить
            </button>
          </div>
        )}

        {loaded && (
          <CardInteractionsProvider cardIds={[loaded.data.id]}>
            <CardPageClient
              data={loaded.data}
              tagEntries={loaded.tagEntries}
              breadcrumbTag={loaded.breadcrumbTag}
              isModal
              // Pass the neighbor navigation that stays inside the *same* modal instance.
              // This makes left/right arrows work without full navigation or multiple modals.
              onListingNeighborGo={goToNeighbor}
              // Make the mobile photo header "Закрыть" крестик actually close this client modal
              // (same visual position and style as on direct /p/[slug] pages).
              onCloseModal={handleClose}
            />
          </CardInteractionsProvider>
        )}
      </div>
    </CardModal>
  );
}
