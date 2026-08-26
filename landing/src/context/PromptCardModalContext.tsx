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
import {
  readListingNavigationCard,
  readListingNavigationContext,
} from "@/lib/listing-card-navigation-context";
import {
  getLiveAuthReturnOverlay,
  setLiveAuthReturnOverlay,
} from "@/lib/auth-return-screen";
import {
  canMutateAuthReturnCardSlug,
  releaseAuthReturnCardPin,
  resolveAuthReturnCardOpenSlug,
} from "@/lib/auth-return-card-pin";
import {
  beginClientCardOverlay,
  endClientCardOverlay,
} from "@/lib/client-card-overlay";
import { markPromptCardOverlayOpened } from "@/lib/prompt-card-overlay-open";
import { lockListingScrollForModal } from "@/lib/scroll-preservation";
import { trackPromptCardOpen, trackVirtualPageView } from "@/lib/yandex-metrika";

const CARD_CACHE_MAX_ENTRIES = 9;
const CARD_PREFETCH_BEHIND = 2;
const CARD_PREFETCH_AHEAD = 6;

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
  const closingRef = useRef(false);
  const inflightRef = useRef(
    new Map<string, Promise<CardPageData | null>>()
  );
  const prefetchWindowRef = useRef<(slug: string) => void>(() => {});

  const open = useCallback((slug: string, seed?: CardModalSeed) => {
    const nextSlug = resolveAuthReturnCardOpenSlug(slug);
    closingRef.current = false;
    prefetchWindowRef.current(nextSlug);
    if (typeof window !== "undefined") {
      beginClientCardOverlay(nextSlug);
      markPromptCardOverlayOpened();
      lockListingScrollForModal();

      const referer = window.location.pathname + window.location.search;
      const alreadyOpen = Boolean(currentSlugRef.current);
      const originPath = alreadyOpen
        ? (getLiveAuthReturnOverlay()?.originPath ?? referer)
        : referer;
      setLiveAuthReturnOverlay({
        originPath,
        overlay: { type: "card", slug: nextSlug },
      });
      if (alreadyOpen) {
        window.history.replaceState(null, "", `/p/${encodeURIComponent(nextSlug)}`);
      } else {
        window.history.pushState(null, "", `/p/${encodeURIComponent(nextSlug)}`);
      }

      trackPromptCardOpen(nextSlug, { entry: "modal", referer });
      trackVirtualPageView(`/p/${encodeURIComponent(nextSlug)}`, { referer });
    }
    setCurrentSeed(nextSlug === slug ? seed ?? null : null);
    setCurrentSlug(nextSlug);
  }, []);

  const goToNeighbor = useCallback((slug: string) => {
    if (closingRef.current || !currentSlugRef.current) return;
    if (!canMutateAuthReturnCardSlug(slug)) return;
    beginClientCardOverlay(slug);
    if (typeof window !== "undefined") {
      const referer = window.location.pathname + window.location.search;

      window.history.replaceState(null, "", `/p/${encodeURIComponent(slug)}`);

      const originPath =
        getLiveAuthReturnOverlay()?.originPath ?? referer;
      setLiveAuthReturnOverlay({
        originPath,
        overlay: { type: "card", slug },
      });
      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSeed(null);
    setCurrentSlug(slug);
  }, []);

  const close = useCallback(() => {
    closingRef.current = true;
    releaseAuthReturnCardPin();
    endClientCardOverlay();
    setLiveAuthReturnOverlay(null);
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
    if (!cached) return readListingNavigationCard(slug);
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

  const prefetchCardWindow = useCallback((currentSlug: string) => {
    const slugs = readListingNavigationContext();
    const currentIndex = slugs?.indexOf(currentSlug) ?? -1;
    if (!slugs || currentIndex < 0) {
      void loadCard(currentSlug);
      return;
    }
    const start = Math.max(0, currentIndex - CARD_PREFETCH_BEHIND);
    const end = Math.min(
      slugs.length,
      currentIndex + CARD_PREFETCH_AHEAD + 1
    );
    for (const slug of slugs.slice(start, end)) {
      void loadCard(slug);
    }
  }, [loadCard]);
  prefetchWindowRef.current = prefetchCardWindow;

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
      releaseAuthReturnCardPin();
      endClientCardOverlay();
      setLiveAuthReturnOverlay(null);
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
