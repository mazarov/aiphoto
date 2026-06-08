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
import { trackVirtualPageView } from "@/lib/yandex-metrika";

type PromptCardModalContextType = {
  currentSlug: string | null;
  /** Open the modal for a given slug (from listing click). Saves scroll position and updates history. */
  open: (slug: string) => void;
  /** Close the modal (user action or browser back). */
  close: () => void;
  /** Switch to a neighbor slug inside the same modal instance (arrows). */
  goToNeighbor: (slug: string) => void;
  /** Optional small cache of recently loaded cards (for snappy neighbor switches). */
  cardCache: Map<string, CardPageData>;
  /** Helper to prime the cache from server-fetched data. */
  setCardInCache: (slug: string, data: CardPageData) => void;
};

const PromptCardModalContext = createContext<PromptCardModalContextType>({
  currentSlug: null,
  open: () => {},
  close: () => {},
  goToNeighbor: () => {},
  cardCache: new Map(),
  setCardInCache: () => {},
});

export function PromptCardModalProvider({ children }: { children: ReactNode }) {
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [cardCache] = useState(() => new Map<string, CardPageData>());
  const currentSlugRef = useRef<string | null>(null);
  currentSlugRef.current = currentSlug;

  const open = useCallback((slug: string) => {
    if (typeof window !== "undefined") {
      lockListingScrollForModal();

      const referer = window.location.pathname + window.location.search;

      window.history.pushState(null, "", `/p/${encodeURIComponent(slug)}`);

      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSlug(slug);
  }, []);

  const goToNeighbor = useCallback((slug: string) => {
    if (typeof window !== "undefined") {
      const referer = window.location.pathname + window.location.search;

      window.history.replaceState(null, "", `/p/${encodeURIComponent(slug)}`);

      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSlug(slug);
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined") {
      // Unmount modal first so CardModal cleanup unlocks body (desktop) before history.back().
      window.history.scrollRestoration = "manual";
      setCurrentSlug(null);
      window.setTimeout(() => {
        window.history.back();
      }, 0);
      return;
    }
    setCurrentSlug(null);
  }, []);

  const setCardInCache = useCallback((slug: string, data: CardPageData) => {
    cardCache.set(slug, data);
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
        open,
        close,
        goToNeighbor,
        cardCache,
        setCardInCache,
      }}
    >
      {children}
    </PromptCardModalContext.Provider>
  );
}

export function usePromptCardModal() {
  return useContext(PromptCardModalContext);
}
