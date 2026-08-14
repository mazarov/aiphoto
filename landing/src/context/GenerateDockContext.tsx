"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_GENERATE_DOCK_SEED,
  isResumeComposeSeed,
  type GenerateDockComposeIntent,
  type GenerateDockSeed,
} from "@/lib/generate-dock-seed";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATE_SHELL_OPEN,
} from "@/lib/yandex-metrika";

export type {
  GenerateDockComposeIntent,
  GenerateDockSeed,
} from "@/lib/generate-dock-seed";

/** Blank dock editor surface — mutual exclusion SSOT for shell stretch. */
export type GenerateDockSurface = "prompt" | "photos" | "model" | null;

export type GenerateDockEntrySource = "tab" | "card" | "route" | "sidebar";

const DEFAULT_SEED: GenerateDockSeed = DEFAULT_GENERATE_DOCK_SEED;

type GenerateDockContextType = {
  seed: GenerateDockSeed;
  seedToken: number;
  /** Floating compose plate open (FAB collapsed when false). Default false. */
  plateOpen: boolean;
  setPlateOpen: (open: boolean) => void;
  dockSurface: GenerateDockSurface;
  setDockSurface: (surface: GenerateDockSurface) => void;
  historyRefreshToken: number;
  notifyGenerationComplete: () => void;
  /** In-flight generate — drives listing FAB / tab progress. */
  runBusy: boolean;
  runProgress: number;
  reportRunProgress: (busy: boolean, progress?: number) => void;
  /** Soft paywall state on FAB / tab / compose CTA → pricing overlay (`/pricing`). */
  needsCredits: boolean;
  reportNeedsCredits: (needs: boolean) => void;
  /** Model explicitly requested by an acquisition/product surface. */
  requestedModelId: string | null;
  requestModelSelection: (
    modelId: string,
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  /** Empty compose on current listing (tab / focus). */
  focusBlank: (options?: { entrySource?: GenerateDockEntrySource }) => void;
  /** Seed a freeform prompt and open the composer. */
  seedBlankPrompt: (
    promptText: string,
    options?: {
      entrySource?: GenerateDockEntrySource;
      intent?: GenerateDockComposeIntent;
      dockSurface?: GenerateDockSurface;
    }
  ) => void;
  /** Seed prompt from prompt card, then caller closes the card. */
  seedFromCard: (
    args: { promptText: string; cardId: string },
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
};

const GenerateDockContext = createContext<GenerateDockContextType>({
  seed: DEFAULT_SEED,
  seedToken: 0,
  plateOpen: false,
  setPlateOpen: () => {},
  dockSurface: null,
  setDockSurface: () => {},
  historyRefreshToken: 0,
  notifyGenerationComplete: () => {},
  runBusy: false,
  runProgress: 0,
  reportRunProgress: () => {},
  needsCredits: false,
  reportNeedsCredits: () => {},
  requestedModelId: null,
  requestModelSelection: () => {},
  focusBlank: () => {},
  seedBlankPrompt: () => {},
  seedFromCard: () => {},
});

export function GenerateDockProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<GenerateDockSeed>(DEFAULT_SEED);
  const [seedToken, setSeedToken] = useState(0);
  const [plateOpen, setPlateOpen] = useState(false);
  const [dockSurface, setDockSurface] = useState<GenerateDockSurface>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [runBusy, setRunBusy] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [requestedModelId, setRequestedModelId] = useState<string | null>(null);

  const trackOpen = useCallback((entrySource: GenerateDockEntrySource) => {
    reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
      entry_source: entrySource,
    });
  }, []);

  const reportRunProgress = useCallback((busy: boolean, progress = 0) => {
    setRunBusy(busy);
    setRunProgress(busy ? Math.min(100, Math.max(0, progress)) : 0);
  }, []);

  const reportNeedsCredits = useCallback((needs: boolean) => {
    setNeedsCredits(needs);
  }, []);

  const requestModelSelection = useCallback(
    (
      modelId: string,
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      if (!modelId.trim()) {
        return;
      }
      if (!isResumeComposeSeed(seed)) {
        setSeed(DEFAULT_SEED);
        setSeedToken((token) => token + 1);
      }
      setRequestedModelId(modelId);
      setPlateOpen(true);
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "route");
    },
    [seed, trackOpen]
  );

  const focusBlank = useCallback(
    (options?: { entrySource?: GenerateDockEntrySource }) => {
      // Avoid remounting the composer on every tab tap — remount = empty shell → fetch → second paint.
      if (!isResumeComposeSeed(seed)) {
        setSeed(DEFAULT_SEED);
        setSeedToken((token) => token + 1);
      }
      setPlateOpen(true);
      // Compact frosted plate (prompt expands on tap) — matches listing glass compose.
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "tab");
    },
    [seed, trackOpen]
  );

  const seedFromCard = useCallback(
    (
      args: { promptText: string; cardId: string },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      setSeed({
        source: "card",
        promptText: args.promptText,
        cardId: args.cardId,
        intent: "resume",
      });
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      // Base compose (collapsed prompt row) — sheet opens only on explicit tap.
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "card");
    },
    [trackOpen]
  );

  const seedBlankPrompt = useCallback(
    (
      promptText: string,
      options?: {
        entrySource?: GenerateDockEntrySource;
        intent?: GenerateDockComposeIntent;
        dockSurface?: GenerateDockSurface;
      }
    ) => {
      setSeed({
        source: "blank",
        promptText: promptText.trim(),
        cardId: null,
        intent: options?.intent ?? "text",
      });
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      setDockSurface(options?.dockSurface ?? null);
      trackOpen(options?.entrySource ?? "route");
    },
    [trackOpen]
  );

  const notifyGenerationComplete = useCallback(() => {
    setHistoryRefreshToken((token) => token + 1);
  }, []);

  const value = useMemo(
    () => ({
      seed,
      seedToken,
      plateOpen,
      setPlateOpen,
      dockSurface,
      setDockSurface,
      historyRefreshToken,
      notifyGenerationComplete,
      runBusy,
      runProgress,
      reportRunProgress,
      needsCredits,
      reportNeedsCredits,
      requestedModelId,
      requestModelSelection,
      focusBlank,
      seedBlankPrompt,
      seedFromCard,
    }),
    [
      seed,
      seedToken,
      plateOpen,
      dockSurface,
      historyRefreshToken,
      notifyGenerationComplete,
      runBusy,
      runProgress,
      reportRunProgress,
      needsCredits,
      reportNeedsCredits,
      requestedModelId,
      requestModelSelection,
      focusBlank,
      seedBlankPrompt,
      seedFromCard,
    ]
  );

  return (
    <GenerateDockContext.Provider value={value}>
      <GenerateDockGuestAuthReactor />
      {children}
    </GenerateDockContext.Provider>
  );
}

/**
 * SSOT: guest compose (`plateOpen`) always opens auth. Dismiss without login
 * closes the plate so a second «Повторить» can retrigger the modal.
 */
function GenerateDockGuestAuthReactor() {
  const { user, loading, showAuthModal, openAuthModal } = useAuth();
  const { plateOpen, setPlateOpen, setDockSurface } = useGenerateDock();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const prevShowAuthRef = useRef(showAuthModal);

  useEffect(() => {
    if (loading || isAuthed || !plateOpen) return;
    openAuthModal();
  }, [loading, isAuthed, plateOpen, openAuthModal]);

  useEffect(() => {
    const wasShowing = prevShowAuthRef.current;
    prevShowAuthRef.current = showAuthModal;
    if (loading || isAuthed) return;
    if (wasShowing && !showAuthModal && plateOpen) {
      setPlateOpen(false);
      setDockSurface(null);
    }
  }, [showAuthModal, loading, isAuthed, plateOpen, setPlateOpen, setDockSurface]);

  return null;
}

export function useGenerateDock() {
  return useContext(GenerateDockContext);
}

/** SEO acquisition route where blank text-to-image is allowed. */
export function isGenerateDockSeoPagePath(pathname: string): boolean {
  const normalized =
    !pathname || pathname === "/"
      ? "/"
      : pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname;
  return normalized === "/generaciya-foto";
}

/** Listing routes where the floating generate dock is mounted. */
export function isGenerateDockListingPath(pathname: string): boolean {
  const np =
    !pathname || pathname === "/"
      ? "/"
      : pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname;

  if (
    np === "/" ||
    np === "/trends" ||
    np === "/catalog" ||
    np === "/search" ||
    np === "/favorites" ||
    np === "/generate" ||
    np === "/generations" ||
    isGenerateDockSeoPagePath(np)
  ) {
    return true;
  }

  const blockedExact = new Set([
    "/pricing",
    "/admin",
    "/foto-v-promt",
    "/embed",
    "/auth",
    "/extension-stv",
    "/privacy",
    "/terms",
    "/policy",
    "/p",
  ]);
  if (blockedExact.has(np)) return false;

  const blockedPrefixes = [
    "/p/",
    "/pricing/",
    "/admin/",
    "/foto-v-promt/",
    "/embed/",
    "/auth/",
    "/extension-stv/",
  ];
  if (blockedPrefixes.some((prefix) => np.startsWith(prefix))) return false;

  // Tag / SEO listing catch-all (`app/[...slug]`)
  return np.startsWith("/") && np.length > 1;
}
