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

const CARD_CACHE_MAX_ENTRIES = 9;

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
  /** Synchronous cache lookup; successful reads refresh the LRU position. */
  getCardFromCache: (slug: string) => CardPageData | null;
  /** Helper to prime the cache from server-fetched data. */
  setCardInCache: (slug: string, data: CardPageData) => void;
  /** Shared request path with in-flight deduplication. */
  loadCard: (slug: string) => Promise<CardPageData | null>;
  /** Fire-and-forget prefetch: fetches card data into cache with in-flight dedup. */
  prefetchCard: (slug: string) => void;
};

const PromptCardModalContext = createContext<PromptCardModalContextType>({
  currentSlug: null,
  currentSeed: null,
  open: () => {},
  close: () => {},
  goToNeighbor: () => {},
  getCardFromCache: () => null,
  setCardInCache: () => {},
  loadCard: async () => null,
  prefetchCard: () => {},
});

export function PromptCardModalProvider({ children }: { children: ReactNode }) {
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentSeed, setCurrentSeed] = useState<CardModalSeed | null>(null);
  const [cardCache] = useState(() => new Map<string, CardPageData>());
  const currentSlugRef = useRef<string | null>(null);
  currentSlugRef.current = currentSlug;
  const inflightRef = useRef(
    new Map<string, Promise<CardPageData | null>>()
  );

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

  const getCardFromCache = useCallback((slug: string) => {
    const cached = cardCache.get(slug);
    if (!cached) return null;
    // Refresh recency without changing the Map identity exposed through callbacks.
    cardCache.delete(slug);
    cardCache.set(slug, cached);
    return cached;
  }, [cardCache]);

  const setCardInCache = useCallback((slug: string, data: CardPageData) => {
    cardCache.delete(slug);
    cardCache.set(slug, data);
    while (cardCache.size > CARD_CACHE_MAX_ENTRIES) {
      const oldestSlug = cardCache.keys().next().value as string | undefined;
      if (!oldestSlug) break;
      cardCache.delete(oldestSlug);
    }
  }, [cardCache]);

  const loadCard = useCallback((slug: string): Promise<CardPageData | null> => {
    const cached = getCardFromCache(slug);
    if (cached) return Promise.resolve(cached);

    const existing = inflightRef.current.get(slug);
    if (existing) return existing;

    let request: Promise<CardPageData | null>;
    request = fetch(`/api/card/${encodeURIComponent(slug)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: CardPageData };
        if (!json.data) return null;
        setCardInCache(slug, json.data);
        return json.data;
      })
      .catch(() => null)
      .finally(() => {
        if (inflightRef.current.get(slug) === request) {
          inflightRef.current.delete(slug);
        }
      });

    inflightRef.current.set(slug, request);
    return request;
  }, [getCardFromCache, setCardInCache]);

  const prefetchCard = useCallback((slug: string) => {
    void loadCard(slug);
  }, [loadCard]);

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
        getCardFromCache,
        setCardInCache,
        loadCard,
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
