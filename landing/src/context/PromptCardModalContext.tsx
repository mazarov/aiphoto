"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { CardPageData } from "@/lib/supabase";
import { saveListingScroll } from "@/lib/scroll-preservation";
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

  const open = useCallback((slug: string) => {
    if (typeof window !== "undefined") {
      // Save scroll position of the listing before we navigate into the modal.
      // Centralized util ensures consistent key + error handling.
      saveListingScroll();

      // Capture current URL as referer BEFORE pushState (for correct virtual pageview attribution)
      const referer = window.location.pathname + window.location.search;

      // Update address bar without a full navigation
      window.history.pushState(null, "", `/p/${encodeURIComponent(slug)}`);

      // Virtual hit so Yandex Metrika / Webmaster sees "internal transition" listing/search → /p/slug
      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSlug(slug);
  }, []);

  const goToNeighbor = useCallback((slug: string) => {
    if (typeof window !== "undefined") {
      // Capture the *current* virtual URL (previous card) before replaceState
      const referer = window.location.pathname + window.location.search;

      // Replace the URL so the address bar always shows the current card
      window.history.replaceState(null, "", `/p/${encodeURIComponent(slug)}`);

      // Virtual hit for neighbor navigation inside the modal (important for card-to-card chains)
      trackVirtualPageView(`/p/${encodeURIComponent(slug)}`, { referer });
    }
    setCurrentSlug(slug);
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined") {
      // Prefer natural back so that the previous history entry (the listing) is restored
      // The actual scroll restoration is performed by the modal unmount logic (ClientCardModal)
      window.history.back();
    }
    setCurrentSlug(null);
  }, []);

  const setCardInCache = useCallback((slug: string, data: CardPageData) => {
    cardCache.set(slug, data);
  }, [cardCache]);

  // Handle browser back/forward when the modal is open
  useEffect(() => {
    function onPopState() {
      // If we still think a modal is open, close it (the back navigation already happened in history)
      if (currentSlug) {
        setCurrentSlug(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [currentSlug]);

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
