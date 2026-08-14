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
import { lockListingScrollForModal } from "@/lib/scroll-preservation";
import {
  reachYandexMetrikaGoal,
  trackVirtualPageView,
  YM_GOAL_GENERATE_SHELL_OPEN,
} from "@/lib/yandex-metrika";

export const GENERATE_PATH = "/generate";
const MOBILE_MQ = "(max-width: 1023px)";
const ENTRY_SOURCE_STORAGE_KEY = "promptshot_generate_entry_source";

export type GenerateEntry =
  | { source: "blank" }
  | { source: "card"; cardId: string; promptText: string };

export type GenerateEntrySource = "tab" | "card" | "route" | "sidebar";

/** Legacy soft/route portal — blank compose now uses global GenerateDock on listings. */
type ModalMode = "soft" | "route";

type GenerateMobileModalContextType = {
  isOpen: boolean;
  mode: ModalMode | null;
  entry: GenerateEntry;
  open: (entry?: GenerateEntry, options?: { entrySource?: GenerateEntrySource }) => void;
  close: () => void;
};

const DEFAULT_ENTRY: GenerateEntry = { source: "blank" };

const GenerateMobileModalContext = createContext<GenerateMobileModalContextType>({
  isOpen: false,
  mode: null,
  entry: DEFAULT_ENTRY,
  open: () => {},
  close: () => {},
});

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function isGeneratePath(path: string): boolean {
  const np = normalizePath(path);
  return np === GENERATE_PATH || np.startsWith(`${GENERATE_PATH}/`);
}

export function markGenerateEntrySource(source: GenerateEntrySource): void {
  try {
    window.sessionStorage.setItem(ENTRY_SOURCE_STORAGE_KEY, source);
  } catch {
    /* ignore */
  }
}

export function GenerateMobileModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<ModalMode | null>(null);
  const [entry, setEntry] = useState<GenerateEntry>(DEFAULT_ENTRY);
  const [isMobile, setIsMobile] = useState(false);
  const modeRef = useRef<ModalMode | null>(null);
  modeRef.current = mode;

  const trackOpen = useCallback((entrySource: GenerateEntrySource) => {
    reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
      entry_source: entrySource,
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Hard /generate uses the real page + global dock (no portal).
  useEffect(() => {
    if (!isMobile) {
      if (modeRef.current) {
        setMode(null);
        setEntry(DEFAULT_ENTRY);
      }
      return;
    }

    if (isGeneratePath(pathname) && modeRef.current) {
      setMode(null);
      setEntry(DEFAULT_ENTRY);
    }
  }, [isMobile, pathname]);

  const open = useCallback(
    (nextEntry: GenerateEntry = DEFAULT_ENTRY, options?: { entrySource?: GenerateEntrySource }) => {
      if (typeof window === "undefined") return;

      // Blank compose: global dock / hard /generate — no soft portal.
      if (nextEntry.source === "blank") {
        if (!window.matchMedia(MOBILE_MQ).matches) {
          markGenerateEntrySource(options?.entrySource ?? "route");
          window.location.assign(GENERATE_PATH);
        }
        return;
      }

      // Legacy card portal (unused by CardPageClient — card seeds global dock).
      if (!window.matchMedia(MOBILE_MQ).matches) return;
      if (modeRef.current) return;

      const entrySource = options?.entrySource ?? "card";
      lockListingScrollForModal();
      const referer = window.location.pathname + window.location.search;
      setEntry(nextEntry);
      window.history.pushState(null, "", GENERATE_PATH);
      trackVirtualPageView(GENERATE_PATH, { referer });
      setMode("soft");
      trackOpen(entrySource);
    },
    [trackOpen]
  );

  const close = useCallback(() => {
    if (typeof window === "undefined") {
      setMode(null);
      setEntry(DEFAULT_ENTRY);
      return;
    }

    const current = modeRef.current;
    if (current === "soft") {
      window.history.scrollRestoration = "manual";
      setMode(null);
      setEntry(DEFAULT_ENTRY);
      window.setTimeout(() => {
        window.history.back();
      }, 0);
      return;
    }

    setMode(null);
    setEntry(DEFAULT_ENTRY);
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
      setMode(null);
      setEntry(DEFAULT_ENTRY);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <GenerateMobileModalContext.Provider
      value={{ isOpen: mode !== null, mode, entry, open, close }}
    >
      {children}
    </GenerateMobileModalContext.Provider>
  );
}

export function useGenerateMobileModal() {
  return useContext(GenerateMobileModalContext);
}

/** @deprecated Prefer useGenerateDock for listing compose. */
export const useGenerateSurface = useGenerateMobileModal;
