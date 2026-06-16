"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { CardPageData } from "@/lib/supabase";
import { lockListingScrollForModal } from "@/lib/scroll-preservation";
import { trackPromptCardOpen, trackVirtualPageView } from "@/lib/yandex-metrika";

/** Lightweight preview data available immediately from the listing grid on click. */
export type CardModalSeed = {
  photoUrl: string | null;
  photoCount: number;
  hasPrompts: boolean;
};

type PromptCardModalContextType = {
  currentSlug: string | null;
  /** Seed preview data passed from the listing grid — available immediately on open. */
  currentSeed: CardModalSeed | null;
  /** Open the modal for a given slug (from listing click). Saves scroll position and updates history. */
  open: (slug: string, seed?: CardModalSeed) => void;
  /** Close the modal (user action or browser back). */
  close: () => void;
  /** Switch to a neighbor slug inside the same modal instance (arrows). */
  goToNeighbor: (slug: string) => void;
  /** Optional small cache of recently loaded cards (for snappy neighbor switches). */
  cardCache: Map<string, CardPageData>;
  /** Helper to prime the cache from server-fetched data. */
  setCardInCache: (slug: string, data: CardPageData) => void;
  /** Fire-and-forget prefetch: fetches card data into cache with in-flight dedup. */
  prefetchCard: (slug: string) => void;
};

const PromptCardModalContext = createContext<PromptCardModalContextType>({
  currentSlug: null,
  currentSeed: null,
  open: () => {},
  close: () => {},
  goToNeighbor: () => {},
  cardCache: new Map(),
  setCardInCache: () => {},
  prefetchCard: () => {},
});

export function PromptCardModalProvider({ children }: { children: ReactNode }) {
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentSeed, setCurrentSeed] = useState<CardModalSeed | null>(null);
  const [cardCache] = useState(() => new Map<string, CardPageData>());
  const currentSlugRef = useRef<string | null>(null);
  currentSlugRef.current = currentSlug;
  const inflightRef = useRef(new Map<string, true>());

  const open = useCallback((slug: string, seed?: CardModalSeed) => {
    if (typeof window !== "undefined") {
      lockListingScrollForModal();

      const referer = window.location.pathname + window.location.search;

      window.history.pushState(null, "", `/p/${encodeURIComponent(slug)}`);

      trackPromptCardOpen(slug, { entry: "modal", referer });
      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSeed(seed ?? null);
    setCurrentSlug(slug);
  }, []);

  const goToNeighbor = useCallback((slug: string) => {
    if (typeof window !== "undefined") {
      const referer = window.location.pathname + window.location.search;

      window.history.replaceState(null, "", `/p/${encodeURIComponent(slug)}`);

      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSeed(null);
    setCurrentSlug(slug);
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined") {
      // Unmount modal first so CardModal cleanup unlocks body (desktop) before history.back().
      window.history.scrollRestoration = "manual";
      setCurrentSlug(null);
      setCurrentSeed(null);
      window.setTimeout(() => {
        window.history.back();
      }, 0);
      return;
    }
    setCurrentSlug(null);
    setCurrentSeed(null);
  }, []);

  const setCardInCache = useCallback((slug: string, data: CardPageData) => {
    cardCache.set(slug, data);
  }, [cardCache]);

  const prefetchCard = useCallback((slug: string) => {
    if (cardCache.has(slug) || inflightRef.current.has(slug)) return;
    inflightRef.current.set(slug, true);
    fetch(`/api/card/${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: CardPageData } | null) => {
        if (json?.data) cardCache.set(slug, json.data);
      })
      .catch(() => {})
      .finally(() => inflightRef.current.delete(slug));
  }, [cardCache]);

  useEffect(() => {
    if (!currentSlug) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [currentSlug]);

  useEffect(() => {
    function onPopState() {
      if (!currentSlugRef.current) return;
      setCurrentSlug(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <PromptCardModalContext.Provider
      value={{
        currentSlug,
        currentSeed,
        open,
        close,
        goToNeighbor,
        cardCache,
        setCardInCache,
        prefetchCard,
      }}
    >
      {children}
    </PromptCardModalContext.Provider>
  );
}

export function usePromptCardModal() {
  return useContext(PromptCardModalContext);
}
