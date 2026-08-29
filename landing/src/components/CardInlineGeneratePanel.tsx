"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  CREDIT_BALANCE_REFRESH_EVENT,
  requestCreditBalanceRefresh,
} from "@/lib/credit-balance-events";
import {
  FALLBACK_VIDEO_GENERATION_MODELS,
  GENERATION_MODEL_DISPLAY,
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
} from "@/lib/generation-model-labels";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { browserAcquisitionHeaders } from "@/lib/acquisition-client-events";
import {
  GenerationCardMenu,
  type GenerationMenuAction,
} from "@/components/GenerationCardMenu";
import {
  downloadGenerationResult,
  shareGenerationResult,
} from "@/lib/generation-result-client-actions";
import { getGenerationPromptRemixUrl } from "@/lib/foto-v-promt-config";
import { PROMPT_REMIX_COPY } from "@/lib/foto-v-promt-copy";
import {
  isGenerateComposeJobBusy,
  isPrimaryOverlayDismissPointer,
  type GenerateComposeJobPhase,
} from "@/lib/generate-compose-job";
import {
  isCompletedResultSeed,
  photoshootTileUrlsFromUnknown,
  shouldAttachLibraryPhotos,
  shouldHydrateLastDockResult as seedAllowsLastDockHydrate,
} from "@/lib/generate-dock-seed";
import { useAuth } from "@/context/AuthContext";
import {
  useGenerateDock,
  type GenerateDockSurface,
} from "@/context/GenerateDockContext";
import { GenerationResultBackdrop } from "@/components/generate/GenerationResultBackdrop";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import { GenerationResultActionRail } from "@/components/generate/GenerationResultActionRail";
import {
  CameraOrbitOverlay,
  type CameraSceneShot,
} from "@/components/generate/CameraOrbitOverlay";
import {
  PhotoshootFrameFilm,
  PhotoshootOverlay,
} from "@/components/generate/PhotoshootOverlay";
import { PricingEntryLink } from "@/components/PricingEntryLink";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_CAMERA_ORBIT_BUSY,
  YM_GOAL_CAMERA_ORBIT_DISABLED,
  YM_GOAL_CAMERA_ORBIT_FAIL,
  YM_GOAL_CAMERA_ORBIT_NO_CREDITS,
  YM_GOAL_CAMERA_ORBIT_READY,
  YM_GOAL_CAMERA_ORBIT_SUBMIT,
  YM_GOAL_PHOTOSHOOT_BUSY,
  YM_GOAL_PHOTOSHOOT_DISABLED,
  YM_GOAL_PHOTOSHOOT_FAIL,
  YM_GOAL_PHOTOSHOOT_NO_CREDITS,
  YM_GOAL_PHOTOSHOOT_OPEN,
  YM_GOAL_PHOTOSHOOT_READY,
  YM_GOAL_PHOTOSHOOT_SUBMIT,
  YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED,
  YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_PROMPT,
  DEFAULT_VIDEO_RESOLUTION,
  IMAGE_GENERATION_MODALITY,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_GENERATION_MODALITY,
  VIDEO_RESOLUTION_OPTIONS,
  clampImageSizeForModel,
  imageSizeOptionsForModel,
  isVeoLiteVideoModel,
  videoDurationOptionsForModel,
} from "@/lib/generation/image-options";
import {
  composeVideoScenarioKey,
  emptyComposePromptStash,
  switchComposeModalityPrompt,
} from "@/lib/compose-modality-prompt";
import {
  apiModalityForComposeMode,
  canEnqueueWhilePhotoshootSelected,
  composeGenerateCtaLabel,
  composeGenerateCtaShowsModelName,
  composeModeTileLabel,
  nextComposeModeTileSheet,
  promptModalityForComposeMode,
  rememberCompletedImageResult,
  resolvePhotoshootLibraryFrame,
  resolvePhotoshootReadyFrame,
  PHOTOSHOOT_NEEDS_LIBRARY_PHOTO,
  type GenerateComposeMode,
  type PhotoshootReadyFrame,
} from "@/lib/generate-compose-mode";
import {
  ANIMATE_SCENARIO_PLACEHOLDER,
  isGenericVideoPrompt,
} from "@/lib/video-animate-scenario";
import {
  calculateVideoCreditCost,
  videoDurationExtraCredits,
} from "@/lib/video-generation-contract";
import {
  readCachedVideoAnimateEnabled,
  writeCachedVideoAnimateEnabled,
} from "@/lib/video-animate-availability";
import {
  readCachedCameraOrbitEnabled,
  writeCachedCameraOrbitEnabled,
} from "@/lib/camera-orbit-availability";
import {
  readCachedPhotoshootEnabled,
  writeCachedPhotoshootEnabled,
} from "@/lib/photoshoot-availability";
import {
  CAMERA_ORBIT_EDIT_KIND,
  type CameraPose,
} from "@/lib/camera-orbit";
import {
  PHOTOSHOOT_CTA_LABEL,
  PHOTOSHOOT_CREDIT_COST,
  PHOTOSHOOT_EDIT_KIND,
  isPhotoshootEditKind,
  photoshootCtaDetail,
  photoshootTileIndexForUrl,
  resolvePhotoshootSheetAspect,
  type PhotoshootTileIndex,
} from "@/lib/photoshoot";
import {
  parseStoredGenerationPreferences,
  pickFresherPreferences,
  readCachedGenerationPreferences,
  resolveComposerPreferences,
  writeCachedGenerationPreferences,
  type StoredGenerationPreferences,
} from "@/lib/generation-preferences";
import { resolveVideoEnqueueParentGenerationId } from "@/lib/user-generation-photos";

const BLANK_PROMPT_PLACEHOLDER = "Опишите изображение или референс";

type ModelOpt = { id: string; label: string; cost: number };
type RatioOpt = { value: string; label: string };
type SizeOpt = { value: string; label: string };
type UserPhoto = {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

type Phase = GenerateComposeJobPhase;

type Props = {
  /** card = remix from prompt card; blank = freeform compose (/generate, tab) */
  source?: "card" | "blank";
  /**
   * fullscreen — immersive card/result UI;
   * dock — floating bottom composer over listing (blank /generate).
   */
  chrome?: "fullscreen" | "dock";
  generationSurface?: "prompt_card" | "seo_page";
  promptText?: string;
  cardId?: string | null;
  onBack: () => void;
  /** desktop | mobile visual density */
  layout?: "desktop" | "mobile";
  /** Called when a blank dock generation finishes (refresh listing). */
  onGenerationComplete?: () => void;
  /**
   * Controlled dock surface (blank /generate). Parent stretches the floating
   * sheet for prompt / photos / model — no separate viewport overlays.
   */
  dockSurface?: GenerateDockSurface;
  onDockSurfaceChange?: (surface: GenerateDockSurface) => void;
  /**
   * Dock parent: keep plate tall + sticky (no scroll-collapse) while result
   * chrome is shown or a generation is in flight.
   */
  onDockResultChromeChange?: (active: boolean) => void;
};

const POLL_MS = 2500;

export function CardInlineGeneratePanel({
  source = "card",
  chrome = "fullscreen",
  promptText = "",
  cardId = null,
  onBack,
  layout = "desktop",
  onGenerationComplete,
  dockSurface: dockSurfaceProp,
  onDockSurfaceChange,
  onDockResultChromeChange,
  generationSurface,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, openAuthModal } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const {
    setPlateOpen: setDockPlateOpen,
    reportRunProgress,
    reportNeedsCredits,
    requestedModelId,
    seed,
    seedAnimate,
    lastDockResultDismissed,
    dismissLastDockResult,
    clearLastDockResultDismiss,
  } = useGenerateDock();
  const isDock = chrome === "dock";
  const isBlank = source === "blank";
  const resolvedCardId = cardId;
  const resolvedGenerationSurface =
    generationSurface || "prompt_card";
  const dockControlled = isDock && typeof onDockSurfaceChange === "function";

  const [models, setModels] = useState<ModelOpt[]>([]);
  const [aspectRatios, setAspectRatios] = useState<RatioOpt[]>([]);
  const [imageSizes, setImageSizes] = useState<SizeOpt[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash-image");
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_IMAGE_ASPECT_RATIO);
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE);
  const [configError, setConfigError] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(10);
  const [composeMode, setComposeMode] = useState<GenerateComposeMode>(
    seed.intent === "animate" ? "video" : "image"
  );
  const [videoEnabled, setVideoEnabled] = useState(
    () => readCachedVideoAnimateEnabled() === true
  );
  const [cameraOrbitEnabled, setCameraOrbitEnabled] = useState(
    () => readCachedCameraOrbitEnabled() === true
  );
  const [cameraOrbitOpen, setCameraOrbitOpen] = useState(false);
  const [cameraOrbitCreditCost, setCameraOrbitCreditCost] = useState(10);
  const [photoshootEnabled, setPhotoshootEnabled] = useState(
    () => readCachedPhotoshootEnabled() === true
  );
  const [photoshootOpen, setPhotoshootOpen] = useState(false);
  const [photoshootSourceId, setPhotoshootSourceId] = useState<string | null>(null);
  const [photoshootSourceUrl, setPhotoshootSourceUrl] = useState<string | null>(null);
  const [photoshootLibraryPath, setPhotoshootLibraryPath] = useState<string | null>(null);
  const [photoshootTileUrls, setPhotoshootTileUrls] = useState<string[] | null>(
    () => photoshootTileUrlsFromUnknown(seed.photoshootTileUrls)
  );
  const [resultEditKind, setResultEditKind] = useState<string | null>(
    () => seed.editKind || null
  );
  const photoshootDismissedRef = useRef(false);
  const photoshootPollAbortRef = useRef<AbortController | null>(null);
  const [videoModels, setVideoModels] = useState<ModelOpt[]>([]);
  const [videoModel, setVideoModel] = useState(
    () =>
      (user?.id ? readCachedGenerationPreferences(user.id)?.videoModel : null) ||
      DEFAULT_VIDEO_MODEL,
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(
    () =>
      user?.id
        ? readCachedGenerationPreferences(user.id)?.videoDurationSeconds ??
          DEFAULT_VIDEO_DURATION_SECONDS
        : DEFAULT_VIDEO_DURATION_SECONDS,
  );
  const seededResult = isCompletedResultSeed(seed);
  const [resultModality, setResultModality] = useState<"image" | "video">(
    seed.resultModality === "video" ? "video" : "image"
  );
  const [animateParentId, setAnimateParentId] = useState<string | null>(
    seed.parentGenerationId || null
  );
  const [animatePreviewUrl, setAnimatePreviewUrl] = useState<string | null>(
    seed.previewUrl || null
  );
  const [scenarioLoading, setScenarioLoading] = useState(seed.intent === "animate");
  const scenarioRequestRef = useRef(0);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const prefsDirtyRef = useRef(false);
  const skipNextPrefsPersistRef = useRef(false);
  const seedIntentRef = useRef(seed.intent);
  seedIntentRef.current = seed.intent;
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>(seededResult ? "done" : "idle");
  const phaseRef = useRef<Phase>(seededResult ? "done" : "idle");
  const generateInFlightRef = useRef(false);
  const [starting, setStarting] = useState(false);
  /**
   * After «Повторить» / delete — do not re-apply last completed result from the
   * in-flight mount hydrate fetch. Persist dismiss in GenerateDockContext so a
   * later remount (close/reopen, auth flicker) also skips last-result hydrate.
   */
  const suppressResultHydrateRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(
    seededResult ? seed.previewUrl || null : null
  );
  const [resultPreviewOpen, setResultPreviewOpen] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(
    seededResult ? seed.resultGenerationId || null : null
  );
  resultUrlRef.current = resultUrl;
  generationIdRef.current = generationId;
  const [draftPrompt, setDraftPrompt] = useState(promptText);
  const draftPromptRef = useRef(draftPrompt);
  draftPromptRef.current = draftPrompt;
  const composeModeRef = useRef(composeMode);
  composeModeRef.current = composeMode;
  const lastImageResultRef = useRef<PhotoshootReadyFrame | null>(
    rememberCompletedImageResult({
      generationId: seededResult ? seed.resultGenerationId : null,
      resultUrl: seededResult ? seed.previewUrl : null,
      resultModality: seed.resultModality === "video" ? "video" : "image",
    })
  );
  const promptStashRef = useRef(
    emptyComposePromptStash({
      imagePrompt: seed.intent === "animate" ? "" : promptText,
      videoPrompt:
        seed.intent === "animate" &&
        seed.promptText.trim() &&
        !isGenericVideoPrompt(seed.promptText)
          ? seed.promptText
          : "",
      lastScenarioKey:
        seed.intent === "animate"
          ? composeVideoScenarioKey({
              parentGenerationId: seed.parentGenerationId,
            })
          : null,
    })
  );

  const rememberVideoPrompt = (next: string) => {
    setDraftPrompt(next);
    if (composeModeRef.current !== "video") return;
    promptStashRef.current = {
      ...promptStashRef.current,
      videoPrompt: next,
    };
  };

  const loadAnimateScenario = useCallback(
    async (input: {
      parentGenerationId?: string | null;
      photoStoragePath?: string | null;
      sourcePrompt?: string | null;
    }) => {
      if (!isAuthed || (!input.parentGenerationId && !input.photoStoragePath)) {
        setScenarioLoading(false);
        if (!draftPromptRef.current.trim()) rememberVideoPrompt(DEFAULT_VIDEO_PROMPT);
        return;
      }
      const requestId = ++scenarioRequestRef.current;
      setScenarioLoading(true);
      try {
        const res = await fetch("/api/generate/animate-scenario", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentGenerationId: input.parentGenerationId || undefined,
            photoStoragePath: input.photoStoragePath || undefined,
            sourcePrompt: input.sourcePrompt || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { scenario?: string };
        if (requestId !== scenarioRequestRef.current) return;
        if (composeModeRef.current !== "video") return;
        const scenario = typeof data.scenario === "string" ? data.scenario.trim() : "";
        const current = draftPromptRef.current.trim();
        if (res.ok && scenario && (!current || isGenericVideoPrompt(current))) {
          rememberVideoPrompt(scenario);
        } else if (!current || isGenericVideoPrompt(current)) {
          rememberVideoPrompt(DEFAULT_VIDEO_PROMPT);
        }
      } catch {
        if (requestId !== scenarioRequestRef.current) return;
        if (composeModeRef.current !== "video") return;
        const current = draftPromptRef.current.trim();
        if (!current || isGenericVideoPrompt(current)) {
          rememberVideoPrompt(DEFAULT_VIDEO_PROMPT);
        }
      } finally {
        if (requestId === scenarioRequestRef.current) setScenarioLoading(false);
      }
    },
    [isAuthed]
  );
  const [submittedPrompt, setSubmittedPrompt] = useState(
    seededResult ? seed.promptText.trim() : ""
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [isPublished, setIsPublished] = useState(Boolean(seededResult && seed.isPublished));
  const [toast, setToast] = useState("");
  const [expandedControlLocal, setExpandedControlLocal] = useState<
    "photos" | "model" | null
  >(null);
  const [promptExpandedLocal, setPromptExpandedLocal] = useState(false);

  const activeDockSurface: GenerateDockSurface = dockControlled
    ? (dockSurfaceProp ?? null)
    : promptExpandedLocal
      ? "prompt"
      : expandedControlLocal;

  const promptExpanded = activeDockSurface === "prompt";
  const expandedControl =
    activeDockSurface === "photos" || activeDockSurface === "model"
      ? activeDockSurface
      : null;

  const setDockSurface = useCallback(
    (next: GenerateDockSurface | ((prev: GenerateDockSurface) => GenerateDockSurface)) => {
      const value = typeof next === "function" ? next(activeDockSurface) : next;
      if (dockControlled) {
        onDockSurfaceChange?.(value);
        return;
      }
      if (value === "prompt") {
        setExpandedControlLocal(null);
        setPromptExpandedLocal(true);
      } else if (value === "photos" || value === "model") {
        setPromptExpandedLocal(false);
        setExpandedControlLocal(value);
      } else {
        setPromptExpandedLocal(false);
        setExpandedControlLocal(null);
      }
    },
    [activeDockSurface, dockControlled, onDockSurfaceChange]
  );

  const setPromptExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(promptExpanded) : next;
      setDockSurface(value ? "prompt" : null);
    },
    [promptExpanded, setDockSurface]
  );

  const setExpandedControl = useCallback(
    (
      next:
        | "photos"
        | "model"
        | null
        | ((prev: "photos" | "model" | null) => "photos" | "model" | null)
    ) => {
      const prev = expandedControl;
      const value = typeof next === "function" ? next(prev) : next;
      setDockSurface(value);
    },
    [expandedControl, setDockSurface]
  );

  const enterVideoCompose = useCallback(
    (input: {
      parentGenerationId?: string | null;
      previewUrl?: string | null;
      photoStoragePath?: string | null;
      scenarioKey: string | null;
      sourcePrompt?: string;
    }) => {
      const switched = switchComposeModalityPrompt({
        from: promptModalityForComposeMode(composeModeRef.current),
        to: "video",
        currentDraft: draftPromptRef.current,
        stash: promptStashRef.current,
        scenarioKey: input.scenarioKey,
      });
      promptStashRef.current = switched.stash;
      setDraftPrompt(switched.draft);
      setComposeMode("video");
      setAnimateParentId(input.parentGenerationId || null);
      setAnimatePreviewUrl(input.previewUrl || null);
      setError("");
      if (switched.shouldLoadScenario) {
        void loadAnimateScenario({
          parentGenerationId: input.parentGenerationId,
          photoStoragePath: input.photoStoragePath,
          sourcePrompt: input.sourcePrompt ?? switched.stash.imagePrompt,
        });
      }
    },
    [loadAnimateScenario]
  );

  const restoreImagePromptFromVideo = useCallback(() => {
    if (composeModeRef.current !== "video") return;
    const switched = switchComposeModalityPrompt({
      from: "video",
      to: "image",
      currentDraft: draftPromptRef.current,
      stash: promptStashRef.current,
      scenarioKey: promptStashRef.current.lastScenarioKey,
    });
    promptStashRef.current = switched.stash;
    scenarioRequestRef.current += 1;
    setScenarioLoading(false);
    setDraftPrompt(switched.draft);
    setAnimateParentId(null);
    setAnimatePreviewUrl(null);
  }, []);

  const enterImageCompose = useCallback(() => {
    restoreImagePromptFromVideo();
    setComposeMode("image");
    setError("");
  }, [restoreImagePromptFromVideo]);

  const enterPhotoshootCompose = useCallback(() => {
    restoreImagePromptFromVideo();
    setComposeMode("photoshoot");
  }, [restoreImagePromptFromVideo]);

  const [changeRequest, setChangeRequest] = useState("");
  const [remixing, setRemixing] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!preferencesHydrated || !requestedModelId) return;
    const selected = models.find((item) => item.id === requestedModelId);
    if (!selected) return;

    setModel(requestedModelId);
    setExpandedControl(null);
    setDockPlateOpen(true);
    setToast(`${selected.label} выбрана`);
  }, [
    models,
    preferencesHydrated,
    requestedModelId,
    setDockPlateOpen,
    setExpandedControl,
  ]);

  useEffect(() => {
    if (!resultUrl) setResultPreviewOpen(false);
  }, [resultUrl]);

  useEffect(() => {
    if (!resultPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resultPreviewOpen]);

  /** Soft-advance CTA fill between poll ticks so progress is always visible. */
  useEffect(() => {
    if (phase !== "uploading" && phase !== "generating") return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const step = current < 40 ? 2.5 : current < 70 ? 1.2 : 0.45;
        return Math.min(92, current + step);
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    setDraftPrompt(promptText);
  }, [cardId, promptText]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const shouldHydrateLastDockResult = Boolean(
          isDock &&
            isBlank &&
            isAuthed &&
            seedAllowsLastDockHydrate(seed, {
              dismissedLastResult: lastDockResultDismissed,
            })
        );
        const [configRes, videoConfigRes, photosRes, preferencesRes, meRes, generationsRes] =
          await Promise.all([
            fetch(`/api/generation-config?modality=${IMAGE_GENERATION_MODALITY}`),
            fetch(`/api/generation-config?modality=${VIDEO_GENERATION_MODALITY}`),
            fetch("/api/user-generation-photos", { credentials: "include" }),
            fetch("/api/generation-preferences", { credentials: "include" }),
            fetch("/api/me", { cache: "no-store", credentials: "include" }),
            shouldHydrateLastDockResult
              ? fetch("/api/generations?limit=12", { credentials: "include" })
              : Promise.resolve(null),
          ]);
        if (!configRes.ok) throw new Error("config_failed");
        const configData = (await configRes.json()) as {
          models?: ModelOpt[];
          aspectRatios?: RatioOpt[];
          imageSizes?: SizeOpt[];
          defaults?: { model?: string; aspectRatio?: string; imageSize?: string };
          limits?: { maxPhotos?: number };
          cameraOrbitEnabled?: boolean;
          cameraOrbitModel?: { id?: string; cost?: number } | null;
          photoshootEnabled?: boolean;
          photoshootModel?: { id?: string; cost?: number } | null;
        };
        const photosData = (await photosRes.json().catch(() => ({}))) as {
          photos?: UserPhoto[];
          error?: string;
        };
        const preferencesData = preferencesRes.ok
          ? ((await preferencesRes.json().catch(() => ({}))) as {
              preferences?: StoredGenerationPreferences | null;
            })
          : {};
        const meData = meRes.ok
          ? ((await meRes.json().catch(() => ({}))) as { credits?: number })
          : {};
        const generationsData =
          generationsRes && generationsRes.ok
            ? ((await generationsRes.json().catch(() => ({}))) as {
                generations?: Array<{
                  id?: string;
                  status?: string;
                  prompt?: string;
                  model?: string;
                  aspectRatio?: string;
                  resultUrl?: string | null;
                  isPublished?: boolean;
                  modality?: string;
                  resultMimeType?: string | null;
                  editKind?: string | null;
                  photoshootTileUrls?: string[] | null;
                }>;
              })
            : {};
        // Unauth / blank: photo library is best-effort — do not block composer.
        if (!photosRes.ok && !isBlank) {
          throw new Error(photosData.error || "Не удалось загрузить ваши фото");
        }
        if (cancelled) return;
        const videoConfigData = videoConfigRes.ok
          ? ((await videoConfigRes.json().catch(() => ({}))) as {
              enabled?: boolean;
              models?: ModelOpt[];
              defaults?: { aspectRatio?: string; model?: string };
            })
          : {};
        const nextVideoEnabled = Boolean(videoConfigData.enabled);
        writeCachedVideoAnimateEnabled(nextVideoEnabled);
        setVideoEnabled(nextVideoEnabled);
        const nextCameraOrbitEnabled = Boolean(configData.cameraOrbitEnabled);
        writeCachedCameraOrbitEnabled(nextCameraOrbitEnabled);
        setCameraOrbitEnabled(nextCameraOrbitEnabled);
        setCameraOrbitCreditCost(
          typeof configData.cameraOrbitModel?.cost === "number"
            ? configData.cameraOrbitModel.cost
            : 10,
        );
        const nextPhotoshootEnabled = Boolean(configData.photoshootEnabled);
        writeCachedPhotoshootEnabled(nextPhotoshootEnabled);
        setPhotoshootEnabled(nextPhotoshootEnabled);
        const nextVideoModels = Array.isArray(videoConfigData.models)
          ? videoConfigData.models
          : [];
        setVideoModels(nextVideoModels);
        if (seed.intent === "animate") {
          setComposeMode("video");
          setAnimateParentId(seed.parentGenerationId || null);
          setAnimatePreviewUrl(seed.previewUrl || null);
          if (seed.promptText.trim() && !isGenericVideoPrompt(seed.promptText)) {
            setDraftPrompt(seed.promptText);
          } else {
            setDraftPrompt("");
          }
        } else if (isCompletedResultSeed(seed)) {
          const prompt = seed.promptText.trim();
          setComposeMode("image");
          setGenerationId(seed.resultGenerationId!);
          setResultUrl(seed.previewUrl!);
          setResultModality(seed.resultModality === "video" ? "video" : "image");
          lastImageResultRef.current = rememberCompletedImageResult({
            generationId: seed.resultGenerationId,
            resultUrl: seed.previewUrl,
            resultModality: seed.resultModality === "video" ? "video" : "image",
            previous: lastImageResultRef.current,
          });
          setDraftPrompt(prompt);
          promptStashRef.current = {
            ...promptStashRef.current,
            imagePrompt: prompt,
          };
          setSubmittedPrompt(prompt);
          setIsPublished(Boolean(seed.isPublished));
          setResultEditKind(seed.editKind || null);
          setPhotoshootTileUrls(photoshootTileUrlsFromUnknown(seed.photoshootTileUrls));
          setProgress(100);
          setPhase("done");
          phaseRef.current = "done";
        }
        const nextModels = Array.isArray(configData.models) ? configData.models : [];
        const nextRatios = Array.isArray(configData.aspectRatios)
          ? configData.aspectRatios
          : [];
        const nextSizes = Array.isArray(configData.imageSizes) ? configData.imageSizes : [];
        const nextPhotos =
          photosRes.ok && Array.isArray(photosData.photos) ? photosData.photos : [];
        const defaultModel = configData.defaults?.model || nextModels[0]?.id;
        const defaultRatio = configData.defaults?.aspectRatio || nextRatios[0]?.value;
        const defaultSize = configData.defaults?.imageSize || nextSizes[0]?.value;
        setModels(nextModels);
        setAspectRatios(nextRatios);
        setImageSizes(nextSizes);
        setPhotos(nextPhotos);
        if (Number.isFinite(meData.credits)) {
          setCredits(Number(meData.credits));
        }
        const userId = isAuthed ? user?.id ?? null : null;
        const storedPrefs = pickFresherPreferences(
          parseStoredGenerationPreferences(preferencesData.preferences),
          userId ? readCachedGenerationPreferences(userId) : null
        );
        const resolvedPrefs = resolveComposerPreferences({
          stored: storedPrefs,
          imageModelIds: nextModels.map((item) => item.id),
          videoModelIds: nextVideoModels.map((item) => item.id),
          availablePhotoIds: nextPhotos.map((photo) => photo.id),
          defaults: {
            model: defaultModel || undefined,
            aspectRatio: defaultRatio || undefined,
            imageSize: defaultSize || undefined,
            videoModel: videoConfigData.defaults?.model || DEFAULT_VIDEO_MODEL,
            videoAspectRatio:
              videoConfigData.defaults?.aspectRatio || DEFAULT_VIDEO_ASPECT_RATIO,
          },
        });
        setModel(resolvedPrefs.model);
        setAspectRatio(resolvedPrefs.aspectRatio);
        setImageSize(resolvedPrefs.imageSize);
        setVideoModel(resolvedPrefs.videoModel);
        setVideoAspectRatio(resolvedPrefs.videoAspectRatio);
        setVideoDurationSeconds(resolvedPrefs.videoDurationSeconds);
        setSelectedPhotoIds(
          shouldAttachLibraryPhotos(seed)
            ? new Set(resolvedPrefs.selectedPhotoIds)
            : new Set()
        );
        if (userId && storedPrefs) {
          writeCachedGenerationPreferences(userId, resolvedPrefs);
        }
        skipNextPrefsPersistRef.current = true;
        prefsDirtyRef.current = false;
        if (typeof configData.limits?.maxPhotos === "number") {
          setMaxPhotos(Math.max(1, Math.min(10, configData.limits.maxPhotos)));
        }

        /**
         * Blank listing dock: restore last completed result + prompt only.
         * Model / ratio / size / photos stay from landing_generation_preferences
         * (user can change them only via sheets → «Готово»).
         */
        const lastCompleted =
          shouldHydrateLastDockResult &&
          !cancelled &&
          (generationsData.generations || []).find(
            (item) =>
              item.status === "completed" &&
              Boolean(item.resultUrl) &&
              Boolean(item.id)
          );
        if (
          lastCompleted &&
          !suppressResultHydrateRef.current &&
          phaseRef.current === "idle" &&
          !resultUrlRef.current &&
          !generationIdRef.current
        ) {
          const prompt = (lastCompleted.prompt || "").trim();
          setGenerationId(lastCompleted.id!);
          setResultUrl(lastCompleted.resultUrl!);
          setResultModality(lastCompleted.modality === "video" ? "video" : "image");
          lastImageResultRef.current = rememberCompletedImageResult({
            generationId: lastCompleted.id,
            resultUrl: lastCompleted.resultUrl,
            resultModality: lastCompleted.modality === "video" ? "video" : "image",
            previous: lastImageResultRef.current,
          });
          setDraftPrompt(prompt);
          promptStashRef.current = {
            ...promptStashRef.current,
            imagePrompt: prompt,
          };
          setSubmittedPrompt(prompt);
          setIsPublished(Boolean(lastCompleted.isPublished));
          setResultEditKind(lastCompleted.editKind || null);
          setPhotoshootTileUrls(
            photoshootTileUrlsFromUnknown(lastCompleted.photoshootTileUrls),
          );
          setProgress(100);
          setPhase("done");
          phaseRef.current = "done";
        }

        // Persist prefs only for authenticated library sessions.
        setPreferencesHydrated(isAuthed && photosRes.ok);
        setLibraryLoading(false);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message !== "config_failed") {
            setError(err.message);
          } else {
            setConfigError("Не удалось загрузить параметры генерации");
          }
          setLibraryLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Hydrate once per mount / auth identity — do not re-fetch on every result change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount hydrate
  }, [isBlank, isDock, user]);

  useEffect(() => {
    if (seed.intent !== "animate" || !isAuthed) return;
    void loadAnimateScenario({
      parentGenerationId: seed.parentGenerationId,
      sourcePrompt: seed.promptText,
    });
  }, [isAuthed, loadAnimateScenario, seed.intent, seed.parentGenerationId, seed.promptText]);

  useEffect(() => {
    if (composeMode !== "video" || !animateParentId || !isAuthed) return;
    let cancelled = false;
    void fetch(`/api/generations/${encodeURIComponent(animateParentId)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { resultUrl?: string } | null) => {
        if (cancelled || !data) return;
        if (typeof data.resultUrl === "string" && data.resultUrl) {
          setAnimatePreviewUrl(data.resultUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [animateParentId, composeMode, isAuthed]);

  useEffect(() => {
    const refreshCredits = () => {
      void fetch("/api/me", {
        cache: "no-store",
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json().catch(() => ({}))) as {
            credits?: number;
          };
          if (Number.isFinite(payload.credits)) {
            setCredits(Number(payload.credits));
          }
        })
        .catch((error) => {
          console.error("[generation.balance] refresh failed", error);
        });
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshCredits);
    return () =>
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshCredits);
  }, []);

  /**
   * Latest prefs snapshot for flush-on-unmount / sheet-collapse (debounce cancel
   * otherwise loses edits when seedToken remounts within 300ms).
   */
  const prefsSnapshotRef = useRef({
    model,
    aspectRatio,
    imageSize,
    selectedPhotoIds,
    videoModel,
    videoAspectRatio,
    videoDurationSeconds,
    preferencesHydrated,
    userId: isAuthed ? (user?.id ?? null) : null,
  });
  prefsSnapshotRef.current = {
    model,
    aspectRatio,
    imageSize,
    selectedPhotoIds,
    videoModel,
    videoAspectRatio,
    videoDurationSeconds,
    preferencesHydrated,
    userId: isAuthed ? (user?.id ?? null) : null,
  };

  const persistGenerationPreferences = useCallback(
    (snapshot?: typeof prefsSnapshotRef.current, options?: { force?: boolean }) => {
      const s = snapshot ?? prefsSnapshotRef.current;
      if (!s.preferencesHydrated || !s.userId) return;
      if (!options?.force && !prefsDirtyRef.current) return;
      const attachLibraryPhotos = shouldAttachLibraryPhotos({
        source: "blank",
        promptText: "",
        cardId: null,
        intent: seedIntentRef.current,
      });
      const selectedPhotoIds = attachLibraryPhotos
        ? Array.from(s.selectedPhotoIds)
        : s.selectedPhotoIds.size > 0
          ? Array.from(s.selectedPhotoIds)
          : readCachedGenerationPreferences(s.userId)?.selectedPhotoIds ?? [];
      const payload: StoredGenerationPreferences = {
        model: s.model,
        aspectRatio: s.aspectRatio,
        imageSize: s.imageSize,
        selectedPhotoIds,
        videoModel: s.videoModel,
        videoAspectRatio: s.videoAspectRatio,
        videoDurationSeconds: s.videoDurationSeconds,
        updatedAt: new Date().toISOString(),
      };
      writeCachedGenerationPreferences(s.userId, payload);
      prefsDirtyRef.current = false;
      void fetch("/api/generation-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) {
          prefsDirtyRef.current = true;
          console.warn("[generation-preferences] save failed", res.status);
        }
      });
    },
    []
  );

  /** Debounced backup while editing; hydrate itself must not rewrite prefs. */
  useEffect(() => {
    if (!preferencesHydrated) return;
    if (skipNextPrefsPersistRef.current) {
      skipNextPrefsPersistRef.current = false;
      return;
    }
    prefsDirtyRef.current = true;
    const timer = window.setTimeout(() => {
      persistGenerationPreferences();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    aspectRatio,
    imageSize,
    model,
    persistGenerationPreferences,
    preferencesHydrated,
    selectedPhotoIds,
    videoAspectRatio,
    videoDurationSeconds,
    videoModel,
  ]);

  /**
   * Any exit from photos/model sheet (Готово, tile toggle, desktop scrim →
   * setDockSurface(null), switch to prompt) must flush — not only «Готово».
   */
  const prevPrefsSurfaceRef = useRef<"photos" | "model" | null>(null);
  useEffect(() => {
    const prev = prevPrefsSurfaceRef.current;
    prevPrefsSurfaceRef.current = expandedControl;
    if (prev && !expandedControl) {
      persistGenerationPreferences();
    }
  }, [expandedControl, persistGenerationPreferences]);

  /** Remount (seedToken) cancels debounce — flush last snapshot on unmount. */
  useEffect(() => {
    return () => {
      persistGenerationPreferences(prefsSnapshotRef.current);
    };
  }, [persistGenerationPreferences]);

  const closePrefsSheet = useCallback(() => {
    persistGenerationPreferences();
    setExpandedControl(null);
  }, [persistGenerationPreferences, setExpandedControl]);

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.has(photo.id)),
    [photos, selectedPhotoIds]
  );
  const selectImageModel = (modelId: string) => {
    setModel(modelId);
    if (composeModeRef.current !== "image") {
      enterImageCompose();
    }
  };
  const selectVideoModel = (modelId: string) => {
    if (composeModeRef.current !== "video") {
      if (selectedPhotos.length !== 1) {
        setError("Для оживления выберите одно фото");
        setExpandedControl("photos");
        return;
      }
      const photo = selectedPhotos[0];
      const linkedParentId = resolveVideoEnqueueParentGenerationId(
        null,
        photo.originalFilename
      );
      enterVideoCompose({
        parentGenerationId: linkedParentId || null,
        previewUrl: photo.previewUrl || null,
        photoStoragePath: linkedParentId ? null : photo.storagePath || null,
        scenarioKey: composeVideoScenarioKey({
          parentGenerationId: linkedParentId,
          photoId: photo.id,
        }),
        sourcePrompt: draftPromptRef.current,
      });
    }
    setVideoModel(modelId);
    if (isVeoLiteVideoModel(modelId) && videoDurationSeconds > 8) {
      setVideoDurationSeconds(8);
    }
  };
  const minModelCost = useMemo(() => {
    if (!models.length) return null;
    return models.reduce(
      (min, item) => Math.min(min, item.cost),
      Number.POSITIVE_INFINITY
    );
  }, [models]);
  /** Not enough for even the cheapest model → FAB/tab paywall, no compose open. */
  const cannotAffordAny =
    isAuthed &&
    credits !== null &&
    (credits <= 0 || (minModelCost !== null && credits < minModelCost));
  const activeVideoModel =
    videoModels.find((item) => item.id === videoModel) ?? videoModels[0] ?? null;
  const videoDurationChoices = videoDurationOptionsForModel(activeVideoModel?.id);
  const videoCostModel =
    activeVideoModel ??
    FALLBACK_VIDEO_GENERATION_MODELS.find((item) => item.id === videoModel) ??
    FALLBACK_VIDEO_GENERATION_MODELS.find((item) => item.id === DEFAULT_VIDEO_MODEL) ??
    FALLBACK_VIDEO_GENERATION_MODELS[0];
  const selectedVideoCost =
    videoCostModel != null
      ? calculateVideoCreditCost(
          videoCostModel.cost,
          videoDurationSeconds,
          videoCostModel.id,
        )
      : null;
  const photoshootReadyFrame = resolvePhotoshootReadyFrame({
    generationId,
    resultUrl,
    resultModality,
    lastImageResult: lastImageResultRef.current,
  });
  const photoshootLibraryFrame = resolvePhotoshootLibraryFrame({
    selectedPhotos,
  });
  const selectedModelCost =
    composeMode === "video"
      ? selectedVideoCost
      : composeMode === "photoshoot"
        ? photoshootLibraryFrame
          ? PHOTOSHOOT_CREDIT_COST
          : null
        : models.find((item) => item.id === model)?.cost ?? null;
  const cannotAffordSelected =
    isAuthed &&
    credits !== null &&
    selectedModelCost !== null &&
    credits < selectedModelCost;

  useEffect(() => {
    if (!cannotAffordAny) {
      setNeedsCredits(false);
    }
  }, [cannotAffordAny]);

  useEffect(() => {
    if (!isVeoLiteVideoModel(videoModel)) return;
    if (videoDurationSeconds > 8) setVideoDurationSeconds(8);
  }, [videoModel, videoDurationSeconds]);

  const visibleImageSizes = useMemo(() => {
    const allowed = new Set(imageSizeOptionsForModel(model).map((item) => item.value));
    return imageSizes.filter((item) => allowed.has(item.value));
  }, [model, imageSizes]);

  useEffect(() => {
    const next = clampImageSizeForModel(model, imageSize);
    if (next !== imageSize) setImageSize(next);
  }, [model, imageSize]);

  useEffect(() => {
    if (!isDock) return;
    reportNeedsCredits(cannotAffordAny || needsCredits);
  }, [isDock, cannotAffordAny, needsCredits, reportNeedsCredits]);

  useEffect(() => {
    if (!isDock) return;
    return () => reportNeedsCredits(false);
  }, [isDock, reportNeedsCredits]);

  const togglePhoto = (id: string) => {
    if (isGenerateComposeJobBusy(phase) || libraryUploading) return;
    setError("");
    setSelectedPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= maxPhotos) {
        setError(`Можно выбрать не больше ${maxPhotos} фото`);
        return current;
      }
      next.add(id);
      return next;
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const availableSelectionSlots = Math.max(0, maxPhotos - selectedPhotoIds.size);
    setError("");
    setLibraryUploading(true);

    const uploaded: UserPhoto[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const prepared = await prepareUploadFile(files[index]);
        if (!prepared.ok) {
          const message = noticeForUploadError(prepared.error, (key) => {
            if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
            if (key === "readFailed") return "Не удалось прочитать файл";
            return "Недопустимый тип файла";
          });
          throw new Error(message);
        }

        const blob = await (await fetch(prepared.dataUrl)).blob();
        const mime =
          prepared.mime === "image/png" || prepared.mime === "image/webp"
            ? prepared.mime
            : "image/jpeg";
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const typedFile = new File([blob], files[index].name || `photo.${ext}`, { type: mime });
        const form = new FormData();
        form.append("file", typedFile);
        form.append("saveToLibrary", "true");

        const upRes = await fetch("/api/upload-generation-photo", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const upData = (await upRes.json().catch(() => ({}))) as {
          photo?: UserPhoto;
          error?: string;
          message?: string;
        };
        if (!upRes.ok || !upData.photo) {
          throw new Error(upData.message || upData.error || "Ошибка загрузки фото");
        }
        uploaded.push(upData.photo);
      }

      setPhotos((current) => [...uploaded.reverse(), ...current]);
      setSelectedPhotoIds((current) => {
        const next = new Set(current);
        for (const photo of uploaded) {
          if (next.size >= maxPhotos) break;
          next.add(photo.id);
        }
        return next;
      });
      if (uploaded.length > availableSelectionSlots) {
        setError(
          `Все фото сохранены. Для генерации можно выбрать не больше ${maxPhotos}.`
        );
      }
    } catch (err) {
      if (uploaded.length) {
        setPhotos((current) => [...uploaded.reverse(), ...current]);
        setSelectedPhotoIds((current) => {
          const next = new Set(current);
          for (const photo of uploaded) {
            if (next.size >= maxPhotos) break;
            next.add(photo.id);
          }
          return next;
        });
      }
      setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
    } finally {
      setLibraryUploading(false);
    }
  };

  const deletePhoto = async (photo: UserPhoto) => {
    if (!window.confirm("Удалить это фото из вашей библиотеки?")) return;
    setDeletingPhotoId(photo.id);
    setError("");
    try {
      const res = await fetch(`/api/user-generation-photos/${photo.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось удалить фото");

      const remaining = photos.filter((item) => item.id !== photo.id);
      setPhotos(remaining);
      setSelectedPhotoIds((selected) => {
        const next = new Set(selected);
        next.delete(photo.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить фото");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const runGenerate = async (options?: {
    promptOverride?: string;
    parentGenerationId?: string;
    editInstruction?: string;
    editKind?: string;
    parentTile?: number;
    plannerTemperature?: number;
    cameraPose?: CameraPose;
    forceTextOnly?: boolean;
    modality?: "image" | "video";
    photoStoragePath?: string;
  }): Promise<boolean> => {
    const requestedModality =
      options?.modality || apiModalityForComposeMode(composeMode);
    const isVideo = requestedModality === "video";
    const isCameraOrbit = options?.editKind === CAMERA_ORBIT_EDIT_KIND;
    const isPhotoshoot = options?.editKind === PHOTOSHOOT_EDIT_KIND;
    if (
      !canEnqueueWhilePhotoshootSelected({
        composeMode,
        editKind: options?.editKind,
      })
    ) {
      setError(PHOTOSHOOT_NEEDS_LIBRARY_PHOTO);
      return false;
    }
    const parentGenerationId = isVideo
      ? resolveVideoEnqueueParentGenerationId(
          options?.parentGenerationId?.trim() || animateParentId,
          selectedPhotos[0]?.originalFilename,
        )
      : options?.parentGenerationId?.trim() || "";
    const editInstruction = isVideo || isCameraOrbit ? "" : options?.editInstruction?.trim() || "";
    const isContinuation = Boolean(parentGenerationId) && !isVideo;
    if (isContinuation && !editInstruction && !isCameraOrbit && !isPhotoshoot) {
      setError("Опишите, что изменить");
      return false;
    }
    const prompt = isCameraOrbit
      ? "CAMERA ORBIT"
      : isPhotoshoot
        ? "PHOTOSHOOT"
      : (options?.promptOverride ?? draftPrompt).trim()
        || (isVideo ? DEFAULT_VIDEO_PROMPT : "");
    if (!isCameraOrbit && !isPhotoshoot && prompt.length < 8) {
      setError("Промпт слишком короткий");
      return false;
    }
    const photoshootLibraryPathOverride = options?.photoStoragePath?.trim() || "";
    if (isVideo) {
      const photoCount = selectedPhotos.length;
      if (!parentGenerationId && photoCount !== 1) {
        setError("Для оживления нужно одно фото");
        return false;
      }
    }
    if (isPhotoshoot && !parentGenerationId) {
      const libraryPath =
        photoshootLibraryPathOverride || selectedPhotos[0]?.storagePath || "";
      if (
        !libraryPath ||
        (!photoshootLibraryPathOverride && selectedPhotos.length !== 1)
      ) {
        setError(PHOTOSHOOT_NEEDS_LIBRARY_PHOTO);
        return false;
      }
    }
    if (generateInFlightRef.current) return false;
    generateInFlightRef.current = true;
    const photoshootAbort = isPhotoshoot ? new AbortController() : null;
    if (photoshootAbort) photoshootPollAbortRef.current = photoshootAbort;
    setStarting(true);

    setError("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setExpandedControl(null);
    setPromptExpanded(false);

    try {
      const idempotencyKey = crypto.randomUUID();
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...browserAcquisitionHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          generationSurface: resolvedGenerationSurface,
          modality: isVideo ? VIDEO_GENERATION_MODALITY : IMAGE_GENERATION_MODALITY,
          prompt,
          model: isVideo ? activeVideoModel?.id : model,
          aspectRatio: isVideo
            ? videoAspectRatio
            : isPhotoshoot && !parentGenerationId
              ? resolvePhotoshootSheetAspect({
                  aspectRatio,
                  width:
                    selectedPhotos.find(
                      (photo) =>
                        photo.storagePath ===
                        (photoshootLibraryPathOverride || selectedPhotos[0]?.storagePath),
                    )?.width ?? selectedPhotos[0]?.width ?? undefined,
                  height:
                    selectedPhotos.find(
                      (photo) =>
                        photo.storagePath ===
                        (photoshootLibraryPathOverride || selectedPhotos[0]?.storagePath),
                    )?.height ?? selectedPhotos[0]?.height ?? undefined,
                })
              : aspectRatio,
          imageSize: isVideo ? DEFAULT_VIDEO_RESOLUTION : imageSize,
          durationSeconds: isVideo ? videoDurationSeconds : undefined,
          cardId: resolvedCardId,
          photoStoragePaths: isPhotoshoot
            ? parentGenerationId
              ? []
              : [
                  photoshootLibraryPathOverride ||
                    selectedPhotos[0]?.storagePath ||
                    "",
                ].filter(Boolean)
            : isVideo
            ? parentGenerationId
              ? []
              : selectedPhotos.slice(0, 1).map((photo) => photo.storagePath)
            : isContinuation || options?.forceTextOnly
              ? []
              : selectedPhotos.map((photo) => photo.storagePath),
          parentGenerationId: parentGenerationId || null,
          editInstruction: isVideo || isCameraOrbit || isPhotoshoot ? null : editInstruction || null,
          editKind: isCameraOrbit
            ? CAMERA_ORBIT_EDIT_KIND
            : isPhotoshoot
              ? PHOTOSHOOT_EDIT_KIND
              : undefined,
          cameraPose: isCameraOrbit ? options?.cameraPose : undefined,
          parentTile: isPhotoshoot ? options?.parentTile : undefined,
          plannerTemperature: isPhotoshoot ? options?.plannerTemperature : undefined,
          vibeId: null,
        }),
      });
      const genData = (await genRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        message?: string;
      };
      if (!genRes.ok || !genData.id) {
        if (genData.error === "insufficient_credits") {
          setNeedsCredits(true);
          setError("");
          setPhase(resultUrl || isContinuation ? "done" : "idle");
          phaseRef.current = resultUrl || isContinuation ? "done" : "idle";
          reachYandexMetrikaGoal(
            isPhotoshoot
              ? YM_GOAL_PHOTOSHOOT_NO_CREDITS
              : isCameraOrbit
              ? YM_GOAL_CAMERA_ORBIT_NO_CREDITS
              : YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
          );
          return false;
        }
        if (isCameraOrbit && genData.error === "camera_orbit_busy") {
          reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_BUSY);
          throw new Error(genData.message || "Этот ракурс ещё снимается");
        }
        if (isCameraOrbit && genData.error === "camera_orbit_disabled") {
          reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_DISABLED);
          throw new Error(genData.message || "Смена ракурса пока недоступна");
        }
        if (isCameraOrbit && genData.error === "camera_orbit_model_unavailable") {
          throw new Error(genData.message || "Модель смены ракурса временно недоступна");
        }
        if (isPhotoshoot && genData.error === "photoshoot_busy") {
          reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_BUSY);
          throw new Error(genData.message || "Эта фотосессия ещё в очереди");
        }
        if (isPhotoshoot && genData.error === "photoshoot_disabled") {
          reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_DISABLED);
          throw new Error(genData.message || "Фотосессия пока недоступна");
        }
        if (isPhotoshoot && genData.error === "photoshoot_from_sheet") {
          throw new Error(genData.message || "Фотосессию нельзя снять с готового листа");
        }
        if (isPhotoshoot && genData.error === "photoshoot_model_unavailable") {
          throw new Error(genData.message || "Модель фотосессии временно недоступна");
        }
        throw new Error(genData.message || genData.error || "Не удалось создать генерацию");
      }
      if (isCameraOrbit) {
        reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_SUBMIT, {
          azimuth: options?.cameraPose?.azimuthDeg ?? 0,
          elevation: options?.cameraPose?.elevationDeg ?? 0,
          distance: options?.cameraPose?.distanceRel ?? 1,
        });
      }
      if (isPhotoshoot) {
        reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_SUBMIT, { credits: PHOTOSHOOT_CREDIT_COST });
      }
      setPhase("generating");
      phaseRef.current = "generating";
      setProgress(8);
      setStarting(false);
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED);
      if (!isContinuation) setGenerationId(genData.id);
      if (!isCameraOrbit && !isPhotoshoot) {
        setDraftPrompt(prompt);
        setSubmittedPrompt(prompt);
      }
      setIsPublished(false);
      requestCreditBalanceRefresh();

      while (true) {
        if (photoshootAbort?.signal.aborted) return true;
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (photoshootAbort?.signal.aborted) return true;
        let pollRes: Response;
        try {
          pollRes = await fetch(`/api/generations/${genData.id}`, {
            credentials: "include",
          });
        } catch {
          setError("Связь прервана, генерация продолжается…");
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
        };
        if (!pollRes.ok) {
          if (pollRes.status >= 500) {
            setError("Сервис временно недоступен, генерация продолжается…");
            continue;
          }
          throw new Error(poll.errorMessage || poll.error || "Ошибка статуса генерации");
        }
        setError("");
        if (typeof poll.progress === "number") {
          setProgress((current) => Math.max(current, Math.min(96, poll.progress!)));
        }
        if (poll.status === "completed") {
          if (photoshootAbort?.signal.aborted) return true;
          const tiles =
            Array.isArray(poll.photoshootTileUrls) && poll.photoshootTileUrls.length === 4
              ? poll.photoshootTileUrls
              : null;
          if (isPhotoshoot && !tiles) {
            throw new Error("Кадры фотосессии не готовы");
          }
          const nextResultUrl = isPhotoshoot ? tiles![0] : poll.resultUrl;
          if (!nextResultUrl) {
            continue;
          }
          requestCreditBalanceRefresh();
          clearLastDockResultDismiss();
          setGenerationId(genData.id);
          setResultUrl(nextResultUrl);
          setResultModality(poll.modality === "video" || isVideo ? "video" : "image");
          lastImageResultRef.current = rememberCompletedImageResult({
            generationId: genData.id,
            resultUrl: nextResultUrl,
            resultModality: poll.modality === "video" || isVideo ? "video" : "image",
            previous: lastImageResultRef.current,
          });
          if (isVideo) {
            enterImageCompose();
          }
          setProgress(100);
          setPhase("done");
          if (isCameraOrbit) reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_READY);
          if (isPhotoshoot) {
            setResultEditKind(PHOTOSHOOT_EDIT_KIND);
            setPhotoshootTileUrls(tiles);
            setPhotoshootOpen(false);
            setPhotoshootLibraryPath(null);
            reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_READY);
          }
          onGenerationComplete?.();
          return true;
        }
        if (poll.status === "failed") {
          requestCreditBalanceRefresh();
          throw new Error(poll.errorMessage || "Генерация не удалась");
        }
      }
    } catch (err) {
      if (isCameraOrbit) reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_FAIL);
      if (isPhotoshoot) reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_FAIL);
      setPhase(resultUrl || isContinuation ? "done" : "error");
      phaseRef.current = resultUrl || isContinuation ? "done" : "error";
      setError(err instanceof Error ? err.message : "Ошибка генерации");
      return false;
    } finally {
      if (photoshootAbort && photoshootPollAbortRef.current === photoshootAbort) {
        photoshootPollAbortRef.current = null;
      }
      generateInFlightRef.current = false;
      setStarting(false);
    }
  };

  const applyPromptRemix = async () => {
    const basePrompt = draftPrompt.trim();
    const requestedChange = changeRequest.trim();
    const parentGenerationId =
      resultUrl && generationId ? generationId : null;
    if (
      basePrompt.length < 8 ||
      !requestedChange ||
      remixing ||
      phase === "generating"
    ) {
      return;
    }

    setRemixing(true);
    setError("");
    try {
      const remixRes = await fetch(getGenerationPromptRemixUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: basePrompt,
          parentGenerationId,
          changeRequest: requestedChange,
        }),
      });
      const remixData = (await remixRes.json().catch(() => ({}))) as {
        prompt?: string;
        error?: string;
        message?: string;
      };
      if (!remixRes.ok) {
        throw new Error(
          remixRes.status === 429
            ? remixData.message || PROMPT_REMIX_COPY.errorRateLimited
            : remixData.error === "unchanged_prompt"
              ? remixData.message || PROMPT_REMIX_COPY.errorUnchanged
              : remixData.message || PROMPT_REMIX_COPY.errorGeneric
        );
      }
      const nextPrompt = remixData.prompt?.trim() || "";
      if (nextPrompt.length < 8) {
        throw new Error(PROMPT_REMIX_COPY.errorGeneric);
      }
      setDraftPrompt(nextPrompt);
      setChangeRequest("");
      await runGenerate({
        promptOverride: nextPrompt,
        parentGenerationId: parentGenerationId || undefined,
        editInstruction: parentGenerationId ? requestedChange : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : PROMPT_REMIX_COPY.errorGeneric);
    } finally {
      setRemixing(false);
    }
  };

  const handleResultAction = async (action: GenerationMenuAction) => {
    if (!resultUrl || !generationId || busyAction) return;

    if (action === "select") return;

    if (action === "share") {
      setMenuOpen(false);
      try {
        const mode = await shareGenerationResult(resultUrl);
        if (mode === "copied") setToast("Ссылка скопирована");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setToast("Не удалось поделиться");
      }
      return;
    }

    if (action === "download") {
      setBusyAction("download");
      try {
        await downloadGenerationResult(
          resultUrl,
          resultModality === "video"
            ? `promptshot-${generationId}.mp4`
            : `promptshot-${generationId}.jpg`
        );
        setMenuOpen(false);
      } catch {
        setToast("Не удалось скачать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "copyPrompt") {
      setMenuOpen(false);
      const ok = await copyTextUniversal(submittedPrompt || draftPrompt);
      setToast(ok ? "Промпт скопирован" : "Не удалось скопировать");
      return;
    }

    if (action === "animate") {
      setMenuOpen(false);
      enterAnimateFromResult();
      return;
    }

    if (action === "use") {
      setBusyAction("use");
      try {
        const res = await fetch(`/api/generations/${generationId}/save-to-library`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          photo?: UserPhoto;
        };
        if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
        if (data.photo) {
          setPhotos((current) => [
            data.photo!,
            ...current.filter((photo) => photo.id !== data.photo!.id),
          ]);
          setSelectedPhotoIds((current) => {
            if (current.has(data.photo!.id) || current.size >= maxPhotos) return current;
            return new Set([...current, data.photo!.id]);
          });
        }
        setMenuOpen(false);
        setToast("Сохранено для генерации");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось сохранить");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "publish") {
      setBusyAction("publish");
      try {
        const res = await fetch(`/api/generations/${generationId}/publish`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          promptsReady?: boolean;
        };
        if (!res.ok) throw new Error(data.error || "Не удалось опубликовать");
        const wasPublished = isPublished;
        setIsPublished(true);
        setMenuOpen(false);
        setToast(
          data.promptsReady
            ? wasPublished
              ? "Промпты обновлены"
              : "Карточка опубликована"
            : "Опубликовано. Промпты появятся через минуту",
        );
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось опубликовать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Удалить эту генерацию?")) return;
      setBusyAction("delete");
      try {
        const res = await fetch(`/api/generations/${generationId}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось удалить");
        setMenuOpen(false);
        dismissLastDockResult();
        suppressResultHydrateRef.current = true;
        setResultUrl(null);
        setGenerationId(null);
        setSubmittedPrompt("");
        setProgress(0);
        setPhase("idle");
        phaseRef.current = "idle";
        setToast("Генерация удалена");
        onGenerationComplete?.();
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось удалить");
      } finally {
        setBusyAction(null);
      }
    }
  };

  const jobBusy = isGenerateComposeJobBusy(phase);
  const busy = jobBusy || starting;
  const controlsBusy = busy || Boolean(deletingPhotoId) || libraryUploading;
  const showCreditsCta =
    (cannotAffordAny || cannotAffordSelected || needsCredits) && !busy;
  const isMobile = layout === "mobile";
  const activePrompt = draftPrompt;
  const openPromptEditor = () => {
    setError("");
    setCameraOrbitOpen(false);
    setPhotoshootOpen(false);
    setDockSurface("prompt");
  };
  /** Leave result chrome → idle compose (keep prompt / model / photos for editing). */
  const enterAnimateFromResult = () => {
    if (!generationId || !resultUrl || resultModality === "video" || !videoEnabled) return;
    setPhotoshootOpen(false);
    const sourcePrompt = submittedPrompt || draftPromptRef.current;
    enterVideoCompose({
      parentGenerationId: generationId,
      previewUrl: resultUrl,
      scenarioKey: composeVideoScenarioKey({ parentGenerationId: generationId }),
      sourcePrompt,
    });
    setSubmittedPrompt("");
    setChangeRequest("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setCameraOrbitOpen(false);
    setResultPreviewOpen(false);
    setExpandedControl(null);
    setPromptExpanded(false);
    setPhase("idle");
    phaseRef.current = "idle";
  };

  const resetToCompose = () => {
    dismissLastDockResult();
    suppressResultHydrateRef.current = true;
    setResultUrl(null);
    setGenerationId(null);
    setSubmittedPrompt("");
    setChangeRequest("");
    setProgress(0);
    setError("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setCameraOrbitOpen(false);
    setPhotoshootOpen(false);
    setPhotoshootSourceId(null);
    setPhotoshootSourceUrl(null);
    setPhotoshootLibraryPath(null);
    setPhotoshootTileUrls(null);
    setResultEditKind(null);
    photoshootDismissedRef.current = false;
    setResultPreviewOpen(false);
    setIsPublished(false);
    setResultModality("image");
    if (composeModeRef.current === "video") {
      enterImageCompose();
    } else {
      setComposeMode("image");
      setAnimateParentId(null);
      setAnimatePreviewUrl(null);
    }
    setExpandedControl(null);
    setPromptExpanded(false);
    setPhase("idle");
    phaseRef.current = "idle";
    onDockResultChromeChange?.(false);
  };
  /** Success X: dismiss result photo, wipe prompt, then close the plate/shell. */
  const clearResultAndPrompt = () => {
    lastImageResultRef.current = null;
    resetToCompose();
    setDraftPrompt("");
    onBack();
  };
  const videoCompose = composeMode === "video";
  const photoshootCompose = composeMode === "photoshoot";
  /**
   * Blank compose: single prompt field until a completed result exists.
   * Card seed and «Что изменить» after generation use remix (changeRequest + parent).
   */
  const useBlankPromptEditor =
    (isBlank && !(resultUrl && generationId)) || videoCompose;
  /** Prefill (photo→prompt) must not steal focus on mobile — keyboard shrinks the sheet. */
  const autofocusPromptEditor = !isMobile || draftPrompt.trim().length < 8;
  /**
   * Result photo as plate background after completion; keep it during a follow-up
   * generate so the modal stays tall and the CTA progress stays readable.
   */
  const showResultChrome =
    Boolean(resultUrl) &&
    !videoCompose &&
    (!isDock || phase === "done" || phase === "generating");

  useEffect(() => {
    if (!showResultChrome) return;
    setExpandedControl(null);
  }, [showResultChrome]);
  /**
   * Glass compose chrome: listing shows through the dock plate (idle + after result).
   * Fullscreen card keeps solid white until there is a result photo.
   */
  const glassChrome = isDock || showResultChrome;
  const imageCompose = !videoCompose && !photoshootCompose;
  const selectedImageModel = models.find((item) => item.id === model) ?? null;
  const selectedImageCost = selectedImageModel?.cost ?? null;
  const selectedImageModelLabel = selectedImageModel
    ? displayLabelForGenerationModel(selectedImageModel.id, selectedImageModel.label)
    : null;
  const selectedVideoModelLabel = videoCostModel
    ? displayLabelForGenerationModel(videoCostModel.id, videoCostModel.label)
    : null;
  const composeCtaModelLabel = composeGenerateCtaShowsModelName(composeMode)
    ? videoCompose
      ? selectedVideoModelLabel
      : selectedImageModelLabel
    : null;
  const composeCtaCost = photoshootCompose
    ? photoshootLibraryFrame
      ? PHOTOSHOOT_CREDIT_COST
      : null
    : videoCompose
      ? selectedVideoCost
      : selectedImageCost;
  const composeTileBorder = (selected: boolean) =>
    selected
      ? glassChrome
        ? "bg-white/10 text-white after:border-indigo-400"
        : "bg-indigo-50 text-zinc-900 after:border-indigo-500"
      : glassChrome
        ? "bg-white/5 text-white after:border-white/25 hover:bg-white/10 hover:after:border-white/40"
        : "bg-zinc-100 text-zinc-900 after:border-zinc-300 hover:bg-zinc-200 hover:after:border-zinc-400";
  const composeTileFrame =
    "after:pointer-events-none after:absolute after:inset-0 after:z-[1] after:rounded-xl after:border-2 after:border-solid";
  const composeModeLogoWrap = `mb-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${
    glassChrome ? "bg-white/90" : "bg-white"
  }`;
  /** Fullscreen card sheets cover the panel; dock uses in-sheet expand instead. */
  const sheetPos = "absolute";
  /** Dock: stretch floating sheet for any editor surface (no viewport overlay). */
  const dockExpanded = isDock && activeDockSurface !== null;
  /** Tall plate when editor / result / in-flight generate needs height. */
  const dockTall = dockExpanded || (isDock && (showResultChrome || busy || cameraOrbitOpen || photoshootOpen));
  const dockPromptExpanded = dockExpanded && activeDockSurface === "prompt";
  const dockPhotosExpanded = dockExpanded && activeDockSurface === "photos";
  const dockModelExpanded = dockExpanded && activeDockSurface === "model";
  /**
   * Dock editor sheets: full plate height, light chrome (no solid black fill).
   * Underlying tiles/footer are invisible while open — sheet stays transparent so
   * the plate glass / listing show through; soft bottom fade keeps CTA readable.
   */
  const dockSheetPanelBase = isMobile
    ? "absolute inset-0 z-50 flex h-full min-h-0 flex-col rounded-none bg-transparent bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(9,9,11,0.28)_100%)] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-zinc-100"
    : "absolute inset-0 z-50 flex h-full min-h-0 flex-col rounded-[1.75rem] bg-transparent bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(9,9,11,0.28)_100%)] p-3 pb-3 text-zinc-100";
  const dockSheetPanel = `${dockSheetPanelBase} overflow-y-auto overscroll-contain`;
  /** Prompt: pin CTA at bottom; fields scroll in an inner region. */
  const dockPromptSheetPanel = `${dockSheetPanelBase} overflow-hidden`;
  const dockSheetHandle = "h-1 w-9 rounded-full bg-white/35";
  const dockSheetCloseBtn = `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15`;
  const dockSheetField =
    "rounded-xl border border-white/15 bg-white/10 text-white outline-none transition placeholder:text-white/40 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60";
  const showResultActions =
    showResultChrome &&
    phase === "done" &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    !cameraOrbitOpen &&
    !photoshootOpen &&
    !(isDock && dockExpanded);
  const showCameraOverlay =
    cameraOrbitOpen &&
    !photoshootOpen &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    resultModality === "image";
  const showPhotoshootOverlay =
    photoshootOpen &&
    resultModality === "image" &&
    Boolean(photoshootLibraryPath || generationId);
  const hideComposeChrome = showPhotoshootOverlay || showCameraOverlay;
  const startPhotoshoot = () => {
    const frame = resolvePhotoshootReadyFrame({
      generationId,
      resultUrl,
      resultModality,
      lastImageResult: lastImageResultRef.current,
    });
    if (!frame) return;
    photoshootDismissedRef.current = false;
    setPhotoshootLibraryPath(null);
    setGenerationId(frame.generationId);
    setResultUrl(frame.resultUrl);
    setResultModality("image");
    setPhotoshootSourceId(frame.generationId);
    setPhotoshootSourceUrl(frame.resultUrl);
    setPromptExpanded(false);
    setExpandedControl(null);
    setPhotoshootOpen(true);
    reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_OPEN);
  };

  const startPhotoshootFromLibrary = () => {
    const frame = resolvePhotoshootLibraryFrame({ selectedPhotos });
    if (!frame) return;
    photoshootDismissedRef.current = false;
    setPhotoshootLibraryPath(frame.storagePath);
    setPhotoshootSourceId(null);
    setPhotoshootSourceUrl(frame.previewUrl || null);
    setResultUrl(frame.previewUrl || null);
    setResultModality("image");
    setPhase("done");
    phaseRef.current = "done";
    setPromptExpanded(false);
    setExpandedControl(null);
    setPhotoshootOpen(true);
    reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_OPEN);
  };

  const onPhotoshootTileClick = () => {
    enterPhotoshootCompose();
    setExpandedControl(null);
  };

  const onImageModeTileClick = () => {
    const wasImage = composeModeRef.current === "image";
    if (!wasImage) enterImageCompose();
    setExpandedControl(
      nextComposeModeTileSheet({
        mode: "image",
        alreadyInMode: wasImage,
        currentSheet: expandedControl,
      }),
    );
  };

  const onVideoModeTileClick = () => {
    const wasVideo = composeModeRef.current === "video";
    if (!wasVideo) {
      if (selectedPhotos.length === 1) {
        selectVideoModel(activeVideoModel?.id || videoModel);
      } else {
        enterVideoCompose({ scenarioKey: null });
      }
    }
    setExpandedControl(
      nextComposeModeTileSheet({
        mode: "video",
        alreadyInMode: wasVideo,
        currentSheet: expandedControl,
      }),
    );
  };

  const createPhotoshoot = (temperature: number) => {
    if (photoshootLibraryPath) {
      return runGenerate({
        editKind: PHOTOSHOOT_EDIT_KIND,
        plannerTemperature: temperature,
        photoStoragePath: photoshootLibraryPath,
      });
    }
    if (!generationId || !resultUrl || resultModality !== "image") {
      return Promise.resolve(false);
    }
    return runGenerate({
      parentGenerationId: generationId,
      editKind: PHOTOSHOOT_EDIT_KIND,
      parentTile: photoshootTileIndexForUrl(photoshootTileUrls, resultUrl),
      plannerTemperature: temperature,
    });
  };

  const closePhotoshoot = () => {
    photoshootDismissedRef.current = true;
    photoshootPollAbortRef.current?.abort();
    setPhotoshootOpen(false);
    if (photoshootLibraryPath) {
      setPhotoshootLibraryPath(null);
      setPhotoshootSourceId(null);
      setPhotoshootSourceUrl(null);
      if (!generationId) {
        setResultUrl(null);
        setPhase("idle");
        phaseRef.current = "idle";
      }
      return;
    }
    if (photoshootSourceId && photoshootSourceUrl) {
      setGenerationId(photoshootSourceId);
      setResultUrl(photoshootSourceUrl);
      setResultEditKind(null);
      setPhotoshootTileUrls(null);
    }
    setPhase("done");
    phaseRef.current = "done";
  };

  useEffect(() => {
    if (!generationId || phase !== "done" || resultModality !== "image") return;
    let cancelled = false;
    void fetch(`/api/generations/${generationId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { editKind?: string | null; photoshootTileUrls?: string[] | null } | null) => {
        if (cancelled || !data) return;
        const kind = String(data.editKind || "").trim() || null;
        setResultEditKind(kind);
        const tiles =
          Array.isArray(data.photoshootTileUrls) && data.photoshootTileUrls.length === 4
            ? data.photoshootTileUrls
            : null;
        if (tiles) setPhotoshootTileUrls(tiles);
        if (isPhotoshootEditKind(kind) && tiles) {
          setPhotoshootOpen(false);
          setResultUrl((current) =>
            current && tiles.includes(current) ? current : tiles[0],
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [generationId, phase, resultModality]);

  useEffect(() => {
    if (!isDock || !onDockResultChromeChange) return;
    /** Sticky tall plate only for result chrome (in-flight gen uses listing FAB progress). */
    onDockResultChromeChange(showResultChrome);
  }, [isDock, onDockResultChromeChange, showResultChrome]);

  useEffect(() => {
    if (!isDock || !onDockResultChromeChange) return;
    return () => onDockResultChromeChange(false);
  }, [isDock, onDockResultChromeChange]);

  /** Publish progress to listing FAB / mobile tab while generation runs. */
  useEffect(() => {
    if (!isDock) return;
    reportRunProgress(jobBusy, progress);
  }, [isDock, jobBusy, progress, reportRunProgress]);

  useEffect(() => {
    if (!isDock) return;
    return () => reportRunProgress(false, 0);
  }, [isDock, reportRunProgress]);

  /**
   * Desktop: collapse plate on generate so listing FAB shows progress; reopen on done.
   * Mobile: keep fullscreen shell open (above tab/nav); CTA shows in-plate progress.
   * Do not auto-open on hydrated last result.
   */
  useEffect(() => {
    if (!isDock) return;
    const previous = phaseRef.current;
    phaseRef.current = phase;
    if (isGenerateComposeJobBusy(phase)) {
      if (!isMobile && !cameraOrbitOpen && !photoshootOpen) setDockPlateOpen(false);
      return;
    }
    if (
      !isMobile &&
      phase === "done" &&
      resultUrl &&
      (previous === "generating" || previous === "uploading")
    ) {
      setDockPlateOpen(true);
    }
  }, [cameraOrbitOpen, isDock, isMobile, phase, photoshootOpen, resultUrl, setDockPlateOpen]);

  return (
    <div
      className={`relative isolate flex min-h-0 flex-col overflow-hidden ${
        isDock
          ? showResultChrome
            ? `${isMobile ? "rounded-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "rounded-[1.75rem]"} border-0 bg-zinc-950 text-zinc-100${
                isMobile ? "" : " shadow-[0_-12px_48px_-16px_rgba(24,24,27,0.28)]"
              }${dockTall || isMobile ? " h-full min-h-0 flex-1" : ""}`
            : // Frosted glass — listing shows through (mobile fullscreen + desktop plate).
              `${isMobile ? "rounded-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "rounded-[1.75rem]"} border-0 bg-zinc-950/55 text-zinc-100 shadow-[0_-12px_48px_-16px_rgba(24,24,27,0.28)] backdrop-blur-xl${
                dockTall || isMobile ? " h-full min-h-0 flex-1" : ""
              }`
          : `${isMobile ? "h-full min-h-[100dvh] flex-1" : "flex-1"} ${
              showResultChrome ? "bg-transparent text-zinc-100" : "bg-white text-zinc-900"
            }`
      }`}
    >
      {showResultChrome ? (
        <GenerationResultBackdrop
          resultUrl={resultUrl}
          phase={phase}
          kind={resultModality}
          className={isDock && isMobile ? "" : "rounded-[1.75rem]"}
        />
      ) : !isDock ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.16),transparent_38%),#09090b]"
          aria-hidden
        />
      ) : null}

      {isDock && showResultChrome && phase === "done" && !dockExpanded && !cameraOrbitOpen && !photoshootOpen ? (
        <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-2">
          {resultUrl && generationId ? (
            <div className="relative" data-generation-menu-root>
              <button
                type="button"
                aria-label="Действия с фото"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={`${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/65 active:scale-[0.98]`}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <circle cx="12" cy="5" r="1.75" />
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="12" cy="19" r="1.75" />
                </svg>
              </button>
              <GenerationCardMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                showSelect={false}
                hasResult
                hasPrompt={Boolean(activePrompt.trim())}
                canPublish={resultModality !== "video"}
                isPublished={isPublished}
                allowRepublish={isPhotoshootEditKind(resultEditKind)}
                canAnimate={videoEnabled && resultModality === "image"}
                canSaveToLibrary={resultModality !== "video"}
                busyAction={busyAction}
                onAction={(action) => {
                  void handleResultAction(action);
                }}
              />
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Очистить результат и промпт"
            onClick={clearResultAndPrompt}
            className={`${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/65 active:scale-[0.98]`}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ) : null}

      {showResultActions && photoshootTileUrls ? (
        <PhotoshootFrameFilm
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[11rem] z-20"
          tileUrls={photoshootTileUrls}
          activeTile={photoshootTileIndexForUrl(photoshootTileUrls, resultUrl)}
          onSelect={(tile) => {
            const url = photoshootTileUrls?.[tile - 1];
            if (url) setResultUrl(url);
          }}
        />
      ) : null}

      {showResultActions ? (
        <GenerationResultActionRail
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30"
          actions={[
            {
              id: "view",
              label: "Посмотреть",
              onClick: () => setResultPreviewOpen(true),
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path
                    d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="2.75" />
                </svg>
              ),
            },
            {
              id: "download",
              label: busyAction === "download" ? "Скачиваем…" : "Скачать",
              disabled: Boolean(busyAction),
              onClick: () => void handleResultAction("download"),
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              id: "repeat",
              label: "Повторить",
              disabled: busy || Boolean(busyAction),
              onClick: resetToCompose,
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a9 9 0 1 1-3.25-6.8" strokeLinecap="round" />
                  <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            ...(videoEnabled && resultModality === "image"
              ? [
                  {
                    id: "animate",
                    label: "Оживить",
                    accent: "orbit" as const,
                    creditCost: selectedVideoCost ?? undefined,
                    creditUnaffordable:
                      selectedVideoCost != null &&
                      isAuthed &&
                      credits !== null &&
                      credits < selectedVideoCost,
                    ariaLabel:
                      selectedVideoCost != null
                        ? `Оживить, ${selectedVideoCost} кредитов`
                        : "Оживить",
                    onClick: enterAnimateFromResult,
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 6.8v10.4L17.2 12 8 6.8Z" />
                      </svg>
                    ),
                  },
                ]
              : []),
            ...(cameraOrbitEnabled && resultModality === "image"
              ? [
                  {
                    id: "camera",
                    label: "Камера",
                    onClick: () => setCameraOrbitOpen(true),
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path
                          d="M4.5 8.5h2.2l1.1-2h8.4l1.1 2H19.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="14" r="3.1" />
                      </svg>
                    ),
                  },
                ]
              : []),
            ...(photoshootEnabled && resultModality === "image"
              ? [
                  {
                    id: "photoshoot",
                    label: PHOTOSHOOT_CTA_LABEL,
                    detail: photoshootCtaDetail(),
                    creditCost: PHOTOSHOOT_CREDIT_COST,
                    creditUnaffordable:
                      isAuthed && credits !== null && credits < PHOTOSHOOT_CREDIT_COST,
                    ariaLabel: `${PHOTOSHOOT_CTA_LABEL}, ${photoshootCtaDetail()}, ${PHOTOSHOOT_CREDIT_COST} кредитов`,
                    onClick: startPhotoshoot,
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path
                          d="M4 7h4l1.2-2h5.6L16 7h4v12H4V7Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="13" r="3.1" />
                      </svg>
                    ),
                  },
                ]
              : []),
            {
              id: "edit",
              label: "Что изменить",
              primary: true,
              disabled: busy || Boolean(busyAction),
              onClick: openPromptEditor,
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m14.5 6.7 2.8 2.8" />
                </svg>
              ),
            },
          ]}
        />
      ) : null}

      {showCameraOverlay && generationId && resultUrl ? (
        <CameraOrbitOverlay
          generationId={generationId}
          displayedResultUrl={resultUrl}
          creditCostFallback={cameraOrbitCreditCost}
          hideCreditCost={!isAuthed}
          capturing={phase === "generating"}
          progress={progress}
          onClose={() => setCameraOrbitOpen(false)}
          onCapture={(pose) =>
            runGenerate({
              parentGenerationId: generationId,
              editKind: CAMERA_ORBIT_EDIT_KIND,
              cameraPose: pose,
            })
          }
          onSelectShot={(shot: CameraSceneShot) => {
            if (!shot.resultUrl) return;
            setGenerationId(shot.id);
            setResultUrl(shot.resultUrl);
          }}
        />
      ) : null}

      {showPhotoshootOverlay ? (
        <PhotoshootOverlay
          capturing={phase === "generating"}
          progress={progress}
          onClose={closePhotoshoot}
          onCreate={createPhotoshoot}
        />
      ) : null}

      {!isDock && !showCameraOverlay && !showPhotoshootOverlay ? (
      <header
        className={`relative z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-3 ${
          isMobile ? "pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]" : "py-2"
        } ${
          showResultChrome
            ? "border-transparent bg-transparent"
            : "border-zinc-200 bg-white/90 backdrop-blur-md"
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold backdrop-blur-md transition disabled:opacity-50 ${
            showResultChrome
              ? "bg-black/25 text-white hover:bg-black/40"
              : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          }`}
        >
          Назад
        </button>
        <span
          className={`text-[13px] font-semibold ${
            showResultChrome ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" : "text-zinc-700"
          }`}
        >
          {phase === "generating" ? "Генерируем" : resultUrl ? "Готово" : "Новая генерация"}
        </span>
        {resultUrl && generationId && phase === "done" ? (
          <div className="relative" data-generation-menu-root>
            <button
              type="button"
              aria-label="Действия с фото"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition hover:bg-black/40`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="19" r="1.75" />
              </svg>
            </button>
            <GenerationCardMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              showSelect={false}
              hasResult
              hasPrompt={Boolean(activePrompt.trim())}
              canPublish={resultModality !== "video"}
              isPublished={isPublished}
              allowRepublish={isPhotoshootEditKind(resultEditKind)}
              canAnimate={videoEnabled && resultModality === "image"}
              canSaveToLibrary={resultModality !== "video"}
              busyAction={busyAction}
              onAction={(action) => {
                void handleResultAction(action);
              }}
            />
          </div>
        ) : (
          <span className="h-11 w-11" aria-hidden />
        )}
      </header>
      ) : null}

      <div
        className={`flex min-h-0 flex-col ${
          hideComposeChrome
            ? "hidden"
            : isDock
            ? // flex-1 only (no h-full) so footer actions stay inside the plate.
              `min-h-0 flex-1 justify-end px-3 pb-0 ${
                isMobile ? "pt-2" : "pt-3"
              }`
            : `relative z-10 flex-1 ${isMobile ? "px-3 py-3" : "px-3 py-2.5"}`
        }`}
      >
        <div
          className={`${
            isDock
              ? "mt-auto flex w-full flex-col justify-end gap-2.5"
              : dockTall
                ? "mt-auto flex min-h-0 flex-1 flex-col justify-end gap-2.5"
                : "mt-auto space-y-3"
          }`}
        >
        {promptExpanded && !dockPromptExpanded ? (
          <button
            type="button"
            aria-label="Свернуть промпт"
            className={`${OVERLAY_BUTTON_UA_RESET} ${sheetPos} inset-0 z-40 bg-black/45 backdrop-blur-[2px]`}
            onClick={() => setPromptExpanded(false)}
          />
        ) : null}

        <section
          role={promptExpanded && !dockPromptExpanded ? "dialog" : undefined}
          aria-modal={promptExpanded && !dockPromptExpanded ? "true" : undefined}
          aria-labelledby={promptExpanded ? "inline-prompt-editor-title" : undefined}
          aria-hidden={
            (isDock && dockExpanded && !dockPromptExpanded) ||
            (showResultChrome && !promptExpanded)
              ? true
              : undefined
          }
          className={`shadow-none ${
            dockPromptExpanded
              ? dockPromptSheetPanel
              : promptExpanded
              ? `${sheetPos} inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-0 flex-col rounded-t-3xl border border-transparent bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
              : isDock
                ? `rounded-none border-0 bg-transparent px-1 py-0.5 text-white${
                    // Sheets keep height; result chrome (rail / photoshoot / orbit) drops the strip.
                    dockExpanded
                      ? " invisible pointer-events-none"
                      : showResultChrome
                        ? "hidden"
                        : ""
                  }`
                : showResultChrome
                  ? "hidden"
                  : "rounded-2xl border px-3 py-1 backdrop-blur-md"
          } ${
            promptExpanded || isDock
              ? ""
              : glassChrome
              ? "border-white/15 bg-black/15 text-white backdrop-blur-md"
              : "border-zinc-200 bg-white/95 text-zinc-900"
          }`}
        >
          {promptExpanded ? (
            useBlankPromptEditor ? (
              <>
                {dockPromptExpanded ? (
                  <button
                    type="button"
                    aria-label="Свернуть промпт"
                    onClick={() => setPromptExpanded(false)}
                    className={`${OVERLAY_BUTTON_UA_RESET} mx-auto mb-1 flex w-full shrink-0 flex-col items-center gap-1 py-1`}
                  >
                    <span className={dockSheetHandle} aria-hidden />
                  </button>
                ) : (
                  <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-zinc-300" aria-hidden />
                )}
                <div className="mb-2 flex min-h-11 shrink-0 items-center justify-between gap-3">
                  <h3 id="inline-prompt-editor-title" className="text-[13px] font-semibold">
                    Промпт
                  </h3>
                  <button
                    type="button"
                    aria-label="Закрыть"
                    onClick={() => setPromptExpanded(false)}
                    className={
                      dockPromptExpanded
                        ? dockSheetCloseBtn
                        : `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`
                    }
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                <label className="flex min-h-0 flex-1 flex-col">
                  <textarea
                    value={draftPrompt}
                    onChange={(event) => setDraftPrompt(event.target.value)}
                    placeholder={
                      videoCompose && scenarioLoading
                        ? ANIMATE_SCENARIO_PLACEHOLDER
                        : BLANK_PROMPT_PLACEHOLDER
                    }
                    maxLength={8000}
                    disabled={busy}
                    autoFocus={autofocusPromptEditor}
                    className={`min-h-0 w-full flex-1 resize-none overflow-y-auto p-3 text-[13px] font-medium leading-relaxed ${
                      dockPromptExpanded
                        ? dockSheetField
                        : "rounded-xl border border-zinc-200 bg-white text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                    }`}
                  />
                </label>
                {error ? (
                  <p
                    className={`mt-2 text-[13px] font-medium ${
                      dockPromptExpanded ? "text-rose-200" : "text-rose-600"
                    }`}
                    role="status"
                  >
                    {error}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy || draftPrompt.trim().length < 8}
                  onClick={() => setPromptExpanded(false)}
                  className={`${OVERLAY_BUTTON_UA_RESET} mt-3 flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Готово
                </button>
              </>
            ) : (
            <>
              {dockPromptExpanded ? (
                <button
                  type="button"
                  aria-label="Свернуть промпт"
                  onClick={() => setPromptExpanded(false)}
                  className={`${OVERLAY_BUTTON_UA_RESET} mx-auto mb-1 flex w-full shrink-0 flex-col items-center gap-1 py-1`}
                >
                  <span className={dockSheetHandle} aria-hidden />
                </button>
              ) : (
                <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-zinc-300" aria-hidden />
              )}
              <div className="mb-2 flex min-h-11 shrink-0 items-center justify-between gap-3">
                <h3 id="inline-prompt-editor-title" className="text-[13px] font-semibold">
                  {resultUrl ? "Изменить картинку" : "Промпт"}
                </h3>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setPromptExpanded(false)}
                  className={
                    dockPromptExpanded
                      ? dockSheetCloseBtn
                      : `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`
                  }
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <label className="flex min-h-0 flex-1 flex-col">
                  <span
                    className={`mb-2 block shrink-0 text-[13px] font-semibold ${
                      dockPromptExpanded ? "text-white/70" : "text-zinc-700"
                    }`}
                  >
                    Текущий промпт
                  </span>
                  <textarea
                    value={draftPrompt}
                    onChange={(event) => setDraftPrompt(event.target.value)}
                    maxLength={8000}
                    disabled={busy || remixing}
                    className={`min-h-0 w-full flex-1 resize-none overflow-y-auto p-3 text-[13px] font-medium leading-relaxed ${
                      dockPromptExpanded
                        ? dockSheetField
                        : "rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                    }`}
                  />
                </label>
                <label className="mt-3 block shrink-0">
                  <span
                    className={`mb-2 block text-[13px] font-semibold ${
                      dockPromptExpanded ? "text-white/70" : "text-zinc-700"
                    }`}
                  >
                    {PROMPT_REMIX_COPY.changeLabel}
                  </span>
                  <textarea
                    value={changeRequest}
                    onChange={(event) => setChangeRequest(event.target.value)}
                    placeholder={PROMPT_REMIX_COPY.changePlaceholder}
                    maxLength={1000}
                    rows={3}
                    disabled={busy || remixing}
                    autoFocus
                    className={`w-full resize-none p-3 text-[13px] font-medium leading-relaxed ${
                      dockPromptExpanded
                        ? dockSheetField
                        : "rounded-xl border border-zinc-200 bg-white text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                    }`}
                  />
                </label>
                {error ? (
                  <p
                    className={`mt-2 text-[13px] font-medium ${
                      dockPromptExpanded ? "text-rose-200" : "text-rose-600"
                    }`}
                  >
                    {error}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={
                  controlsBusy ||
                  draftPrompt.trim().length < 8 ||
                  !changeRequest.trim() ||
                  remixing
                }
                onClick={() => void applyPromptRemix()}
                className={`${OVERLAY_BUTTON_UA_RESET} mt-3 flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-indigo-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {remixing ? "Применяем и генерируем…" : "Применить и сгенерировать"}
              </button>
            </>
            )
          ) : (
            <button
              type="button"
              aria-expanded="false"
              onClick={openPromptEditor}
              className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 w-full items-center gap-3 text-left`}
            >
              {isBlank ? null : (
                <span className="shrink-0 text-[13px] font-semibold">Промпт</span>
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
                  glassChrome
                    ? "text-white/70"
                    : activePrompt.trim()
                      ? "text-zinc-700"
                      : "text-zinc-400"
                }`}
              >
                {activePrompt.trim()
                  || (videoCompose && scenarioLoading
                    ? ANIMATE_SCENARIO_PLACEHOLDER
                    : isBlank
                      ? BLANK_PROMPT_PLACEHOLDER
                      : "")}
              </span>
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
          )}
        </section>

        {expandedControl && !isDock && !showResultChrome ? (
          <button
            type="button"
            aria-label="Закрыть выбор"
            className={`${OVERLAY_BUTTON_UA_RESET} ${sheetPos} inset-0 z-40 bg-black/45 backdrop-blur-[2px]`}
            onPointerDown={(event) => {
              if (!isPrimaryOverlayDismissPointer(event)) return;
              closePrefsSheet();
            }}
          />
        ) : null}

        {expandedControl === "photos" && !showResultChrome ? (
          <div
            id="inline-generation-photos"
            role={isDock ? undefined : "dialog"}
            aria-modal={isDock ? undefined : "true"}
            aria-label="Выбор фотографий"
            className={
              dockPhotosExpanded
                ? `${dockSheetPanelBase} overflow-hidden`
                : isMobile
                  ? `${sheetPos} inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden bg-white p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900`
                  : `${sheetPos} inset-x-0 bottom-0 z-50 max-h-[min(76dvh,38rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
            }
          >
            <div
              className={
                isMobile || dockPhotosExpanded
                  ? "flex h-full min-h-0 w-full flex-col"
                  : "contents"
              }
            >
            {dockPhotosExpanded ? (
              <button
                type="button"
                aria-label="Свернуть выбор фотографий"
                onClick={closePrefsSheet}
                className={`${OVERLAY_BUTTON_UA_RESET} mx-auto mb-1 flex w-full shrink-0 flex-col items-center gap-1 py-1`}
              >
                <span className={dockSheetHandle} aria-hidden />
              </button>
            ) : (
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-300" aria-hidden />
            )}
            <div className="mb-2 flex min-h-11 shrink-0 items-center justify-between gap-3">
              <span
                className={`text-[13px] font-semibold ${
                  dockPhotosExpanded ? "text-white" : "text-zinc-900"
                }`}
              >
                Ваши фото · {selectedPhotos.length}/{maxPhotos}
              </span>
              {libraryLoading ? (
                <span
                  className={`text-[13px] font-medium ${
                    dockPhotosExpanded ? "text-white/60" : "text-zinc-500"
                  }`}
                >
                  Загрузка…
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Закрыть выбор фотографий"
                  onClick={closePrefsSheet}
                  className={
                    dockPhotosExpanded
                      ? dockSheetCloseBtn
                      : `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`
                  }
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </div>
            {!libraryLoading ? (
              <section
                aria-labelledby="generation-photo-guide-title"
                className={
                  isMobile || dockPhotosExpanded
                    ? "flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain py-3"
                    : "mb-3"
                }
              >
                <div
                  className={`flex w-full flex-col ${
                    isMobile || dockPhotosExpanded
                      ? "max-w-[13.5rem] items-center text-center"
                      : "items-start"
                  }`}
                >
                  <h3
                    id="generation-photo-guide-title"
                    className={`text-[13px] font-semibold ${
                      dockPhotosExpanded ? "text-white" : "text-zinc-900"
                    }`}
                  >
                    Какое фото добавить
                  </h3>
                  <p
                    className={`mt-1 text-[13px] font-medium leading-relaxed ${
                      dockPhotosExpanded ? "text-white/65" : "text-zinc-600"
                    }`}
                  >
                    Один человек, лицо крупно и хорошо видно.
                  </p>
                  <div
                    className={`relative mt-3 rounded-2xl ring-1 ${
                      dockPhotosExpanded ? "ring-white/15" : "ring-zinc-200"
                    } ${
                      isMobile || dockPhotosExpanded
                        ? "aspect-square w-full"
                        : "h-24 w-[4.5rem] shrink-0"
                    }`}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-2xl bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/generate/photo-guide-portrait.webp"
                        alt="Пример подходящего фото: одиночный студийный портрет с открытым лицом"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-[13px] font-medium ${
                      dockPhotosExpanded ? "text-white/50" : "text-zinc-500"
                    }`}
                  >
                    Без групп, очков и съёмки издалека
                  </p>
                </div>
              </section>
            ) : null}
            <div className={isMobile || dockPhotosExpanded ? "shrink-0" : "contents"}>
            <div className="flex gap-2 overflow-x-auto px-0.5 py-1">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={controlsBusy || libraryLoading}
                className={`${OVERLAY_BUTTON_UA_RESET} flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed text-center transition disabled:opacity-50 ${
                  dockPhotosExpanded
                    ? "border-white/25 bg-white/10 text-white hover:border-indigo-300 hover:bg-white/15"
                    : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:border-indigo-400 hover:bg-indigo-50"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span className="mt-1 text-[13px] font-semibold">Добавить</span>
              </button>
              {photos.map((photo) => {
                const selected = selectedPhotoIds.has(photo.id);
                const deleting = deletingPhotoId === photo.id;
                return (
                  <div
                    key={photo.id}
                    className={`group relative h-[4.75rem] w-[4.75rem] shrink-0 rounded-xl ring-2 transition ${
                      selected ? "ring-indigo-300" : "ring-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={selected ? "Не использовать фото" : "Использовать фото"}
                      aria-pressed={selected}
                      disabled={controlsBusy || deleting}
                      onClick={() => togglePhoto(photo.id)}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 overflow-hidden rounded-xl bg-zinc-800 disabled:opacity-50`}
                    >
                      {photo.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.previewUrl}
                          alt={photo.originalFilename || "Сохранённое фото"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[13px] font-medium text-zinc-400">
                          Фото
                        </span>
                      )}
                      {selected ? (
                        <span
                          aria-hidden
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-300 text-[13px] font-bold text-zinc-950 shadow"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      aria-label="Удалить фото"
                      disabled={busy || Boolean(deletingPhotoId)}
                      onClick={() => void deletePhoto(photo)}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-0 left-0 z-10 flex h-11 w-11 items-end justify-start p-1.5 text-white disabled:opacity-50`}
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-md"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            {!isMobile && !libraryLoading && !photos.length ? (
              <p
                className={`mt-2 shrink-0 text-[13px] font-medium ${
                  dockPhotosExpanded ? "text-white/65" : "text-zinc-600"
                }`}
              >
                Фото необязательно. Если добавите — сохранится для следующих генераций и внешности.
              </p>
            ) : null}
            <button
              type="button"
              onClick={closePrefsSheet}
              className={`${OVERLAY_BUTTON_UA_RESET} ${
                dockPhotosExpanded && !isMobile ? "mt-auto" : "mt-3"
              } flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-indigo-700`}
            >
              Готово
            </button>
            </div>
            </div>
          </div>
        ) : null}

        {expandedControl === "model" && !showResultChrome ? (
          <div
            id="inline-generation-models"
            role={isDock ? undefined : "dialog"}
            aria-modal={isDock ? undefined : "true"}
            aria-label="Выбор модели"
            className={
              dockModelExpanded
                ? isMobile
                  ? `${dockSheetPanelBase} overflow-hidden`
                  : `${dockSheetPanel} overflow-y-auto`
                : isMobile
                  ? `${sheetPos} inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden bg-white p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900`
                  : `${sheetPos} inset-x-0 bottom-0 z-50 max-h-[min(82dvh,44rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
            }
          >
            <div
              className={
                isMobile
                  ? "flex h-full min-h-0 w-full flex-col"
                  : "contents"
              }
            >
            {dockModelExpanded ? (
              <button
                type="button"
                aria-label="Свернуть выбор модели"
                onClick={closePrefsSheet}
                className={`${OVERLAY_BUTTON_UA_RESET} mx-auto mb-1 flex w-full shrink-0 flex-col items-center gap-1 py-1`}
              >
                <span className={dockSheetHandle} aria-hidden />
              </button>
            ) : (
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-300" aria-hidden />
            )}
            <div className="mb-2 flex min-h-11 shrink-0 items-center justify-between gap-3">
              <span
                className={`text-[13px] font-semibold ${
                  dockModelExpanded ? "text-white" : "text-zinc-900"
                }`}
              >
                {videoCompose ? "Модель видео" : "Модель фото"}
              </span>
              <button
                type="button"
                aria-label="Закрыть выбор модели"
                onClick={closePrefsSheet}
                className={
                  dockModelExpanded
                    ? dockSheetCloseBtn
                    : `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`
                }
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div
              className={
                isMobile
                  ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pt-1 pb-1"
                  : "contents"
              }
            >
            {!videoCompose ? (
            <div className="grid shrink-0 grid-cols-2 gap-2">
              {models.map((item) => {
                const selected = model === item.id;
                const display = GENERATION_MODEL_DISPLAY[item.id];
                const unaffordable =
                  credits !== null && credits < item.cost;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={unaffordable || undefined}
                    disabled={controlsBusy}
                    title={
                      unaffordable
                        ? "Не хватает кредитов"
                        : display?.description || item.label
                    }
                    onClick={() => selectImageModel(item.id)}
                    className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-20 min-w-0 items-center gap-3 rounded-xl p-3 text-left ring-2 transition ${
                      dockModelExpanded
                        ? selected
                          ? "bg-white/15 text-white ring-indigo-300 shadow-sm"
                          : "bg-white/5 text-white ring-white/10 hover:bg-white/10 hover:ring-white/25"
                        : selected
                          ? "bg-indigo-50 text-zinc-900 ring-indigo-500 shadow-sm"
                          : "bg-zinc-100 text-zinc-900 ring-zinc-200 hover:bg-zinc-200 hover:ring-zinc-300"
                    } ${unaffordable ? "opacity-90" : ""} disabled:opacity-50`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
                        dockModelExpanded ? "bg-white/90" : "bg-white"
                      }`}
                    >
                      <GenerationModelIcon modelId={item.id} />
                    </span>
                    <span className="min-w-0 flex-1 pr-9">
                      <span className="block truncate text-[13px] font-semibold leading-tight">
                        {displayLabelForGenerationModel(item.id, item.label)}
                      </span>
                      {unaffordable ? (
                        <span
                          className={`mt-1 block text-[13px] font-semibold leading-tight ${
                            dockModelExpanded ? "text-rose-400" : "text-rose-600"
                          }`}
                        >
                          Не хватает кредитов
                        </span>
                      ) : (
                        <span
                          className={`mt-1 block line-clamp-2 text-[13px] font-medium leading-tight ${
                            dockModelExpanded ? "text-white/60" : "text-zinc-500"
                          }`}
                        >
                          {display?.description || "Генерация изображений"}
                        </span>
                      )}
                    </span>
                    <GenerationCreditCostBadge
                      cost={item.cost}
                      unaffordable={unaffordable}
                      className="absolute right-1.5 top-1.5"
                    />
                  </button>
                );
              })}
            </div>
            ) : null}
            {videoCompose ? (
              <>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  {videoModels.map((item) => {
                    const selected = activeVideoModel?.id === item.id;
                    const itemCost = calculateVideoCreditCost(
                      item.cost,
                      videoDurationSeconds,
                      item.id
                    );
                    const unaffordable = credits !== null && credits < itemCost;
                    const description = displayDescriptionForGenerationModel(
                      item.id,
                      "Видео из фото"
                    );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        aria-disabled={unaffordable || undefined}
                        disabled={controlsBusy}
                        title={unaffordable ? "Не хватает кредитов" : description}
                        onClick={() => selectVideoModel(item.id)}
                        className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-20 min-w-0 items-center gap-3 rounded-xl p-3 text-left ring-2 transition ${
                          dockModelExpanded
                            ? selected
                              ? "bg-white/15 text-white ring-indigo-300 shadow-sm"
                              : "bg-white/5 text-white ring-white/10 hover:bg-white/10 hover:ring-white/25"
                            : selected
                              ? "bg-indigo-50 text-zinc-900 ring-indigo-500 shadow-sm"
                              : "bg-zinc-100 text-zinc-900 ring-zinc-200 hover:bg-zinc-200 hover:ring-zinc-300"
                        } ${unaffordable ? "opacity-90" : ""} disabled:opacity-50`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
                            dockModelExpanded ? "bg-white/90" : "bg-white"
                          }`}
                        >
                          <GenerationModelIcon modelId={item.id} />
                        </span>
                        <span className="min-w-0 flex-1 pr-9">
                          <span className="block truncate text-[13px] font-semibold leading-tight">
                            {displayLabelForGenerationModel(item.id, item.label)}
                          </span>
                          {unaffordable ? (
                            <span
                              className={`mt-1 block text-[13px] font-semibold leading-tight ${
                                dockModelExpanded ? "text-rose-400" : "text-rose-600"
                              }`}
                            >
                              Не хватает кредитов
                            </span>
                          ) : (
                            <span
                              className={`mt-1 block line-clamp-2 text-[13px] font-medium leading-tight ${
                                dockModelExpanded ? "text-white/60" : "text-zinc-500"
                              }`}
                            >
                              {description}
                            </span>
                          )}
                        </span>
                        <GenerationCreditCostBadge
                          cost={itemCost}
                          unaffordable={unaffordable}
                          className="absolute right-1.5 top-1.5"
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {videoCompose ? (
              <>
                <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
                  <label className="block min-w-0">
                    <span
                      className={`mb-1 block text-[13px] font-medium ${
                        dockModelExpanded ? "text-white/65" : "text-zinc-600"
                      }`}
                    >
                      Формат
                    </span>
                    <select
                      value={videoAspectRatio}
                      onChange={(event) => setVideoAspectRatio(event.target.value)}
                      disabled={controlsBusy}
                      className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${
                        dockModelExpanded
                          ? dockSheetField
                          : "rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-900 focus:border-indigo-400"
                      }`}
                    >
                      {VIDEO_ASPECT_RATIO_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span
                      className={`mb-1 block text-[13px] font-medium ${
                        dockModelExpanded ? "text-white/65" : "text-zinc-600"
                      }`}
                    >
                      Длительность
                    </span>
                    <select
                      value={String(videoDurationSeconds)}
                      onChange={(event) =>
                        setVideoDurationSeconds(Number(event.target.value))
                      }
                      disabled={controlsBusy}
                      className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${
                        dockModelExpanded
                          ? dockSheetField
                          : "rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-900 focus:border-indigo-400"
                      }`}
                    >
                      {videoDurationChoices.map((item) => {
                        const extra = videoDurationExtraCredits(
                          item.value,
                          activeVideoModel?.id
                        );
                        return (
                          <option key={item.value} value={item.value}>
                            {extra > 0 ? `${item.label} · +${extra}` : item.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="col-span-2 block min-w-0">
                    <span
                      className={`mb-1 block text-[13px] font-medium ${
                        dockModelExpanded ? "text-white/65" : "text-zinc-600"
                      }`}
                    >
                      Качество
                    </span>
                    <select
                      value={DEFAULT_VIDEO_RESOLUTION}
                      disabled
                      className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${
                        dockModelExpanded
                          ? dockSheetField
                          : "rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-900 focus:border-indigo-400"
                      }`}
                    >
                      {VIDEO_RESOLUTION_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            ) : (
              <>
            <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span
                  className={`mb-1 block text-[13px] font-medium ${
                    dockModelExpanded ? "text-white/65" : "text-zinc-600"
                  }`}
                >
                  Формат
                </span>
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                  disabled={controlsBusy || !aspectRatios.length}
                  className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${
                    dockModelExpanded
                      ? dockSheetField
                      : "rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-900 focus:border-indigo-400"
                  }`}
                >
                  {aspectRatios.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span
                  className={`mb-1 block text-[13px] font-medium ${
                    dockModelExpanded ? "text-white/65" : "text-zinc-600"
                  }`}
                >
                  Качество
                </span>
                <select
                  value={imageSize}
                  onChange={(event) => setImageSize(event.target.value)}
                  disabled={controlsBusy || !imageSizes.length}
                  className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${
                    dockModelExpanded
                      ? dockSheetField
                      : "rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-900 focus:border-indigo-400"
                  }`}
                >
                  {visibleImageSizes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
              </>
            )}
            </div>
            <button
              type="button"
              onClick={closePrefsSheet}
              className={`${OVERLAY_BUTTON_UA_RESET} ${
                dockModelExpanded && !isMobile ? "mt-auto" : "mt-3"
              } flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-indigo-700`}
            >
              Готово
            </button>
            </div>
          </div>
        ) : null}

        {!showResultChrome ? (
        <section
          className={`shrink-0 ${
            isDock
              ? `rounded-none border-0 bg-transparent p-1${
                  dockExpanded ? " invisible pointer-events-none" : ""
                }`
              : `rounded-2xl border p-2 ${
                  glassChrome
                    ? "border-white/15 bg-black/15 backdrop-blur-md"
                    : "border-zinc-200 bg-white/95"
                }`
          }`}
          aria-hidden={isDock && dockExpanded ? true : undefined}
        >
          <div className="flex items-start gap-2 overflow-x-auto overscroll-x-contain px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-expanded={expandedControl === "photos"}
              aria-controls="inline-generation-photos"
              disabled={controlsBusy}
              onClick={() => {
                setExpandedControl((current) => (current === "photos" ? null : "photos"));
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 rounded-xl text-left transition ${composeTileFrame} ${composeTileBorder(
                expandedControl === "photos",
              )} disabled:opacity-50`}
            >
              <span className="absolute inset-0 overflow-hidden rounded-xl">
              {selectedPhotos[0]?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPhotos[0].previewUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-300">
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden
                  >
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
                  </svg>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
              <span className="absolute inset-x-2 bottom-1.5 text-[13px] font-semibold text-white">
                Ваши фото
              </span>
              <span className="absolute right-1.5 top-1.5 rounded-full bg-zinc-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {selectedPhotos.length}/{maxPhotos}
              </span>
              </span>
            </button>

            <button
              type="button"
              aria-pressed={imageCompose}
              aria-expanded={imageCompose && expandedControl === "model"}
              aria-controls="inline-generation-models"
              disabled={controlsBusy || !models.length}
              onClick={onImageModeTileClick}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl p-1.5 text-center transition ${composeTileFrame} ${composeTileBorder(
                imageCompose,
              )} disabled:opacity-50`}
            >
              <span className={composeModeLogoWrap}>
                <GenerationModelIcon modelId={model} className="h-4 w-4" />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                {composeModeTileLabel("image")}
              </span>
            </button>

            {videoEnabled ? (
              <button
                type="button"
                aria-pressed={videoCompose}
                aria-expanded={videoCompose && expandedControl === "model"}
                aria-controls="inline-generation-models"
                disabled={controlsBusy || !videoModels.length}
                onClick={onVideoModeTileClick}
                className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl p-1.5 text-center transition ${composeTileFrame} ${composeTileBorder(
                  videoCompose,
                )} disabled:opacity-50`}
              >
                <span className={composeModeLogoWrap}>
                  <GenerationModelIcon
                    modelId={activeVideoModel?.id || DEFAULT_VIDEO_MODEL}
                    className="h-4 w-4"
                  />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                  {composeModeTileLabel("video")}
                </span>
              </button>
            ) : null}

            {photoshootEnabled ? (
              <button
                type="button"
                aria-pressed={photoshootCompose}
                disabled={controlsBusy}
                onClick={onPhotoshootTileClick}
                className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl p-1.5 text-center transition ${composeTileFrame} ${composeTileBorder(
                  photoshootCompose,
                )} disabled:opacity-50`}
              >
                <span className={composeModeLogoWrap}>
                  <svg
                    className="h-4 w-4 text-zinc-800"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path
                      d="M4 7h4l1.2-2h5.6L16 7h4v12H4V7Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="13" r="3.1" />
                  </svg>
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                  {composeModeTileLabel("photoshoot")}
                </span>
              </button>
            ) : null}
          </div>

        </section>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void uploadFiles(files);
            event.target.value = "";
          }}
        />

        {(Boolean(error) || Boolean(configError)) && !needsCredits ? (
          <div
            className={`rounded-xl border p-3 ${
              isDock
                ? `border-rose-300/25 bg-rose-950/35${
                    dockExpanded ? " invisible pointer-events-none" : ""
                  }`
                : glassChrome
                  ? "border-white/15 bg-black/15 backdrop-blur-md"
                  : "border-rose-200 bg-rose-50"
            }`}
            aria-hidden={isDock && dockExpanded ? true : undefined}
          >
            <p
              className={`text-[13px] font-medium ${
                isDock || glassChrome ? "text-rose-200" : "text-rose-700"
              }`}
            >
              {configError || error}
            </p>
          </div>
        ) : null}
        </div>
      </div>

      <footer
        className={`relative z-20 shrink-0 p-3 ${
          hideComposeChrome
          || promptExpanded
          || (isDock && dockExpanded)
          || (showResultActions && !showCreditsCta)
            ? "hidden"
            : isDock
            ? "mt-auto border-0 bg-transparent pb-3"
            : `pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
                showResultChrome
                  ? "border-transparent bg-transparent"
                  : "border-t border-zinc-200 bg-white/90 backdrop-blur-md"
              }`
        }`}
      >
        <div className="flex min-w-0 gap-2">
        {showCreditsCta ? (
          <PricingEntryLink
            href="/pricing"
            onClick={() =>
              reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING)
            }
            className="flex min-h-12 min-w-0 w-full items-center justify-center rounded-2xl bg-rose-500/85 px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(244,63,94,0.45)] transition hover:bg-rose-500/95"
          >
            Недостаточно кредитов
          </PricingEntryLink>
        ) : (
          <button
            type="button"
            aria-busy={busy}
            aria-valuemin={jobBusy ? 0 : undefined}
            aria-valuemax={jobBusy ? 100 : undefined}
            aria-valuenow={jobBusy ? Math.round(progress) : undefined}
            disabled={
              busy ||
              (isAuthed &&
                (controlsBusy ||
                  libraryLoading ||
                  (!photoshootCompose && scenarioLoading) ||
                  Boolean(busyAction) ||
                  Boolean(configError) ||
                  (!photoshootCompose && draftPrompt.trim().length < 8)))
            }
            onClick={() => {
              if (!isAuthed) {
                openAuthModal();
                return;
              }
              if (busy) return;
              if (photoshootCompose) {
                if (photoshootLibraryFrame) {
                  startPhotoshootFromLibrary();
                  return;
                }
                setError(PHOTOSHOOT_NEEDS_LIBRARY_PHOTO);
                setExpandedControl("photos");
                return;
              }
              if (videoCompose) {
                void runGenerate({
                  promptOverride: draftPrompt.trim() || DEFAULT_VIDEO_PROMPT,
                  modality: "video",
                  parentGenerationId: animateParentId || undefined,
                });
                return;
              }
              if (phase === "done" && resultUrl && generationId) {
                openPromptEditor();
                return;
              }
              void runGenerate({ promptOverride: draftPrompt });
            }}
            className={`${OVERLAY_BUTTON_UA_RESET} relative isolate flex min-h-12 min-w-0 w-full items-center justify-center overflow-hidden rounded-2xl px-4 py-3 text-[15px] font-semibold text-white shadow-lg shadow-indigo-950/35 transition active:scale-[0.99] disabled:cursor-not-allowed ${
              busy
                ? "opacity-100 disabled:opacity-100"
                : "bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 disabled:opacity-50"
            }`}
            style={jobBusy ? { backgroundColor: "rgba(39,39,42,0.95)" } : undefined}
          >
          {jobBusy ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 z-0 origin-left transition-transform duration-300 ease-out"
              style={{
                width: "100%",
                transform: `scaleX(${Math.min(1, Math.max(0.06, progress / 100))})`,
                background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              aria-hidden
            />
          ) : null}
          <span className="relative z-10 flex min-w-0 items-center justify-center gap-1.5 drop-shadow-sm">
            {phase === "done" && resultUrl && !busy ? (
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m14.5 6.7 2.8 2.8" />
              </svg>
            ) : null}
            <span
              className={
                starting ||
                phase === "uploading" ||
                phase === "generating" ||
                (photoshootCompose && !photoshootLibraryFrame) ||
                (videoCompose && scenarioLoading) ||
                (phase === "done" && resultUrl && !photoshootCompose && !videoCompose)
                  ? phase === "done" && resultUrl && !busy
                    ? "truncate"
                    : undefined
                  : "flex min-w-0 w-full items-center justify-between gap-3"
              }
            >
              {starting
                ? "Запускаем…"
                : phase === "uploading"
                ? `Загружаем фото · ${Math.round(progress)}%`
                : phase === "generating"
                  ? `Генерируем · ${Math.round(progress)}%`
                  : photoshootCompose && !photoshootLibraryFrame
                    ? "Выберите фото"
                  : videoCompose && scenarioLoading
                    ? ANIMATE_SCENARIO_PLACEHOLDER
                    : phase === "done" && resultUrl && !photoshootCompose && !videoCompose
                    ? "Что изменить"
                    : (
                      <>
                        <span className="shrink-0">
                          {composeGenerateCtaLabel(composeMode)}
                        </span>
                        {composeCtaModelLabel || composeCtaCost != null ? (
                          <span className="flex min-w-0 items-center justify-end gap-1.5">
                            {composeCtaModelLabel ? (
                              <span className="min-w-0 truncate text-[13px] font-medium text-white/80">
                                {composeCtaModelLabel}
                              </span>
                            ) : null}
                            {composeCtaCost != null ? (
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums ${
                                  cannotAffordSelected
                                    ? "bg-rose-400/95"
                                    : "bg-white/20"
                                }`}
                              >
                                {composeCtaCost}✦
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </>
                    )}
            </span>
          </span>
          </button>
        )}
        </div>
      </footer>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-20 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-zinc-900/95 px-4 py-2 text-center text-[13px] font-medium text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md"
        >
          {toast}
        </div>
      ) : null}

      {resultPreviewOpen && resultUrl
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр результата"
              className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setResultPreviewOpen(false)}
            >
              <button
                type="button"
                aria-label="Закрыть просмотр"
                className={`${OVERLAY_BUTTON_UA_RESET} absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55`}
                onClick={() => setResultPreviewOpen(false)}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
              {resultModality === "video" ? (
                <video
                  src={resultUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[min(90dvh,100%)] max-w-full"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultUrl}
                  alt="Результат генерации"
                  className="max-h-[min(90dvh,100%)] max-w-full object-contain"
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
