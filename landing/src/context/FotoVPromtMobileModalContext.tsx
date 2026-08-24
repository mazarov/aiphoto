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
import { usePathname, useRouter } from "next/navigation";
import { setLiveAuthReturnOverlay } from "@/lib/auth-return-screen";
import { lockListingScrollForModal } from "@/lib/scroll-preservation";
import { trackVirtualPageView } from "@/lib/yandex-metrika";

const FOTO_V_PROMT_PATH = "/foto-v-promt";
const MOBILE_MQ = "(max-width: 1023px)";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function isFotoVPromtPath(path: string): boolean {
  const np = normalizePath(path);
  return np === FOTO_V_PROMT_PATH || np.startsWith(`${FOTO_V_PROMT_PATH}/`);
}

/** soft = tab pushState over listing; route = hard /foto-v-promt on mobile */
type ModalMode = "soft" | "route";

type FotoVPromtMobileModalContextType = {
  isOpen: boolean;
  mode: ModalMode | null;
  open: () => void;
  close: () => void;
};

const FotoVPromtMobileModalContext = createContext<FotoVPromtMobileModalContextType>({
  isOpen: false,
  mode: null,
  open: () => {},
  close: () => {},
});

export function FotoVPromtMobileModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<ModalMode | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const modeRef = useRef<ModalMode | null>(null);
  modeRef.current = mode;

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Hard navigation / refresh / search: always show immersive shell on mobile.
  // Soft pushState keeps Next pathname on the previous listing — do not treat as route.
  useEffect(() => {
    if (!isMobile) {
      if (modeRef.current === "route") setMode(null);
      return;
    }
    if (isFotoVPromtPath(pathname)) {
      setMode((prev) => (prev === "soft" ? prev : "route"));
      return;
    }
    if (modeRef.current === "route") {
      setMode(null);
    }
  }, [pathname, isMobile]);

  const open = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(MOBILE_MQ).matches) return;
    if (modeRef.current) return;

    // Already on the hard SEO route — route-mode effect will open the shell.
    if (isFotoVPromtPath(window.location.pathname)) {
      setMode("route");
      return;
    }

    lockListingScrollForModal();
    const referer = window.location.pathname + window.location.search;
    setLiveAuthReturnOverlay({
      originPath: referer,
      overlay: { type: "foto-v-promt" },
    });
    window.history.pushState(null, "", FOTO_V_PROMT_PATH);
    trackVirtualPageView(FOTO_V_PROMT_PATH, { referer });
    setMode("soft");
  }, []);

  const close = useCallback(() => {
    if (typeof window === "undefined") {
      setLiveAuthReturnOverlay(null);
      setMode(null);
      return;
    }

    const current = modeRef.current;
    if (current === "soft") {
      window.history.scrollRestoration = "manual";
      setLiveAuthReturnOverlay(null);
      setMode(null);
      window.setTimeout(() => {
        window.history.back();
      }, 0);
      return;
    }

    // Hard page / search entry: leave the route (avoid empty SEO flash under modal).
    setLiveAuthReturnOverlay(null);
    setMode(null);
    router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!mode) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [mode]);

  useEffect(() => {
    function onPopState() {
      if (modeRef.current !== "soft") return;
      setLiveAuthReturnOverlay(null);
      setMode(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <FotoVPromtMobileModalContext.Provider
      value={{ isOpen: mode !== null, mode, open, close }}
    >
      {children}
    </FotoVPromtMobileModalContext.Provider>
  );
}

export function useFotoVPromtMobileModal() {
  return useContext(FotoVPromtMobileModalContext);
}
