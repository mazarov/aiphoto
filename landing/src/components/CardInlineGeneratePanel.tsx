"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  CREDIT_BALANCE_REFRESH_EVENT,
  requestCreditBalanceRefresh,
} from "@/lib/credit-balance-events";
import {
  FALLBACK_VIDEO_GENERATION_MODELS,
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
  displayTileLabelForGenerationModel,
} from "@/lib/generation-model-labels";
import {
  analyzeImageToPrompt,
  dataUrlFromImageUrl,
  fetchAnalyzeQuota,
  type AnalyzeQuotaPayload,
} from "@/lib/image-prompt-analyze-client";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";
import {
  clearPendingGenerateDock,
  persistPendingGenerateDock,
} from "@/lib/generate-dock-pending";
import {
  PHOTO_PROMPT_EPHEMERAL_ID,
  PHOTO_PROMPT_NEEDS_PHOTO,
  PHOTO_PROMPT_SUCCESS_DOCK_SURFACE,
  PHOTO_PROMPT_UPLOAD_MAX_PX,
  PHOTO_PROMPT_UPLOAD_QUALITY,
  clampPhotoPromptSelection,
  clearPendingPhotoPrompt,
  composePhotoPromptBusyLabel,
  composePhotoPromptGuestQuotaLabel,
  guestPhotoPromptRemainingFree,
  isPhotoPromptComposeMode,
  isPhotoPromptEphemeralId,
  makeEphemeralPhotoPromptPhoto,
  nextPhotoPromptSelection,
  photoPromptSelectionCap,
  markPhotoPromptAnalyzeCompleted,
  resolvePhotoPromptAnalyzeSource,
  sharePhotoPromptAnalyze,
  shouldHoldPhotoPromptResultChrome,
  shouldStartPhotoPromptAnalyze,
} from "@/lib/generate-photo-prompt";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { browserAcquisitionHeaders } from "@/lib/acquisition-client-events";
import type { GenerationMenuAction } from "@/components/GenerationCardMenu";
import {
  downloadGenerationResult,
  downloadStickerPackZip,
  downloadStickerPlatformFile,
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
  isRestorableLastDockResult,
  photoshootTileUrlsFromUnknown,
  shouldAttachLibraryPhotos,
  shouldHydrateLastDockResult as seedAllowsLastDockHydrate,
  applyComposeExampleToSeed,
} from "@/lib/generate-dock-seed";
import {
  isPersistableIdentityDataUrl,
  libraryStoragePaths,
  mergeLibraryHydratePhotos,
  mergeLibraryHydrateSelection,
  shouldPersistEphemeralIdentityPhoto,
  uploadDataUrlToGenerationLibrary,
} from "@/lib/compose-library-photos";
import { useAuth } from "@/context/AuthContext";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  useGenerateDock,
  type GenerateDockSurface,
} from "@/context/GenerateDockContext";
import { GenerationResultBackdrop } from "@/components/generate/GenerationResultBackdrop";
import {
  prefetchComposeExampleAudience,
  prefetchComposeExampleListing,
  prefetchComposeExamplePickerFirstPage,
} from "@/lib/compose-example-audience-client";
import { ComposeModelChoiceCard } from "@/components/generate/ComposeModelChoiceCard";
import {
  ComposeDockToolTile,
  ComposeExampleToolIcon,
  ComposeLibraryPhotosIcon,
  ComposeModelToolTile,
  ComposeToolChoiceTile,
  ComposeToolPickerTile,
} from "@/components/generate/ComposeModeToolTile";
import {
  ComposePhotoUploadGuide,
  ComposeToolGuide,
  StickerPickerGuide,
} from "@/components/generate/ComposeToolGuide";
import {
  ComposeSheetShell,
  DockAutoHeightBox,
  DockInlineDrawer,
  DockSummaryPocket,
} from "@/components/generate/ComposeSheetShell";
import { ComposeActiveJobsTray } from "@/components/generate/ComposeActiveJobsTray";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import { GenerationResultBottomBar } from "@/components/generate/GenerationResultBottomBar";
import {
  ComposeAuthSheet,
  type ComposeAuthSheetReason,
} from "@/components/generate/ComposeAuthSheet";
import { LowBalanceUpgradeOfferCard } from "@/components/LowBalanceUpgradeOfferCard";
import {
  canStartAnotherDockJob,
  MAX_PARALLEL_DOCK_JOBS,
  type ActiveDockGenerationJob,
} from "@/lib/generate-active-jobs";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PHOTOSHOOT_BUSY,
  YM_GOAL_PHOTOSHOOT_DISABLED,
  YM_GOAL_PHOTOSHOOT_FAIL,
  YM_GOAL_PHOTOSHOOT_NO_CREDITS,
  YM_GOAL_PHOTOSHOOT_OPEN,
  YM_GOAL_PHOTOSHOOT_READY,
  YM_GOAL_PHOTOSHOOT_SUBMIT,
  YM_GOAL_STICKER_DONE,
  YM_GOAL_STICKER_EMOTION,
  YM_GOAL_STICKER_MOTION,
  YM_GOAL_STICKER_REVISE,
  YM_GOAL_STICKER_START,
  YM_GOAL_STICKER_TEXT,
  YM_GOAL_STICKER_BORDER,
  YM_GOAL_STICKER_DOWNLOAD,
  YM_GOAL_STICKER_FROM_RESULT_CLOSE,
  YM_GOAL_STICKER_FROM_RESULT_OPEN,
  YM_GOAL_STICKER_FROM_RESULT_RESTYLE,
  YM_GOAL_ANALYZE_AUTH_REQUIRED,
  YM_GOAL_ANALYZE_NO_CREDITS,
  YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN,
  YM_GOAL_GENERATION_PHOTO_PROMPT_READY,
  YM_GOAL_GENERATION_PHOTO_PROMPT_START,
  YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD,
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
  GPT_IMAGE_25_FLARE_CREDIT_COST,
  GPT_IMAGE_25_FLARE_IMAGE_MODEL,
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
  COMPOSE_BUY_CREDITS_CTA,
  resultChromeHidesComposeFooter,
  resultChromeHidesPromptStrip,
  resultPrimaryAction,
  composeGenerateCtaLabel,
  composeGenerateCtaShowsModelName,
  COMPOSE_SAVE_PROMPT_CTA,
  showBlankPromptRemixBlock,
  COMPOSE_SAVING_PROMPT_CTA,
  composeModeFromDockIntent,
  composeNeedsPhotoCtaLabel,
  composeHasSingleSourcePhoto,
  stickerStudioCta,
  COMPOSE_NEXT_STEP_CTA,
  COMPOSE_PHOTOS_TOOL_EDGE_LABEL,
  COMPOSE_TOOL_SHEET_DONE_CTA,
  COMPOSE_TOOL_SHEET_TITLE,
  STICKER_PACK_CREATE_CTA,
  STICKER_PACK_SOON_CTA,
  composeCtaDisabledForStickerPack,
  composePhotosToolCountLabel,
  composeSecondaryTools,
  composeToolOptions,
  composeToolTileBodyLabel,
  promptModalityForComposeMode,
  type StickerToolKind,
  rememberCompletedImageResult,
  resolveDockStepCta,
  resolvePhotoshootLibraryFrame,
  resolvePhotoshootReadyFrame,
  resolvePromptDrawerTextareaHeightPx,
  resolveStickerFromResultFrame,
  shouldDockDrawerFillViewport,
  PROMPT_DRAWER_MIN_HEIGHT_PX,
  PROMPT_DRAWER_MIN_LINES,
  PHOTOSHOOT_NEEDS_LIBRARY_PHOTO,
  STICKER_NEEDS_LIBRARY_PHOTO,
  BLANK_PROMPT_PLACEHOLDER,
  PROMPT_FIELD_LABEL,
  type DockOpenStepSurface,
  type GenerateComposeMode,
  type PhotoshootReadyFrame,
} from "@/lib/generate-compose-mode";
import {
  ANIMATE_SCENARIO_PLACEHOLDER,
  isGenericVideoPrompt,
} from "@/lib/video-animate-scenario";
import { splitVideoCatalogPrompt } from "@/lib/video-catalog-prompt";
import { LISTING_VIDEO_REPEAT_KIND } from "@/lib/listing-video-repeat";
import {
  calculateVideoCreditCost,
  videoDurationExtraCredits,
} from "@/lib/video-generation-contract";
import {
  STICKER_PACK_DEFAULT_CREDIT_COST,
  STICKER_PACK_EDIT_KIND,
  isStickerPackEditKind,
  stickerPackTileFilename,
} from "@/lib/sticker-pack";
import { sidecarTileNumberForUrl, sidecarTileUrls } from "@/lib/generations-list";
import {
  DEFAULT_STICKER_STYLE_ID,
  STICKER_EDIT_KIND,
  STICKER_STYLES as STICKER_STYLES_FALLBACK,
  STICKER_TEXT_ACTION,
  isStickerEditKind,
  type StickerEditAction,
  type StickerPlatform,
} from "@/lib/sticker";
import {
  loadStickerCatalogClient,
  peekStickerCatalog,
  stickerStyleTileLabel,
  type StickerCatalogClient,
} from "@/lib/sticker-catalog-client";
import {
  STICKER_ACTION_COPY,
  STICKER_ACTION_FREE_DETAIL,
  STICKER_BORDER_COPY,
  STICKER_FROM_RESULT_RAIL,
  STICKER_FROM_RESULT_RAIL_DETAIL,
  STICKER_FROM_RESULT_RESTYLE,
  STICKER_PACK_SET_PICKER_TITLE,
  STICKER_STYLE_PICKER_CONFIRM_CTA,
  STICKER_STYLE_PICKER_TITLE,
  type StickerResultAction,
} from "@/lib/sticker-action-sheet";
import {
  loadStickerPackExamplesClient,
  peekStickerPackExamples,
  type StickerPackExampleClient,
} from "@/lib/sticker-pack-examples-client";
import type { StickerDownloadTarget } from "@/components/sticker/StickerDownloadSheet";
import {
  PHOTOSHOOT_CTA_LABEL,
  PHOTOSHOOT_CREDIT_COST,
  PHOTOSHOOT_EDIT_KIND,
  isPhotoshootEditKind,
  photoshootCtaDetail,
  photoshootTileIndexForUrl,
  resolvePhotoshootSheetAspect,
} from "@/lib/photoshoot";
import {
  DEFAULT_CARD_REPEAT_REWARD_CONFIG,
  cardRepeatRewardBadgeLabel,
  cardRepeatRewardDetail,
  cardRepeatRewardMenuHint,
  cardRepeatRewardOffer,
  parseCardModerationStatus,
  publishModerationToast,
  publishRewardToastMessage,
  type CardModerationStatus,
  type CardRepeatRewardConfig,
} from "@/lib/publish-reward";
import { showUserPublishControl } from "@/lib/publish-access";
import {
  parseStoredGenerationPreferences,
  pickFresherPreferences,
  readCachedGenerationPreferences,
  resolveComposerPreferences,
  writeCachedGenerationPreferences,
  type StoredGenerationPreferences,
} from "@/lib/generation-preferences";
import { shouldShowPreserveOutfitChip } from "@/lib/wardrobe-policy";
import { resolveVideoEnqueueParentGenerationId } from "@/lib/user-generation-photos";
import {
  PHOTO_GUIDE_PORTRAIT_SRC,
  readCachedUserGenerationPhotos,
  warmupPhotoPreviewImages,
  writeCachedUserGenerationPhotos,
} from "@/lib/user-generation-photos-cache";
import {
  fetchGenerateBootstrap,
  peekOptimisticAuthUserId,
  readFrameZeroGenerateState,
  snapshotFromBootstrapPayload,
  updateCachedGenerateUserCredits,
} from "@/lib/generate-bootstrap-client";
import { computeSeedSyncTransition } from "@/lib/generate-panel-seed-sync";
import { useGenerateHostAdapter } from "@/components/generate/host-adapter";
import { isStickerGenerateDockPath, listingComposeExampleInitialFilter } from "@/lib/generate-dock-path";
import {
  composePhotosPreviewUrls,
  composePreviewImageUrls,
} from "@/lib/compose-tile-mosaic";
import {
  SEO_COMPOSE_EXAMPLE_SHEET_CLOSE_LABEL,
  SEO_COMPOSE_EXAMPLE_SHEET_COLLAPSE_LABEL,
  SEO_COMPOSE_EXAMPLE_SHEET_TITLE,
  SEO_COMPOSE_EXAMPLE_TOOL_EDGE_LABEL,
  SEO_COMPOSE_EXAMPLE_TOOL_LABEL,
  SEO_COMPOSE_PICK_EXAMPLE_CTA,
  composeNeedsExamplePick,
  composeShouldAutoOpenExampleSheet,
  composeShowsExampleTool,
} from "@/lib/generaciya-foto-compose-example";
import {
  COMPOSE_PICK_IMAGE_MODEL_CTA,
  composeNeedsImageModelPick,
  composeShouldAutoOpenModelSheet,
  readSessionChosenImageModel,
  writeSessionChosenImageModel,
} from "@/lib/compose-image-model";
import { composePhotoshootGuideExample } from "@/lib/photoshoot-compose-example";
import {
  composeToolGuideHidesPromptStrip,
  composeToolGuideVisible,
} from "@/lib/compose-tool-guide";

const ComposeExamplePicker = dynamic(
  () =>
    import("@/components/generate/ComposeExamplePicker").then(
      (mod) => mod.ComposeExamplePicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-[13px] opacity-60"
        aria-busy="true"
      >
        Загружаем образы…
      </div>
    ),
  },
);

const StickerPackSetPicker = dynamic(
  () =>
    import("@/components/sticker/StickerPackSetPicker").then(
      (mod) => mod.StickerPackSetPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[8rem] w-full rounded-2xl bg-white/5" aria-busy="true" />
    ),
  },
);

const StickerStylePicker = dynamic(
  () =>
    import("@/components/sticker/StickerStylePicker").then(
      (mod) => mod.StickerStylePicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-[13px] opacity-60"
        aria-busy="true"
      >
        Загружаем стили…
      </div>
    ),
  },
);

const StickerActionSheet = dynamic(
  () =>
    import("@/components/sticker/StickerActionSheet").then(
      (mod) => mod.StickerActionSheet,
    ),
  { ssr: false },
);

const StickerFromResultSheet = dynamic(
  () =>
    import("@/components/sticker/StickerFromResultSheet").then(
      (mod) => mod.StickerFromResultSheet,
    ),
  { ssr: false },
);

const StickerBorderSheet = dynamic(
  () =>
    import("@/components/sticker/StickerBorderSheet").then(
      (mod) => mod.StickerBorderSheet,
    ),
  { ssr: false },
);

const StickerDownloadSheet = dynamic(
  () =>
    import("@/components/sticker/StickerDownloadSheet").then(
      (mod) => mod.StickerDownloadSheet,
    ),
  { ssr: false },
);

const PhotoshootOverlay = dynamic(
  () =>
    import("@/components/generate/PhotoshootOverlay").then(
      (mod) => mod.PhotoshootOverlay,
    ),
  { ssr: false },
);

const PhotoshootFrameFilm = dynamic(
  () =>
    import("@/components/generate/PhotoshootOverlay").then(
      (mod) => mod.PhotoshootFrameFilm,
    ),
  { ssr: false },
);

const GenerationCardMenu = dynamic(
  () =>
    import("@/components/GenerationCardMenu").then(
      (mod) => mod.GenerationCardMenu,
    ),
  { ssr: false },
);

function preloadExampleSheetChunks(stickerMode: boolean, packMode: boolean): void {
  if (stickerMode) {
    void import("@/components/sticker/StickerStylePicker");
    if (packMode) {
      void import("@/components/sticker/StickerPackSetPicker");
    }
    return;
  }
  void import("@/components/generate/ComposeExamplePicker");
}

function preloadGenerationMenuChunk(): void {
  void import("@/components/GenerationCardMenu");
}

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
  audienceTag?: string | null;
};

type Phase = GenerateComposeJobPhase;

type Props = {
  /** Monotonic seed counter from GenerateDockContext — syncs in-place without unmounting. */
  seedToken?: number;
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
  seedToken = 0,
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
  const promptDrawerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hostAdapter = useGenerateHostAdapter();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const { open: openPricingModal } = usePricingModal();
  const openPricing = hostAdapter.openPricing || openPricingModal;
  const optimisticUserId = peekOptimisticAuthUserId({ user, authLoading });
  const effectiveUserId =
    user && user.is_anonymous !== true ? user.id : optimisticUserId;
  const isAuthed = Boolean(effectiveUserId);
  const [authSheetReason, setAuthSheetReason] =
    useState<ComposeAuthSheetReason>("default");
  const {
    generateDockV2Enabled,
    setPlateOpen: setDockPlateOpen,
    reportRunProgress,
    reportNeedsCredits,
    activeJobs,
    beginDockJob,
    attachDockJobServerId,
    failDockJob,
    removeDockJob,
    markDockJobSeen,
    subscribeDockJobEvents,
    requestedModelId,
    preferredModelId,
    clearRequestedModelSelection,
    seed,
    seedAnimate,
    applyComposeExamplePick,
    lastDockResult,
    rememberLastDockResult,
    lastDockResultDismissed,
    dismissLastDockResult,
  } = useGenerateDock();
  const isDock = chrome === "dock";
  const isDockV2 = isDock && generateDockV2Enabled;
  const isBlank = source === "blank";
  const pathname = usePathname();
  const resolvedCardIdFromSeed = cardId;
  const resolvedGenerationSurface =
    generationSurface || "prompt_card";
  const dockControlled = isDock && typeof onDockSurfaceChange === "function";

  const initialBootRef = useRef<ReturnType<typeof readFrameZeroGenerateState> | null>(
    null,
  );
  if (initialBootRef.current === null) {
    initialBootRef.current = readFrameZeroGenerateState({
      userId: effectiveUserId,
      pathname:
        pathname ||
        (typeof window !== "undefined" ? window.location.pathname : null),
      preferredModelId,
      seed,
    });
  }
  const initialBoot = initialBootRef.current;

  const initialSeedSyncRef = useRef<ReturnType<
    typeof computeSeedSyncTransition
  > | null>(null);
  if (initialSeedSyncRef.current === null) {
    initialSeedSyncRef.current = computeSeedSyncTransition({
      seed: {
        ...seed,
        source,
        promptText,
        cardId,
      },
      pathname,
      isDock,
      isAuthed,
      lastDockResult,
      lastDockResultDismissed,
    });
  }
  const initialSeedSync = initialSeedSyncRef.current;

  const [pickedExampleCardId, setPickedExampleCardId] = useState<string | null>(
    () => initialSeedSync.pickedExampleCardId,
  );
  const [pickedExamplePreviewUrl, setPickedExamplePreviewUrl] = useState<
    string | null
  >(() => initialSeedSync.pickedExamplePreviewUrl);
  const resolvedCardId = pickedExampleCardId ?? resolvedCardIdFromSeed ?? null;

  const [models, setModels] = useState<ModelOpt[]>(() => initialBoot.models);
  const [aspectRatios, setAspectRatios] = useState<RatioOpt[]>(
    () => initialBoot.aspectRatios,
  );
  const [imageSizes, setImageSizes] = useState<SizeOpt[]>(
    () => initialBoot.imageSizes,
  );
  const [model, setModel] = useState(() => initialBoot.model);
  const [aspectRatio, setAspectRatio] = useState(() => initialBoot.aspectRatio);
  const [imageSize, setImageSize] = useState(() => initialBoot.imageSize);
  const [configError, setConfigError] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(() => initialBoot.maxPhotos);
  /** `/stiker-iz-foto`: dock is the sticker tool for guests and signed-in users. */
  const [composeMode, setComposeMode] = useState<GenerateComposeMode>(
    () => initialSeedSync.composeMode,
  );
  const [analyzeQuota, setAnalyzeQuota] = useState<AnalyzeQuotaPayload | null>(
    null,
  );
  const [videoEnabled, setVideoEnabled] = useState(
    () => initialBoot.videoEnabled,
  );
  const [listingVideoRepeatEnabled, setListingVideoRepeatEnabled] = useState(
    () => initialBoot.listingVideoRepeatEnabled,
  );
  const [composeExampleMatchEnabled, setComposeExampleMatchEnabled] = useState(
    () => initialBoot.composeExampleMatchEnabled,
  );
  const [photoshootComposeExampleEnabled, setPhotoshootComposeExampleEnabled] =
    useState(() => initialBoot.photoshootComposeExampleEnabled);
  const [photoshootEnabled, setPhotoshootEnabled] = useState(
    () => initialBoot.photoshootEnabled,
  );
  const [stickerEnabled, setStickerEnabled] = useState(
    () => initialBoot.stickerEnabled,
  );
  const [stickerFromResultEnabled, setStickerFromResultEnabled] = useState(
    () => initialBoot.stickerFromResultEnabled,
  );
  const [stickerFromResultOpen, setStickerFromResultOpen] = useState(false);
  const [stickerFromResultParentId, setStickerFromResultParentId] = useState<
    string | null
  >(null);
  /** «Сменить стиль» cuts the sticker on screen; «Сделать стикер» cuts the photo. */
  const [stickerStyleSheetMode, setStickerStyleSheetMode] = useState<
    "photo" | "restyle" | null
  >(null);
  const [stickerStyleId, setStickerStyleId] = useState(DEFAULT_STICKER_STYLE_ID);
  const [stickerModelId, setStickerModelId] = useState(
    () => initialBoot.stickerModelId,
  );
  const [stickerCost, setStickerCost] = useState<number | null>(
    () => initialBoot.stickerCost,
  );
  /** From generation-config: flag on, or this email is on the internal allowlist. */
  const [stickerPackEnabled, setStickerPackEnabled] = useState(
    () => initialBoot.stickerPackEnabled,
  );
  const [stickerPackCreditCost, setStickerPackCreditCost] = useState(
    () => initialBoot.stickerPackCreditCost,
  );
  const [stickerCatalog, setStickerCatalog] =
    useState<StickerCatalogClient | null>(() => peekStickerCatalog());
  const [stickerCatalogLoading, setStickerCatalogLoading] = useState(false);
  const [stickerPacks, setStickerPacks] = useState<
    StickerPackExampleClient[] | null
  >(() => peekStickerPackExamples());
  /** «Стикер» tool: one sticker or a pack. Pack enqueue follows `stickerPackEnabled`. */
  const [stickerKind, setStickerKind] = useState<StickerToolKind>("single");
  const [stickerPackSetId, setStickerPackSetId] = useState<string | null>(null);
  /** Open result action («emotion» / «motion» / «text») on a finished sticker. */
  const [stickerActionOpen, setStickerActionOpen] =
    useState<StickerResultAction | null>(null);
  const [stickerDownloadOpen, setStickerDownloadOpen] = useState(false);
  const [stickerDownloadBusy, setStickerDownloadBusy] =
    useState<StickerDownloadTarget | null>(null);
  const [stickerDownloadError, setStickerDownloadError] = useState<
    string | null
  >(null);
  const [stickerTextBusy, setStickerTextBusy] = useState(false);
  const [stickerBorderBusy, setStickerBorderBusy] = useState(false);
  const [stickerBorderOpen, setStickerBorderOpen] = useState(false);
  const stickerStyleTouchedRef = useRef(false);
  const [photoshootOpen, setPhotoshootOpen] = useState(false);
  const [photoshootSourceId, setPhotoshootSourceId] = useState<string | null>(
    null,
  );
  const [photoshootSourceUrl, setPhotoshootSourceUrl] = useState<string | null>(
    null,
  );
  const [photoshootLibraryPath, setPhotoshootLibraryPath] = useState<
    string | null
  >(null);
  const [photoshootTileUrls, setPhotoshootTileUrls] = useState<string[] | null>(
    () => initialSeedSync.photoshootTileUrls,
  );
  const [resultEditKind, setResultEditKind] = useState<string | null>(
    () => initialSeedSync.resultEditKind,
  );
  const photoshootDismissedRef = useRef(false);
  const photoshootPollAbortRef = useRef<AbortController | null>(null);
  const [videoModels, setVideoModels] = useState<ModelOpt[]>(
    () => initialBoot.videoModels,
  );
  const [videoModel, setVideoModel] = useState(() => initialBoot.videoModel);
  const [videoAspectRatio, setVideoAspectRatio] = useState(
    () => initialBoot.videoAspectRatio,
  );
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(
    () => initialBoot.videoDurationSeconds,
  );
  const seededResult = isCompletedResultSeed(seed);
  const restoredLastResult =
    !seededResult &&
    isDock &&
    isBlank &&
    isAuthed &&
    seedAllowsLastDockHydrate(seed, {
      dismissedLastResult: lastDockResultDismissed,
    }) &&
    isRestorableLastDockResult(lastDockResult, {
      dismissedLastResult: lastDockResultDismissed,
    })
      ? lastDockResult
      : null;
  const [resultModality, setResultModality] = useState<"image" | "video">(
    () => initialSeedSync.resultModality,
  );
  const [animateParentId, setAnimateParentId] = useState<string | null>(
    () => initialSeedSync.animateParentId,
  );
  const [animatePreviewUrl, setAnimatePreviewUrl] = useState<string | null>(
    () => initialSeedSync.animatePreviewUrl,
  );
  const [scenarioLoading, setScenarioLoading] = useState(
    () => initialSeedSync.scenarioLoading,
  );
  const scenarioRequestRef = useRef(0);
  const [preferencesHydrated, setPreferencesHydrated] = useState(
    () => Boolean(effectiveUserId) && initialBoot.libraryHydratedFromCache,
  );
  const [hasCompletedImageGeneration, setHasCompletedImageGeneration] =
    useState(
      () =>
        initialBoot.hasCompletedImageGeneration ||
        Boolean(restoredLastResult && restoredLastResult.modality !== "video"),
    );
  const [preserveOutfit, setPreserveOutfit] = useState(
    () => initialBoot.preserveOutfit,
  );
  const [preserveOutfitEnabled, setPreserveOutfitEnabled] = useState(
    () => initialBoot.preserveOutfitEnabled,
  );
  const [credits, setCredits] = useState<number | null>(
    () => initialBoot.credits,
  );

  const [photos, setPhotos] = useState<UserPhoto[]>(() => {
    const pendingDataUrl =
      seed.intent === "photo_prompt" || seed.attachIdentityPhoto
        ? resolvePhotoPromptAnalyzeSource({
            seedPreviewUrl: seed.previewUrl,
          })?.dataUrl || ""
        : "";
    const ephemeral = pendingDataUrl
      ? makeEphemeralPhotoPromptPhoto(pendingDataUrl)
      : null;
    return mergeLibraryHydratePhotos({
      incomingLibrary: initialBoot.photos,
      current: [],
      pendingEphemeral: ephemeral,
    });
  });
  const [hasMorePhotos, setHasMorePhotos] = useState(
    () => initialBoot.hasMorePhotos,
  );
  const loadingMorePhotosRef = useRef(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => {
    const pendingDataUrl =
      seed.intent === "photo_prompt" || seed.attachIdentityPhoto
        ? resolvePhotoPromptAnalyzeSource({
            seedPreviewUrl: seed.previewUrl,
          })?.dataUrl || ""
        : "";
    if (pendingDataUrl) {
      return new Set([PHOTO_PROMPT_EPHEMERAL_ID]);
    }
    return new Set(initialBoot.selectedPhotoIds);
  });
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const selectedPhotoIdsRef = useRef(selectedPhotoIds);
  selectedPhotoIdsRef.current = selectedPhotoIds;
  const persistEphemeralInFlightRef = useRef<Promise<UserPhoto | null> | null>(
    null,
  );
  const prefsDirtyRef = useRef(false);
  const skipNextPrefsPersistRef = useRef(false);
  const seedIntentRef = useRef(seed.intent);
  seedIntentRef.current = seed.intent;
  const [libraryLoading, setLibraryLoading] = useState(
    () => Boolean(effectiveUserId) && !initialBoot.libraryHydratedFromCache,
  );
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>(() => initialSeedSync.phase);
  const phaseRef = useRef<Phase>(initialSeedSync.phase);
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
  const [progress, setProgress] = useState(() => initialSeedSync.progress);
  const [resultUrl, setResultUrl] = useState<string | null>(
    () => initialSeedSync.resultUrl,
  );
  const photoPromptDataUrlRef = useRef<string | null>(null);
  const [resultPreviewOpen, setResultPreviewOpen] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(
    () => initialSeedSync.generationId,
  );
  resultUrlRef.current = resultUrl;
  generationIdRef.current = generationId;
  const [draftPrompt, setDraftPrompt] = useState(
    () => initialSeedSync.draftPrompt,
  );
  const draftPromptRef = useRef(draftPrompt);
  draftPromptRef.current = draftPrompt;
  const composeModeRef = useRef(composeMode);
  composeModeRef.current = composeMode;
  const modelRef = useRef(model);
  modelRef.current = model;
  const hasCompletedImageGenerationRef = useRef(hasCompletedImageGeneration);
  hasCompletedImageGenerationRef.current = hasCompletedImageGeneration;
  const preferencesHydratedRef = useRef(preferencesHydrated);
  preferencesHydratedRef.current = preferencesHydrated;
  const pendingModelAfterHydrateRef = useRef(false);
  const lastImageResultRef = useRef<PhotoshootReadyFrame | null>(
    rememberCompletedImageResult({
      generationId: seededResult
        ? seed.resultGenerationId
        : restoredLastResult?.generationId,
      resultUrl: seededResult ? seed.previewUrl : restoredLastResult?.resultUrl,
      resultModality: seededResult
        ? seed.resultModality === "video"
          ? "video"
          : "image"
        : restoredLastResult?.modality === "video"
          ? "video"
          : "image",
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
    () => initialSeedSync.submittedPrompt,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [isPublished, setIsPublished] = useState(
    () => initialSeedSync.isPublished,
  );
  const [moderationStatus, setModerationStatus] = useState<CardModerationStatus>("none");
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [cardRepeatReward, setCardRepeatReward] = useState<CardRepeatRewardConfig>(
    () => initialBoot.cardRepeatReward,
  );
  const [publishHidden, setPublishHidden] = useState(
    () => initialBoot.publishHidden,
  );
  const [toast, setToast] = useState("");
  const [expandedControlLocal, setExpandedControlLocal] = useState<
    "photos" | "model" | "example" | "tool" | "auth" | null
  >(null);
  const [promptExpandedLocal, setPromptExpandedLocal] = useState(false);

  const activeDockSurface: GenerateDockSurface = dockControlled
    ? (dockSurfaceProp ?? null)
    : promptExpandedLocal
      ? "prompt"
      : expandedControlLocal;
  const activeDockSurfaceRef = useRef<GenerateDockSurface>(activeDockSurface);
  activeDockSurfaceRef.current = activeDockSurface;

  const promptExpanded = activeDockSurface === "prompt";
  const expandedControl =
    activeDockSurface === "photos" ||
    activeDockSurface === "model" ||
    activeDockSurface === "example" ||
    activeDockSurface === "tool" ||
    activeDockSurface === "auth"
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
      } else if (
        value === "photos" ||
        value === "model" ||
        value === "example" ||
        value === "tool" ||
        value === "auth"
      ) {
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
        | "example"
        | "tool"
        | "auth"
        | null
        | ((
            prev: "photos" | "model" | "example" | "tool" | "auth" | null,
          ) => "photos" | "model" | "example" | "tool" | "auth" | null)
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

  const enterStickerCompose = useCallback(() => {
    restoreImagePromptFromVideo();
    setComposeMode("sticker");
    setSelectedPhotoIds((current) => {
      if (current.size <= 1) return current;
      const last = [...current].at(-1);
      return last ? new Set([last]) : new Set();
    });
    setError("");
  }, [restoreImagePromptFromVideo]);

  const enterPhotoPromptCompose = useCallback(() => {
    restoreImagePromptFromVideo();
    setComposeMode("photo_prompt");
    setSelectedPhotoIds((current) => new Set(clampPhotoPromptSelection(current)));
    setError("");
  }, [restoreImagePromptFromVideo]);

  const openInlineAuthSheet = useCallback(
    (reason: ComposeAuthSheetReason = "default") => {
      setError("");
      if (!generateDockV2Enabled) {
        openAuthModal(reason);
        return;
      }
      setAuthSheetReason(reason);
      setDockSurface("auth");
    },
    [generateDockV2Enabled, openAuthModal, setDockSurface],
  );

  const runPhotoPromptAnalyze = useCallback(
    async (dataUrl: string, previewUrl: string) => {
      photoPromptDataUrlRef.current = dataUrl;
      setComposeMode("photo_prompt");
      setResultUrl(previewUrl || dataUrl);
      setGenerationId(null);
      setPhase("generating");
      phaseRef.current = "generating";
      setProgress(8);
      setError("");
      setNeedsCredits(false);
      setDockPlateOpen(true);
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_START);
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD);
      try {
        const result = await sharePhotoPromptAnalyze(dataUrl, (signal) =>
          analyzeImageToPrompt(dataUrl, { signal })
        );
        if (photoPromptDataUrlRef.current !== dataUrl) return;
        if (result.quota) setAnalyzeQuota(result.quota);
        if (!result.ok) {
          if (result.authRequired) {
            reachYandexMetrikaGoal(YM_GOAL_ANALYZE_AUTH_REQUIRED);
            setResultUrl(null);
            setPhase("idle");
            phaseRef.current = "idle";
            openInlineAuthSheet("analyze_quota");
            return;
          }
          if (result.noCredits) {
            reachYandexMetrikaGoal(YM_GOAL_ANALYZE_NO_CREDITS);
            openPricing();
          }
          setError(result.message);
          setPhase("error");
          phaseRef.current = "error";
          return;
        }
        if (result.quota?.credits_charged) {
          requestCreditBalanceRefresh();
        }
        setDraftPrompt(result.prompt);
        promptStashRef.current = {
          ...promptStashRef.current,
          imagePrompt: result.prompt,
        };
        setPhase("idle");
        phaseRef.current = "idle";
        setProgress(0);
        setResultUrl(null);
        setGenerationId(null);
        enterImageCompose();
        setPhotoshootOpen(false);
        markPhotoPromptAnalyzeCompleted(dataUrl);
        clearPendingPhotoPrompt();
        setDockSurface(PHOTO_PROMPT_SUCCESS_DOCK_SURFACE);
        reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_READY);
      } catch {
        if (photoPromptDataUrlRef.current !== dataUrl) return;
        setError("Не удалось обработать фото. Проверьте соединение и попробуйте снова.");
        setPhase("error");
        phaseRef.current = "error";
      }
    },
    [enterImageCompose, openInlineAuthSheet, openPricing, setDockPlateOpen, setDockSurface]
  );

  /**
   * When inline Popup OAuth completes without page reload, close the auth sheet
   * and seamlessly resume any pending quota-blocked analyze or model pick.
   */
  useEffect(() => {
    if (!isAuthed || expandedControl !== "auth") return;
    clearPendingGenerateDock();
    const reason = authSheetReason;
    setAuthSheetReason("default");
    setExpandedControl(null);
    if (
      reason === "analyze_quota" &&
      composeModeRef.current === "photo_prompt" &&
      photoPromptDataUrlRef.current
    ) {
      const dataUrl = photoPromptDataUrlRef.current;
      void runPhotoPromptAnalyze(dataUrl, dataUrl);
      return;
    }
    maybeOpenImageModelSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on auth transition while auth sheet is open
  }, [authSheetReason, expandedControl, isAuthed]);

  const [changeRequest, setChangeRequest] = useState("");
  const [remixing, setRemixing] = useState(false);
  /** Blank compose: «Что изменить?» block under a typed/pasted prompt (same remix model as after generation). */
  const [blankChangeOpen, setBlankChangeOpen] = useState(false);
  useEffect(() => {
    if (!promptExpanded) setBlankChangeOpen(false);
  }, [promptExpanded]);
  const [pendingRemixEdit, setPendingRemixEdit] = useState<{
    parentGenerationId: string;
    editInstruction: string;
  } | null>(null);

  const runPhotoPromptAnalyzeRef = useRef(runPhotoPromptAnalyze);
  runPhotoPromptAnalyzeRef.current = runPhotoPromptAnalyze;
  const landingAnalyzeSource =
    seed.intent === "photo_prompt"
      ? resolvePhotoPromptAnalyzeSource({ seedPreviewUrl: seed.previewUrl })
      : null;
  useEffect(() => {
    if (
      !shouldStartPhotoPromptAnalyze({
        intent: seed.intent,
        dataUrl: landingAnalyzeSource?.dataUrl,
      })
    ) {
      return;
    }
    const dataUrl = landingAnalyzeSource!.dataUrl;
    const previewUrl = landingAnalyzeSource!.previewUrl || dataUrl;
    void runPhotoPromptAnalyzeRef.current(dataUrl, previewUrl);
  }, [landingAnalyzeSource?.dataUrl, landingAnalyzeSource?.previewUrl, seed.intent]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (isAuthed || composeMode !== "photo_prompt") return;
    const controller = new AbortController();
    void fetchAnalyzeQuota({ signal: controller.signal }).then((next) => {
      if (next) setAnalyzeQuota(next);
    });
    return () => controller.abort();
  }, [composeMode, isAuthed]);

  useEffect(() => {
    if (!requestedModelId || models.length === 0) return;
    const selected = models.find((item) => item.id === requestedModelId);
    if (!selected) {
      clearRequestedModelSelection();
      return;
    }

    writeSessionChosenImageModel(requestedModelId);
    setModel(requestedModelId);
    setDockPlateOpen(true);
    setToast(`${selected.label} выбрана`);
    clearRequestedModelSelection();
  }, [
    clearRequestedModelSelection,
    models,
    requestedModelId,
    setDockPlateOpen,
  ]);

  useEffect(() => {
    if (!preferredModelId || models.length === 0) return;
    if (modelRef.current) return;
    if (!models.some((item) => item.id === preferredModelId)) return;
    writeSessionChosenImageModel(preferredModelId);
    setModel(preferredModelId);
  }, [models, preferredModelId]);

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
    setPickedExampleCardId(cardId || null);
    setPickedExamplePreviewUrl(cardId ? seed.examplePreviewUrl ?? null : null);
  }, [cardId, promptText, seed.examplePreviewUrl]);

  /**
   * In-place seed synchronization when `seedToken` advances without remounting
   * the panel. Keeps warm models, library photos, credits, and sticker catalog.
   */
  const prevSeedTokenRef = useRef(seedToken);
  useEffect(() => {
    if (prevSeedTokenRef.current === seedToken) return;
    prevSeedTokenRef.current = seedToken;
    if (generateInFlightRef.current) return;

    const transition = computeSeedSyncTransition({
      seed: {
        ...seed,
        source,
        promptText,
        cardId,
      },
      pathname,
      isDock,
      isAuthed,
      lastDockResult,
      lastDockResultDismissed,
    });

    suppressResultHydrateRef.current = false;
    scenarioRequestRef.current += 1;
    setError("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setChangeRequest("");
    setBlankChangeOpen(false);
    setPendingRemixEdit(null);
    setStickerFromResultOpen(false);
    setStickerFromResultParentId(null);
    setStickerActionOpen(null);
    setStickerBorderOpen(false);
    setStickerDownloadOpen(false);
    setPhotoshootOpen(false);
    setPhotoshootSourceId(null);
    setPhotoshootSourceUrl(null);
    setPhotoshootLibraryPath(null);
    setResultPreviewOpen(false);

    setComposeMode(transition.composeMode);
    setPhase(transition.phase);
    phaseRef.current = transition.phase;
    setProgress(transition.progress);
    setDraftPrompt(transition.draftPrompt);
    setSubmittedPrompt(transition.submittedPrompt);
    setPickedExampleCardId(transition.pickedExampleCardId);
    setPickedExamplePreviewUrl(transition.pickedExamplePreviewUrl);
    setGenerationId(transition.generationId);
    setResultUrl(transition.resultUrl);
    setResultModality(transition.resultModality);
    setIsPublished(transition.isPublished);
    setModerationStatus("none");
    setPublishedSlug(null);
    setResultEditKind(transition.resultEditKind);
    setPhotoshootTileUrls(transition.photoshootTileUrls);
    setAnimateParentId(transition.animateParentId);
    setAnimatePreviewUrl(transition.animatePreviewUrl);
    setScenarioLoading(transition.scenarioLoading);

    lastImageResultRef.current = rememberCompletedImageResult({
      generationId: transition.generationId,
      resultUrl: transition.resultUrl,
      resultModality: transition.resultModality,
      previous: lastImageResultRef.current,
    });
    promptStashRef.current = emptyComposePromptStash({
      imagePrompt: seed.intent === "animate" ? "" : transition.draftPrompt,
      videoPrompt:
        seed.intent === "animate" &&
        transition.draftPrompt.trim() &&
        !isGenericVideoPrompt(transition.draftPrompt)
          ? transition.draftPrompt
          : "",
      lastScenarioKey:
        seed.intent === "animate"
          ? composeVideoScenarioKey({
              parentGenerationId: seed.parentGenerationId,
            })
          : null,
    });

    const pendingDataUrl =
      seed.intent === "photo_prompt" || seed.attachIdentityPhoto
        ? resolvePhotoPromptAnalyzeSource({
            seedPreviewUrl: seed.previewUrl,
          })?.dataUrl || ""
        : "";
    const seedEphemeral = pendingDataUrl
      ? makeEphemeralPhotoPromptPhoto(pendingDataUrl)
      : null;
    const libraryOnly = photosRef.current.filter(
      (photo) => !isPhotoPromptEphemeralId(photo.id),
    );
    const nextPhotos = seedEphemeral
      ? [seedEphemeral, ...libraryOnly]
      : libraryOnly;
    setPhotos(nextPhotos);

    const cachedPrefPhotoIds = effectiveUserId
      ? readCachedGenerationPreferences(effectiveUserId)?.selectedPhotoIds ?? []
      : [];
    const currentLibrarySelection = [...selectedPhotoIdsRef.current].filter(
      (id) => !isPhotoPromptEphemeralId(id),
    );
    setSelectedPhotoIds(
      new Set(
        seedEphemeral
          ? [PHOTO_PROMPT_EPHEMERAL_ID]
          : shouldAttachLibraryPhotos(seed)
            ? mergeLibraryHydrateSelection({
                pendingEphemeralId: null,
                currentSelectedIds: currentLibrarySelection,
                mergedPhotoIds: nextPhotos.map((photo) => photo.id),
                preferencePhotoIds: cachedPrefPhotoIds,
              })
            : [],
      ),
    );
  }, [
    cardId,
    effectiveUserId,
    isAuthed,
    isDock,
    lastDockResult,
    lastDockResultDismissed,
    pathname,
    promptText,
    seed,
    seedToken,
    source,
  ]);

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
        const authHeaders = hostAdapter.getAuthHeaders
          ? await hostAdapter.getAuthHeaders()
          : undefined;
        const bootstrap = await fetchGenerateBootstrap({
          userIdHint: effectiveUserId,
          includeLastResult: shouldHydrateLastDockResult,
          apiBaseUrl: hostAdapter.apiBaseUrl,
          credentialsMode: hostAdapter.credentialsMode,
          headers: authHeaders,
        });
        if (!bootstrap) {
          if (!initialBootRef.current?.hasCachedConfig) {
            throw new Error("config_failed");
          }
          if (!cancelled) setLibraryLoading(false);
          return;
        }
        if (cancelled) return;

        const configSnap = snapshotFromBootstrapPayload(bootstrap);
        setConfigError("");
        setVideoEnabled(configSnap.videoEnabled);
        setPhotoshootEnabled(configSnap.photoshootEnabled);
        setStickerEnabled(configSnap.stickerEnabled);
        setStickerFromResultEnabled(configSnap.stickerFromResultEnabled);
        setStickerModelId(configSnap.stickerModelId);
        setStickerCost(configSnap.stickerCost);
        setStickerPackEnabled(configSnap.stickerPackEnabled);
        setStickerPackCreditCost(configSnap.stickerPackCreditCost);
        setListingVideoRepeatEnabled(configSnap.listingVideoRepeatEnabled);
        setPreserveOutfitEnabled(configSnap.preserveOutfitEnabled);
        setComposeExampleMatchEnabled(configSnap.composeExampleMatchEnabled);
        setPhotoshootComposeExampleEnabled(
          configSnap.photoshootComposeExampleEnabled,
        );
        setCardRepeatReward(configSnap.cardRepeatReward);
        setModels(configSnap.models);
        setAspectRatios(configSnap.aspectRatios);
        setImageSizes(configSnap.imageSizes);
        setVideoModels(configSnap.videoModels);
        setMaxPhotos(configSnap.limits.maxPhotos);

        const authedPayloadUser =
          bootstrap.user && !bootstrap.user.isAnonymous && !bootstrap.guestMode
            ? bootstrap.user
            : null;
        setPublishHidden(
          authedPayloadUser ? bootstrap.publishHidden === true : false,
        );
        if (authedPayloadUser && Number.isFinite(bootstrap.credits)) {
          setCredits(Number(bootstrap.credits));
        } else if (bootstrap.guestMode && Number.isFinite(bootstrap.credits)) {
          setCredits(Number(bootstrap.credits));
        } else if (!authedPayloadUser) {
          setCredits(null);
        }

        const pendingPhotoPromptDataUrl =
          seedIntentRef.current === "photo_prompt" || seed.attachIdentityPhoto
            ? resolvePhotoPromptAnalyzeSource({
                seedPreviewUrl: seed.previewUrl,
              })?.dataUrl || ""
            : "";
        const seedEphemeral = pendingPhotoPromptDataUrl
          ? makeEphemeralPhotoPromptPhoto(pendingPhotoPromptDataUrl)
          : null;
        const incomingLibrary = authedPayloadUser
          ? readCachedUserGenerationPhotos(authedPayloadUser.id) ??
            bootstrap.photos ??
            []
          : [];
        const nextPhotos = mergeLibraryHydratePhotos({
          incomingLibrary,
          current: photosRef.current,
          pendingEphemeral: seedEphemeral,
        });
        setPhotos(nextPhotos);
        setHasMorePhotos(
          authedPayloadUser ? bootstrap.hasMorePhotos === true : false,
        );

        const userId = authedPayloadUser?.id ?? null;
        const storedPrefs = pickFresherPreferences(
          parseStoredGenerationPreferences(bootstrap.preferences),
          userId ? readCachedGenerationPreferences(userId) : null,
        );
        const preferredModelAvailable =
          preferredModelId &&
          configSnap.models.some((item) => item.id === preferredModelId);
        const sessionChosenModel = readSessionChosenImageModel();
        const sessionChosenAvailable =
          sessionChosenModel &&
          configSnap.models.some((item) => item.id === sessionChosenModel);
        const completedImageGeneration = Boolean(
          bootstrap.hasCompletedImageGeneration ||
            hasCompletedImageGenerationRef.current,
        );
        setHasCompletedImageGeneration(completedImageGeneration);

        const resolvedPrefs = resolveComposerPreferences({
          stored: storedPrefs,
          imageModelIds: configSnap.models.map((item) => item.id),
          videoModelIds: configSnap.videoModels.map((item) => item.id),
          availablePhotoIds: nextPhotos.map((photo) => photo.id),
          defaults: {
            model: configSnap.defaults.model || undefined,
            aspectRatio: configSnap.defaults.aspectRatio || undefined,
            imageSize: configSnap.defaults.imageSize || undefined,
            videoModel: configSnap.videoDefaults.model || DEFAULT_VIDEO_MODEL,
            videoAspectRatio:
              configSnap.videoDefaults.aspectRatio ||
              DEFAULT_VIDEO_ASPECT_RATIO,
            videoDurationSeconds: configSnap.videoDefaults.durationSeconds,
          },
          hasCompletedImageGeneration: completedImageGeneration,
          explicitImageModelId: preferredModelAvailable
            ? preferredModelId
            : sessionChosenAvailable
              ? sessionChosenModel
              : null,
        });

        if (!prefsDirtyRef.current) {
          const keepSessionModel =
            !completedImageGeneration &&
            !preferredModelAvailable &&
            !sessionChosenAvailable &&
            Boolean(modelRef.current) &&
            configSnap.models.some((item) => item.id === modelRef.current);
          setModel(keepSessionModel ? modelRef.current : resolvedPrefs.model);
          setAspectRatio(resolvedPrefs.aspectRatio);
          setImageSize(resolvedPrefs.imageSize);
          setVideoModel(resolvedPrefs.videoModel);
          setVideoAspectRatio(resolvedPrefs.videoAspectRatio);
          setVideoDurationSeconds(resolvedPrefs.videoDurationSeconds);
          setPreserveOutfit(resolvedPrefs.preserveOutfit);
          setSelectedPhotoIds(
            new Set(
              mergeLibraryHydrateSelection({
                pendingEphemeralId: seedEphemeral
                  ? PHOTO_PROMPT_EPHEMERAL_ID
                  : photosRef.current.find((photo) =>
                      isPhotoPromptEphemeralId(photo.id),
                    )?.id ?? null,
                currentSelectedIds: [...selectedPhotoIdsRef.current],
                mergedPhotoIds: nextPhotos.map((photo) => photo.id),
                preferencePhotoIds: shouldAttachLibraryPhotos(seed)
                  ? resolvedPrefs.selectedPhotoIds
                  : [],
              }),
            ),
          );
          if (userId && storedPrefs && resolvedPrefs.model) {
            writeCachedGenerationPreferences(userId, resolvedPrefs);
          }
          skipNextPrefsPersistRef.current = true;
          prefsDirtyRef.current = false;
        }

        const lastCompleted =
          shouldHydrateLastDockResult && !cancelled
            ? bootstrap.lastCompletedGeneration
            : null;
        if (
          lastCompleted &&
          lastCompleted.status === "completed" &&
          Boolean(lastCompleted.resultUrl) &&
          Boolean(lastCompleted.id) &&
          !suppressResultHydrateRef.current &&
          phaseRef.current === "idle" &&
          !resultUrlRef.current &&
          !generationIdRef.current
        ) {
          const prompt = (lastCompleted.prompt || "").trim();
          setGenerationId(lastCompleted.id);
          setResultUrl(lastCompleted.resultUrl);
          setResultModality(
            lastCompleted.modality === "video" ? "video" : "image",
          );
          lastImageResultRef.current = rememberCompletedImageResult({
            generationId: lastCompleted.id,
            resultUrl: lastCompleted.resultUrl,
            resultModality:
              lastCompleted.modality === "video" ? "video" : "image",
            previous: lastImageResultRef.current,
          });
          setDraftPrompt(prompt);
          promptStashRef.current = {
            ...promptStashRef.current,
            imagePrompt: prompt,
          };
          setSubmittedPrompt(prompt);
          setIsPublished(Boolean(lastCompleted.isPublished));
          setModerationStatus(
            parseCardModerationStatus(lastCompleted.moderationStatus),
          );
          setResultEditKind(lastCompleted.editKind || null);
          setStickerFromResultOpen(false);
          setStickerFromResultParentId(null);
          setPhotoshootTileUrls(
            photoshootTileUrlsFromUnknown(lastCompleted.photoshootTileUrls),
          );
          setProgress(100);
          setPhase("done");
          phaseRef.current = "done";
          rememberLastDockResult({
            generationId: lastCompleted.id,
            resultUrl: lastCompleted.resultUrl,
            promptText: prompt,
            modality: lastCompleted.modality === "video" ? "video" : "image",
            isPublished: Boolean(lastCompleted.isPublished),
            editKind: lastCompleted.editKind || null,
            photoshootTileUrls: photoshootTileUrlsFromUnknown(
              lastCompleted.photoshootTileUrls,
            ),
          });
        }

        setPreferencesHydrated(Boolean(authedPayloadUser));
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
    // Hydrate once per mount / resolved auth identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount hydrate
  }, [isBlank, isDock, effectiveUserId]);

  /** Lazy expansion beyond top-12 bootstrap photos only when «Ваши фото» opens. */
  useEffect(() => {
    if (
      expandedControl !== "photos" ||
      !isAuthed ||
      !effectiveUserId ||
      !hasMorePhotos ||
      loadingMorePhotosRef.current
    ) {
      return;
    }
    let cancelled = false;
    loadingMorePhotosRef.current = true;
    void fetch("/api/user-generation-photos", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { photos?: UserPhoto[] } | null) => {
        if (cancelled || !Array.isArray(data?.photos)) return;
        const merged = mergeLibraryHydratePhotos({
          incomingLibrary: data.photos,
          current: photosRef.current,
          pendingEphemeral:
            photosRef.current.find((photo) =>
              isPhotoPromptEphemeralId(photo.id),
            ) ?? null,
        });
        setPhotos(merged);
        setHasMorePhotos(false);
        writeCachedUserGenerationPhotos(
          effectiveUserId,
          merged.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
          { signedAt: Date.now(), hasMorePhotos: false },
        );
        warmupPhotoPreviewImages(merged);
      })
      .catch(() => {
        /* top-12 photos remain usable */
      })
      .finally(() => {
        loadingMorePhotosRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, expandedControl, hasMorePhotos, isAuthed]);

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
          if (isAuthed && Number.isFinite(payload.credits)) {
            const nextCredits = Number(payload.credits);
            setCredits(nextCredits);
            updateCachedGenerateUserCredits(effectiveUserId, nextCredits);
          }
        })
        .catch((error) => {
          console.error("[generation.balance] refresh failed", error);
        });
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshCredits);
    return () =>
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshCredits);
  }, [effectiveUserId, isAuthed]);

  /**
   * Latest prefs snapshot for flush-on-unmount / sheet-collapse.
   */
  const prefsSnapshotRef = useRef({
    model,
    aspectRatio,
    imageSize,
    selectedPhotoIds,
    videoModel,
    videoAspectRatio,
    videoDurationSeconds,
    preserveOutfit,
    preferencesHydrated,
    hasCompletedImageGeneration,
    userId: effectiveUserId,
  });
  prefsSnapshotRef.current = {
    model,
    aspectRatio,
    imageSize,
    selectedPhotoIds,
    videoModel,
    videoAspectRatio,
    videoDurationSeconds,
    preserveOutfit,
    preferencesHydrated,
    hasCompletedImageGeneration,
    userId: effectiveUserId,
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
        preserveOutfit: s.preserveOutfit,
        updatedAt: new Date().toISOString(),
      };
      if (!s.model.trim() || !s.hasCompletedImageGeneration) {
        prefsDirtyRef.current = false;
        return;
      }
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
    preserveOutfit,
  ]);

  /**
   * Any exit from photos/model sheet (Готово, tile toggle, desktop scrim →
   * setDockSurface(null), switch to prompt) must flush — not only «Готово».
   */
  const prevPrefsSurfaceRef = useRef<
    "photos" | "model" | "example" | "tool" | "auth" | null
  >(null);
  useEffect(() => {
    const prev = prevPrefsSurfaceRef.current;
    prevPrefsSurfaceRef.current = expandedControl;
    if (prev && !expandedControl) {
      persistGenerationPreferences();
      if (prev === "example") {
        maybeOpenImageModelSheet();
      }
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

  const openSeoExampleSheet = () => {
    setError("");
    setExpandedControl("example");
  };

  const openImageModelSheet = () => {
    setError("");
    setExpandedControl("model");
  };

  const maybeOpenImageModelSheet = () => {
    if (
      !composeShouldAutoOpenModelSheet({
        composeMode: composeModeRef.current,
        modelId: modelRef.current,
      })
    ) {
      return;
    }
    if (isAuthed && !preferencesHydratedRef.current) {
      pendingModelAfterHydrateRef.current = true;
      return;
    }
    openImageModelSheet();
  };

  const advanceAfterPhotoSelection = () => {
    const mode = composeModeRef.current;
    if (mode === "sticker") {
      setExpandedControl("example");
      return;
    }
    if (mode === "video") {
      setExpandedControl("model");
      return;
    }
    if (mode === "photoshoot" || mode === "photo_prompt") {
      setExpandedControl(null);
      return;
    }
    if (
      composeShouldAutoOpenExampleSheet({
        composeMode: mode,
        cardId: pickedExampleCardId ?? resolvedCardIdFromSeed,
      })
    ) {
      setExpandedControl("example");
      return;
    }
    if (
      composeShouldAutoOpenModelSheet({
        composeMode: mode,
        modelId: modelRef.current,
      })
    ) {
      maybeOpenImageModelSheet();
      return;
    }
    setExpandedControl(null);
  };

  const advanceAfterStyleSelection = () => {
    if (composeModeRef.current === "image") {
      if (!String(modelRef.current || "").trim()) {
        openImageModelSheet();
      } else {
        setExpandedControl(null);
      }
      return;
    }
    setExpandedControl(null);
  };

  const maybeOpenSeoExampleAfterPhoto = () => {
    if (isDockV2) {
      advanceAfterPhotoSelection();
      return;
    }
    if (
      composeShouldAutoOpenExampleSheet({
        composeMode: composeModeRef.current,
        cardId: pickedExampleCardId ?? resolvedCardIdFromSeed,
      })
    ) {
      setExpandedControl("example");
      return;
    }
    maybeOpenImageModelSheet();
  };

  useEffect(() => {
    if (!preferencesHydrated) return;
    if (!pendingModelAfterHydrateRef.current) return;
    pendingModelAfterHydrateRef.current = false;
    if (expandedControl === "example") return;
    maybeOpenImageModelSheet();
  }, [expandedControl, preferencesHydrated]);

  const toggleSeoExampleSheet = () => {
    setError("");
    setExpandedControl((current) => (current === "example" ? null : "example"));
  };

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.has(photo.id)),
    [photos, selectedPhotoIds]
  );
  const startComposeExampleMatch = (photo: UserPhoto | null | undefined) => {
    if (!composeExampleMatchEnabled) return;
    if (!composeShowsExampleTool({ composeMode: composeModeRef.current })) return;
    // Sticker mode shows bot styles, not catalog examples — no audience match needed.
    if (composeModeRef.current === "sticker") return;
    if (!photo) return;
    const matchPhoto = {
      id: photo.id,
      dataUrl: isPhotoPromptEphemeralId(photo.id) ? photo.previewUrl : null,
      audienceTag: photo.audienceTag ?? null,
    };
    if (isPhotoPromptEphemeralId(photo.id) && !matchPhoto.dataUrl) return;
    prefetchComposeExampleListing(null);
    void prefetchComposeExampleAudience(matchPhoto).then((tag) => {
      prefetchComposeExampleListing(tag);
      setPhotos((current) => {
        const currentPhoto = current.find((item) => item.id === photo.id);
        if (!currentPhoto || currentPhoto.audienceTag === tag) return current;
        const next = current.map((item) =>
          item.id === photo.id ? { ...item, audienceTag: tag } : item,
        );
        if (user?.id) {
          writeCachedUserGenerationPhotos(
            user.id,
            next.filter((item) => !isPhotoPromptEphemeralId(item.id)),
          );
        }
        return next;
      });
    });
  };

  useEffect(() => {
    startComposeExampleMatch(selectedPhotos[0] ?? null);
  }, [
    composeExampleMatchEnabled,
    composeMode,
    selectedPhotos[0]?.id,
    selectedPhotos[0]?.previewUrl,
    selectedPhotos[0]?.audienceTag,
  ]);
  useEffect(() => {
    if (composeMode !== "image") return;
    const filter = listingComposeExampleInitialFilter(
      typeof window !== "undefined" ? window.location.pathname : "",
    );
    prefetchComposeExamplePickerFirstPage({
      filter: filter
        ? { dimension: filter.dimension, value: filter.value }
        : null,
    });
  }, [composeMode]);
  const selectImageModel = (modelId: string) => {
    writeSessionChosenImageModel(modelId);
    setModel(modelId);
    if (composeModeRef.current !== "image") {
      enterImageCompose();
    }
    if (isDockV2 && expandedControl === "model") {
      setExpandedControl(null);
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
    if (isDockV2 && expandedControl === "model") {
      setExpandedControl(null);
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
  const listingCatalogSplit = splitVideoCatalogPrompt(seed.promptText);
  const listingVideoRepeatCompose =
    seed.source === "card" &&
    seed.intent === "animate" &&
    listingVideoRepeatEnabled &&
    Boolean(listingCatalogSplit.imagePrompt);
  const photoshootReadyFrame = resolvePhotoshootReadyFrame({
    generationId,
    resultUrl,
    resultModality,
    lastImageResult: lastImageResultRef.current,
  });
  const photoshootLibraryFrame = resolvePhotoshootLibraryFrame({
    selectedPhotos,
  });
  /** Footer copy: a guest's not-yet-saved upload counts as a picked photo. */
  const sourcePhotoPicked = composeHasSingleSourcePhoto({ selectedPhotos });
  const selectedModelCost =
    listingVideoRepeatCompose && composeMode === "video"
      ? selectedVideoCost != null
        ? (models.find((item) => item.id === model)?.cost ?? 0) + selectedVideoCost
        : selectedVideoCost
      : composeMode === "video"
      ? selectedVideoCost
      : composeMode === "photoshoot"
        ? photoshootLibraryFrame
          ? PHOTOSHOOT_CREDIT_COST
          : null
        : composeMode === "sticker"
          ? photoshootLibraryFrame
            ? stickerCost ?? GPT_IMAGE_25_FLARE_CREDIT_COST
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
    const wasEmpty = selectedPhotoIds.size === 0;
    const willSelect = !selectedPhotoIds.has(id);
    setSelectedPhotoIds((current) => {
      if (isPhotoPromptComposeMode(composeModeRef.current)) {
        return new Set(nextPhotoPromptSelection({ current, toggledId: id }));
      }
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
    if (
      isDock &&
      expandedControl === "photos" &&
      wasEmpty &&
      willSelect &&
      !isPhotoPromptComposeMode(composeModeRef.current)
    ) {
      const picked = photos.find((item) => item.id === id);
      if (picked) {
        startComposeExampleMatch(picked);
      }
      advanceAfterPhotoSelection();
    }
  };

  const persistEphemeralIdentityToLibrary = useCallback(async (): Promise<UserPhoto | null> => {
    if (persistEphemeralInFlightRef.current) return persistEphemeralInFlightRef.current;
    const task = (async () => {
      if (
        !shouldPersistEphemeralIdentityPhoto({
          isAuthed,
          intent: seedIntentRef.current,
          composeMode: composeModeRef.current,
        })
      ) {
        return null;
      }
      const ephemeral = photosRef.current.find((photo) =>
        isPhotoPromptEphemeralId(photo.id),
      );
      const dataUrl = ephemeral?.previewUrl?.trim() || "";
      if (!isPersistableIdentityDataUrl(dataUrl)) {
        const selectedLibrary = photosRef.current.filter(
          (photo) =>
            !isPhotoPromptEphemeralId(photo.id) &&
            Boolean(photo.storagePath?.trim()) &&
            selectedPhotoIdsRef.current.has(photo.id),
        );
        return selectedLibrary[0] ?? null;
      }
      setLibraryUploading(true);
      try {
        const photo = await uploadDataUrlToGenerationLibrary({
          dataUrl,
          filename: ephemeral?.originalFilename || "photo.jpg",
        });
        const nextPhotos = [
          photo,
          ...photosRef.current.filter(
            (item) =>
              !isPhotoPromptEphemeralId(item.id) && item.id !== photo.id,
          ),
        ];
        photosRef.current = nextPhotos;
        const nextSelected = new Set(
          [...selectedPhotoIdsRef.current].filter(
            (id) => !isPhotoPromptEphemeralId(id),
          ),
        );
        nextSelected.add(photo.id);
        selectedPhotoIdsRef.current = nextSelected;
        setPhotos(nextPhotos);
        if (user?.id) {
          writeCachedUserGenerationPhotos(
            user.id,
            nextPhotos.filter((item) => !isPhotoPromptEphemeralId(item.id)),
          );
        }
        warmupPhotoPreviewImages([photo]);
        setSelectedPhotoIds(nextSelected);
        return photo;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
        return null;
      } finally {
        setLibraryUploading(false);
      }
    })();
    persistEphemeralInFlightRef.current = task;
    try {
      return await task;
    } finally {
      persistEphemeralInFlightRef.current = null;
    }
  }, [isAuthed, user?.id]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const photoPromptMode = isPhotoPromptComposeMode(composeModeRef.current);
    const filesToUpload = photoPromptMode ? files.slice(0, 1) : files;
    if (!isAuthed) {
      const prepared = await prepareUploadFile(filesToUpload[0], {
        maxPx: PHOTO_PROMPT_UPLOAD_MAX_PX,
        quality: PHOTO_PROMPT_UPLOAD_QUALITY,
      });
      if (!prepared.ok) {
        setError(
          noticeForUploadError(prepared.error, (key) => {
            if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
            if (key === "readFailed") return "Не удалось прочитать файл";
            return "Недопустимый тип файла";
          })
        );
        return;
      }
      const ephemeral = makeEphemeralPhotoPromptPhoto(prepared.dataUrl);
      const nextPhotos = [
        ephemeral,
        ...photosRef.current.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
      ];
      photosRef.current = nextPhotos;
      selectedPhotoIdsRef.current = new Set([PHOTO_PROMPT_EPHEMERAL_ID]);
      setPhotos(nextPhotos);
      setSelectedPhotoIds(new Set([PHOTO_PROMPT_EPHEMERAL_ID]));
      setError("");
      startComposeExampleMatch(ephemeral);
      maybeOpenSeoExampleAfterPhoto();
      return;
    }
    const selectionCap = photoPromptSelectionCap(composeModeRef.current, maxPhotos);
    const availableSelectionSlots = photoPromptMode
      ? 1
      : Math.max(0, selectionCap - selectedPhotoIds.size);
    setError("");
    setLibraryUploading(true);

    const uploaded: UserPhoto[] = [];
    try {
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const prepared = await prepareUploadFile(filesToUpload[index]);
        if (!prepared.ok) {
          const message = noticeForUploadError(prepared.error, (key) => {
            if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
            if (key === "readFailed") return "Не удалось прочитать файл";
            return "Недопустимый тип файла";
          });
          throw new Error(message);
        }

        const photo = await uploadDataUrlToGenerationLibrary({
          dataUrl: prepared.dataUrl,
          filename: filesToUpload[index].name || "photo.jpg",
        });
        uploaded.push(photo);
      }

      setPhotos((current) => {
        const next = [...uploaded.reverse(), ...current];
        if (user?.id) {
          writeCachedUserGenerationPhotos(
            user.id,
            next.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
          );
        }
        warmupPhotoPreviewImages(uploaded);
        return next;
      });
      setSelectedPhotoIds((current) => {
        if (photoPromptMode) {
          const last = uploaded[uploaded.length - 1];
          return last ? new Set([last.id]) : new Set();
        }
        const next = new Set(current);
        for (const photo of uploaded) {
          if (next.size >= selectionCap) break;
          next.add(photo.id);
        }
        return next;
      });
      if (uploaded.length > availableSelectionSlots) {
        setError(
          `Все фото сохранены. Для генерации можно выбрать не больше ${selectionCap}.`
        );
      }
      startComposeExampleMatch(uploaded[uploaded.length - 1] ?? uploaded[0] ?? null);
      maybeOpenSeoExampleAfterPhoto();
    } catch (err) {
      if (uploaded.length) {
        setPhotos((current) => {
          const next = [...uploaded.reverse(), ...current];
          if (user?.id) {
            writeCachedUserGenerationPhotos(
              user.id,
              next.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
            );
          }
          warmupPhotoPreviewImages(uploaded);
          return next;
        });
        setSelectedPhotoIds((current) => {
          if (photoPromptMode) {
            const last = uploaded[uploaded.length - 1];
            return last ? new Set([last.id]) : new Set();
          }
          const next = new Set(current);
          for (const photo of uploaded) {
            if (next.size >= selectionCap) break;
            next.add(photo.id);
          }
          return next;
        });
        startComposeExampleMatch(uploaded[uploaded.length - 1] ?? uploaded[0] ?? null);
        maybeOpenSeoExampleAfterPhoto();
      }
      setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
    } finally {
      setLibraryUploading(false);
    }
  };

  useEffect(() => {
    if (
      !shouldPersistEphemeralIdentityPhoto({
        isAuthed,
        intent: seed.intent,
        composeMode,
      })
    ) {
      return;
    }
    const ephemeral = photos.find(
      (photo) =>
        isPhotoPromptEphemeralId(photo.id) &&
        isPersistableIdentityDataUrl(photo.previewUrl),
    );
    if (!ephemeral) return;
    void persistEphemeralIdentityToLibrary();
  }, [
    composeMode,
    isAuthed,
    persistEphemeralIdentityToLibrary,
    photos,
    seed.intent,
  ]);

  const deletePhoto = async (photo: UserPhoto) => {
    if (isPhotoPromptEphemeralId(photo.id)) {
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setSelectedPhotoIds((selected) => {
        const next = new Set(selected);
        next.delete(photo.id);
        return next;
      });
      return;
    }
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
      if (user?.id) {
        writeCachedUserGenerationPhotos(
          user.id,
          remaining.filter((item) => !isPhotoPromptEphemeralId(item.id)),
        );
      }
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
    forceTextOnly?: boolean;
    modality?: "image" | "video";
    photoStoragePath?: string;
    listingVideoRepeat?: { videoPrompt: string };
    /** Sticker result edit: emotion / motion on top of `parentGenerationId`. */
    stickerAction?: StickerEditAction;
    stickerPresetId?: string | null;
    stickerCustomHint?: string;
    /** Cut a sticker from a finished photo (`parentGenerationId`), not from the library. */
    stickerFromResult?: boolean;
    /** New style from the sticker PNG on screen (`parentGenerationId` is that sticker). */
    stickerRestyle?: boolean;
  }): Promise<boolean> => {
    const requestedModality =
      options?.modality || apiModalityForComposeMode(composeMode);
    const listingVideoRepeat = options?.listingVideoRepeat;
    const isVideo = requestedModality === "video" && !listingVideoRepeat;
    const isPhotoshoot = options?.editKind === PHOTOSHOOT_EDIT_KIND;
    const isSticker = options?.editKind === STICKER_EDIT_KIND;
    const isStickerPack = options?.editKind === STICKER_PACK_EDIT_KIND;
    const isStickerJob = isSticker || isStickerPack;
    const isStickerEdit =
      isSticker && Boolean(options?.parentGenerationId?.trim()) && Boolean(options?.stickerAction);
    const isStickerFromResult =
      isSticker && options?.stickerFromResult === true && Boolean(options?.parentGenerationId?.trim());
    const isStickerRestyle =
      isSticker && options?.stickerRestyle === true && Boolean(options?.parentGenerationId?.trim());
    if (
      !isStickerEdit &&
      !isStickerFromResult &&
      !isStickerRestyle &&
      !canEnqueueWhilePhotoshootSelected({
        composeMode,
        editKind: options?.editKind,
      })
    ) {
      setError(
        composeMode === "sticker"
          ? STICKER_NEEDS_LIBRARY_PHOTO
          : PHOTOSHOOT_NEEDS_LIBRARY_PHOTO,
      );
      return false;
    }
    const parentGenerationId = isVideo
      ? resolveVideoEnqueueParentGenerationId(
          options?.parentGenerationId?.trim() || animateParentId,
          selectedPhotos[0]?.originalFilename,
        )
      : options?.parentGenerationId?.trim() || "";
    const editInstruction = isVideo ? "" : options?.editInstruction?.trim() || "";
    const isContinuation = Boolean(parentGenerationId) && !isVideo;
    if (isContinuation && !editInstruction && !isPhotoshoot && !isStickerEdit && !isStickerFromResult && !isStickerRestyle) {
      setError("Опишите, что изменить");
      return false;
    }
    const prompt = isPhotoshoot
        ? "PHOTOSHOOT"
      : isStickerJob
        ? "STICKER"
      : (options?.promptOverride ?? draftPrompt).trim()
        || (isVideo ? DEFAULT_VIDEO_PROMPT : "");
    if (
      composeNeedsExamplePick({
        composeMode,
        selectedPhotoCount: selectedPhotos.length,
        cardId: resolvedCardId,
        promptLength: prompt.length,
      })
    ) {
      setError("Выберите образ из каталога");
      setExpandedControl("example");
      return false;
    }
    if (
      composeNeedsImageModelPick({
        composeMode,
        modelId: model,
      })
    ) {
      setError("Выберите модель");
      setExpandedControl("model");
      return false;
    }
    if (!isPhotoshoot && !isStickerJob && prompt.length < 8) {
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
    if (listingVideoRepeat && selectedPhotos.length !== 1) {
      setError("Для повтора видео нужно одно фото");
      return false;
    }
    let photosForEnqueue = selectedPhotos;
    if (
      shouldPersistEphemeralIdentityPhoto({
        isAuthed,
        intent: seedIntentRef.current,
        composeMode,
      }) &&
      selectedPhotos.some((photo) => isPhotoPromptEphemeralId(photo.id))
    ) {
      const saved = await persistEphemeralIdentityToLibrary();
      if (!saved?.storagePath) {
        return false;
      }
      photosForEnqueue = [
        saved,
        ...selectedPhotos.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
      ];
    }
    if (isPhotoshoot && !parentGenerationId) {
      const libraryPath =
        photoshootLibraryPathOverride || photosForEnqueue[0]?.storagePath || "";
      if (
        !libraryPath ||
        (!photoshootLibraryPathOverride && photosForEnqueue.length !== 1)
      ) {
        setError(PHOTOSHOOT_NEEDS_LIBRARY_PHOTO);
        return false;
      }
    }
    if ((isSticker && !isStickerEdit && !isStickerFromResult && !isStickerRestyle) || isStickerPack) {
      const libraryPath =
        photoshootLibraryPathOverride || photosForEnqueue[0]?.storagePath || "";
      const singleLibraryPhoto = Boolean(photoshootLibraryPathOverride) || photosForEnqueue.length === 1;
      if (!libraryPath || !singleLibraryPhoto) {
        setError(STICKER_NEEDS_LIBRARY_PHOTO);
        return false;
      }
    }
    if (isStickerPack && !stickerPackSetId) {
      setError("Выберите набор стикер пака");
      setExpandedControl("example");
      return false;
    }
    const useParallelDockQueue = isDockV2;
    if (
      useParallelDockQueue &&
      !canStartAnotherDockJob(activeJobs, MAX_PARALLEL_DOCK_JOBS)
    ) {
      setToast("Уже в работе 3 генерации — дождитесь завершения одной");
      return false;
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

    const resolvedEditKind = isPhotoshoot
      ? PHOTOSHOOT_EDIT_KIND
      : isStickerPack
        ? STICKER_PACK_EDIT_KIND
        : isSticker
          ? STICKER_EDIT_KIND
          : null;
    const jobSourcePreviewUrl = parentGenerationId
      ? resultUrl ??
        photoshootSourceUrl ??
        photosForEnqueue[0]?.previewUrl ??
        selectedPhotos[0]?.previewUrl ??
        null
      : photoshootLibraryPathOverride
        ? photoshootSourceUrl ??
          photosForEnqueue[0]?.previewUrl ??
          selectedPhotos[0]?.previewUrl ??
          null
        : photosForEnqueue[0]?.previewUrl ??
          selectedPhotos[0]?.previewUrl ??
          null;
    const parallelClientJobId = useParallelDockQueue
      ? beginDockJob({
          promptText: isPhotoshoot ? draftPromptRef.current : prompt,
          modality: isVideo ? "video" : "image",
          editKind: resolvedEditKind,
          sourcePreviewUrl: jobSourcePreviewUrl,
          listingVideoRepeat: Boolean(listingVideoRepeat),
          stickerStyleId: isStickerJob && !isStickerEdit ? stickerStyleId : null,
        })
      : null;

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
                    photosForEnqueue.find(
                      (photo) =>
                        photo.storagePath ===
                        (photoshootLibraryPathOverride || photosForEnqueue[0]?.storagePath),
                    )?.width ?? photosForEnqueue[0]?.width ?? undefined,
                  height:
                    photosForEnqueue.find(
                      (photo) =>
                        photo.storagePath ===
                        (photoshootLibraryPathOverride || photosForEnqueue[0]?.storagePath),
                    )?.height ?? photosForEnqueue[0]?.height ?? undefined,
                })
              : aspectRatio,
          imageSize: isVideo ? DEFAULT_VIDEO_RESOLUTION : imageSize,
          durationSeconds: isVideo ? videoDurationSeconds : undefined,
          cardId: resolvedCardId,
          photoStoragePaths: isPhotoshoot || isStickerJob
            ? parentGenerationId && (!isStickerJob || isStickerEdit || isStickerFromResult || isStickerRestyle)
              ? []
              : [
                  photoshootLibraryPathOverride ||
                    photosForEnqueue[0]?.storagePath ||
                    "",
                ].filter(Boolean)
            : isVideo
            ? parentGenerationId
              ? []
              : libraryStoragePaths(photosForEnqueue.slice(0, 1))
            : isContinuation || options?.forceTextOnly
              ? []
              : libraryStoragePaths(photosForEnqueue),
          parentGenerationId: parentGenerationId || null,
          editInstruction: isVideo || isPhotoshoot || isStickerJob ? null : editInstruction || null,
          editKind: isPhotoshoot
              ? PHOTOSHOOT_EDIT_KIND
              : isStickerPack
                ? STICKER_PACK_EDIT_KIND
                : isSticker
                  ? STICKER_EDIT_KIND
                  : undefined,
          stickerStyleId: isStickerJob && !isStickerEdit ? stickerStyleId : undefined,
          packContentSetId: isStickerPack ? stickerPackSetId : undefined,
          stickerAction: isStickerEdit ? options?.stickerAction : undefined,
          stickerPresetId: isStickerEdit ? options?.stickerPresetId || null : undefined,
          stickerCustomHint: isStickerEdit ? options?.stickerCustomHint || undefined : undefined,
          parentTile: isPhotoshoot ? options?.parentTile : undefined,
          vibeId: null,
          preserveOutfit:
            !isVideo &&
            !isPhotoshoot &&
            !isStickerJob &&
            !isContinuation &&
            !options?.forceTextOnly &&
            preserveOutfit &&
            photosForEnqueue.length > 0,
          ...(listingVideoRepeat
            ? {
                pipeline: {
                  kind: LISTING_VIDEO_REPEAT_KIND,
                  videoPrompt: listingVideoRepeat.videoPrompt,
                  videoModel: activeVideoModel?.id,
                  durationSeconds: videoDurationSeconds,
                  aspectRatio: videoAspectRatio,
                  resolution: DEFAULT_VIDEO_RESOLUTION,
                },
              }
            : {}),
        }),
      });
      const genData = (await genRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        message?: string;
      };
      if (!genRes.ok || !genData.id) {
        if (parallelClientJobId) {
          failDockJob(parallelClientJobId);
        }
        if (genRes.status === 401 || genData.error === "unauthorized") {
          setPhase(resultUrl || isContinuation ? "done" : "idle");
          phaseRef.current = resultUrl || isContinuation ? "done" : "idle";
          openInlineAuthSheet("default");
          return false;
        }
        if (genData.error === "insufficient_credits") {
          setNeedsCredits(true);
          setError(isStickerFromResult || isStickerRestyle ? "Не хватает кредитов" : "");
          setPhase(resultUrl || isContinuation ? "done" : "idle");
          phaseRef.current = resultUrl || isContinuation ? "done" : "idle";
          reachYandexMetrikaGoal(
            isPhotoshoot
              ? YM_GOAL_PHOTOSHOOT_NO_CREDITS
              : YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
          );
          return false;
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
        if (isSticker && genData.error === "sticker_disabled") {
          throw new Error(genData.message || "Генератор стикеров пока недоступен");
        }
        if (isSticker && genData.error === "sticker_from_result_disabled") {
          throw new Error(genData.message || "Стикер из этого фото пока недоступен");
        }
        if (isSticker && genData.error === "sticker_model_unavailable") {
          throw new Error(genData.message || "Модель стикеров временно недоступна");
        }
        if (isStickerPack && genData.error === "sticker_pack_disabled") {
          throw new Error(genData.message || "Стикер пак пока недоступен");
        }
        if (isStickerPack && genData.error === "sticker_pack_model_unavailable") {
          throw new Error(genData.message || "Модель стикер пака временно недоступна");
        }
        throw new Error(genData.message || genData.error || "Не удалось создать генерацию");
      }
      if (isPhotoshoot) {
        reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_SUBMIT, { credits: PHOTOSHOOT_CREDIT_COST });
      }
      if (isStickerJob && !isStickerEdit) {
        reachYandexMetrikaGoal(YM_GOAL_STICKER_START, {
          style: stickerStyleId,
          source: isStickerRestyle ? "restyle" : isStickerFromResult ? "result" : "photo",
        });
      }
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED);
      if (!isPhotoshoot && !isStickerJob && !listingVideoRepeat) {
        setDraftPrompt(prompt);
        setSubmittedPrompt(prompt);
      }

      if (parallelClientJobId) {
        const launchedFromResult = Boolean(
          phaseRef.current === "done" ||
            resultUrl ||
            stickerFromResultOpen ||
            stickerActionOpen ||
            photoshootOpen,
        );
        requestCreditBalanceRefresh();
        attachDockJobServerId(parallelClientJobId, genData.id);
        setStarting(false);
        setStickerFromResultOpen(false);
        setStickerStyleSheetMode(null);
        setStickerActionOpen(null);
        setStickerDownloadOpen(false);
        setStickerBorderOpen(false);
        setPhotoshootOpen(false);
        setPhotoshootLibraryPath(null);
        setPhotoshootSourceId(null);
        setPhotoshootSourceUrl(null);
        if (launchedFromResult || generationId) {
          dismissLastDockResult();
          setResultUrl(null);
          setGenerationId(null);
          setPhotoshootTileUrls(null);
          setResultEditKind(null);
          setPhase("idle");
          phaseRef.current = "idle";
          setProgress(0);
        }
        if (layout !== "mobile" && !launchedFromResult) {
          setDockPlateOpen(false);
        }
        return true;
      }

      setPhase("generating");
      phaseRef.current = "generating";
      setProgress(8);
      setStarting(false);
      if (!isContinuation) setGenerationId(genData.id);
      let pollGenerationId = genData.id;
      let listingRepeatFollowupWaitStarted = 0;
      let photoshootTilesWaitStarted = 0;
      setIsPublished(false);
      setModerationStatus("none");
      requestCreditBalanceRefresh();

      while (true) {
        if (photoshootAbort?.signal.aborted) return true;
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (photoshootAbort?.signal.aborted) return true;
        let pollRes: Response;
        try {
          pollRes = await fetch(`/api/generations/${pollGenerationId}`, {
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
          pipelineSpec?: { kind?: string } | null;
          followupGenerationId?: string | null;
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
          if (
            listingVideoRepeat &&
            poll.pipelineSpec?.kind === LISTING_VIDEO_REPEAT_KIND &&
            poll.modality !== "video"
          ) {
            if (poll.followupGenerationId) {
              pollGenerationId = poll.followupGenerationId;
              listingRepeatFollowupWaitStarted = 0;
              setGenerationId(poll.followupGenerationId);
              setProgress((current) => Math.max(current, 55));
              continue;
            }
            listingRepeatFollowupWaitStarted ||= Date.now();
            if (Date.now() - listingRepeatFollowupWaitStarted > 45_000) {
              throw new Error(
                "Фото готово, но видео не запустилось. Нажмите «Оживить» на кадре.",
              );
            }
            if (poll.resultUrl) {
              setGenerationId(genData.id);
              setResultUrl(poll.resultUrl);
              setResultModality("image");
            }
            continue;
          }
          if (photoshootAbort?.signal.aborted) return true;
          // Photoshoot = 4 frames, sticker pack = 16 stickers; the single slot (sheet / preview) is never the result.
          const tiles = sidecarTileUrls(
            isPhotoshoot ? PHOTOSHOOT_EDIT_KIND : isStickerPack ? STICKER_PACK_EDIT_KIND : null,
            poll.photoshootTileUrls,
          );
          if ((isPhotoshoot || isStickerPack) && !tiles) {
            photoshootTilesWaitStarted ||= Date.now();
            if (Date.now() - photoshootTilesWaitStarted > 45_000) {
              throw new Error(isPhotoshoot ? "Кадры фотосессии не готовы" : "Стикеры пака не готовы");
            }
            continue;
          }
          const nextResultUrl = tiles ? tiles[0] : poll.resultUrl;
          if (!nextResultUrl) {
            continue;
          }
          requestCreditBalanceRefresh();
          const nextModality = poll.modality === "video" || isVideo ? "video" : "image";
          rememberLastDockResult({
            generationId: genData.id,
            resultUrl: nextResultUrl,
            promptText: isPhotoshoot ? draftPromptRef.current : prompt,
            modality: nextModality,
            isPublished: false,
            editKind: isPhotoshoot
              ? PHOTOSHOOT_EDIT_KIND
              : isStickerPack
                ? STICKER_PACK_EDIT_KIND
                : isSticker
                  ? STICKER_EDIT_KIND
                  : undefined,
            photoshootTileUrls: tiles,
          });
          if (nextModality !== "video") {
            hasCompletedImageGenerationRef.current = true;
            setHasCompletedImageGeneration(true);
            prefsSnapshotRef.current = {
              ...prefsSnapshotRef.current,
              hasCompletedImageGeneration: true,
            };
            persistGenerationPreferences(prefsSnapshotRef.current, { force: true });
          }
          setGenerationId(genData.id);
          setResultUrl(nextResultUrl);
          setResultModality(nextModality);
          lastImageResultRef.current = rememberCompletedImageResult({
            generationId: genData.id,
            resultUrl: nextResultUrl,
            resultModality: nextModality,
            previous: lastImageResultRef.current,
          });
          if (isVideo || poll.modality === "video") {
            enterImageCompose();
          }
          setProgress(100);
          setPhase("done");
          setStickerFromResultOpen(false);
          setStickerStyleSheetMode(null);
          if (!(isStickerFromResult || (isSticker && isStickerEdit))) {
            setStickerFromResultParentId(null);
          }
          if (isPhotoshoot) {
            setResultEditKind(PHOTOSHOOT_EDIT_KIND);
            setPhotoshootTileUrls(tiles);
            setPhotoshootOpen(false);
            setPhotoshootLibraryPath(null);
            reachYandexMetrikaGoal(YM_GOAL_PHOTOSHOOT_READY);
          }
          if (isStickerPack) {
            setResultEditKind(STICKER_PACK_EDIT_KIND);
            setPhotoshootTileUrls(tiles);
            setStickerActionOpen(null);
            setStickerDownloadOpen(false);
            reachYandexMetrikaGoal(YM_GOAL_STICKER_DONE, { style: stickerStyleId });
          }
          if (isSticker) {
            setResultEditKind(STICKER_EDIT_KIND);
            setStickerActionOpen(null);
            setStickerDownloadOpen(false);
            if (isStickerFromResult) setPhotoshootTileUrls(null);
            if (!isStickerEdit) {
              reachYandexMetrikaGoal(YM_GOAL_STICKER_DONE, { style: stickerStyleId });
            }
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
      if (parallelClientJobId) {
        failDockJob(parallelClientJobId);
      }
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

  /**
   * Rewrite the prompt via the remix model. After a result the editor closes (the next CTA is generate);
   * in blank compose (`keepEditorOpen`) the sheet stays up so the user sees the rewritten text.
   */
  const applyPromptRemix = async (options?: { keepEditorOpen?: boolean }) => {
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
      setSubmittedPrompt(nextPrompt);
      setChangeRequest("");
      setPendingRemixEdit(
        parentGenerationId
          ? { parentGenerationId, editInstruction: requestedChange }
          : null,
      );
      if (options?.keepEditorOpen) {
        setBlankChangeOpen(false);
        setToast(PROMPT_REMIX_COPY.done);
      } else {
        setPromptExpanded(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : PROMPT_REMIX_COPY.errorGeneric);
    } finally {
      setRemixing(false);
    }
  };

  const handleResultAction = async (action: GenerationMenuAction) => {
    if (action === "publish") {
      if (busyAction || publishHidden) return;
      if (!generationId) {
        setToast("Не удалось опубликовать");
        return;
      }
      setBusyAction("publish");
      try {
        const res = await fetch(`/api/generations/${generationId}/publish`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          promptsReady?: boolean;
          slug?: string;
          isPublished?: boolean;
          moderationStatus?: string;
        };
        if (!res.ok) {
          throw new Error(
            data.error === "unauthorized"
              ? "Войдите, чтобы опубликовать"
              : data.error === "generation_result_not_available"
                ? "Результат ещё не готов"
                : data.error === "publish_hidden"
                  ? "Публикация для этого аккаунта отключена"
                  : "Не удалось опубликовать",
          );
        }
        const wasPublished = isPublished;
        const nowPublished = data.isPublished === true;
        setIsPublished(nowPublished);
        setModerationStatus(parseCardModerationStatus(data.moderationStatus));
        if (data.slug) setPublishedSlug(data.slug);
        setMenuOpen(false);
        const offer = cardRepeatRewardOffer(cardRepeatReward);
        setToast(
          nowPublished
            ? publishRewardToastMessage({
                promptsReady: data.promptsReady,
                wasPublished,
                reward: null,
              })
            : offer
              ? publishModerationToast(offer.credits, offer.maxPerCard)
              : "Отправлено на модерацию. На витрине фото появится после проверки.",
        );
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось опубликовать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

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
            : isStickerEditKind(resultEditKind) || /\.png($|\?)/i.test(resultUrl)
              ? `promptshot-${generationId}.png`
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
        setStickerFromResultOpen(false);
        setStickerFromResultParentId(null);
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
    setPhotoshootOpen(false);
    setStickerFromResultOpen(false);
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
    setPendingRemixEdit(null);
    setNeedsCredits(false);
    setMenuOpen(false);
    setStickerFromResultOpen(false);
    setStickerFromResultParentId(null);
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
    setPendingRemixEdit(null);
    setProgress(0);
    setError("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setStickerFromResultOpen(false);
    setStickerFromResultParentId(null);
    setPhotoshootOpen(false);
    setPhotoshootSourceId(null);
    setPhotoshootSourceUrl(null);
    setPhotoshootLibraryPath(null);
    setPhotoshootTileUrls(null);
    setResultEditKind(null);
    photoshootDismissedRef.current = false;
    setResultPreviewOpen(false);
    setIsPublished(false);
    setModerationStatus("none");
    setResultModality("image");
    if (composeModeRef.current === "video") {
      enterImageCompose();
    } else if (composeModeRef.current !== "sticker") {
      setComposeMode("image");
      setAnimateParentId(null);
      setAnimatePreviewUrl(null);
    } else {
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

  const openCompletedDockJob = useCallback(
    (job: ActiveDockGenerationJob) => {
      if (!job.generationId || !job.resultUrl) return;
      markDockJobSeen(job.clientJobId);
      setGenerationId(job.generationId);
      setResultUrl(job.resultUrl);
      setResultModality(job.modality);
      setResultEditKind(job.editKind || null);
      setPhotoshootTileUrls(job.photoshootTileUrls || null);
      setPhotoshootOpen(false);
      setPhotoshootLibraryPath(null);
      setStickerFromResultOpen(false);
      setStickerStyleSheetMode(null);
      setStickerActionOpen(null);
      setStickerDownloadOpen(false);
      setStickerBorderOpen(false);
      setIsPublished(false);
      setModerationStatus("none");
      setPublishedSlug(null);
      if (
        job.promptText &&
        job.promptText !== "PHOTOSHOOT" &&
        job.promptText !== "STICKER"
      ) {
        setDraftPrompt(job.promptText);
        setSubmittedPrompt(job.promptText);
        promptStashRef.current = {
          ...promptStashRef.current,
          imagePrompt: job.promptText,
        };
      }
      if (job.modality === "video") {
        enterImageCompose();
      }
      if (
        !isStickerEditKind(job.editKind) &&
        !isStickerPackEditKind(job.editKind)
      ) {
        setStickerFromResultParentId(null);
        lastImageResultRef.current = rememberCompletedImageResult({
          generationId: job.generationId,
          resultUrl: job.resultUrl,
          resultModality: job.modality,
          previous: lastImageResultRef.current,
        });
      }
      setProgress(100);
      setPhase("done");
      phaseRef.current = "done";
      setExpandedControl(null);
      setPromptExpanded(false);
      setDockPlateOpen(true);
    },
    [
      enterImageCompose,
      markDockJobSeen,
      setDockPlateOpen,
      setExpandedControl,
      setPromptExpanded,
    ],
  );

  useEffect(() => {
    if (!isDock) return;
    return subscribeDockJobEvents((event) => {
      if (event.type === "failed") {
        setToast(event.job.errorMessage || "Генерация не удалась");
        return;
      }
      const { job } = event;
      if (job.modality !== "video") {
        hasCompletedImageGenerationRef.current = true;
        setHasCompletedImageGeneration(true);
        prefsSnapshotRef.current = {
          ...prefsSnapshotRef.current,
          hasCompletedImageGeneration: true,
        };
        persistGenerationPreferences(prefsSnapshotRef.current, { force: true });
      }
      const busyInEditor =
        activeDockSurfaceRef.current !== null ||
        (phaseRef.current === "generating" &&
          composeModeRef.current === "photo_prompt");
      if (busyInEditor) {
        setToast("Кадр готов — нажмите «Готово» в очереди сверху");
        return;
      }
      openCompletedDockJob(job);
    });
  }, [
    isDock,
    openCompletedDockJob,
    persistGenerationPreferences,
    subscribeDockJobEvents,
  ]);

  const videoCompose = composeMode === "video";
  const photoshootCompose = composeMode === "photoshoot";
  const stickerCompose = composeMode === "sticker";
  const photoPromptCompose = composeMode === "photo_prompt";
  /** A pack result is shown one sticker at a time; the sticker chrome applies to the selected tile. */
  const stickerPackResult = isStickerPackEditKind(resultEditKind);
  const stickerResult = isStickerEditKind(resultEditKind) || stickerPackResult;
  /** 1..16 for the sticker on screen when the result is a pack, else null (`?tile=` for sticker routes). */
  const stickerTile = stickerPackResult ? sidecarTileNumberForUrl(photoshootTileUrls, resultUrl) : null;
  const stickerCatalogWanted =
    stickerCompose ||
    stickerResult ||
    stickerFromResultOpen ||
    expandedControl === "tool";
  useEffect(() => {
    if (!stickerCatalogWanted || stickerCatalog) return;
    let cancelled = false;
    setStickerCatalogLoading(true);
    loadStickerCatalogClient()
      .then((catalog) => {
        if (cancelled) return;
        setStickerCatalog(catalog);
        if (!stickerStyleTouchedRef.current && catalog.defaultStyleId) {
          setStickerStyleId(catalog.defaultStyleId);
        }
      })
      .catch(() => {
        /* static fallback styles stay in place */
      })
      .finally(() => {
        if (!cancelled) setStickerCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stickerCatalogWanted, stickerCatalog]);
  useEffect(() => {
    if (!stickerCompose || stickerPacks) return;
    let cancelled = false;
    loadStickerPackExamplesClient()
      .then((packs) => {
        if (!cancelled) setStickerPacks(packs);
      })
      .catch(() => {
        if (!cancelled) setStickerPacks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [stickerCompose, stickerPacks]);
  useEffect(() => {
    if (!stickerPacks?.length) return;
    setStickerPackSetId((current) => current ?? stickerPacks[0].id);
  }, [stickerPacks]);
  const stickerStyles = stickerCatalog?.styles ?? STICKER_STYLES_FALLBACK;
  const stickerPresetsFor = (action: StickerResultAction) =>
    action === "emotion" ? stickerCatalog?.emotions ?? [] : action === "motion" ? stickerCatalog?.motions ?? [] : [];
  const selectedStickerPack =
    stickerPacks?.find((pack) => pack.id === stickerPackSetId) ?? stickerPacks?.[0] ?? null;
  const selectedStickerStyleLabel = stickerStyleTileLabel(stickerStyles, stickerStyleId);
  const selectedStickerExampleUrl =
    stickerStyles.find((style) => style.id === stickerStyleId)?.exampleUrls?.[0] ??
    stickerStyles.find((style) => style.exampleUrls?.length)?.exampleUrls?.[0] ??
    null;
  const photoPromptHasSource = Boolean(
    resolvePhotoPromptAnalyzeSource({
      selectedPreviewUrl: selectedPhotos[0]?.previewUrl,
      seedPreviewUrl: seed.previewUrl,
    })
  );
  const photoSelectionCap = photoPromptSelectionCap(composeMode, maxPhotos);
  /**
   * Blank compose: single prompt field until a completed result exists.
   * Card seed and «Что изменить» after generation use remix (changeRequest + parent).
   * Remix only saves the rewritten prompt; generate is a separate CTA.
   */
  const useBlankPromptEditor =
    (isBlank && !(resultUrl && generationId)) || videoCompose;
  /**
   * Typed or pasted prompt in blank compose gets the same «Что изменить?» rewrite as a card seed —
   * image prompts only (video scenarios are not remixed) and only once there is a prompt to rewrite.
   */
  const showBlankPromptRemix = showBlankPromptRemixBlock({
    useBlankPromptEditor,
    videoCompose,
    promptLength: draftPrompt.trim().length,
  });
  /** Prefill (photo→prompt) must not steal focus on mobile — keyboard shrinks the sheet. */
  const autofocusPromptEditor = !isMobile || draftPrompt.trim().length < 8;
  /**
   * Result photo as plate background after completion; keep it during a follow-up
   * generate so the modal stays tall and the CTA progress stays readable.
   */
  const showResultChrome =
    Boolean(resultUrl) &&
    !videoCompose &&
    (!isDock ||
      phase === "done" ||
      phase === "generating" ||
      phase === "uploading" ||
      shouldHoldPhotoPromptResultChrome({ composeMode, resultUrl }));

  useEffect(() => {
    if (!showResultChrome) return;
    setExpandedControl(null);
  }, [showResultChrome]);
  /**
   * Glass compose chrome: listing shows through the dock plate (idle + after result).
   * Fullscreen card keeps solid white until there is a result photo.
   */
  const glassChrome = isDock || showResultChrome;
  const imageCompose = composeMode === "image";
  const seoNeedsExamplePick = composeNeedsExamplePick({
    composeMode,
    selectedPhotoCount: selectedPhotos.length,
    cardId: resolvedCardId,
    promptLength: draftPrompt.trim().length,
  });
  const seoNeedsImageModelPick = composeNeedsImageModelPick({
    composeMode,
    modelId: model,
  });
  const showSeoExampleTool = composeShowsExampleTool({
    composeMode,
    showResultChrome,
  });
  const showPreserveOutfitChip = shouldShowPreserveOutfitChip({
    composeMode,
    photoCount: selectedPhotos.length,
    flagOn: preserveOutfitEnabled,
  });
  const selectedImageModel = models.find((item) => item.id === model) ?? null;
  const selectedImageCost = selectedImageModel?.cost ?? null;
  const selectedImageModelLabel = selectedImageModel
    ? displayLabelForGenerationModel(selectedImageModel.id, selectedImageModel.label)
    : null;
  const selectedImageModelTileLabel = selectedImageModel
    ? displayTileLabelForGenerationModel(
        selectedImageModel.id,
        selectedImageModel.label,
      )
    : null;
  const selectedVideoModelLabel = videoCostModel
    ? displayLabelForGenerationModel(videoCostModel.id, videoCostModel.label)
    : null;
  const selectedVideoModelTileLabel = videoCostModel
    ? displayTileLabelForGenerationModel(videoCostModel.id, videoCostModel.label)
    : null;
  /** Sticker footer always names the model and price — the model tile is not shown for this tool. */
  const stickerPageCta = stickerCompose
    ? stickerStudioCta({
        modelId: stickerModelId,
        cost:
          stickerKind === "pack" && stickerPackEnabled ? stickerPackCreditCost : stickerCost,
      })
    : null;
  const stickerPackSoon = composeCtaDisabledForStickerPack({
    composeMode,
    stickerKind,
    enqueueEnabled: stickerPackEnabled,
  });
  const openStepSurface: DockOpenStepSurface | null =
    isDockV2 && !showResultChrome
      ? promptExpanded
        ? "prompt"
        : expandedControl && expandedControl !== "auth"
          ? expandedControl
          : null
      : null;
  const dockStepCta = !busy
    ? resolveDockStepCta({
        surface: openStepSurface,
        composeMode,
        hasSelectedPhotos: selectedPhotos.length > 0,
        hasSinglePhoto: selectedPhotos.length === 1,
        sourcePhotoPicked,
        photoPromptHasSource,
        hasStyleOrPrompt:
          Boolean(resolvedCardId) || draftPrompt.trim().length >= 8,
        draftPromptLength: draftPrompt.trim().length,
        needsImageModelPick: seoNeedsImageModelPick,
      })
    : null;
  const advanceDockWizardStep = (): boolean => {
    if (!dockStepCta) return false;
    setError("");
    if (dockStepCta.target === "photos") {
      if (promptExpanded) setPromptExpanded(false);
      setExpandedControl("photos");
      return true;
    }
    if (dockStepCta.target === "example") {
      if (promptExpanded) setPromptExpanded(false);
      if (composeMode === "image") {
        openSeoExampleSheet();
      } else {
        setExpandedControl("example");
      }
      return true;
    }
    if (dockStepCta.target === "model") {
      if (promptExpanded) setPromptExpanded(false);
      if (composeMode === "image") {
        openImageModelSheet();
      } else {
        setExpandedControl("model");
      }
      return true;
    }
    if (promptExpanded) {
      setPromptExpanded(false);
    } else {
      closePrefsSheet();
    }
    return true;
  };
  const toolOptions = composeToolOptions({
    videoEnabled,
    photoshootEnabled,
    stickerEnabled,
    current: composeMode,
  });
  const secondaryTools = composeSecondaryTools(composeMode);
  const composeCtaModelLabel = stickerPageCta
    ? stickerPageCta.modelLabel
    : composeGenerateCtaShowsModelName(composeMode, {
        isAuthed,
      })
      ? videoCompose
        ? selectedVideoModelLabel
        : selectedImageModelLabel
      : null;
  const composeCtaCost = stickerPageCta
    ? stickerPageCta.cost
    : !isAuthed || photoPromptCompose
      ? null
      : photoshootCompose
        ? photoshootLibraryFrame
          ? PHOTOSHOOT_CREDIT_COST
          : null
        : stickerCompose
          ? resolvePhotoshootLibraryFrame({ selectedPhotos })
            ? stickerCost
            : null
          : videoCompose
          ? listingVideoRepeatCompose
            ? selectedModelCost
            : selectedVideoCost
          : selectedImageCost;
  const composeCtaGuestQuota = photoPromptCompose
    ? guestPhotoPromptRemainingFree({
        isAuthed,
        remainingFree: analyzeQuota?.remaining_free,
      })
    : null;
  const composeCtaGuestQuotaExhausted = composeCtaGuestQuota === 0;
  const composeCtaGuestQuotaPill =
    composeCtaGuestQuota != null ? (
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums ${
          composeCtaGuestQuotaExhausted ? "bg-rose-400/95" : "bg-white/20"
        }`}
        aria-label={`${composeCtaGuestQuota} бесплатных разборов сегодня`}
      >
        {composePhotoPromptGuestQuotaLabel(composeCtaGuestQuota)}
      </span>
    ) : null;
  const composeTileBorder = (selected: boolean, glass: boolean = glassChrome) =>
    selected
      ? glass
        ? "bg-indigo-400 text-white after:border-indigo-400"
        : "bg-indigo-500 text-white after:border-indigo-500"
      : glass
        ? "bg-white/5 text-white after:border-white/25 hover:bg-white/10 hover:after:border-white/40"
        : "bg-zinc-100 text-zinc-900 after:border-zinc-300 hover:bg-zinc-200 hover:after:border-zinc-400";
  const composeTileFrame =
    "after:pointer-events-none after:absolute after:inset-0 after:z-[1] after:rounded-xl after:border-2 after:border-solid";
  const composeToolTileSize = "h-[5.25rem] w-[5.25rem]";
  /** One rhythm for prompt / tiles / CTA and every dock sheet. */
  const composeBlockGap = "gap-3";
  const composeSheetCta =
    "inline-flex h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-indigo-600 px-4 text-[14px] font-semibold leading-none text-white transition hover:bg-indigo-700";
  /** Fullscreen card sheets cover the panel; dock uses in-sheet expand instead. */
  const sheetPos = "absolute";
  /** Dock: stretch floating sheet upward in-flow (V2) or fill dock frame (V1). */
  const dockExpanded = isDock && activeDockSurface !== null;
  /** True only when an upper V2 drawer surface (not footer-inline `auth`) is open. */
  const dockUpperDrawerOpen = Boolean(
    isDockV2 &&
      !showResultChrome &&
      (promptExpanded || (expandedControl && expandedControl !== "auth")),
  );
  /**
   * V2: full-height plate only when displaying finished/active result chrome or sub-result overlays.
   * V1: mobile dock and any expanded dock editor sheet also take full dock height.
   */
  const dockTall = isDockV2
    ? showResultChrome || stickerFromResultOpen || photoshootOpen
    : isDock &&
      (isMobile ||
        dockExpanded ||
        showResultChrome ||
        stickerFromResultOpen ||
        photoshootOpen);
  const dockPromptExpanded = dockExpanded && activeDockSurface === "prompt";
  const dockPhotosExpanded = dockExpanded && activeDockSurface === "photos";
  const dockModelExpanded = dockExpanded && activeDockSurface === "model";
  const dockExampleExpanded = dockExpanded && activeDockSurface === "example";
  const dockToolExpanded = dockExpanded && activeDockSurface === "tool";
  const dockAuthExpanded = dockExpanded && activeDockSurface === "auth";
  const showComposeToolGuide = composeToolGuideVisible({
    composeMode,
    showResultChrome,
    dockExpanded: isDockV2 ? dockUpperDrawerOpen : dockExpanded,
    busy,
  });

  useEffect(() => {
    preloadExampleSheetChunks(stickerCompose, stickerKind === "pack");
  }, [stickerCompose, stickerKind]);

  useLayoutEffect(() => {
    if (!isDockV2 || !promptExpanded) return;
    const el = promptDrawerTextareaRef.current;
    if (!el) return;
    const syncTextareaHeight = () => {
      const node = promptDrawerTextareaRef.current;
      if (!node) return;
      const prevScroll = node.scrollTop;
      node.style.height = "0px";
      const nextPx = resolvePromptDrawerTextareaHeightPx(node.scrollHeight);
      node.style.height = `${nextPx}px`;
      node.scrollTop = prevScroll;
    };
    syncTextareaHeight();
    window.addEventListener("resize", syncTextareaHeight);
    return () => window.removeEventListener("resize", syncTextareaHeight);
  }, [blankChangeOpen, draftPrompt, isDockV2, promptExpanded]);
  const hideCollapsedPromptStrip =
    resultChromeHidesPromptStrip({
      showResultChrome,
      promptExpanded,
    }) ||
    composeToolGuideHidesPromptStrip({
      composeMode,
      promptExpanded,
    });
  const dockSheetField =
    "rounded-xl border border-white/15 bg-white/10 text-white outline-none transition placeholder:text-white/40 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60";
  const showPhotoPromptResult =
    photoPromptCompose &&
    showResultChrome &&
    phase === "done" &&
    Boolean(resultUrl) &&
    Boolean(draftPrompt.trim()) &&
    !stickerFromResultOpen &&
    !photoshootOpen &&
    !(isDock && dockExpanded);
  const showResultActions =
    showResultChrome &&
    phase === "done" &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    !photoPromptCompose &&
    !stickerFromResultOpen &&
    !photoshootOpen &&
    !stickerActionOpen &&
    !stickerDownloadOpen &&
    !(isDock && dockExpanded);
  const resultPrimary = resultPrimaryAction({
    showCreditsCta,
    remixSaved: Boolean(pendingRemixEdit),
    stickerResult,
    stickerPackResult,
  });
  const repeatOffer = !isPublished ? cardRepeatRewardOffer(cardRepeatReward) : null;
  const pendingModeration = moderationStatus === "pending" && !isPublished;
  const publishHint = repeatOffer
    ? cardRepeatRewardMenuHint(repeatOffer.credits, repeatOffer.maxPerCard)
    : null;
  const showPublishRail = !stickerResult && showUserPublishControl({
    publishHidden,
    isPublished,
    catalogSlug: publishedSlug,
    republish: isPhotoshootEditKind(resultEditKind),
  });
  const showStickerFromResultOverlay =
    stickerFromResultOpen &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    resultModality === "image" &&
    (phase === "done" || phase === "generating");
  const showPhotoshootOverlay =
    photoshootOpen &&
    resultModality === "image" &&
    Boolean(photoshootLibraryPath || generationId);
  // Stays up while the emotion/motion job runs so the CTA shows progress; closes on completion.
  const showStickerActionOverlay =
    Boolean(stickerActionOpen) &&
    stickerResult &&
    (phase === "done" || phase === "generating") &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    resultModality === "image";
  const showStickerDownloadOverlay =
    stickerDownloadOpen &&
    stickerResult &&
    phase === "done" &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    resultModality === "image";
  const showStickerBorderOverlay =
    stickerBorderOpen &&
    stickerResult &&
    phase === "done" &&
    Boolean(resultUrl) &&
    Boolean(generationId) &&
    resultModality === "image";
  const hideComposeChrome =
    showPhotoshootOverlay ||
    showStickerFromResultOverlay ||
    showStickerActionOverlay ||
    showStickerDownloadOverlay ||
    showStickerBorderOverlay;
  const openStickerAction = (action: StickerResultAction) => {
    setError("");
    setStickerActionOpen(action);
  };
  const openStickerFromResult = () => {
    const frame = resolveStickerFromResultFrame({
      generationId,
      resultUrl,
      resultModality,
      resultEditKind,
    });
    if (!frame) return;
    setPhotoshootOpen(false);
    setStickerActionOpen(null);
    setStickerDownloadOpen(false);
    setStickerBorderOpen(false);
    setError("");
    setStickerFromResultParentId(frame.parentGenerationId);
    setStickerStyleSheetMode("photo");
    setStickerFromResultOpen(true);
    reachYandexMetrikaGoal(YM_GOAL_STICKER_FROM_RESULT_OPEN);
  };
  const openStickerRestyle = () => {
    if (!generationId || !resultUrl || resultModality !== "image" || stickerPackResult) return;
    setPhotoshootOpen(false);
    setStickerActionOpen(null);
    setStickerDownloadOpen(false);
    setStickerBorderOpen(false);
    setError("");
    setStickerStyleSheetMode("restyle");
    setStickerFromResultOpen(true);
    reachYandexMetrikaGoal(YM_GOAL_STICKER_FROM_RESULT_RESTYLE);
  };
  const closeStickerFromResult = () => {
    setStickerFromResultOpen(false);
    setStickerStyleSheetMode(null);
    reachYandexMetrikaGoal(YM_GOAL_STICKER_FROM_RESULT_CLOSE);
  };
  const submitStickerFromResult = () => {
    if (stickerStyleSheetMode === "restyle") {
      if (!generationId) return false;
      return runGenerate({
        editKind: STICKER_EDIT_KIND,
        parentGenerationId: generationId,
        stickerRestyle: true,
      });
    }
    if (!stickerFromResultParentId) return false;
    return runGenerate({
      editKind: STICKER_EDIT_KIND,
      parentGenerationId: stickerFromResultParentId,
      stickerFromResult: true,
    });
  };
  const openStickerBorder = () => {
    setError("");
    setStickerBorderOpen(true);
  };
  const closeStickerDownload = () => {
    setStickerDownloadOpen(false);
    setStickerDownloadError(null);
  };
  /** Platform-specific file (Telegram WebP / WhatsApp WebP ≤100 KB / Max PNG) built server-side. */
  const downloadStickerFor = async (platform: StickerPlatform) => {
    if (!generationId || stickerDownloadBusy) return;
    if (stickerPackResult && !stickerTile) {
      setStickerDownloadError("Выберите стикер из пака");
      return;
    }
    setStickerDownloadBusy(platform.id);
    setStickerDownloadError(null);
    try {
      const filename = stickerTile
        ? stickerPackTileFilename(stickerTile, platform.filename.split(".").pop() || "png")
        : platform.filename;
      await downloadStickerPlatformFile(generationId, platform.id, filename, { tile: stickerTile });
      reachYandexMetrikaGoal(YM_GOAL_STICKER_DOWNLOAD, { platform: platform.id });
      setStickerDownloadOpen(false);
      setToast(`Стикер для ${platform.label} сохранён`);
    } catch (err) {
      setStickerDownloadError(err instanceof Error ? err.message : "Не удалось подготовить стикер");
    } finally {
      setStickerDownloadBusy(null);
    }
  };
  /** Whole pack: 16 PNGs in one ZIP, built server-side. */
  const downloadStickerPackAll = async () => {
    if (!generationId || stickerDownloadBusy) return;
    setStickerDownloadBusy("zip");
    setStickerDownloadError(null);
    try {
      await downloadStickerPackZip(generationId, `promptshot-stickers-${generationId}.zip`);
      reachYandexMetrikaGoal(YM_GOAL_STICKER_DOWNLOAD, { platform: "zip" });
      setStickerDownloadOpen(false);
      setToast("Стикер пак сохранён");
    } catch (err) {
      setStickerDownloadError(err instanceof Error ? err.message : "Не удалось собрать архив");
    } finally {
      setStickerDownloadBusy(null);
    }
  };
  const submitStickerEdit = async (
    action: StickerEditAction,
    input: { presetId: string | null; customText: string },
  ): Promise<boolean> => {
    if (!generationId) return false;
    const goal =
      action === "emotion"
        ? YM_GOAL_STICKER_EMOTION
        : action === "motion"
          ? YM_GOAL_STICKER_MOTION
          : YM_GOAL_STICKER_REVISE;
    reachYandexMetrikaGoal(goal, {
      preset: action === "revise" ? "custom" : input.presetId || "custom",
    });
    return runGenerate({
      editKind: STICKER_EDIT_KIND,
      parentGenerationId: generationId,
      stickerAction: action,
      stickerPresetId: action === "revise" ? null : input.presetId,
      stickerCustomHint: action === "revise" || !input.presetId ? input.customText : "",
    });
  };
  /** Free server-side overlay: new completed generation, no worker round-trip. */
  const submitStickerText = async (input: { customText: string }): Promise<boolean> => {
    if (!generationId || stickerTextBusy) return false;
    setStickerTextBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/generations/${generationId}/sticker-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...browserAcquisitionHeaders() },
        credentials: "include",
        body: JSON.stringify({ text: input.customText, tile: stickerTile ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        resultUrl?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.id || !data.resultUrl) {
        setError(data.message || (res.status === 503 ? "Сервер занят, попробуйте ещё раз" : "Не удалось добавить текст"));
        return false;
      }
      reachYandexMetrikaGoal(YM_GOAL_STICKER_TEXT, { length: input.customText.trim().length });
      setGenerationId(data.id);
      setResultUrl(data.resultUrl);
      setResultEditKind(STICKER_EDIT_KIND);
      // The new row is one sticker — drop the pack film if the source was a pack tile.
      setPhotoshootTileUrls(null);
      setIsPublished(false);
      setModerationStatus("none");
      setPublishedSlug(null);
      rememberLastDockResult({
        generationId: data.id,
        resultUrl: data.resultUrl,
        promptText: draftPrompt,
        modality: "image",
        isPublished: false,
        editKind: STICKER_EDIT_KIND,
        photoshootTileUrls: null,
      });
      setStickerActionOpen(null);
      setStickerDownloadOpen(false);
      onGenerationComplete?.();
      return true;
    } catch {
      setError("Не удалось добавить текст");
      return false;
    } finally {
      setStickerTextBusy(false);
    }
  };
  /** Free die-cut, same role as the bot's «Обводка»: new completed sticker, no model call. */
  const submitStickerBorder = async ({ borderPx }: { borderPx: number }): Promise<boolean> => {
    if (!generationId || stickerBorderBusy || stickerTextBusy) return false;
    setStickerBorderBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/generations/${generationId}/sticker-border`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...browserAcquisitionHeaders() },
        credentials: "include",
        body: JSON.stringify({ borderPx, tile: stickerTile ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        resultUrl?: string;
        message?: string;
      };
      if (!res.ok || !data.id || !data.resultUrl) {
        setError(data.message || (res.status === 503 ? "Сервер занят, попробуйте ещё раз" : "Не удалось добавить обводку"));
        return false;
      }
      reachYandexMetrikaGoal(YM_GOAL_STICKER_BORDER);
      setGenerationId(data.id);
      setResultUrl(data.resultUrl);
      setResultEditKind(STICKER_EDIT_KIND);
      setPhotoshootTileUrls(null);
      setIsPublished(false);
      setModerationStatus("none");
      setPublishedSlug(null);
      rememberLastDockResult({
        generationId: data.id,
        resultUrl: data.resultUrl,
        promptText: draftPrompt,
        modality: "image",
        isPublished: false,
        editKind: STICKER_EDIT_KIND,
        photoshootTileUrls: null,
      });
      setStickerActionOpen(null);
      setStickerBorderOpen(false);
      setStickerDownloadOpen(false);
      onGenerationComplete?.();
      return true;
    } catch {
      setError("Не удалось добавить обводку");
      return false;
    } finally {
      setStickerBorderBusy(false);
    }
  };
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
    setStickerFromResultOpen(false);
    setStickerFromResultParentId(null);
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

  /**
   * «Инструмент» sheet chip. Switches compose mode and keeps «Инструмент» open
   * so the user sees the unified explainer for the chosen tool; «Далее →» advances.
   */
  const selectComposeTool = (mode: GenerateComposeMode) => {
    if (composeModeRef.current !== mode) {
      if (mode === "image") enterImageCompose();
      else if (mode === "photoshoot") enterPhotoshootCompose();
      else if (mode === "sticker") enterStickerCompose();
      else if (mode === "photo_prompt") {
        enterPhotoPromptCompose();
        reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN);
      } else if (selectedPhotos.length === 1) {
        selectVideoModel(activeVideoModel?.id || videoModel);
      } else {
        enterVideoCompose({ scenarioKey: null });
      }
    }
    setExpandedControl("tool");
  };

  const startPhotoPromptFromSelected = () => {
    const source = resolvePhotoPromptAnalyzeSource({
      selectedPreviewUrl: selectedPhotos[0]?.previewUrl,
      seedPreviewUrl: seed.previewUrl,
    });
    if (!source) {
      setError(PHOTO_PROMPT_NEEDS_PHOTO);
      setExpandedControl("photos");
      return;
    }
    void (async () => {
      try {
        const dataUrl = source.dataUrl.startsWith("data:")
          ? source.dataUrl
          : source.previewUrl.startsWith("data:")
            ? source.previewUrl
            : await dataUrlFromImageUrl(source.previewUrl);
        await runPhotoPromptAnalyze(dataUrl, source.previewUrl || dataUrl);
      } catch {
        setError("Не удалось прочитать фото. Попробуйте другое.");
      }
    })();
  };

  const createPhotoshoot = () => {
    if (photoshootLibraryPath) {
      return runGenerate({
        editKind: PHOTOSHOOT_EDIT_KIND,
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
      setStickerFromResultOpen(false);
      setStickerFromResultParentId(null);
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
        const tiles = sidecarTileUrls(kind, data.photoshootTileUrls);
        if (tiles) setPhotoshootTileUrls(tiles);
        if ((isPhotoshootEditKind(kind) || isStickerPackEditKind(kind)) && tiles) {
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
    /** Sticky tall plate only for result chrome or sub-result screens. */
    onDockResultChromeChange(
      showResultChrome || stickerFromResultOpen || photoshootOpen,
    );
  }, [
    isDock,
    onDockResultChromeChange,
    photoshootOpen,
    showResultChrome,
    stickerFromResultOpen,
  ]);

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
      if (!isMobile && !stickerFromResultOpen && !photoshootOpen && !photoPromptCompose) {
        setDockPlateOpen(false);
      }
      return;
    }
    if (
      phase === "done" &&
      resultUrl &&
      (previous === "generating" || previous === "uploading")
    ) {
      setDockPlateOpen(true);
      setExpandedControl(null);
    }
  }, [
    stickerFromResultOpen,
    isDock,
    isMobile,
    phase,
    photoPromptCompose,
    photoshootOpen,
    resultUrl,
    setDockPlateOpen,
    setExpandedControl,
  ]);

  const dockFrostedStyle =
    isDockV2 && (!showResultChrome || stickerResult)
      ? {
          backgroundColor: "rgba(12, 12, 17, 0.95)",
          backgroundImage:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0) 28%, rgba(0, 0, 0, 0.18) 100%)",
          backdropFilter: "blur(44px) saturate(1.55)",
          WebkitBackdropFilter: "blur(44px) saturate(1.55)",
        }
      : undefined;

  return (
    <div
      data-dock-panel-root={isDockV2 ? "" : undefined}
      style={dockFrostedStyle}
      className={`relative isolate flex min-h-0 flex-col overflow-hidden ${
        isDockV2 ? "max-h-full " : ""
      }${
        isDock
          ? showResultChrome
            ? `${isMobile ? "rounded-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "rounded-[1.75rem]"} border-0 text-zinc-100 ${
                stickerResult
                  ? isDockV2
                    ? "ps-dock-glass bg-zinc-950/95 ring-1 ring-inset ring-white/15"
                    : "bg-zinc-950/55 backdrop-blur-xl"
                  : "bg-zinc-950"
              }${
                isMobile
                  ? ""
                  : isDockV2
                    ? " shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.65)]"
                    : " shadow-[0_-12px_48px_-16px_rgba(24,24,27,0.28)]"
              }${dockTall || isMobile ? " h-full min-h-0 flex-1" : ""}`
            : isDockV2
              ? `${isMobile ? "rounded-t-[1.75rem] rounded-b-none pb-[env(safe-area-inset-bottom)]" : "rounded-[1.75rem]"} ps-dock-glass border-0 bg-zinc-950/95 text-zinc-100 shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/15${
                  dockTall ? " h-full min-h-0 flex-1" : ""
                }`
              : `${isMobile ? "rounded-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "rounded-[1.75rem]"} border-0 bg-zinc-950/55 text-zinc-100 shadow-[0_-12px_48px_-16px_rgba(24,24,27,0.28)] backdrop-blur-xl${
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
          pixelateOnBusy={!photoPromptCompose}
          fit={photoPromptCompose ? "cover" : "contain"}
          frame={stickerResult ? "square" : "fill"}
          className={isDock && isMobile ? "" : "rounded-[1.75rem]"}
        />
      ) : !isDock ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.16),transparent_38%),#09090b]"
          aria-hidden
        />
      ) : null}

      {isDockV2 && isMobile && !showResultChrome && onBack ? (
        <DockSummaryPocket
          tucked={dockUpperDrawerOpen}
          className="flex items-center justify-between px-3 pt-3 pb-0"
        >
          <span className="h-1 w-9 rounded-full bg-white/25" aria-hidden />
          <button
            type="button"
            aria-label="Закрыть генератор"
            onClick={onBack}
            className={`${OVERLAY_BUTTON_UA_RESET} flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white active:scale-95`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </DockSummaryPocket>
      ) : null}

      {isDockV2 &&
      activeJobs.length > 0 &&
      !(showResultChrome && dockExpanded) &&
      !hideComposeChrome ? (
        <ComposeActiveJobsTray
          jobs={activeJobs}
          activeGenerationId={generationId}
          showingResult={showResultChrome && phase === "done"}
          glassChrome={glassChrome}
          onSelectCompletedJob={openCompletedDockJob}
          onDismissJob={removeDockJob}
          onNewCompose={resetToCompose}
        />
      ) : null}

      {isDock && showResultChrome && phase === "done" && !dockExpanded && !stickerFromResultOpen && !photoshootOpen ? (
        <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-2">
          {resultUrl && generationId ? (
            <div className="relative" data-generation-menu-root>
              <button
                type="button"
                aria-label="Действия с фото"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onPointerEnter={preloadGenerationMenuChunk}
                onTouchStart={preloadGenerationMenuChunk}
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
              {menuOpen ? (
                <GenerationCardMenu
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  showSelect={false}
                  hasResult
                  hasPrompt={Boolean(activePrompt.trim())}
                  canPublish={!stickerResult}
                  showPublish={!publishHidden && !stickerResult}
                  isPublished={isPublished}
                  allowRepublish={isPhotoshootEditKind(resultEditKind)}
                  canAnimate={videoEnabled && resultModality === "image" && !stickerResult}
                  canSaveToLibrary={resultModality !== "video"}
                  moderationStatus={moderationStatus}
                  publishHint={publishHint}
                  busyAction={busyAction}
                  onAction={(action) => {
                    void handleResultAction(action);
                  }}
                />
              ) : null}
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

      {showResultActions
        ? (() => {
            const resultActionsList: GenerationResultAction[] = [
            ...(showPublishRail ? [{
              id: "publish",
              label: busyAction === "publish"
                ? "Публикация…"
                : isPublished
                  ? isPhotoshootEditKind(resultEditKind)
                    ? "Обновить промпты"
                    : "В каталоге"
                  : pendingModeration
                    ? "На модерации"
                    : "Опубликовать",
              detail: !isPublished && !pendingModeration && repeatOffer
                ? cardRepeatRewardDetail(repeatOffer.credits, repeatOffer.maxPerCard)
                : undefined,
              creditRewardLabel: !isPublished && !pendingModeration && repeatOffer
                ? cardRepeatRewardBadgeLabel(repeatOffer.maxPerCard)
                : undefined,
              wrap: true,
              disabled: Boolean(busyAction) || pendingModeration || (isPublished && !publishedSlug && !isPhotoshootEditKind(resultEditKind)),
              ariaLabel: isPublished
                ? "Открыть карточку в каталоге"
                : pendingModeration
                  ? "На модерации"
                  : repeatOffer
                    ? `Опубликовать в каталог. ${cardRepeatRewardDetail(repeatOffer.credits, repeatOffer.maxPerCard)}`
                    : "Опубликовать в каталог",
              onClick: () => {
                if (isPublished && publishedSlug && !isPhotoshootEditKind(resultEditKind)) {
                  window.location.assign(`/p/${publishedSlug}`);
                  return;
                }
                void handleResultAction("publish");
              },
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path
                    d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
            }] : []),
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
              detail: stickerResult ? "Telegram · WhatsApp · Max" : undefined,
              disabled: Boolean(busyAction),
              onClick: () => {
                if (stickerResult) {
                  setStickerDownloadError(null);
                  setStickerDownloadOpen(true);
                  return;
                }
                void handleResultAction("download");
              },
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              id: "repeat",
              label: stickerResult ? "Ещё стикер" : "Повторить",
              disabled: busy || Boolean(busyAction),
              onClick: resetToCompose,
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a9 9 0 1 1-3.25-6.8" strokeLinecap="round" />
                  <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            ...(stickerResult && !stickerPackResult && resultModality === "image"
              ? [
                  {
                    id: "restyle",
                    label: STICKER_FROM_RESULT_RESTYLE,
                    creditCost: stickerCost ?? undefined,
                    creditUnaffordable:
                      stickerCost != null && isAuthed && credits !== null && credits < stickerCost,
                    disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                    ariaLabel:
                      stickerCost != null
                        ? `${STICKER_FROM_RESULT_RESTYLE}, ${stickerCost} кредитов`
                        : STICKER_FROM_RESULT_RESTYLE,
                    onClick: () => void openStickerRestyle(),
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 4.5a7.5 7.5 0 1 0 7.2 5.4" strokeLinecap="round" />
                        <path d="M16.5 3.5v4.2H20" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ]
              : []),
            // Emotion / motion re-generate from a finished single sticker; a pack tile has no own row yet.
            ...(stickerResult && !stickerPackResult && resultModality === "image"
              ? [
                  {
                    id: "sticker-emotion",
                    label: STICKER_ACTION_COPY.emotion.railLabel,
                    creditCost: stickerCost ?? undefined,
                    creditUnaffordable:
                      stickerCost != null && isAuthed && credits !== null && credits < stickerCost,
                    disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                    ariaLabel: STICKER_ACTION_COPY.emotion.title,
                    onClick: () => openStickerAction("emotion"),
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="8.5" />
                        <path d="M8.5 14.2c.9 1.3 2.1 1.9 3.5 1.9s2.6-.6 3.5-1.9" strokeLinecap="round" />
                        <path d="M9.2 9.8h.01M14.8 9.8h.01" strokeLinecap="round" strokeWidth="2.4" />
                      </svg>
                    ),
                  },
                  {
                    id: "sticker-motion",
                    label: STICKER_ACTION_COPY.motion.railLabel,
                    creditCost: stickerCost ?? undefined,
                    creditUnaffordable:
                      stickerCost != null && isAuthed && credits !== null && credits < stickerCost,
                    disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                    ariaLabel: STICKER_ACTION_COPY.motion.title,
                    onClick: () => openStickerAction("motion"),
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="13.5" cy="5" r="1.6" />
                        <path d="m7 21 3.2-6.2L8 12.5l3.5-4.3 3.3 1.6 2.7 2.4M11 14.8l3.5 2.2L16 21" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ]
              : []),
            // Text and border are free overlays on the stored PNG — work on a single sticker and on a pack tile.
            ...(stickerResult && resultModality === "image" && (!stickerPackResult || stickerTile)
              ? [
                  {
                    id: "sticker-text",
                    label: STICKER_ACTION_COPY.text.railLabel,
                    detail: STICKER_ACTION_FREE_DETAIL,
                    disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                    ariaLabel: `${STICKER_ACTION_COPY.text.title}, ${STICKER_ACTION_FREE_DETAIL}`,
                    onClick: () => openStickerAction(STICKER_TEXT_ACTION),
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M5 6.5V4.5h14v2M12 4.5v15m-3 0h6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    id: "sticker-border",
                    label: stickerBorderBusy ? `${STICKER_BORDER_COPY.railLabel}…` : STICKER_BORDER_COPY.railLabel,
                    detail: STICKER_ACTION_FREE_DETAIL,
                    disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                    ariaLabel: `${STICKER_BORDER_COPY.railLabel}, ${STICKER_ACTION_FREE_DETAIL}`,
                    onClick: openStickerBorder,
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="4.25" />
                        <circle cx="12" cy="12" r="7.25" />
                      </svg>
                    ),
                  },
                ]
              : []),
            ...(videoEnabled && resultModality === "image" && !stickerResult
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
            ...(stickerEnabled &&
            stickerFromResultEnabled &&
            resultModality === "image" &&
            !stickerResult &&
            !isPhotoshootEditKind(resultEditKind)
              ? [
                  {
                    id: "sticker",
                    label: STICKER_FROM_RESULT_RAIL,
                    detail: STICKER_FROM_RESULT_RAIL_DETAIL,
                    creditCost: stickerCost ?? undefined,
                    creditUnaffordable:
                      stickerCost != null && isAuthed && credits !== null && credits < stickerCost,
                    ariaLabel:
                      stickerCost != null
                        ? `${STICKER_FROM_RESULT_RAIL}, ${STICKER_FROM_RESULT_RAIL_DETAIL}, ${stickerCost} кредитов`
                        : `${STICKER_FROM_RESULT_RAIL}, ${STICKER_FROM_RESULT_RAIL_DETAIL}`,
                    disabled: busy || Boolean(busyAction),
                    onClick: openStickerFromResult,
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path
                          d="M5 7a2 2 0 0 1 2-2h8l4 4v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M15 5v4h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ]
              : []),
            ...(photoshootEnabled && resultModality === "image" && !stickerResult
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
            ...(resultPrimary.kind === "credits"
              ? [{
                  id: "credits",
                  label: resultPrimary.label,
                  primary: true,
                  wrap: true,
                  onClick: () => {
                    reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
                    openPricing();
                  },
                  icon: (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="8.25" />
                      <path d="M12 8v8M9.5 10.5h3.2a1.8 1.8 0 1 1 0 3.6H9.5" strokeLinecap="round" />
                    </svg>
                  ),
                }]
              : resultPrimary.kind === "generate" && pendingRemixEdit
              ? [{
                  id: "generate",
                  label: resultPrimary.label,
                  primary: true,
                  disabled: busy || Boolean(busyAction),
                  onClick: () => {
                    const pending = pendingRemixEdit;
                    setPendingRemixEdit(null);
                    void runGenerate({
                      promptOverride: draftPrompt,
                      parentGenerationId: pending.parentGenerationId,
                      editInstruction: pending.editInstruction,
                    });
                  },
                  icon: (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                }]
              : resultPrimary.kind === "sticker_revise"
              ? [{
                  id: "sticker-revise",
                  label: resultPrimary.label,
                  primary: true,
                  wrap: true,
                  creditCost: stickerCost ?? undefined,
                  creditUnaffordable:
                    stickerCost != null && isAuthed && credits !== null && credits < stickerCost,
                  disabled: busy || Boolean(busyAction) || stickerTextBusy || stickerBorderBusy,
                  ariaLabel:
                    stickerCost != null
                      ? `${STICKER_ACTION_COPY.revise.title}, ${stickerCost} кредитов`
                      : STICKER_ACTION_COPY.revise.title,
                  onClick: () => openStickerAction("revise"),
                  icon: (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m14.5 6.7 2.8 2.8" />
                    </svg>
                  ),
                }]
              : resultPrimary.kind === "none"
              ? []
              : [{
                  id: "edit",
                  label: resultPrimary.label,
                  primary: true,
                  disabled: busy || Boolean(busyAction),
                  onClick: openPromptEditor,
                  icon: (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m14.5 6.7 2.8 2.8" />
                    </svg>
                  ),
                }]),
            ];
            return generateDockV2Enabled ? (
              <GenerationResultBottomBar
                className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30"
                offerBanner={<LowBalanceUpgradeOfferCard variant="result" />}
                film={
                  photoshootTileUrls ? (
                    <PhotoshootFrameFilm
                      tileUrls={photoshootTileUrls}
                      activeTile={
                        sidecarTileNumberForUrl(photoshootTileUrls, resultUrl) ?? 1
                      }
                      tileLabel={stickerPackResult ? "Стикер" : "Кадр"}
                      onSelect={(tile) => {
                        const url = photoshootTileUrls?.[tile - 1];
                        if (url) setResultUrl(url);
                      }}
                    />
                  ) : null
                }
                actions={resultActionsList}
              />
            ) : (
              <>
                {photoshootTileUrls ? (
                  <PhotoshootFrameFilm
                    className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[11rem] z-20"
                    tileUrls={photoshootTileUrls}
                    activeTile={
                      sidecarTileNumberForUrl(photoshootTileUrls, resultUrl) ?? 1
                    }
                    tileLabel={stickerPackResult ? "Стикер" : "Кадр"}
                    onSelect={(tile) => {
                      const url = photoshootTileUrls?.[tile - 1];
                      if (url) setResultUrl(url);
                    }}
                  />
                ) : null}
                <GenerationResultActionRail
                  className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30"
                  beforePrimary={<LowBalanceUpgradeOfferCard variant="result" />}
                  actions={resultActionsList}
                />
              </>
            );
          })()
        : null}

      {showPhotoPromptResult
        ? (() => {
            const photoPromptActions: GenerationResultAction[] = [
            {
              id: "copy",
              label: "Скопировать",
              onClick: () => {
                void copyTextUniversal(draftPrompt).then((ok) => {
                  setToast(ok ? "Промт скопирован" : "Не удалось скопировать");
                });
              },
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5h10" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              id: "create",
              label: isAuthed ? "Создать" : "Войдите",
              primary: true,
              disabled: busy || Boolean(busyAction) || draftPrompt.trim().length < 8,
              onClick: () => {
                const prompt = draftPrompt.trim();
                if (!isAuthed) {
                  persistPendingGenerateDock({
                    seed: {
                      source: "blank",
                      promptText: prompt,
                      cardId: null,
                      intent: "text",
                    },
                    dockSurface: null,
                  });
                  setResultUrl(null);
                  setPhase("idle");
                  phaseRef.current = "idle";
                  enterImageCompose();
                  openInlineAuthSheet("default");
                  return;
                }
                enterImageCompose();
                void runGenerate({ promptOverride: prompt });
              },
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              id: "repeat",
              label: "Повторить",
              disabled: busy || Boolean(busyAction),
              onClick: () => {
                const dataUrl = photoPromptDataUrlRef.current;
                if (!dataUrl) {
                  startPhotoPromptFromSelected();
                  return;
                }
                void runPhotoPromptAnalyze(dataUrl, resultUrl || dataUrl);
              },
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a9 9 0 1 1-3.25-6.8" strokeLinecap="round" />
                  <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            ];
            return generateDockV2Enabled ? (
              <GenerationResultBottomBar
                className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30"
                actions={photoPromptActions}
              />
            ) : (
              <GenerationResultActionRail
                className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30"
                actions={photoPromptActions}
              />
            );
          })()
        : null}

      {showStickerFromResultOverlay ? (
        <StickerFromResultSheet
          styles={stickerStyles}
          loading={stickerCatalogLoading}
          selectedId={stickerStyleId}
          onSelect={(style) => {
            stickerStyleTouchedRef.current = true;
            setStickerStyleId(style.id);
            setError("");
          }}
          creditCost={stickerCost}
          creditUnaffordable={
            stickerCost != null && isAuthed && credits !== null && credits < stickerCost
          }
          hideCreditCost={!isAuthed}
          busy={phase === "generating" || starting}
          progress={progress}
          error={error || null}
          mode={stickerStyleSheetMode ?? "photo"}
          v2Chrome={generateDockV2Enabled}
          onClose={closeStickerFromResult}
          onSubmit={submitStickerFromResult}
        />
      ) : null}

      {showPhotoshootOverlay ? (
        <PhotoshootOverlay
          capturing={phase === "generating"}
          progress={progress}
          v2Chrome={generateDockV2Enabled}
          onClose={closePhotoshoot}
          onCreate={createPhotoshoot}
        />
      ) : null}

      {showStickerActionOverlay && stickerActionOpen ? (
        <StickerActionSheet
          action={stickerActionOpen}
          presets={stickerPresetsFor(stickerActionOpen)}
          loading={stickerCatalogLoading}
          creditCost={stickerCost}
          creditUnaffordable={
            stickerCost != null && isAuthed && credits !== null && credits < stickerCost
          }
          hideCreditCost={!isAuthed}
          busy={phase === "generating" || starting || stickerTextBusy}
          progress={progress}
          error={error || null}
          v2Chrome={generateDockV2Enabled}
          onClose={() => setStickerActionOpen(null)}
          onSubmit={(input) =>
            stickerActionOpen === STICKER_TEXT_ACTION
              ? submitStickerText(input)
              : submitStickerEdit(stickerActionOpen, input)
          }
        />
      ) : null}

      {showStickerBorderOverlay ? (
        <StickerBorderSheet
          busy={stickerBorderBusy}
          error={error || null}
          v2Chrome={generateDockV2Enabled}
          onClose={() => setStickerBorderOpen(false)}
          onSubmit={submitStickerBorder}
        />
      ) : null}

      {showStickerDownloadOverlay ? (
        <StickerDownloadSheet
          busyPlatform={stickerDownloadBusy}
          error={stickerDownloadError}
          packTile={stickerTile}
          v2Chrome={generateDockV2Enabled}
          onClose={closeStickerDownload}
          onPick={(platform) => void downloadStickerFor(platform)}
          onPickAll={stickerPackResult ? () => void downloadStickerPackAll() : undefined}
        />
      ) : null}

      {!isDock && !hideComposeChrome ? (
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
              onPointerEnter={preloadGenerationMenuChunk}
              onTouchStart={preloadGenerationMenuChunk}
              className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition hover:bg-black/40`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="19" r="1.75" />
              </svg>
            </button>
            {menuOpen ? (
              <GenerationCardMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                showSelect={false}
                hasResult
                hasPrompt={Boolean(activePrompt.trim())}
                canPublish={!stickerResult}
                showPublish={!publishHidden && !stickerResult}
                isPublished={isPublished}
                allowRepublish={isPhotoshootEditKind(resultEditKind)}
                canAnimate={videoEnabled && resultModality === "image" && !stickerResult}
                canSaveToLibrary={resultModality !== "video"}
                moderationStatus={moderationStatus}
                publishHint={publishHint}
                busyAction={busyAction}
                onAction={(action) => {
                  void handleResultAction(action);
                }}
              />
            ) : null}
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
            : isDockV2
            ? showResultChrome
              ? "min-h-0 flex-1 px-3 pb-3 pt-3"
              : "min-h-0 flex-1"
            : isDock
            ? "min-h-0 flex-1 px-3 pb-3 pt-3"
            : `relative z-10 flex-1 ${isMobile ? "px-3 py-3" : "px-3 py-2.5"}`
        }`}
      >
        {!isDockV2 &&
        showComposeToolGuide &&
        (composeMode === "photoshoot" ||
          composeMode === "photo_prompt" ||
          composeMode === "sticker") ? (
          <ComposeToolGuide
            mode={composeMode}
            glassChrome={glassChrome}
            photoshootExample={
              composeMode === "photoshoot"
                ? composePhotoshootGuideExample(photoshootComposeExampleEnabled)
                : null
            }
            stickerExampleUrl={composeMode === "sticker" ? selectedStickerExampleUrl : null}
            stickerKind={stickerKind}
            className="min-h-0 flex-1 px-3 pt-3 pb-0"
          />
        ) : null}

        {isDockV2 && !showResultChrome ? (
          <DockInlineDrawer
            open={Boolean(dockUpperDrawerOpen || showComposeToolGuide)}
            fillViewport={shouldDockDrawerFillViewport({
              expandedControl,
              stickerCompose,
            })}
            elevatedStage={dockUpperDrawerOpen}
          >
            {promptExpanded ? (
              <ComposeSheetShell
                id="inline-generation-prompt"
                title={PROMPT_FIELD_LABEL}
                titleId="inline-prompt-editor-title"
                collapseAriaLabel="Свернуть промпт"
                closeAriaLabel="Свернуть промпт"
                isDock
                isMobile={isMobile}
                inFlowDock
                headerAction={
                  draftPrompt.trim().length >= 8 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void copyTextUniversal(draftPrompt).then((ok) => {
                          setToast(
                            ok ? "Промт скопирован" : "Не удалось скопировать",
                          );
                        });
                      }}
                      className={`${OVERLAY_BUTTON_UA_RESET} inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-950/35 px-3 text-[12px] font-semibold text-white/90 ring-1 ring-inset ring-white/15 transition hover:bg-white/15 hover:text-white`}
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        aria-hidden
                      >
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5h10" strokeLinecap="round" />
                      </svg>
                      <span>Скопировать</span>
                    </button>
                  ) : null
                }
                onClose={() => setPromptExpanded(false)}
                bodyClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
              >
                <label className="flex min-h-0 flex-col">
                  <span className="sr-only">{PROMPT_FIELD_LABEL}</span>
                  <textarea
                    ref={promptDrawerTextareaRef}
                    rows={PROMPT_DRAWER_MIN_LINES}
                    value={draftPrompt}
                    onChange={(event) => setDraftPrompt(event.target.value)}
                    placeholder={
                      videoCompose && scenarioLoading
                        ? ANIMATE_SCENARIO_PLACEHOLDER
                        : BLANK_PROMPT_PLACEHOLDER
                    }
                    maxLength={8000}
                    disabled={busy || remixing}
                    autoFocus={autofocusPromptEditor}
                    style={{ minHeight: `${PROMPT_DRAWER_MIN_HEIGHT_PX}px` }}
                    className="max-h-full w-full resize-none overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950/35 p-3.5 text-[13px] font-medium leading-relaxed text-white outline-none transition-colors placeholder:text-white/45 focus:border-indigo-300 focus:bg-zinc-950/45 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60"
                  />
                </label>

                {!useBlankPromptEditor || showBlankPromptRemix ? (
                  !useBlankPromptEditor || blankChangeOpen ? (
                    <div className="flex shrink-0 flex-col gap-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-white/80">
                          {PROMPT_REMIX_COPY.changeLabel}
                        </span>
                        <textarea
                          value={changeRequest}
                          onChange={(event) =>
                            setChangeRequest(event.target.value)
                          }
                          placeholder={PROMPT_REMIX_COPY.changePlaceholder}
                          maxLength={1000}
                          rows={2}
                          disabled={busy || remixing}
                          className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-950/35 p-3 text-[13px] font-medium leading-relaxed text-white outline-none transition placeholder:text-white/45 focus:border-indigo-300 focus:bg-zinc-950/45 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60"
                        />
                      </label>
                      {changeRequest.trim().length > 0 ? (
                        <button
                          type="button"
                          disabled={
                            busy ||
                            remixing ||
                            draftPrompt.trim().length < 8 ||
                            !changeRequest.trim()
                          }
                          onClick={() =>
                            void applyPromptRemix({ keepEditorOpen: true })
                          }
                          className={`${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-9 self-end items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-50`}
                        >
                          {remixing
                            ? PROMPT_REMIX_COPY.submitting
                            : PROMPT_REMIX_COPY.submit}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || remixing}
                      onClick={() => {
                        setError("");
                        setBlankChangeOpen(true);
                      }}
                      className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-10 w-full shrink-0 items-center gap-2 rounded-2xl bg-zinc-950/35 px-3.5 py-2 text-left text-[13px] font-semibold text-white/90 ring-1 ring-inset ring-white/15 transition hover:bg-zinc-950/50 disabled:opacity-50`}
                    >
                      <svg
                        className="h-4 w-4 shrink-0 text-indigo-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden
                      >
                        <path
                          d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="m13.5 7.5 3 3" strokeLinecap="round" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">
                        {PROMPT_REMIX_COPY.changeLabel}
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-white/60">
                        {PROMPT_REMIX_COPY.changeHint}
                      </span>
                    </button>
                  )
                ) : null}
              </ComposeSheetShell>
            ) : expandedControl === "photos" ? (
              <ComposeSheetShell
                id="inline-generation-photos"
                title={`Ваши фото · ${selectedPhotos.length}/${photoSelectionCap}`}
                ariaLabel="Выбор фотографий"
                collapseAriaLabel="Свернуть выбор фотографий"
                closeAriaLabel="Свернуть выбор фотографий"
                isDock
                isMobile={isMobile}
                inFlowDock
                onClose={closePrefsSheet}
                bodyClassName="flex min-h-0 flex-[1_1_auto] flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <section
                  aria-labelledby={
                    photoPromptCompose
                      ? "generation-photo-prompt-guide-title"
                      : stickerCompose
                        ? "generation-sticker-picker-guide-title"
                        : "generation-photo-guide-title"
                  }
                  className="w-full"
                >
                  <ComposePhotoUploadGuide
                    mode={composeMode}
                    glassChrome
                    isDock
                    stickerKind={stickerKind}
                    stickerExampleUrl={selectedStickerExampleUrl}
                  />
                </section>

                <div className={`flex shrink-0 flex-col ${composeBlockGap}`}>
                  {showPreserveOutfitChip ? (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-pressed={preserveOutfit}
                        disabled={controlsBusy}
                        onClick={() => setPreserveOutfit((current) => !current)}
                        className={`${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition disabled:opacity-50 ${
                          preserveOutfit
                            ? "bg-indigo-500/30 text-white ring-1 ring-indigo-300"
                            : "bg-white/10 text-white/85 ring-1 ring-white/20 hover:bg-white/15"
                        }`}
                      >
                        <span>Оставить одежду</span>
                        {preserveOutfit ? (
                          <span aria-hidden className="text-[12px] leading-none">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ) : null}
                  <div className="flex gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={controlsBusy}
                      className={`${OVERLAY_BUTTON_UA_RESET} flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/10 text-center text-white transition hover:border-indigo-300 hover:bg-white/15 disabled:opacity-50`}
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
                      <span className="mt-1 text-[12px] font-semibold">Добавить</span>
                    </button>
                    {photos.map((photo) => {
                      const selected = selectedPhotoIds.has(photo.id);
                      const deleting = deletingPhotoId === photo.id;
                      return (
                        <div
                          key={photo.id}
                          className={`group relative isolate h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ${composeTileFrame} ${
                            selected ? "after:border-indigo-300" : "after:border-white/25"
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
                                className="absolute inset-0 size-full object-cover object-center"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center text-[12px] font-medium text-zinc-400">
                                Фото
                              </span>
                            )}
                            {selected ? (
                              <span
                                aria-hidden
                                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-300 text-[12px] font-bold text-zinc-950 shadow"
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
                            className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-0 left-0 z-10 flex h-9 w-9 items-end justify-start p-1 text-white disabled:opacity-50`}
                          >
                            <span
                              aria-hidden
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md"
                            >
                              <svg
                                className="h-3.5 w-3.5"
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
                </div>
              </ComposeSheetShell>
            ) : expandedControl === "example" && showSeoExampleTool ? (
              <ComposeSheetShell
                id="inline-generation-examples"
                title={
                  stickerCompose
                    ? STICKER_STYLE_PICKER_TITLE
                    : SEO_COMPOSE_EXAMPLE_SHEET_TITLE
                }
                titleId="generation-example-picker-title"
                collapseAriaLabel={SEO_COMPOSE_EXAMPLE_SHEET_COLLAPSE_LABEL}
                closeAriaLabel={SEO_COMPOSE_EXAMPLE_SHEET_CLOSE_LABEL}
                isDock
                isMobile={isMobile}
                inFlowDock
                onClose={closePrefsSheet}
                bodyClassName={
                  stickerCompose
                    ? "flex min-h-0 flex-[1_1_auto] flex-col overflow-hidden"
                    : "flex min-h-0 flex-1 flex-col overflow-hidden"
                }
              >
                {stickerCompose && stickerKind === "pack" ? (
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <p className="px-1 pb-2 text-[13px] font-semibold text-white">
                      {STICKER_PACK_SET_PICKER_TITLE}
                    </p>
                    <StickerPackSetPicker
                      packs={stickerPacks}
                      selectedId={stickerPackSetId}
                      tone="dark"
                      onSelect={(pack) => {
                        setStickerPackSetId(pack.id);
                        setError("");
                      }}
                    />
                    <p className="px-1 pb-2 pt-4 text-[13px] font-semibold text-white">
                      {STICKER_STYLE_PICKER_TITLE}
                    </p>
                    <StickerStylePicker
                      embedded
                      styles={stickerStyles}
                      loading={stickerCatalogLoading}
                      selectedId={stickerStyleId}
                      tone="dark"
                      confirmCtaClassName={composeSheetCta}
                      onSelect={(style) => {
                        stickerStyleTouchedRef.current = true;
                        setStickerStyleId(style.id);
                        setError("");
                      }}
                    />
                  </div>
                ) : stickerCompose ? (
                  <StickerStylePicker
                    styles={stickerStyles}
                    loading={stickerCatalogLoading}
                    selectedId={stickerStyleId}
                    tone="dark"
                    confirmCtaClassName={`${OVERLAY_BUTTON_UA_RESET} mt-3 ${composeSheetCta}`}
                    onSelect={(style) => {
                      stickerStyleTouchedRef.current = true;
                      setStickerStyleId(style.id);
                      setError("");
                      advanceAfterStyleSelection();
                    }}
                  />
                ) : (
                  <ComposeExamplePicker
                    selectedCardId={resolvedCardId}
                    instantSelect
                    tone="dark"
                    matchEnabled={composeExampleMatchEnabled}
                    matchPhoto={
                      selectedPhotos[0]
                        ? {
                            id: selectedPhotos[0].id,
                            dataUrl: isPhotoPromptEphemeralId(selectedPhotos[0].id)
                              ? selectedPhotos[0].previewUrl
                              : null,
                            audienceTag: selectedPhotos[0].audienceTag ?? null,
                          }
                        : null
                    }
                    confirmCtaClassName={`${OVERLAY_BUTTON_UA_RESET} mt-3 ${composeSheetCta}`}
                    onSelect={({ cardId: nextCardId, promptText, photoUrl }) => {
                      setPickedExampleCardId(nextCardId);
                      setPickedExamplePreviewUrl(photoUrl);
                      setDraftPrompt(promptText);
                      setError("");
                      applyComposeExamplePick({
                        cardId: nextCardId,
                        promptText,
                        examplePreviewUrl: photoUrl,
                      });
                      advanceAfterStyleSelection();
                    }}
                  />
                )}
              </ComposeSheetShell>
            ) : expandedControl === "tool" ? (
              <ComposeSheetShell
                id="inline-generation-tools"
                title={COMPOSE_TOOL_SHEET_TITLE}
                titleId="generation-tool-sheet-title"
                collapseAriaLabel="Свернуть выбор инструмента"
                closeAriaLabel="Свернуть выбор инструмента"
                isDock
                isMobile={isMobile}
                inFlowDock
                onClose={closePrefsSheet}
                bodyClassName="flex min-h-0 flex-[1_1_auto] flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <ComposeToolGuide
                  mode={composeMode}
                  glassChrome
                  photoshootExample={
                    composeMode === "photoshoot"
                      ? composePhotoshootGuideExample(photoshootComposeExampleEnabled)
                      : null
                  }
                  stickerExampleUrl={composeMode === "sticker" ? selectedStickerExampleUrl : null}
                  stickerKind={stickerKind}
                  onStickerKindChange={setStickerKind}
                  photoExampleUrl={pickedExamplePreviewUrl || null}
                />
                <div
                  role="group"
                  aria-label={COMPOSE_TOOL_SHEET_TITLE}
                  className="-mt-[3px] flex shrink-0 items-start justify-start gap-2 overflow-x-auto overscroll-x-contain px-1.5 pt-2.5 sm:justify-center [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {toolOptions.map((mode) => (
                    <ComposeToolChoiceTile
                      key={mode}
                      mode={mode}
                      selected={composeMode === mode}
                      disabled={controlsBusy}
                      glassChrome
                      className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                        composeMode === mode,
                        true,
                      )}`}
                      onClick={() => selectComposeTool(mode)}
                    />
                  ))}
                </div>
              </ComposeSheetShell>
            ) : expandedControl === "model" ? (
              <ComposeSheetShell
                id="inline-generation-models"
                title={videoCompose ? "Модель видео" : "Модель фото"}
                ariaLabel="Выбор модели"
                collapseAriaLabel="Свернуть выбор модели"
                closeAriaLabel="Свернуть выбор модели"
                isDock
                isMobile={isMobile}
                inFlowDock
                onClose={closePrefsSheet}
                bodyClassName={`flex min-h-0 flex-[1_1_auto] flex-col justify-start overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${composeBlockGap}`}
              >
                {!videoCompose ? (
                  <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-5 pb-2">
                    {models.map((item) => {
                      const unaffordable =
                        isAuthed && credits !== null && credits < item.cost;
                      return (
                        <ComposeModelChoiceCard
                          key={item.id}
                          modelId={item.id}
                          label={displayLabelForGenerationModel(item.id, item.label)}
                          description={displayDescriptionForGenerationModel(
                            item.id,
                            "Генерация изображений"
                          )}
                          cost={item.cost}
                          selected={model === item.id}
                          unaffordable={unaffordable}
                          disabled={controlsBusy}
                          dockChrome
                          onClick={() => selectImageModel(item.id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-5 pb-2">
                    {videoModels.map((item) => {
                      const itemCost = calculateVideoCreditCost(
                        item.cost,
                        videoDurationSeconds,
                        item.id
                      );
                      const unaffordable =
                        isAuthed && credits !== null && credits < itemCost;
                      return (
                        <ComposeModelChoiceCard
                          key={item.id}
                          modelId={item.id}
                          label={displayLabelForGenerationModel(item.id, item.label)}
                          description={displayDescriptionForGenerationModel(
                            item.id,
                            "Видео из фото"
                          )}
                          cost={itemCost}
                          selected={activeVideoModel?.id === item.id}
                          unaffordable={unaffordable}
                          disabled={controlsBusy}
                          dockChrome
                          onClick={() => selectVideoModel(item.id)}
                        />
                      );
                    })}
                  </div>
                )}
                {videoCompose ? (
                  <div className="grid shrink-0 grid-cols-3 gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[13px] font-medium text-white/65">
                        Формат
                      </span>
                      <select
                        value={videoAspectRatio}
                        onChange={(event) => setVideoAspectRatio(event.target.value)}
                        disabled={controlsBusy}
                        className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${dockSheetField}`}
                      >
                        {VIDEO_ASPECT_RATIO_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[13px] font-medium text-white/65">
                        Длительность
                      </span>
                      <select
                        value={String(videoDurationSeconds)}
                        onChange={(event) =>
                          setVideoDurationSeconds(Number(event.target.value))
                        }
                        disabled={controlsBusy}
                        className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${dockSheetField}`}
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
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[13px] font-medium text-white/65">
                        Качество
                      </span>
                      <select
                        value={DEFAULT_VIDEO_RESOLUTION}
                        disabled
                        className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${dockSheetField}`}
                      >
                        {VIDEO_RESOLUTION_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="grid shrink-0 grid-cols-2 gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[13px] font-medium text-white/65">
                        Формат
                      </span>
                      <select
                        value={aspectRatio}
                        onChange={(event) => setAspectRatio(event.target.value)}
                        disabled={controlsBusy || !aspectRatios.length}
                        className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${dockSheetField}`}
                      >
                        {aspectRatios.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[13px] font-medium text-white/65">
                        Качество
                      </span>
                      <select
                        value={imageSize}
                        onChange={(event) => setImageSize(event.target.value)}
                        disabled={controlsBusy || !imageSizes.length}
                        className={`min-h-11 w-full px-3 text-[13px] font-semibold outline-none transition disabled:opacity-50 ${dockSheetField}`}
                      >
                        {visibleImageSizes.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </ComposeSheetShell>
            ) : showComposeToolGuide &&
              (composeMode === "photoshoot" ||
                composeMode === "photo_prompt" ||
                composeMode === "sticker") ? (
              <ComposeToolGuide
                mode={composeMode}
                glassChrome={glassChrome}
                photoshootExample={
                  composeMode === "photoshoot"
                    ? composePhotoshootGuideExample(photoshootComposeExampleEnabled)
                    : null
                }
                stickerExampleUrl={
                  composeMode === "sticker" ? selectedStickerExampleUrl : null
                }
                stickerKind={stickerKind}
                className="px-3 pt-3 pb-0"
              />
            ) : null}
          </DockInlineDrawer>
        ) : null}

        <DockSummaryPocket
          enabled={isDockV2 && !showResultChrome}
          tucked={dockUpperDrawerOpen}
          outerClassName="mt-auto w-full"
          className={`${
            isDockV2
              ? showResultChrome
                ? `mt-auto flex min-h-0 w-full flex-col justify-end ${composeBlockGap}`
                : `flex w-full flex-col justify-end px-3 pt-3 pb-0 ${composeBlockGap}`
              : isDock
                ? `mt-auto flex w-full flex-col justify-end ${composeBlockGap}`
                : dockTall
                  ? `mt-auto flex min-h-0 flex-1 flex-col justify-end ${composeBlockGap}`
                  : "mt-auto space-y-3"
          }`}
        >

        {promptExpanded && (!isDockV2 || showResultChrome) && !dockPromptExpanded ? (
          <button
            type="button"
            aria-label="Свернуть промпт"
            className={`${OVERLAY_BUTTON_UA_RESET} ${sheetPos} inset-0 z-40 bg-black/45 backdrop-blur-[2px]`}
            onClick={() => setPromptExpanded(false)}
          />
        ) : null}

        {isDockV2 && !showResultChrome ? (
          hideCollapsedPromptStrip ? null : (
            <section className="shrink-0 rounded-none border-0 bg-transparent p-0 text-white shadow-none">
              <button
                type="button"
                aria-expanded="false"
                aria-label={PROMPT_FIELD_LABEL}
                onClick={openPromptEditor}
                className={`${OVERLAY_BUTTON_UA_RESET} flex w-full items-start gap-3 rounded-2xl bg-white/10 px-3 py-2.5 text-left ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">
                    {PROMPT_FIELD_LABEL}
                  </span>
                  <span className="mt-0.5 block h-[2.75em] overflow-hidden text-[13px] leading-snug">
                    <span className="line-clamp-2 font-medium text-white/75">
                      {activePrompt.trim() ||
                        (videoCompose && scenarioLoading
                          ? ANIMATE_SCENARIO_PLACEHOLDER
                          : BLANK_PROMPT_PLACEHOLDER)}
                    </span>
                  </span>
                </span>
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-white/80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
            </section>
          )
        ) : promptExpanded ? (
          <ComposeSheetShell
            title={
              useBlankPromptEditor
                ? "Промпт"
                : resultUrl
                  ? "Изменить картинку"
                  : "Промпт"
            }
            titleId="inline-prompt-editor-title"
            collapseAriaLabel="Свернуть промпт"
            closeAriaLabel="Закрыть"
            isDock={dockPromptExpanded}
            isMobile={isMobile}
            opaqueBackdrop={generateDockV2Enabled && showResultChrome}
            onClose={() => setPromptExpanded(false)}
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
            footer={
              useBlankPromptEditor ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy || draftPrompt.trim().length < 8}
                    onClick={() => {
                      void copyTextUniversal(draftPrompt).then((ok) => {
                        setToast(ok ? "Промт скопирован" : "Не удалось скопировать");
                      });
                    }}
                    className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      dockPromptExpanded
                        ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
                        : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                    }`}
                  >
                    <svg
                      className="h-5 w-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden
                    >
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5h10" strokeLinecap="round" />
                    </svg>
                    <span className="truncate">Скопировать промт</span>
                  </button>
                  {showBlankPromptRemix && blankChangeOpen ? (
                    <button
                      type="button"
                      disabled={busy || remixing || !changeRequest.trim()}
                      onClick={() => void applyPromptRemix({ keepEditorOpen: true })}
                      className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-3 text-[13px] font-semibold text-white shadow-lg shadow-indigo-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className="truncate">
                        {remixing ? PROMPT_REMIX_COPY.submitting : PROMPT_REMIX_COPY.submit}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || remixing || draftPrompt.trim().length < 8}
                      onClick={() => setPromptExpanded(false)}
                      className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-indigo-600 px-3 py-3 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      Готово
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={
                    controlsBusy ||
                    draftPrompt.trim().length < 8 ||
                    !changeRequest.trim() ||
                    remixing
                  }
                  onClick={() => void applyPromptRemix()}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-indigo-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {remixing ? COMPOSE_SAVING_PROMPT_CTA : COMPOSE_SAVE_PROMPT_CTA}
                </button>
              )
            }
          >
            {useBlankPromptEditor ? (
              <>
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
                    disabled={busy || remixing}
                    autoFocus={autofocusPromptEditor}
                    className={`min-h-0 w-full flex-1 resize-none overflow-y-auto p-3 text-[13px] font-medium leading-relaxed ${
                      dockPromptExpanded
                        ? dockSheetField
                        : "rounded-xl border border-zinc-200 bg-white text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                    }`}
                  />
                </label>
                {showBlankPromptRemix ? (
                  blankChangeOpen ? (
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
                        rows={2}
                        disabled={busy || remixing}
                        autoFocus
                        className={`w-full resize-none p-3 text-[13px] font-medium leading-relaxed ${
                          dockPromptExpanded
                            ? dockSheetField
                            : "rounded-xl border border-zinc-200 bg-white text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                        }`}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || remixing}
                      onClick={() => {
                        setError("");
                        setBlankChangeOpen(true);
                      }}
                      className={`${OVERLAY_BUTTON_UA_RESET} mt-2 flex min-h-11 w-full shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        dockPromptExpanded
                          ? "text-white/85 ring-1 ring-inset ring-white/20 hover:bg-white/10"
                          : "text-indigo-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m13.5 7.5 3 3" strokeLinecap="round" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">{PROMPT_REMIX_COPY.changeLabel}</span>
                      <span className={`shrink-0 text-[12px] font-medium ${dockPromptExpanded ? "text-white/60" : "text-zinc-500"}`}>
                        {PROMPT_REMIX_COPY.changeHint}
                      </span>
                    </button>
                  )
                ) : null}
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
              </>
            ) : (
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
            )}
          </ComposeSheetShell>
        ) : (
          <section
            aria-hidden={hideCollapsedPromptStrip ? true : undefined}
            inert={hideCollapsedPromptStrip ? true : undefined}
            className={`shadow-none ${
              showResultChrome || hideCollapsedPromptStrip
                ? "hidden"
                : `rounded-2xl border px-3 py-1 backdrop-blur-md ${
                    glassChrome
                      ? "border-white/15 bg-black/15 text-white"
                      : "border-zinc-200 bg-white/95 text-zinc-900"
                  }`
            }`}
          >
            <button
              type="button"
              aria-expanded="false"
              aria-label={PROMPT_FIELD_LABEL}
              onClick={openPromptEditor}
              className={`${OVERLAY_BUTTON_UA_RESET} flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                glassChrome
                  ? "bg-white/10 ring-1 ring-inset ring-white/20 hover:bg-white/15"
                  : "border border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">
                  {PROMPT_FIELD_LABEL}
                </span>
                <span
                  className={`mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug ${
                    glassChrome
                      ? "text-white/70"
                      : activePrompt.trim()
                        ? "text-zinc-700"
                        : "text-zinc-400"
                  }`}
                >
                  {activePrompt.trim() ||
                    (videoCompose && scenarioLoading
                      ? ANIMATE_SCENARIO_PLACEHOLDER
                      : BLANK_PROMPT_PLACEHOLDER)}
                </span>
              </span>
              <svg
                className="mt-0.5 h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
          </section>
        )}

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

        {!isDockV2 && expandedControl === "photos" && !showResultChrome ? (
          <ComposeSheetShell
            id="inline-generation-photos"
            title={`Ваши фото · ${selectedPhotos.length}/${photoSelectionCap}`}
            ariaLabel="Выбор фотографий"
            collapseAriaLabel="Свернуть выбор фотографий"
            closeAriaLabel="Закрыть выбор фотографий"
            isDock={dockPhotosExpanded}
            isMobile={isMobile}
            onClose={closePrefsSheet}
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
            footer={
              <button
                type="button"
                onClick={closePrefsSheet}
                className={`${OVERLAY_BUTTON_UA_RESET} ${composeSheetCta}`}
              >
                Готово
              </button>
            }
          >
            <section
              aria-labelledby={
                photoPromptCompose
                  ? "generation-photo-prompt-guide-title"
                  : stickerCompose
                    ? "generation-sticker-picker-guide-title"
                    : "generation-photo-guide-title"
              }
              className={
                isMobile || dockPhotosExpanded
                  ? "flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain py-3"
                  : "mb-3 min-h-0 flex-1 overflow-y-auto overscroll-contain"
              }
            >
              {photoPromptCompose ? (
                <ComposeToolGuide
                  mode="photo_prompt"
                  glassChrome={dockPhotosExpanded}
                  className={
                    isMobile || dockPhotosExpanded ? "" : "items-start"
                  }
                />
              ) : stickerCompose ? (
                <StickerPickerGuide
                  glassChrome={dockPhotosExpanded}
                  centered={isMobile || dockPhotosExpanded}
                  exampleUrl={selectedStickerExampleUrl}
                />
              ) : (
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
                        src={PHOTO_GUIDE_PORTRAIT_SRC}
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
              )}
            </section>
            <div className={`mt-auto flex shrink-0 flex-col ${composeBlockGap}`}>
              {showPreserveOutfitChip ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-pressed={preserveOutfit}
                    disabled={controlsBusy}
                    onClick={() => setPreserveOutfit((current) => !current)}
                    className={`${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition disabled:opacity-50 ${
                      preserveOutfit
                        ? dockPhotosExpanded
                          ? "bg-indigo-500/30 text-white ring-1 ring-indigo-300"
                          : "bg-zinc-900 text-white"
                        : dockPhotosExpanded
                          ? "bg-white/10 text-white/85 ring-1 ring-white/20 hover:bg-white/15"
                          : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                    }`}
                  >
                    <span>Оставить одежду</span>
                    {preserveOutfit ? (
                      <span aria-hidden className="text-[12px] leading-none">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={controlsBusy}
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
                      className={`group relative isolate h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl ${composeTileFrame} ${
                        selected
                          ? "after:border-indigo-300"
                          : dockPhotosExpanded
                            ? "after:border-white/25"
                            : "after:border-zinc-300"
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
                            className="absolute inset-0 size-full object-cover object-center"
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
              {!isMobile && !photos.length ? (
                <p
                  className={`shrink-0 text-[13px] font-medium ${
                    dockPhotosExpanded ? "text-white/65" : "text-zinc-600"
                  }`}
                >
                  {photoPromptCompose
                    ? PHOTO_PROMPT_NEEDS_PHOTO
                    : isAuthed
                      ? "Фото необязательно. Если добавите — сохранится для следующих генераций и внешности."
                      : "Фото необязательно. Можно выбрать сейчас — генерация после входа."}
                </p>
              ) : null}
            </div>
          </ComposeSheetShell>
        ) : null}

        {!isDockV2 && expandedControl === "example" && showSeoExampleTool ? (
          <ComposeSheetShell
            id="inline-generation-examples"
            title={
              stickerCompose
                ? STICKER_STYLE_PICKER_TITLE
                : SEO_COMPOSE_EXAMPLE_SHEET_TITLE
            }
            titleId="generation-example-picker-title"
            collapseAriaLabel={SEO_COMPOSE_EXAMPLE_SHEET_COLLAPSE_LABEL}
            closeAriaLabel={SEO_COMPOSE_EXAMPLE_SHEET_CLOSE_LABEL}
            isDock={dockExampleExpanded}
            isMobile={isMobile}
            onClose={closePrefsSheet}
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
            footer={
              stickerCompose && stickerKind === "pack" ? (
                <button
                  type="button"
                  onClick={closePrefsSheet}
                  className={`${OVERLAY_BUTTON_UA_RESET} ${composeSheetCta}`}
                >
                  {STICKER_STYLE_PICKER_CONFIRM_CTA}
                </button>
              ) : undefined
            }
          >
            {stickerCompose && stickerKind === "pack" ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <p
                  className={`px-1 pb-2 text-[13px] font-semibold ${
                    dockExampleExpanded ? "text-white" : "text-zinc-900"
                  }`}
                >
                  {STICKER_PACK_SET_PICKER_TITLE}
                </p>
                <StickerPackSetPicker
                  packs={stickerPacks}
                  selectedId={stickerPackSetId}
                  tone={dockExampleExpanded ? "dark" : "light"}
                  onSelect={(pack) => {
                    setStickerPackSetId(pack.id);
                    setError("");
                  }}
                />
                <p
                  className={`px-1 pb-2 pt-4 text-[13px] font-semibold ${
                    dockExampleExpanded ? "text-white" : "text-zinc-900"
                  }`}
                >
                  {STICKER_STYLE_PICKER_TITLE}
                </p>
                <StickerStylePicker
                  embedded
                  styles={stickerStyles}
                  loading={stickerCatalogLoading}
                  selectedId={stickerStyleId}
                  tone={dockExampleExpanded ? "dark" : "light"}
                  confirmCtaClassName={composeSheetCta}
                  onSelect={(style) => {
                    stickerStyleTouchedRef.current = true;
                    setStickerStyleId(style.id);
                    setError("");
                  }}
                />
              </div>
            ) : stickerCompose ? (
              <StickerStylePicker
                styles={stickerStyles}
                loading={stickerCatalogLoading}
                selectedId={stickerStyleId}
                tone={dockExampleExpanded ? "dark" : "light"}
                confirmCtaClassName={`${OVERLAY_BUTTON_UA_RESET} mt-3 ${composeSheetCta}`}
                onSelect={(style) => {
                  stickerStyleTouchedRef.current = true;
                  setStickerStyleId(style.id);
                  setError("");
                }}
                onConfirmed={closePrefsSheet}
              />
            ) : (
              <ComposeExamplePicker
                selectedCardId={resolvedCardId}
                tone={dockExampleExpanded ? "dark" : "light"}
                matchEnabled={composeExampleMatchEnabled}
                matchPhoto={
                  selectedPhotos[0]
                    ? {
                        id: selectedPhotos[0].id,
                        dataUrl: isPhotoPromptEphemeralId(selectedPhotos[0].id)
                          ? selectedPhotos[0].previewUrl
                          : null,
                        audienceTag: selectedPhotos[0].audienceTag ?? null,
                      }
                    : null
                }
                confirmCtaClassName={`${OVERLAY_BUTTON_UA_RESET} mt-3 ${composeSheetCta}`}
                onSelect={({ cardId: nextCardId, promptText, photoUrl }) => {
                  setPickedExampleCardId(nextCardId);
                  setPickedExamplePreviewUrl(photoUrl);
                  setDraftPrompt(promptText);
                  setError("");
                  applyComposeExamplePick({
                    cardId: nextCardId,
                    promptText,
                    examplePreviewUrl: photoUrl,
                  });
                }}
                onConfirmed={closePrefsSheet}
              />
            )}
          </ComposeSheetShell>
        ) : null}

        {!isDockV2 && expandedControl === "tool" && !showResultChrome ? (
          <ComposeSheetShell
            id="inline-generation-tools"
            title={COMPOSE_TOOL_SHEET_TITLE}
            titleId="generation-tool-sheet-title"
            collapseAriaLabel="Свернуть выбор инструмента"
            closeAriaLabel="Закрыть выбор инструмента"
            isDock={dockToolExpanded}
            isMobile={isMobile}
            onClose={closePrefsSheet}
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
            footer={
              <button
                type="button"
                onClick={closePrefsSheet}
                className={`${OVERLAY_BUTTON_UA_RESET} ${composeSheetCta}`}
              >
                {COMPOSE_TOOL_SHEET_DONE_CTA}
              </button>
            }
          >
            <ComposeToolGuide
              mode={composeMode}
              glassChrome={dockToolExpanded}
              photoshootExample={
                composeMode === "photoshoot"
                  ? composePhotoshootGuideExample(photoshootComposeExampleEnabled)
                  : null
              }
              stickerExampleUrl={composeMode === "sticker" ? selectedStickerExampleUrl : null}
              stickerKind={stickerKind}
              onStickerKindChange={setStickerKind}
              photoExampleUrl={pickedExamplePreviewUrl || PHOTO_GUIDE_PORTRAIT_SRC}
              className="min-h-0 flex-1 overflow-y-auto px-2 py-4"
            />
            {/* Tool tiles sit at the bottom, same square as the modal row; the guide above is their onboarding. */}
            <div
              role="group"
              aria-label={COMPOSE_TOOL_SHEET_TITLE}
              className="flex shrink-0 items-start gap-2 overflow-x-auto overscroll-x-contain px-0.5 pt-2.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {toolOptions.map((mode) => (
                <ComposeToolChoiceTile
                  key={mode}
                  mode={mode}
                  selected={composeMode === mode}
                  disabled={controlsBusy}
                  glassChrome={dockToolExpanded}
                  className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                    composeMode === mode,
                    dockToolExpanded,
                  )}`}
                  onClick={() => selectComposeTool(mode)}
                />
              ))}
            </div>
          </ComposeSheetShell>
        ) : null}

        {!isDockV2 && expandedControl === "model" && !showResultChrome ? (
          <ComposeSheetShell
            id="inline-generation-models"
            title={videoCompose ? "Модель видео" : "Модель фото"}
            ariaLabel="Выбор модели"
            collapseAriaLabel="Свернуть выбор модели"
            closeAriaLabel="Закрыть выбор модели"
            isDock={dockModelExpanded}
            isMobile={isMobile}
            compactDesktop
            onClose={closePrefsSheet}
            bodyClassName={`flex min-h-0 flex-1 flex-col justify-start overflow-y-auto overscroll-contain pt-0.5 ${composeBlockGap}`}
            footer={
              <button
                type="button"
                onClick={closePrefsSheet}
                disabled={
                  Boolean(
                    !videoCompose &&
                      composeNeedsImageModelPick({
                        composeMode: "image",
                        modelId: model,
                      }),
                  )
                }
                className={`${OVERLAY_BUTTON_UA_RESET} ${composeSheetCta}`}
              >
                {!videoCompose &&
                composeNeedsImageModelPick({
                  composeMode: "image",
                  modelId: model,
                })
                  ? COMPOSE_PICK_IMAGE_MODEL_CTA
                  : "Готово"}
              </button>
            }
          >
            {!videoCompose ? (
              <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-5">
                {models.map((item) => {
                  const unaffordable =
                    isAuthed && credits !== null && credits < item.cost;
                  return (
                    <ComposeModelChoiceCard
                      key={item.id}
                      modelId={item.id}
                      label={displayLabelForGenerationModel(item.id, item.label)}
                      description={displayDescriptionForGenerationModel(
                        item.id,
                        "Генерация изображений"
                      )}
                      cost={item.cost}
                      selected={model === item.id}
                      unaffordable={unaffordable}
                      disabled={controlsBusy}
                      dockChrome={dockModelExpanded}
                      onClick={() => selectImageModel(item.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-5">
                {videoModels.map((item) => {
                  const itemCost = calculateVideoCreditCost(
                    item.cost,
                    videoDurationSeconds,
                    item.id
                  );
                  const unaffordable =
                    isAuthed && credits !== null && credits < itemCost;
                  return (
                    <ComposeModelChoiceCard
                      key={item.id}
                      modelId={item.id}
                      label={displayLabelForGenerationModel(item.id, item.label)}
                      description={displayDescriptionForGenerationModel(
                        item.id,
                        "Видео из фото"
                      )}
                      cost={itemCost}
                      selected={activeVideoModel?.id === item.id}
                      unaffordable={unaffordable}
                      disabled={controlsBusy}
                      dockChrome={dockModelExpanded}
                      onClick={() => selectVideoModel(item.id)}
                    />
                  );
                })}
              </div>
            )}
            {videoCompose ? (
              <div className="grid shrink-0 grid-cols-3 gap-2">
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
                <label className="block min-w-0">
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
            ) : (
              <div className="grid shrink-0 grid-cols-2 gap-2">
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
            )}
          </ComposeSheetShell>
        ) : null}

        {generateDockV2Enabled && !isDock && expandedControl === "auth" && !showResultChrome ? (
          <ComposeAuthSheet
            isDock={dockAuthExpanded}
            isMobile={isMobile}
            reason={authSheetReason}
            onBeforeRedirect={() => {
              persistPendingGenerateDock({
                seed: applyComposeExampleToSeed(seed, {
                  cardId: resolvedCardId || "",
                  promptText: draftPrompt,
                  examplePreviewUrl: pickedExamplePreviewUrl,
                }),
                dockSurface: null,
              });
            }}
            onClose={() => setExpandedControl(null)}
          />
        ) : null}

        {!showResultChrome ? (
        <section
          className={`shrink-0 ${
            isDock
              ? "rounded-none border-0 bg-transparent p-0"
              : `rounded-2xl border p-2 ${
                  glassChrome
                    ? "border-white/15 bg-black/15 backdrop-blur-md"
                    : "border-zinc-200 bg-white/95"
                }`
          }`}
        >
          <div
            className={`-mx-0.5 flex items-start gap-2 overflow-x-auto overscroll-x-contain px-0.5 pt-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isDock ? "-mt-[3px]" : "pb-1"
            }`}
          >
            <ComposeDockToolTile
              edgeLabel={COMPOSE_PHOTOS_TOOL_EDGE_LABEL}
              bodyLabel={
                selectedPhotos.length === 0
                  ? composePhotosToolCountLabel(
                      selectedPhotos.length,
                      photoSelectionCap,
                    )
                  : null
              }
              previewUrls={composePhotosPreviewUrls(selectedPhotos)}
              countBadge={
                selectedPhotos.length > 0
                  ? composePhotosToolCountLabel(
                      selectedPhotos.length,
                      photoSelectionCap,
                    )
                  : null
              }
              statusBadge={
                showPreserveOutfitChip && preserveOutfit ? "Одежда" : null
              }
              icon={<ComposeLibraryPhotosIcon className="h-4 w-4" />}
              selected={expandedControl === "photos"}
              expanded={expandedControl === "photos"}
              disabled={controlsBusy}
              glassChrome={glassChrome}
              className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                expandedControl === "photos",
              )}`}
              controlsId="inline-generation-photos"
              ariaLabel={`${COMPOSE_PHOTOS_TOOL_EDGE_LABEL}, ${selectedPhotos.length} из ${photoSelectionCap}`}
              onClick={() => {
                setExpandedControl((current) => (current === "photos" ? null : "photos"));
              }}
            />

            <ComposeToolPickerTile
              composeMode={composeMode}
              bodyLabel={composeToolTileBodyLabel({ composeMode, stickerKind })}
              selected={expandedControl === "tool"}
              expanded={expandedControl === "tool"}
              disabled={controlsBusy}
              glassChrome={glassChrome}
              className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                expandedControl === "tool",
              )}`}
              controlsId="inline-generation-tools"
              onClick={() => {
                setError("");
                setExpandedControl((current) => (current === "tool" ? null : "tool"));
              }}
            />

            {showSeoExampleTool && secondaryTools.includes("style") ? (
              <ComposeDockToolTile
                edgeLabel={SEO_COMPOSE_EXAMPLE_TOOL_EDGE_LABEL}
                bodyLabel={
                  stickerCompose && stickerKind === "pack"
                    ? selectedStickerPack?.name ?? selectedStickerStyleLabel
                    : stickerCompose
                      ? selectedStickerStyleLabel
                      : undefined
                }
                previewUrls={
                  stickerCompose && stickerKind === "pack"
                    ? composePreviewImageUrls([selectedStickerPack?.exampleUrl])
                    : stickerCompose
                      ? composePreviewImageUrls([selectedStickerExampleUrl])
                      : composePreviewImageUrls([pickedExamplePreviewUrl])
                }
                previewPlate={stickerCompose && stickerKind !== "pack" ? "clear" : "photo"}
                icon={<ComposeExampleToolIcon className="h-4 w-4" />}
                selected={expandedControl === "example"}
                expanded={expandedControl === "example"}
                disabled={controlsBusy}
                glassChrome={glassChrome}
                className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                  expandedControl === "example",
                )}`}
                controlsId="inline-generation-examples"
                ariaLabel={SEO_COMPOSE_EXAMPLE_TOOL_LABEL}
                onPrefetch={() =>
                  preloadExampleSheetChunks(
                    stickerCompose,
                    stickerKind === "pack",
                  )
                }
                onClick={toggleSeoExampleSheet}
              />
            ) : null}

            {secondaryTools.includes("model") && imageCompose ? (
              <ComposeModelToolTile
                mode="image"
                modelId={model || null}
                tileLabel={selectedImageModelTileLabel}
                fullLabel={selectedImageModelLabel}
                selected={expandedControl === "model"}
                expanded={expandedControl === "model"}
                disabled={controlsBusy}
                glassChrome={glassChrome}
                className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                  expandedControl === "model",
                )}`}
                controlsId="inline-generation-models"
                onClick={() => {
                  setExpandedControl((current) => (current === "model" ? null : "model"));
                }}
              />
            ) : null}

            {secondaryTools.includes("model") && videoCompose ? (
              <ComposeModelToolTile
                mode="video"
                modelId={activeVideoModel?.id || DEFAULT_VIDEO_MODEL}
                tileLabel={selectedVideoModelTileLabel}
                fullLabel={selectedVideoModelLabel}
                selected={expandedControl === "model"}
                expanded={expandedControl === "model"}
                disabled={controlsBusy}
                glassChrome={glassChrome}
                className={`${composeToolTileSize} rounded-xl ${composeTileFrame} ${composeTileBorder(
                  expandedControl === "model",
                )}`}
                controlsId="inline-generation-models"
                onClick={() => {
                  setExpandedControl((current) => (current === "model" ? null : "model"));
                }}
              />
            ) : null}
          </div>
        </section>
        ) : null}
        </DockSummaryPocket>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={!photoPromptCompose}
          className="hidden"
          tabIndex={-1}
          aria-label={
            photoPromptCompose ? "Загрузить фото для промта" : "Загрузить фото"
          }
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void uploadFiles(files);
            event.target.value = "";
          }}
        />
        {(Boolean(error) || Boolean(configError)) && !needsCredits ? (
          <div
            className={`shrink-0 rounded-xl border p-3 ${
              isDock
                ? showResultChrome
                  ? "mt-3 border-rose-300/25 bg-rose-950/45"
                  : "mx-3 mt-3 border-rose-300/25 bg-rose-950/45"
                : glassChrome
                  ? "mt-3 border-white/15 bg-black/15 backdrop-blur-md"
                  : "mt-3 border-rose-200 bg-rose-50"
            }`}
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

      <footer
        className={`relative z-30 shrink-0 ${
          hideComposeChrome
          || (!isDockV2 && (promptExpanded || (isDock && dockExpanded)))
          || (showResultChrome && promptExpanded)
          || resultChromeHidesComposeFooter({
            showResultActions,
            showPhotoPromptResult,
          })
            ? "hidden"
            : isDockV2
            ? showResultChrome
              ? "border-0 bg-transparent px-3 pb-3"
              : `border-t px-3 pt-3 ${
                  isMobile
                    ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                    : "pb-3"
                } transition-[border-color,box-shadow,background-color] duration-200 ${
                  dockUpperDrawerOpen
                    ? "border-white/10 bg-[#0d0d13]/95 shadow-[0_-14px_28px_-14px_rgba(0,0,0,0.88)]"
                    : "border-transparent bg-[#0c0c11]/95"
                }`
            : isDock
            ? "border-0 bg-transparent px-3 pb-3"
            : `p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
                showResultChrome
                  ? "border-transparent bg-transparent"
                  : "border-t border-zinc-200 bg-white/90 backdrop-blur-md"
              }`
        }`}
      >
        <DockAutoHeightBox enabled={isDockV2 && !showResultChrome}>
          {isDockV2 && !showResultChrome && expandedControl === "auth" ? (
            <ComposeAuthSheet
              isDock
              isMobile={isMobile}
              inFlowDock
              reason={authSheetReason}
              onBeforeRedirect={() => {
                persistPendingGenerateDock({
                  seed: applyComposeExampleToSeed(seed, {
                    cardId: resolvedCardId || "",
                    promptText: draftPrompt,
                    examplePreviewUrl: pickedExamplePreviewUrl,
                  }),
                  dockSurface: null,
                });
              }}
              onClose={() => setExpandedControl(null)}
            />
          ) : (
            <div className="flex min-w-0 gap-2">
          <button
            type="button"
            aria-busy={busy}
            aria-valuemin={jobBusy ? 0 : undefined}
            aria-valuemax={jobBusy ? 100 : undefined}
            aria-valuenow={jobBusy ? Math.round(progress) : undefined}
            disabled={
              dockStepCta !== null
                ? false
                : showCreditsCta
                ? false
                : busy ||
                  stickerPackSoon ||
                  (photoPromptCompose
                    ? Boolean(busyAction)
                    : isAuthed &&
                      (controlsBusy ||
                        ((photoshootCompose || stickerCompose) &&
                          !sourcePhotoPicked &&
                          libraryLoading) ||
                        (!photoshootCompose && !stickerCompose && scenarioLoading) ||
                        Boolean(busyAction) ||
                        Boolean(configError) ||
                        (!photoshootCompose &&
                          !stickerCompose &&
                          draftPrompt.trim().length < 8 &&
                          !seoNeedsExamplePick &&
                          !seoNeedsImageModelPick)))
            }
            onClick={() => {
              if (dockStepCta !== null && advanceDockWizardStep()) {
                return;
              }
              if (showCreditsCta) {
                hostAdapter.trackGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
                openPricing();
                return;
              }
              if (stickerPackSoon) return;
              if (photoPromptCompose) {
                if (busy) return;
                startPhotoPromptFromSelected();
                return;
              }
              if (seoNeedsExamplePick) {
                openSeoExampleSheet();
                return;
              }
              if (seoNeedsImageModelPick) {
                openImageModelSheet();
                return;
              }
              if (!isAuthed) {
                persistPendingGenerateDock({
                  seed: applyComposeExampleToSeed(seed, {
                    cardId: resolvedCardId || "",
                    promptText: draftPrompt,
                    examplePreviewUrl: pickedExamplePreviewUrl,
                  }),
                  dockSurface: null,
                });
                openInlineAuthSheet("default");
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
              if (stickerCompose) {
                if (sourcePhotoPicked) {
                  // Just-signed-in user: the upload is still in-browser; runGenerate persists it first.
                  void runGenerate({
                    editKind:
                      stickerKind === "pack" ? STICKER_PACK_EDIT_KIND : STICKER_EDIT_KIND,
                    photoStoragePath: photoshootLibraryFrame?.storagePath,
                  });
                  return;
                }
                setError(STICKER_NEEDS_LIBRARY_PHOTO);
                setExpandedControl("photos");
                return;
              }
              if (videoCompose) {
                if (listingVideoRepeatCompose) {
                  void runGenerate({
                    promptOverride: listingCatalogSplit.imagePrompt,
                    modality: "image",
                    listingVideoRepeat: {
                      videoPrompt:
                        draftPrompt.trim() ||
                        listingCatalogSplit.motionPrompt ||
                        DEFAULT_VIDEO_PROMPT,
                    },
                  });
                  return;
                }
                void runGenerate({
                  promptOverride: draftPrompt.trim() || DEFAULT_VIDEO_PROMPT,
                  modality: "video",
                  parentGenerationId: animateParentId || undefined,
                });
                return;
              }
              if (pendingRemixEdit) {
                const pending = pendingRemixEdit;
                setPendingRemixEdit(null);
                void runGenerate({
                  promptOverride: draftPrompt,
                  parentGenerationId: pending.parentGenerationId,
                  editInstruction: pending.editInstruction,
                });
                return;
              }
              if (phase === "done" && resultUrl && generationId) {
                openPromptEditor();
                return;
              }
              void runGenerate({ promptOverride: draftPrompt });
            }}
            className={`${OVERLAY_BUTTON_UA_RESET} relative isolate flex h-12 min-w-0 w-full items-center justify-center overflow-hidden rounded-2xl px-4 text-[15px] font-semibold leading-none text-white shadow-lg shadow-indigo-950/35 transition active:scale-[0.99] disabled:cursor-not-allowed ${
              busy && !showCreditsCta
                ? "opacity-100 disabled:opacity-100"
                : "bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 disabled:opacity-50"
            }`}
            style={
              jobBusy && !showCreditsCta
                ? { backgroundColor: "rgba(39,39,42,0.95)" }
                : undefined
            }
          >
            {jobBusy && !showCreditsCta ? (
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
            <span className="relative z-10 inline-flex max-w-full min-w-0 items-center justify-center gap-2 leading-none drop-shadow-sm">
              {!showCreditsCta && phase === "done" && resultUrl && !busy ? (
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
              <span className="inline-flex max-w-full min-w-0 items-center justify-center gap-2.5">
                {dockStepCta !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    {dockStepCta.kind === "done" ? (
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        aria-hidden
                      >
                        <path
                          d="m5 12.5 4.5 4.5L19 7.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                    <span>{dockStepCta.label}</span>
                    {dockStepCta.kind === "next" ? (
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        aria-hidden
                      >
                        <path
                          d="M5 12h14m-5-5 5 5-5 5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                ) : showCreditsCta ? (
                  <span className="truncate">{COMPOSE_BUY_CREDITS_CTA}</span>
                ) : stickerPackSoon ? (
                  <span className="truncate">{STICKER_PACK_SOON_CTA}</span>
                ) : starting ? (
                  <span className="truncate">Запускаем…</span>
                ) : phase === "uploading" ? (
                  <span className="truncate tabular-nums">
                    {`Загружаем фото · ${Math.round(progress)}%`}
                  </span>
                ) : phase === "generating" ? (
                  <span className="truncate tabular-nums">
                    {photoPromptCompose
                      ? composePhotoPromptBusyLabel(progress)
                      : `Генерируем · ${Math.round(progress)}%`}
                  </span>
                ) : photoshootCompose && !sourcePhotoPicked ? (
                  <span className="truncate">
                    {composeNeedsPhotoCtaLabel("photoshoot", { isAuthed })}
                  </span>
                ) : photoPromptCompose && !photoPromptHasSource ? (
                  <>
                    <span className="shrink-0">
                      {composeNeedsPhotoCtaLabel("photo_prompt", { isAuthed })}
                    </span>
                    {composeCtaGuestQuotaPill}
                  </>
                ) : videoCompose && scenarioLoading ? (
                  <span className="truncate">{ANIMATE_SCENARIO_PLACEHOLDER}</span>
                ) : phase === "done" &&
                  resultUrl &&
                  !photoshootCompose &&
                  !stickerCompose &&
                  !videoCompose &&
                  !photoPromptCompose ? (
                  <span className="truncate">Что изменить</span>
                ) : (
                  <>
                    <span className="shrink-0">
                      {stickerCompose && !sourcePhotoPicked
                        ? composeNeedsPhotoCtaLabel("sticker", { isAuthed })
                        : stickerCompose && stickerKind === "pack"
                          ? STICKER_PACK_CREATE_CTA
                          : seoNeedsExamplePick
                            ? SEO_COMPOSE_PICK_EXAMPLE_CTA
                            : seoNeedsImageModelPick
                              ? COMPOSE_PICK_IMAGE_MODEL_CTA
                              : composeGenerateCtaLabel(composeMode, {
                                  isAuthed,
                                  listingVideoRepeat: listingVideoRepeatCompose,
                                })}
                    </span>
                    {composeCtaModelLabel ||
                    composeCtaCost != null ||
                    composeCtaGuestQuotaPill ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {composeCtaModelLabel ? (
                          <span className="min-w-0 truncate text-[13px] font-medium leading-none text-white/80">
                            {composeCtaModelLabel}
                          </span>
                        ) : null}
                        {composeCtaCost != null ? (
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[12px] font-semibold leading-none tabular-nums ${
                              cannotAffordSelected
                                ? "bg-rose-400/95"
                                : "bg-white/20"
                            }`}
                          >
                            {composeCtaCost}✦
                          </span>
                        ) : null}
                        {composeCtaGuestQuotaPill}
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            </span>
          </button>
        </div>
          )}
        </DockAutoHeightBox>
      </footer>

      {toast ? (
        <div
          role="status"
          className={`pointer-events-none absolute left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-zinc-900/95 px-4 py-2 text-center text-[13px] font-medium text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md ${
            showResultChrome ? "top-16" : "bottom-20"
          }`}
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
              className={`fixed inset-0 z-[130] flex items-center justify-center p-4 ${
                stickerResult ? "bg-zinc-950/55 backdrop-blur-xl" : "bg-black/80"
              }`}
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
