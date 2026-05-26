"use client";

import { useEffect, useState, useCallback } from "react";
import type { CardPageData } from "@/lib/supabase";
import { CardModal } from "@/components/CardModal";
import { CardPageClient } from "@/components/CardPageClient";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";

const SCROLL_POS_KEY = "card_modal_scroll_pos";

type LoadedCard = {
  data: CardPageData;
  tagEntries: { slug: string; label: string; href: string | null }[];
  breadcrumbTag: { labelRu: string; urlPath: string } | null;
};

export function ClientCardModal() {
  const { currentSlug, close, goToNeighbor, cardCache, setCardInCache } = usePromptCardModal();
  const [loaded, setLoaded] = useState<LoadedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async (slug: string) => {
    // Use cache if we have it (for fast neighbor switches)
    const cached = cardCache.get(slug);
    if (cached) {
      // We still need to build the lightweight tag/breadcrumb entries client-side.
      // For simplicity in v1 we re-fetch the full payload; caching can be improved later.
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

      // Build minimal tag/breadcrumb structures (same shape the server page builds)
      // We keep it very light here — full enrichment can be added if needed for breadcrumbs inside the modal.
      const tagEntries: { slug: string; label: string; href: string | null }[] = [];
      const breadcrumbTag = null; // Can be enhanced later if required inside the modal

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

  // Restore scroll position when the modal finally unmounts after close
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      const saved = sessionStorage.getItem(SCROLL_POS_KEY);
      if (saved) {
        const y = parseInt(saved, 10);
        requestAnimationFrame(() => {
          window.scrollTo(0, y);
          // Extra safety for Next.js layout shifts
          setTimeout(() => window.scrollTo(0, y), 60);
        });
        try {
          sessionStorage.removeItem(SCROLL_POS_KEY);
        } catch {}
      }
    };
  }, []);

  if (!currentSlug) return null;

  const handleClose = () => {
    close();
  };

  return (
    <CardModal onClose={handleClose}>
      <div className="max-h-[85vh] overflow-y-auto">
        {loading && !loaded && (
          <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-zinc-500">
            Загрузка…
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
              // Pass the neighbor navigation that stays inside the same modal
              // (the prop is handled in CardPageClient below)
            />
          </CardInteractionsProvider>
        )}
      </div>
    </CardModal>
  );
}
