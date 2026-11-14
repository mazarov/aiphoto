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
  isRestorableLastDockResult,
  isResumeComposeSeed,
  photoshootTileUrlsFromUnknown,
  resolveDockSurfaceForComposeEntry,
  sameGenerateDockComposeIdentity,
  applyComposeExampleToSeed,
  applySeoSelfieToSeed,
  catalogCardRepeatSeed,
  type GenerateDockComposeIntent,
  type GenerateDockSeed,
  type LastDockResult,
} from "@/lib/generate-dock-seed";
import { setPendingPhotoPrompt } from "@/lib/generate-photo-prompt";
import {
  consumePendingGenerateDock,
  persistPendingGenerateDock,
  seedForAuthReturnDock,
  shouldRestorePendingGenerateDock,
  takePendingComposeExample,
} from "@/lib/generate-dock-pending";
import {
  dockSurfaceForCardRepeat,
  shouldKeepCardAuthReturnOverlay,
} from "@/lib/card-repeat-auth";
import {
  authReturnOverlayForGenerateDock,
  getLiveAuthReturnOverlay,
  setLiveAuthReturnOverlay,
} from "@/lib/auth-return-screen";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATE_SHELL_OPEN,
  YM_GOAL_PHOTOSHOOT_FAIL,
  YM_GOAL_PHOTOSHOOT_READY,
  YM_GOAL_STICKER_DONE,
} from "@/lib/yandex-metrika";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { LISTING_VIDEO_REPEAT_KIND } from "@/lib/listing-video-repeat";
import { PHOTOSHOOT_EDIT_KIND } from "@/lib/photoshoot";
import { STICKER_EDIT_KIND } from "@/lib/sticker";
import { STICKER_PACK_EDIT_KIND } from "@/lib/sticker-pack";
import { sidecarTileUrls } from "@/lib/generations-list";
import {
  advanceSoftJobProgress,
  isDockJobActive,
  pruneDockJobsHistory,
  summarizeActiveDockJobs,
  type ActiveDockGenerationJob,
  type ActiveDockJobsSummary,
} from "@/lib/generate-active-jobs";
import {
  fetchGenerateBootstrap,
  readCachedGenerateConfig,
  subscribeGenerateConfigSnapshot,
} from "@/lib/generate-bootstrap-client";
import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";

export type {
  ActiveDockGenerationJob,
  ActiveDockJobsSummary,
} from "@/lib/generate-active-jobs";

export type {
  GenerateDockComposeIntent,
  GenerateDockSeed,
  LastDockResult,
} from "@/lib/generate-dock-seed";
export {
  isGenerateDockListingPath,
  isGenerateDockSeoPagePath,
} from "@/lib/generate-dock-path";

/** Blank dock editor surface — mutual exclusion SSOT for shell stretch. */
export type GenerateDockSurface =
  | "prompt"
  | "photos"
  | "model"
  | "example"
  | "tool"
  | "auth"
  | null;

export type GenerateDockEntrySource =
  | "tab"
  | "fab"
  | "howto"
  | "hero"
  | "card"
  | "route"
  | "sidebar"
  | "foto_v_promt"
  | "analyses"
  | "admin";

const DEFAULT_SEED: GenerateDockSeed = DEFAULT_GENERATE_DOCK_SEED;

type SeedCompletedResultArgs = {
  generationId: string;
  resultUrl: string;
  promptText?: string;
  modality?: "image" | "video";
  isPublished?: boolean;
  editKind?: string | null;
  photoshootTileUrls?: string[] | null;
};

export type DockJobLifecycleEvent =
  | { type: "completed"; job: ActiveDockGenerationJob }
  | { type: "failed"; job: ActiveDockGenerationJob };

type BeginDockJobInput = {
  promptText: string;
  modality: "image" | "video";
  editKind?: string | null;
  sourcePreviewUrl?: string | null;
  listingVideoRepeat?: boolean;
  stickerStyleId?: string | null;
};

type GenerateDockContextType = {
  seed: GenerateDockSeed;
  seedToken: number;
  /** DB feature flag `generate_dock_v2_enabled` (latched while plate is open). */
  generateDockV2Enabled: boolean;
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
  /** Parallel generation queue (up to 3 concurrent jobs) + completed tray items. */
  activeJobs: ActiveDockGenerationJob[];
  activeJobsSummary: ActiveDockJobsSummary;
  beginDockJob: (input: BeginDockJobInput) => string;
  attachDockJobServerId: (clientJobId: string, generationId: string) => void;
  failDockJob: (clientJobId: string, errorMessage?: string | null) => void;
  removeDockJob: (clientJobId: string) => void;
  markDockJobSeen: (clientJobId: string) => void;
  subscribeDockJobEvents: (
    listener: (event: DockJobLifecycleEvent) => void,
  ) => () => void;
  /** Soft paywall state on FAB / tab / compose CTA → pricing overlay (`/pricing`). */
  needsCredits: boolean;
  reportNeedsCredits: (needs: boolean) => void;
  /** Model explicitly requested by an acquisition/product surface. */
  requestedModelId: string | null;
  requestModelSelection: (
    modelId: string,
    options?: {
      entrySource?: GenerateDockEntrySource;
      dockSurface?: GenerateDockSurface;
    }
  ) => void;
  /** Remember a model for the next compose open without opening the dock. */
  preferredModelId: string | null;
  preferModelId: (modelId: string) => void;
  clearRequestedModelSelection: () => void;
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
  /** Open dock on «Фотосессия» (ii-fotosessiya cluster). */
  seedPhotoshoot: (
    options?: {
      entrySource?: GenerateDockEntrySource;
      dockSurface?: GenerateDockSurface;
    }
  ) => void;
  /** Open dock on «Стикер» (`/stiker-iz-foto`). */
  seedSticker: (
    options?: {
      entrySource?: GenerateDockEntrySource;
      dockSurface?: GenerateDockSurface;
    }
  ) => void;
  /** Open dock on «Промт по фото» and start analyze from an in-memory payload. */
  seedPhotoPrompt: (
    args: { previewUrl: string; dataUrl: string },
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  /** SEO hub: selfie in image compose + pick catalog example (not photo_prompt analyze). */
  seedSeoSelfieCompose: (
    args: { previewUrl: string; dataUrl: string },
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  /** Catalog example on SEO compose — updates seed without remounting the panel. */
  applyComposeExamplePick: (pick: {
    cardId: string;
    promptText: string;
    examplePreviewUrl?: string | null;
  }) => void;
  /** Seed prompt from prompt card, then caller closes the card. */
  seedFromCard: (
    args: {
      promptText: string;
      cardId: string;
      intent?: GenerateDockComposeIntent;
      examplePreviewUrl?: string | null;
    },
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  seedAnimate: (
    args: {
      promptText?: string;
      parentGenerationId?: string | null;
      previewUrl?: string | null;
    },
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  /** Open dock on a completed generation (history video/image result chrome). */
  seedCompletedResult: (
    args: SeedCompletedResultArgs,
    options?: { entrySource?: GenerateDockEntrySource }
  ) => void;
  /**
   * Last completed frame for this dock session. Survives panel unmount so
   * tab/FAB reopen can show the photo without waiting for GET /generations.
   */
  lastDockResult: LastDockResult | null;
  rememberLastDockResult: (result: LastDockResult) => void;
  /**
   * User left result chrome («Повторить» / delete / result X). Survives panel
   * unmount so reopen does not restore the dismissed generation.
   */
  lastDockResultDismissed: boolean;
  dismissLastDockResult: () => void;
  /** New completed generation may be resumed on the next blank-dock open. */
  clearLastDockResultDismiss: () => void;
  /** After OAuth: reopen plate with overlay intent + pending seed (no data: photo). */
  restoreFromAuthReturn: (intent: GenerateDockComposeIntent) => void;
};

const EMPTY_JOBS_SUMMARY: ActiveDockJobsSummary = summarizeActiveDockJobs([]);
const DOCK_JOB_POLL_MS = 2500;

const GenerateDockContext = createContext<GenerateDockContextType>({
  seed: DEFAULT_SEED,
  seedToken: 0,
  generateDockV2Enabled: false,
  plateOpen: false,
  setPlateOpen: () => {},
  dockSurface: null,
  setDockSurface: () => {},
  historyRefreshToken: 0,
  notifyGenerationComplete: () => {},
  runBusy: false,
  runProgress: 0,
  reportRunProgress: () => {},
  activeJobs: [],
  activeJobsSummary: EMPTY_JOBS_SUMMARY,
  beginDockJob: () => "",
  attachDockJobServerId: () => {},
  failDockJob: () => {},
  removeDockJob: () => {},
  markDockJobSeen: () => {},
  subscribeDockJobEvents: () => () => {},
  needsCredits: false,
  reportNeedsCredits: () => {},
  requestedModelId: null,
  requestModelSelection: () => {},
  preferredModelId: null,
  preferModelId: () => {},
  clearRequestedModelSelection: () => {},
  focusBlank: () => {},
  seedBlankPrompt: () => {},
  seedPhotoshoot: () => {},
  seedSticker: () => {},
  seedPhotoPrompt: () => {},
  seedSeoSelfieCompose: () => {},
  applyComposeExamplePick: () => {},
  seedFromCard: () => {},
  seedAnimate: () => {},
  seedCompletedResult: () => {},
  lastDockResult: null,
  rememberLastDockResult: () => {},
  lastDockResultDismissed: false,
  dismissLastDockResult: () => {},
  clearLastDockResultDismiss: () => {},
  restoreFromAuthReturn: () => {},
});

export function GenerateDockProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const [seed, setSeed] = useState<GenerateDockSeed>(DEFAULT_SEED);
  const [seedToken, setSeedToken] = useState(0);
  const [plateOpen, setPlateOpen] = useState(false);
  const [cachedDockV2Enabled, setCachedDockV2Enabled] = useState<boolean>(
    () => readCachedGenerateConfig()?.generateDockV2Enabled ?? false,
  );
  const liveDockV2Enabled = Boolean(
    cachedDockV2Enabled || isInternalGenerateAllowlistedEmail(user?.email),
  );
  const [latchedDockV2Enabled, setLatchedDockV2Enabled] =
    useState<boolean>(liveDockV2Enabled);
  if (!plateOpen && latchedDockV2Enabled !== liveDockV2Enabled) {
    setLatchedDockV2Enabled(liveDockV2Enabled);
  }
  const generateDockV2Enabled = plateOpen
    ? latchedDockV2Enabled
    : liveDockV2Enabled;
  const prevAuthIdentityRef = useRef<string | undefined>(undefined);
  const [dockSurface, setDockSurface] = useState<GenerateDockSurface>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [manualRunBusy, setManualRunBusy] = useState(false);
  const [manualRunProgress, setManualRunProgress] = useState(0);
  const [activeJobs, setActiveJobs] = useState<ActiveDockGenerationJob[]>([]);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [requestedModelId, setRequestedModelId] = useState<string | null>(null);
  const [preferredModelId, setPreferredModelId] = useState<string | null>(null);
  const [lastDockResultDismissed, setLastDockResultDismissed] = useState(false);
  const [lastDockResult, setLastDockResult] = useState<LastDockResult | null>(null);
  const restoredPendingRef = useRef(false);
  const plateOpenRef = useRef(plateOpen);
  plateOpenRef.current = plateOpen;
  const activeJobsRef = useRef(activeJobs);
  activeJobsRef.current = activeJobs;
  const pollAbortMapRef = useRef<Map<string, AbortController>>(new Map());
  const stickerStyleByJobRef = useRef<Map<string, string | null>>(new Map());
  const jobEventListenersRef = useRef<
    Set<(event: DockJobLifecycleEvent) => void>
  >(new Set());

  useEffect(() => {
    const cached = readCachedGenerateConfig();
    if (cached) {
      setCachedDockV2Enabled(cached.generateDockV2Enabled === true);
    }
    return subscribeGenerateConfigSnapshot((snapshot) => {
      setCachedDockV2Enabled(snapshot.generateDockV2Enabled === true);
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const identity = isAuthed && user?.id ? user.id : "guest";
    if (prevAuthIdentityRef.current === undefined) {
      prevAuthIdentityRef.current = identity;
      return;
    }
    if (prevAuthIdentityRef.current !== identity) {
      prevAuthIdentityRef.current = identity;
      void fetchGenerateBootstrap({
        force: true,
        userIdHint: isAuthed ? user?.id ?? null : null,
      });
    }
  }, [authLoading, isAuthed, user?.id]);

  useEffect(() => {
    if (authLoading || restoredPendingRef.current) return;
    if (
      typeof window !== "undefined" &&
      !shouldRestorePendingGenerateDock(window.location.pathname)
    ) {
      return;
    }
    restoredPendingRef.current = true;
    const pending = consumePendingGenerateDock();
    const example = takePendingComposeExample();
    if (!pending && !example) return;
    const next = seedForAuthReturnDock(
      pending?.seed.intent ?? "resume",
      pending,
      example,
    );
    setSeed(next.seed);
    setSeedToken((token) => token + 1);
    setPlateOpen(true);
    setDockSurface(next.dockSurface);
  }, [authLoading]);

  const restoreFromAuthReturn = useCallback((intent: GenerateDockComposeIntent) => {
    if (
      typeof window !== "undefined" &&
      !shouldRestorePendingGenerateDock(window.location.pathname)
    ) {
      return;
    }
    restoredPendingRef.current = true;
    const next = seedForAuthReturnDock(
      intent,
      consumePendingGenerateDock(),
      takePendingComposeExample(),
    );
    setSeed(next.seed);
    setSeedToken((token) => token + 1);
    setLastDockResultDismissed(next.seed.intent === "photo_prompt");
    setPlateOpen(true);
    setDockSurface(next.dockSurface);
  }, []);

  useEffect(() => {
    if (!plateOpen || typeof window === "undefined") return;
    const existing = getLiveAuthReturnOverlay();
    const keepCard = shouldKeepCardAuthReturnOverlay(existing?.overlay);
    if (!keepCard) {
      const originPath = `${window.location.pathname}${window.location.search}`;
      setLiveAuthReturnOverlay({
        originPath,
        overlay: authReturnOverlayForGenerateDock(seed.intent),
      });
    }
    if (!isAuthed) {
      persistPendingGenerateDock({ seed, dockSurface });
    }
    return () => {
      if (keepCard) return;
      const live = getLiveAuthReturnOverlay();
      if (live?.overlay.type === "generate-dock") {
        setLiveAuthReturnOverlay(null);
      }
    };
  }, [dockSurface, isAuthed, plateOpen, seed]);

  const trackOpen = useCallback((entrySource: GenerateDockEntrySource) => {
    reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
      entry_source: entrySource,
    });
  }, []);

  const reportRunProgress = useCallback((busy: boolean, progress = 0) => {
    setManualRunBusy(busy);
    setManualRunProgress(busy ? Math.min(100, Math.max(0, progress)) : 0);
  }, []);

  const hasRunningJobs = useMemo(
    () => activeJobs.some(isDockJobActive),
    [activeJobs],
  );

  useEffect(() => {
    if (!hasRunningJobs) return;
    const timer = window.setInterval(() => {
      setActiveJobs((current) => {
        if (!current.some(isDockJobActive)) return current;
        return current.map((job) =>
          isDockJobActive(job)
            ? { ...job, progress: advanceSoftJobProgress(job.progress) }
            : job,
        );
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, [hasRunningJobs]);

  useEffect(() => {
    const aborts = pollAbortMapRef.current;
    return () => {
      for (const ctrl of aborts.values()) {
        ctrl.abort();
      }
      aborts.clear();
    };
  }, []);

  const emitDockJobEvent = useCallback((event: DockJobLifecycleEvent) => {
    for (const listener of jobEventListenersRef.current) {
      try {
        listener(event);
      } catch (err) {
        console.error("[generate-dock] job listener failed", err);
      }
    }
  }, []);

  const subscribeDockJobEvents = useCallback(
    (listener: (event: DockJobLifecycleEvent) => void) => {
      jobEventListenersRef.current.add(listener);
      return () => {
        jobEventListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const beginDockJob = useCallback((input: BeginDockJobInput): string => {
    const clientJobId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextJob: ActiveDockGenerationJob = {
      clientJobId,
      generationId: null,
      promptText: input.promptText.trim(),
      modality: input.modality,
      editKind: input.editKind ?? null,
      status: "starting",
      progress: 6,
      startedAtMs: Date.now(),
      completedAtMs: null,
      sourcePreviewUrl: input.sourcePreviewUrl ?? null,
      resultUrl: null,
      photoshootTileUrls: null,
      errorMessage: null,
      seen: false,
      listingVideoRepeat: input.listingVideoRepeat,
    };
    stickerStyleByJobRef.current.set(clientJobId, input.stickerStyleId ?? null);
    setActiveJobs((current) => pruneDockJobsHistory([nextJob, ...current]));
    return clientJobId;
  }, []);

  const failDockJob = useCallback(
    (clientJobId: string, errorMessage?: string | null) => {
      const ctrl = pollAbortMapRef.current.get(clientJobId);
      if (ctrl) {
        ctrl.abort();
        pollAbortMapRef.current.delete(clientJobId);
      }
      stickerStyleByJobRef.current.delete(clientJobId);
      let failedSnapshot: ActiveDockGenerationJob | null = null;
      setActiveJobs((current) => {
        const target = current.find((item) => item.clientJobId === clientJobId);
        if (!target) return current;
        if (!errorMessage) {
          return current.filter((item) => item.clientJobId !== clientJobId);
        }
        const updated: ActiveDockGenerationJob = {
          ...target,
          status: "failed",
          completedAtMs: Date.now(),
          errorMessage,
        };
        failedSnapshot = updated;
        return current.map((item) =>
          item.clientJobId === clientJobId ? updated : item,
        );
      });
      if (failedSnapshot) {
        emitDockJobEvent({ type: "failed", job: failedSnapshot });
      }
    },
    [emitDockJobEvent],
  );

  const removeDockJob = useCallback((clientJobId: string) => {
    const ctrl = pollAbortMapRef.current.get(clientJobId);
    if (ctrl) {
      ctrl.abort();
      pollAbortMapRef.current.delete(clientJobId);
    }
    stickerStyleByJobRef.current.delete(clientJobId);
    setActiveJobs((current) =>
      current.filter((item) => item.clientJobId !== clientJobId),
    );
  }, []);

  const markDockJobSeen = useCallback((clientJobId: string) => {
    setActiveJobs((current) =>
      current.map((item) =>
        item.clientJobId === clientJobId && !item.seen
          ? { ...item, seen: true }
          : item,
      ),
    );
  }, []);

  const reportNeedsCredits = useCallback((needs: boolean) => {
    setNeedsCredits(needs);
  }, []);

  const requestModelSelection = useCallback(
    (
      modelId: string,
      options?: {
        entrySource?: GenerateDockEntrySource;
        dockSurface?: GenerateDockSurface;
      }
    ) => {
      if (!modelId.trim()) {
        return;
      }
      const nextSurface = options?.dockSurface ?? null;
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: "",
        cardId: null,
        intent: "text",
      };
      setSeed(nextSeed);
      setSeedToken((token) => token + 1);
      setLastDockResultDismissed(true);
      setRequestedModelId(modelId);
      setPlateOpen(true);
      setDockSurface(nextSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({
          seed: nextSeed,
          dockSurface: nextSurface,
        });
      }
      trackOpen(options?.entrySource ?? "route");
    },
    [isAuthed, trackOpen]
  );

  const preferModelId = useCallback((modelId: string) => {
    const next = modelId.trim();
    if (!next) return;
    setPreferredModelId(next);
  }, []);

  const clearRequestedModelSelection = useCallback(() => {
    setRequestedModelId(null);
  }, []);

  const focusBlank = useCallback(
    (options?: { entrySource?: GenerateDockEntrySource }) => {
      // Avoid remounting the composer on every tab tap — remount = empty shell → fetch → second paint.
      if (!isResumeComposeSeed(seed)) {
        setSeed(DEFAULT_SEED);
        setSeedToken((token) => token + 1);
      }
      const nextSurface = resolveDockSurfaceForComposeEntry({
        intent: "resume",
        entrySource: options?.entrySource ?? "tab",
        hasRestorableLastResult: isRestorableLastDockResult(lastDockResult, {
          dismissedLastResult: lastDockResultDismissed,
        }),
        dockV2: generateDockV2Enabled,
      });
      setPlateOpen(true);
      setDockSurface(nextSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({
          seed: isResumeComposeSeed(seed) ? DEFAULT_SEED : seed,
          dockSurface: nextSurface,
        });
      }
      trackOpen(options?.entrySource ?? "tab");
    },
    [
      generateDockV2Enabled,
      isAuthed,
      lastDockResult,
      lastDockResultDismissed,
      seed,
      trackOpen,
    ]
  );

  const seedFromCard = useCallback(
    (
      args: {
        promptText: string;
        cardId: string;
        intent?: GenerateDockComposeIntent;
        examplePreviewUrl?: string | null;
      },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      const nextSeed = catalogCardRepeatSeed(args);
      const dockSurface = dockSurfaceForCardRepeat(
        nextSeed.intent === "animate" ? "animate" : "resume",
        { dockV2: generateDockV2Enabled },
      );
      setSeed(nextSeed);
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      setDockSurface(dockSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface });
      }
      trackOpen(options?.entrySource ?? "card");
    },
    [generateDockV2Enabled, isAuthed, trackOpen]
  );

  const seedAnimate = useCallback(
    (
      args: {
        promptText?: string;
        parentGenerationId?: string | null;
        previewUrl?: string | null;
      },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: (args.promptText || "Оживи изображение").trim(),
        cardId: null,
        intent: "animate",
        parentGenerationId: args.parentGenerationId || null,
        previewUrl: args.previewUrl || null,
      };
      setSeed(nextSeed);
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      setDockSurface(null);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface: null });
      }
      trackOpen(options?.entrySource ?? "tab");
    },
    [isAuthed, trackOpen]
  );

  const seedCompletedResult = useCallback(
    (
      args: SeedCompletedResultArgs,
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      const generationId = args.generationId.trim();
      const resultUrl = args.resultUrl.trim();
      if (!generationId || !resultUrl) return;
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: (args.promptText || "").trim(),
        cardId: null,
        intent: "result",
        previewUrl: resultUrl,
        resultGenerationId: generationId,
        resultModality: args.modality === "video" ? "video" : "image",
        isPublished: Boolean(args.isPublished),
        editKind: args.editKind || null,
        photoshootTileUrls: photoshootTileUrlsFromUnknown(args.photoshootTileUrls),
      };
      setLastDockResult({
        generationId,
        resultUrl,
        promptText: (args.promptText || "").trim(),
        modality: args.modality === "video" ? "video" : "image",
        isPublished: Boolean(args.isPublished),
        editKind: args.editKind || null,
        photoshootTileUrls: photoshootTileUrlsFromUnknown(args.photoshootTileUrls),
      });
      setLastDockResultDismissed(false);
      setSeed(nextSeed);
      setSeedToken((token) => token + 1);
      setPlateOpen(true);
      setDockSurface(null);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface: null });
      }
      trackOpen(options?.entrySource ?? "card");
    },
    [isAuthed, trackOpen]
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
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: promptText.trim(),
        cardId: null,
        intent: options?.intent ?? "text",
      };
      const nextSurface = resolveDockSurfaceForComposeEntry({
        intent: nextSeed.intent,
        entrySource: options?.entrySource,
        explicit: options?.dockSurface,
        dockV2: generateDockV2Enabled,
      });
      if (!sameGenerateDockComposeIdentity(seed, nextSeed)) {
        setSeedToken((token) => token + 1);
      }
      setSeed(nextSeed);
      setPlateOpen(true);
      setDockSurface(nextSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface: nextSurface });
      }
      trackOpen(options?.entrySource ?? "route");
    },
    [generateDockV2Enabled, isAuthed, seed, trackOpen]
  );

  const seedPhotoshoot = useCallback(
    (
      options?: {
        entrySource?: GenerateDockEntrySource;
        dockSurface?: GenerateDockSurface;
      }
    ) => {
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: "",
        cardId: null,
        intent: "photoshoot",
      };
      const nextSurface = resolveDockSurfaceForComposeEntry({
        intent: "photoshoot",
        entrySource: options?.entrySource,
        explicit: options?.dockSurface,
        hasRestorableLastResult: isRestorableLastDockResult(lastDockResult, {
          dismissedLastResult: lastDockResultDismissed,
        }),
        dockV2: generateDockV2Enabled,
      });
      if (!sameGenerateDockComposeIdentity(seed, nextSeed)) {
        setSeedToken((token) => token + 1);
      }
      setSeed(nextSeed);
      setPlateOpen(true);
      setDockSurface(nextSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface: nextSurface });
      }
      trackOpen(options?.entrySource ?? "route");
    },
    [
      generateDockV2Enabled,
      isAuthed,
      lastDockResult,
      lastDockResultDismissed,
      seed,
      trackOpen,
    ]
  );

  const seedSticker = useCallback(
    (
      options?: {
        entrySource?: GenerateDockEntrySource;
        dockSurface?: GenerateDockSurface;
      }
    ) => {
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: "",
        cardId: null,
        intent: "sticker",
      };
      const nextSurface = resolveDockSurfaceForComposeEntry({
        intent: "sticker",
        entrySource: options?.entrySource,
        explicit: options?.dockSurface,
        hasRestorableLastResult: isRestorableLastDockResult(lastDockResult, {
          dismissedLastResult: lastDockResultDismissed,
        }),
        dockV2: generateDockV2Enabled,
      });
      if (!sameGenerateDockComposeIdentity(seed, nextSeed)) {
        setSeedToken((token) => token + 1);
      }
      setSeed(nextSeed);
      setPlateOpen(true);
      setDockSurface(nextSurface);
      if (!isAuthed) {
        persistPendingGenerateDock({ seed: nextSeed, dockSurface: nextSurface });
      }
      trackOpen(options?.entrySource ?? "route");
    },
    [
      generateDockV2Enabled,
      isAuthed,
      lastDockResult,
      lastDockResultDismissed,
      seed,
      trackOpen,
    ]
  );

  const seedPhotoPrompt = useCallback(
    (
      args: { previewUrl: string; dataUrl: string },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      const previewUrl = args.previewUrl.trim();
      const dataUrl = args.dataUrl.trim();
      if (!previewUrl || !dataUrl) return;
      setPendingPhotoPrompt({ previewUrl, dataUrl });
      const nextSeed: GenerateDockSeed = {
        source: "blank",
        promptText: "",
        cardId: null,
        intent: "photo_prompt",
        previewUrl,
      };
      setSeed(nextSeed);
      setSeedToken((token) => token + 1);
      setLastDockResultDismissed(true);
      setPlateOpen(true);
      setDockSurface(null);
      trackOpen(options?.entrySource ?? "foto_v_promt");
    },
    [trackOpen]
  );

  const seedSeoSelfieCompose = useCallback(
    (
      args: { previewUrl: string; dataUrl: string },
      options?: { entrySource?: GenerateDockEntrySource }
    ) => {
      const previewUrl = args.previewUrl.trim();
      const dataUrl = args.dataUrl.trim();
      if (!previewUrl || !dataUrl) return;
      setPendingPhotoPrompt({ previewUrl, dataUrl });
      setSeed((current) => {
        const next = applySeoSelfieToSeed(current, { previewUrl });
        if (!isAuthed) {
          persistPendingGenerateDock({
            seed: next,
            dockSurface: "example",
          });
        }
        return next;
      });
      setSeedToken((token) => token + 1);
      setLastDockResultDismissed(true);
      setPlateOpen(true);
      setDockSurface("example");
      trackOpen(options?.entrySource ?? "route");
    },
    [isAuthed, trackOpen]
  );

  const applyComposeExamplePick = useCallback(
    (pick: {
      cardId: string;
      promptText: string;
      examplePreviewUrl?: string | null;
    }) => {
      setSeed((current) => {
        const next = applyComposeExampleToSeed(current, pick);
        if (!isAuthed) {
          persistPendingGenerateDock({
            seed: next,
            dockSurface,
          });
        }
        return next;
      });
    },
    [dockSurface, isAuthed]
  );

  const notifyGenerationComplete = useCallback(() => {
    setHistoryRefreshToken((token) => token + 1);
  }, []);

  const rememberLastDockResult = useCallback((result: LastDockResult) => {
    const generationId = result.generationId.trim();
    const resultUrl = result.resultUrl.trim();
    if (!generationId || !resultUrl) return;
    setLastDockResult({
      generationId,
      resultUrl,
      promptText: result.promptText.trim(),
      modality: result.modality === "video" ? "video" : "image",
      isPublished: Boolean(result.isPublished),
      editKind: result.editKind || null,
      photoshootTileUrls: photoshootTileUrlsFromUnknown(result.photoshootTileUrls),
    });
    setLastDockResultDismissed(false);
  }, []);

  const dismissLastDockResult = useCallback(() => {
    setLastDockResultDismissed(true);
    setLastDockResult(null);
  }, []);

  const clearLastDockResultDismiss = useCallback(() => {
    setLastDockResultDismissed(false);
  }, []);

  const attachDockJobServerId = useCallback(
    (clientJobId: string, initialGenerationId: string) => {
      const existingCtrl = pollAbortMapRef.current.get(clientJobId);
      if (existingCtrl) existingCtrl.abort();
      const abortController = new AbortController();
      pollAbortMapRef.current.set(clientJobId, abortController);

      setActiveJobs((current) =>
        current.map((job) =>
          job.clientJobId === clientJobId
            ? {
                ...job,
                generationId: initialGenerationId,
                status: "running",
                progress: Math.max(job.progress, 8),
              }
            : job,
        ),
      );

      void (async () => {
        let pollGenerationId = initialGenerationId;
        let listingRepeatFollowupWaitStarted = 0;
        let tilesWaitStarted = 0;

        try {
          while (!abortController.signal.aborted) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, DOCK_JOB_POLL_MS),
            );
            if (abortController.signal.aborted) return;

            let pollRes: Response;
            try {
              pollRes = await fetch(`/api/generations/${pollGenerationId}`, {
                credentials: "include",
                signal: abortController.signal,
              });
            } catch {
              if (abortController.signal.aborted) return;
              continue;
            }

            const poll = (await pollRes.json().catch(() => ({}))) as {
              status?: string;
              progress?: number;
              resultUrl?: string;
              photoshootTileUrls?: string[] | null;
              errorMessage?: string;
              error?: string;
              modality?: string;
              pipelineSpec?: { kind?: string } | null;
              followupGenerationId?: string | null;
            };

            if (!pollRes.ok) {
              if (pollRes.status >= 500) continue;
              throw new Error(
                poll.errorMessage || poll.error || "Ошибка статуса генерации",
              );
            }

            if (typeof poll.progress === "number") {
              const clamped = Math.min(96, poll.progress);
              setActiveJobs((current) =>
                current.map((job) =>
                  job.clientJobId === clientJobId
                    ? { ...job, progress: Math.max(job.progress, clamped) }
                    : job,
                ),
              );
            }

            const liveJob = activeJobsRef.current.find(
              (item) => item.clientJobId === clientJobId,
            );
            if (!liveJob) return;

            if (poll.status === "completed") {
              if (
                liveJob.listingVideoRepeat &&
                poll.pipelineSpec?.kind === LISTING_VIDEO_REPEAT_KIND &&
                poll.modality !== "video"
              ) {
                if (poll.followupGenerationId) {
                  pollGenerationId = poll.followupGenerationId;
                  listingRepeatFollowupWaitStarted = 0;
                  setActiveJobs((current) =>
                    current.map((job) =>
                      job.clientJobId === clientJobId
                        ? {
                            ...job,
                            generationId: poll.followupGenerationId!,
                            modality: "video",
                            progress: Math.max(job.progress, 55),
                          }
                        : job,
                    ),
                  );
                  continue;
                }
                listingRepeatFollowupWaitStarted ||= Date.now();
                if (Date.now() - listingRepeatFollowupWaitStarted > 45_000) {
                  throw new Error(
                    "Фото готово, но видео не запустилось. Нажмите «Оживить» на кадре.",
                  );
                }
                continue;
              }

              const isPhotoshoot = liveJob.editKind === PHOTOSHOOT_EDIT_KIND;
              const isStickerPack =
                liveJob.editKind === STICKER_PACK_EDIT_KIND;
              const isSticker = liveJob.editKind === STICKER_EDIT_KIND;
              const tiles = sidecarTileUrls(
                isPhotoshoot
                  ? PHOTOSHOOT_EDIT_KIND
                  : isStickerPack
                    ? STICKER_PACK_EDIT_KIND
                    : null,
                poll.photoshootTileUrls,
              );
              if ((isPhotoshoot || isStickerPack) && !tiles) {
                tilesWaitStarted ||= Date.now();
                if (Date.now() - tilesWaitStarted > 45_000) {
                  throw new Error(
                    isPhotoshoot
                      ? "Кадры фотосессии не готовы"
                      : "Стикеры пака не готовы",
                  );
                }
                continue;
              }

              const nextResultUrl = tiles ? tiles[0] : poll.resultUrl;
              if (!nextResultUrl) continue;

              const nextModality =
                poll.modality === "video" || liveJob.modality === "video"
                  ? "video"
                  : "image";
              const stickerStyle =
                stickerStyleByJobRef.current.get(clientJobId) ?? null;
              stickerStyleByJobRef.current.delete(clientJobId);
              pollAbortMapRef.current.delete(clientJobId);

              requestCreditBalanceRefresh();
              notifyGenerationComplete();
              rememberLastDockResult({
                generationId: pollGenerationId,
                resultUrl: nextResultUrl,
                promptText: liveJob.promptText,
                modality: nextModality,
                isPublished: false,
                editKind: liveJob.editKind ?? undefined,
                photoshootTileUrls: tiles,
              });

              if (isPhotoshoot) {
                reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_READY);
              } else if ((isSticker || isStickerPack) && stickerStyle) {
                reachYandexMetrikaGoal(YM_GOAL_STICKER_DONE, {
                  style: stickerStyle,
                });
              }

              const completedJob: ActiveDockGenerationJob = {
                ...liveJob,
                generationId: pollGenerationId,
                modality: nextModality,
                status: "completed",
                progress: 100,
                completedAtMs: Date.now(),
                resultUrl: nextResultUrl,
                photoshootTileUrls: tiles,
                errorMessage: null,
                seen: false,
              };

              setActiveJobs((current) =>
                pruneDockJobsHistory(
                  current.map((item) =>
                    item.clientJobId === clientJobId ? completedJob : item,
                  ),
                ),
              );
              emitDockJobEvent({ type: "completed", job: completedJob });
              return;
            }

            if (poll.status === "failed") {
              requestCreditBalanceRefresh();
              if (liveJob.editKind === PHOTOSHOOT_EDIT_KIND) {
                reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_FAIL);
              }
              throw new Error(poll.errorMessage || "Генерация не удалась");
            }
          }
        } catch (err) {
          if (abortController.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : "Ошибка генерации";
          failDockJob(clientJobId, message);
        } finally {
          if (pollAbortMapRef.current.get(clientJobId) === abortController) {
            pollAbortMapRef.current.delete(clientJobId);
          }
        }
      })();
    },
    [
      emitDockJobEvent,
      failDockJob,
      notifyGenerationComplete,
      rememberLastDockResult,
    ],
  );

  const activeJobsSummary = useMemo(
    () => summarizeActiveDockJobs(activeJobs),
    [activeJobs],
  );

  const runBusy =
    (generateDockV2Enabled && activeJobsSummary.runBusy) || manualRunBusy;
  const runProgress =
    generateDockV2Enabled && activeJobsSummary.runBusy
      ? activeJobsSummary.displayProgress
      : manualRunProgress;

  const value = useMemo(
    () => ({
      seed,
      seedToken,
      generateDockV2Enabled,
      plateOpen,
      setPlateOpen,
      dockSurface,
      setDockSurface,
      historyRefreshToken,
      notifyGenerationComplete,
      runBusy,
      runProgress,
      reportRunProgress,
      activeJobs,
      activeJobsSummary,
      beginDockJob,
      attachDockJobServerId,
      failDockJob,
      removeDockJob,
      markDockJobSeen,
      subscribeDockJobEvents,
      needsCredits,
      reportNeedsCredits,
      requestedModelId,
      requestModelSelection,
      preferredModelId,
      preferModelId,
      clearRequestedModelSelection,
      focusBlank,
      seedBlankPrompt,
      seedPhotoshoot,
      seedSticker,
      seedPhotoPrompt,
      seedSeoSelfieCompose,
      applyComposeExamplePick,
      seedFromCard,
      seedAnimate,
      seedCompletedResult,
      lastDockResult,
      rememberLastDockResult,
      lastDockResultDismissed,
      dismissLastDockResult,
      clearLastDockResultDismiss,
      restoreFromAuthReturn,
    }),
    [
      seed,
      seedToken,
      generateDockV2Enabled,
      plateOpen,
      dockSurface,
      historyRefreshToken,
      notifyGenerationComplete,
      runBusy,
      runProgress,
      reportRunProgress,
      activeJobs,
      activeJobsSummary,
      beginDockJob,
      attachDockJobServerId,
      failDockJob,
      removeDockJob,
      markDockJobSeen,
      subscribeDockJobEvents,
      needsCredits,
      reportNeedsCredits,
      requestedModelId,
      requestModelSelection,
      preferredModelId,
      preferModelId,
      clearRequestedModelSelection,
      focusBlank,
      seedBlankPrompt,
      seedPhotoshoot,
      seedSticker,
      seedPhotoPrompt,
      seedSeoSelfieCompose,
      applyComposeExamplePick,
      seedFromCard,
      seedAnimate,
      seedCompletedResult,
      lastDockResult,
      rememberLastDockResult,
      lastDockResultDismissed,
      dismissLastDockResult,
      clearLastDockResultDismiss,
      restoreFromAuthReturn,
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

