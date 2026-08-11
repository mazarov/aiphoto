"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GenerateDockSurface } from "@/components/CardInlineGeneratePanel";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATE_SHELL_OPEN,
} from "@/lib/yandex-metrika";

export type GenerateDockEntrySource = "tab" | "card" | "route" | "sidebar";

export type GenerateDockSeed = {
  source: "blank" | "card";
  promptText: string;
  cardId: string | null;
};

const DEFAULT_SEED: GenerateDockSeed = {
  source: "blank",
  promptText: "",
  cardId: null,
};

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
  /** Soft paywall state on FAB / tab / compose CTA → /pricing. */
  needsCredits: boolean;
  reportNeedsCredits: (needs: boolean) => void;
  /** Empty compose on current listing (tab / focus). */
  focusBlank: (options?: { entrySource?: GenerateDockEntrySource }) => void;
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
  focusBlank: () => {},
  seedFromCard: () => {},
});

export function GenerateDockProvider({ children }: { children: ReactNode }) {
  const {
    promptCardGenerationEnabled,
    promptCardGenerationVariant,
    promptCardGenerationBucketBand,
    loading: featureLoading,
  } = useFeatureAccess();
  const [seed, setSeed] = useState<GenerateDockSeed>(DEFAULT_SEED);
  const [seedToken, setSeedToken] = useState(0);
  const [plateOpen, setPlateOpen] = useState(false);
  const [dockSurface, setDockSurface] = useState<GenerateDockSurface>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [runBusy, setRunBusy] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [needsCredits, setNeedsCredits] = useState(false);

  const trackOpen = useCallback(
    (entrySource: GenerateDockEntrySource) => {
      reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
        entry_source: entrySource,
        variant: promptCardGenerationVariant,
        bucket_band: promptCardGenerationBucketBand ?? "internal",
        feature_key: "prompt_card_generation",
      });
    },
    [promptCardGenerationBucketBand, promptCardGenerationVariant]
  );

  const reportRunProgress = useCallback((busy: boolean, progress = 0) => {
    setRunBusy(busy);
    setRunProgress(busy ? Math.min(100, Math.max(0, progress)) : 0);
  }, []);

  const reportNeedsCredits = useCallback((needs: boolean) => {
    setNeedsCredits(needs);
  }, []);

  const focusBlank = useCallback(
    (options?: { entrySource?: GenerateDockEntrySource }) => {
      if (featureLoading || !promptCardGenerationEnabled) return;
      // Avoid remounting the composer on every tab tap — remount = empty shell → fetch → second paint.
      const alreadyBlank =
        seed.source === "blank" && !seed.promptText && !seed.cardId;
      if (!alreadyBlank) {
        setSeed(DEFAULT_SEED);
        setSeedToken((token) => token + 1);
      }
      setPlateOpen(true);
      // Compact frosted plate (prompt expands on tap) — matches listing glass compose.
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "tab");
    },
    [
      featureLoading,
      promptCardGenerationEnabled,
      seed.cardId,
      seed.promptText,
      seed.source,
      trackOpen,
    ]
  );

  const seedFromCard = useCallback(
    (
      args: { promptText: string; cardId: string },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      if (featureLoading || !promptCardGenerationEnabled) return;
      setSeed({
        source: "card",
        promptText: args.promptText,
        cardId: args.cardId,
      });
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      // Base compose (collapsed prompt row) — sheet opens only on explicit tap.
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "card");
    },
    [featureLoading, promptCardGenerationEnabled, trackOpen]
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
      focusBlank,
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
      focusBlank,
      seedFromCard,
    ]
  );

  return (
    <GenerateDockContext.Provider value={value}>
      {children}
    </GenerateDockContext.Provider>
  );
}

export function useGenerateDock() {
  return useContext(GenerateDockContext);
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
    np === "/new" ||
    np === "/catalog" ||
    np === "/search" ||
    np === "/favorites" ||
    np === "/generate" ||
    np === "/generations"
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
    "/debug",
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
    "/debug/",
  ];
  if (blockedPrefixes.some((prefix) => np.startsWith(prefix))) return false;

  // Tag / SEO listing catch-all (`app/[...slug]`)
  return np.startsWith("/") && np.length > 1;
}
