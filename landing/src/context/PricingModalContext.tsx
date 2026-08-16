"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { lockListingScrollForModal } from "@/lib/scroll-preservation";
import { savePricingReturnPath } from "@/lib/yookassa-return-path";
import { trackVirtualPageView } from "@/lib/yandex-metrika";

const PRICING_PATH = "/pricing";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function isPricingPath(path: string): boolean {
  return normalizePath(path) === PRICING_PATH;
}

type PricingCloseOptions = {
  /** `back` restores the listing URL. `none` for leaving to YooKassa. */
  history?: "back" | "none";
};

type PricingModalContextType = {
  isOpen: boolean;
  open: () => void;
  close: (options?: PricingCloseOptions) => void;
};

const PricingModalContext = createContext<PricingModalContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const pathname = usePathname();

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    if (typeof window !== "undefined" && isPricingPath(window.location.pathname)) {
      return;
    }

    if (typeof window !== "undefined") {
      lockListingScrollForModal();
      const referer = window.location.pathname + window.location.search;
      savePricingReturnPath(referer);
      window.history.pushState(null, "", PRICING_PATH);
      trackVirtualPageView(PRICING_PATH, {
        referer,
        title: "Тарифы и токены — PromptShot",
      });
    }
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  const close = useCallback((options?: PricingCloseOptions) => {
    isOpenRef.current = false;
    setIsOpen(false);
    if (typeof window === "undefined" || options?.history === "none") return;
    window.history.scrollRestoration = "manual";
    window.setTimeout(() => {
      window.history.back();
    }, 0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    function onPopState() {
      if (!isOpenRef.current) return;
      isOpenRef.current = false;
      setIsOpen(false);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Overlay URL is `/pricing` via pushState. A real Next navigation (оферта, политика)
  // leaves that path — drop the overlay without history.back().
  useEffect(() => {
    if (!isOpenRef.current) return;
    if (isPricingPath(pathname)) return;
    isOpenRef.current = false;
    setIsOpen(false);
  }, [pathname]);

  return (
    <PricingModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </PricingModalContext.Provider>
  );
}

export function usePricingModal() {
  return useContext(PricingModalContext);
}
