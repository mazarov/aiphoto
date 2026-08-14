"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  CREDIT_BALANCE_REFRESH_EVENT,
  requestCreditBalanceRefresh,
} from "@/lib/credit-balance-events";
import {
  GENERATION_MODEL_DISPLAY,
  displayLabelForGenerationModel,
} from "@/lib/generation-model-labels";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
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
  shouldAttachLibraryPhotos,
  shouldHydrateLastDockResult as seedAllowsLastDockHydrate,
} from "@/lib/generate-dock-seed";
import { useAuth } from "@/context/AuthContext";
import {
  useGenerateDock,
  type GenerateDockSurface,
} from "@/context/GenerateDockContext";
import { GenerationResultBackdrop } from "@/components/generate/GenerationResultBackdrop";
import { PricingEntryLink } from "@/components/PricingEntryLink";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED,
  YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  IMAGE_GENERATION_MODALITY,
} from "@/lib/generation/image-options";
import { restoreSelectedPhotoIds } from "@/lib/generation-enqueue-core";

const BLANK_PROMPT_PLACEHOLDER = "Опишите изображение или референс";

type ModelOpt = { id: string; label: string; cost: number };
type RatioOpt = { value: string; label: string };
type SizeOpt = { value: string; label: string };
type GenerationPreferences = {
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  selectedPhotoIds?: string[];
};
type UserPhoto = {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

type Phase = "idle" | "uploading" | "generating" | "done" | "error";

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

function GoogleGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

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
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const libraryPhotoIdsRef = useRef<string[]>([]);
  const seedIntentRef = useRef(seed.intent);
  seedIntentRef.current = seed.intent;
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const generateInFlightRef = useRef(false);
  const [starting, setStarting] = useState(false);
  /**
   * After «Повторить» / delete — do not re-apply last completed result from the
   * mount hydrate fetch (async race with stale resultUrl/generationId closures).
   */
  const suppressResultHydrateRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultPreviewOpen, setResultPreviewOpen] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  resultUrlRef.current = resultUrl;
  generationIdRef.current = generationId;
  const [draftPrompt, setDraftPrompt] = useState(promptText);
  const draftPromptRef = useRef(draftPrompt);
  draftPromptRef.current = draftPrompt;
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [isPublished, setIsPublished] = useState(false);
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
          isDock && isBlank && isAuthed && seedAllowsLastDockHydrate(seed)
        );
        const [configRes, photosRes, preferencesRes, meRes, generationsRes] =
          await Promise.all([
            fetch(`/api/generation-config?modality=${IMAGE_GENERATION_MODALITY}`),
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
        };
        const photosData = (await photosRes.json().catch(() => ({}))) as {
          photos?: UserPhoto[];
          error?: string;
        };
        const preferencesData = preferencesRes.ok
          ? ((await preferencesRes.json().catch(() => ({}))) as {
              preferences?: GenerationPreferences | null;
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
                }>;
              })
            : {};
        // Unauth / blank: photo library is best-effort — do not block composer.
        if (!photosRes.ok && !isBlank) {
          throw new Error(photosData.error || "Не удалось загрузить ваши фото");
        }
        if (cancelled) return;
        const nextModels = Array.isArray(configData.models) ? configData.models : [];
        const nextRatios = Array.isArray(configData.aspectRatios)
          ? configData.aspectRatios
          : [];
        const nextSizes = Array.isArray(configData.imageSizes) ? configData.imageSizes : [];
        const nextPhotos =
          photosRes.ok && Array.isArray(photosData.photos) ? photosData.photos : [];
        const preferences = preferencesData.preferences ?? null;
        const preferredModel = preferences?.model;
        const preferredRatio = preferences?.aspectRatio;
        const preferredSize = preferences?.imageSize;
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
        if (preferredModel && nextModels.some((item) => item.id === preferredModel)) {
          setModel(preferredModel);
        } else if (defaultModel) {
          setModel(defaultModel);
        }
        if (preferredRatio && nextRatios.some((item) => item.value === preferredRatio)) {
          setAspectRatio(preferredRatio);
        } else if (defaultRatio) {
          setAspectRatio(defaultRatio);
        }
        if (preferredSize && nextSizes.some((item) => item.value === preferredSize)) {
          setImageSize(preferredSize);
        } else if (defaultSize) {
          setImageSize(defaultSize);
        }
        const availablePhotoIds = nextPhotos.map((photo) => photo.id);
        const restoredPhotoIds = restoreSelectedPhotoIds({
          availablePhotoIds,
          storedPhotoIds: preferences?.selectedPhotoIds,
        });
        libraryPhotoIdsRef.current = restoredPhotoIds;
        setSelectedPhotoIds(
          shouldAttachLibraryPhotos(seed)
            ? new Set(restoredPhotoIds)
            : new Set()
        );
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
          setDraftPrompt(prompt);
          setSubmittedPrompt(prompt);
          setIsPublished(Boolean(lastCompleted.isPublished));
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
    preferencesHydrated,
    userId: isAuthed ? (user?.id ?? null) : null,
  });
  prefsSnapshotRef.current = {
    model,
    aspectRatio,
    imageSize,
    selectedPhotoIds,
    preferencesHydrated,
    userId: isAuthed ? (user?.id ?? null) : null,
  };

  const persistGenerationPreferences = useCallback(
    (snapshot?: typeof prefsSnapshotRef.current) => {
      const s = snapshot ?? prefsSnapshotRef.current;
      if (!s.preferencesHydrated || !s.userId) return;
      const attachLibraryPhotos = shouldAttachLibraryPhotos({
        source: "blank",
        promptText: "",
        cardId: null,
        intent: seedIntentRef.current,
      });
      const selectedPhotoIds =
        attachLibraryPhotos || s.selectedPhotoIds.size > 0
          ? Array.from(s.selectedPhotoIds)
          : libraryPhotoIdsRef.current;
      void fetch("/api/generation-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model: s.model,
          aspectRatio: s.aspectRatio,
          imageSize: s.imageSize,
          selectedPhotoIds,
        }),
      }).then((res) => {
        if (!res.ok) console.warn("[generation-preferences] save failed", res.status);
      });
    },
    []
  );

  /** Debounced backup while editing; sheet close / unmount also flush immediately. */
  useEffect(() => {
    if (!preferencesHydrated) return;
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
  const selectedModelCost =
    models.find((item) => item.id === model)?.cost ?? null;
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
    if (!isDock) return;
    reportNeedsCredits(cannotAffordAny || needsCredits);
  }, [isDock, cannotAffordAny, needsCredits, reportNeedsCredits]);

  useEffect(() => {
    if (!isDock) return;
    return () => reportNeedsCredits(false);
  }, [isDock, reportNeedsCredits]);

  const togglePhoto = (id: string) => {
    if (phase === "uploading" || phase === "generating") return;
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
    setResultUrl(null);
    setPhase("uploading");
    setProgress(8);

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
        setProgress(8 + Math.round(((index + 1) / files.length) * 72));
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
      setPhase("idle");
      setProgress(0);
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
      setPhase("error");
      setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
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
    forceTextOnly?: boolean;
  }): Promise<boolean> => {
    const parentGenerationId = options?.parentGenerationId?.trim() || "";
    const editInstruction = options?.editInstruction?.trim() || "";
    const isContinuation = Boolean(parentGenerationId);
    if (isContinuation && !editInstruction) {
      setError("Опишите, что изменить");
      return false;
    }
    const prompt = (options?.promptOverride ?? draftPrompt).trim();
    if (prompt.length < 8) {
      setError("Промпт слишком короткий");
      return false;
    }
    if (generateInFlightRef.current) return false;
    generateInFlightRef.current = true;
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
        },
        credentials: "include",
        body: JSON.stringify({
          generationSurface: resolvedGenerationSurface,
          modality: IMAGE_GENERATION_MODALITY,
          prompt,
          model,
          aspectRatio,
          imageSize,
          cardId: resolvedCardId,
          photoStoragePaths: isContinuation || options?.forceTextOnly
            ? []
            : selectedPhotos.map((photo) => photo.storagePath),
          parentGenerationId: parentGenerationId || null,
          editInstruction: editInstruction || null,
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
          reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS);
          return false;
        }
        throw new Error(genData.message || genData.error || "Не удалось создать генерацию");
      }
      setPhase("generating");
      phaseRef.current = "generating";
      setProgress(8);
      setStarting(false);
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED);
      if (!isContinuation) setGenerationId(genData.id);
      setDraftPrompt(prompt);
      setSubmittedPrompt(prompt);
      setIsPublished(false);
      requestCreditBalanceRefresh();

      while (true) {
        await new Promise((r) => setTimeout(r, POLL_MS));
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
          errorMessage?: string;
          error?: string;
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
        if (poll.status === "completed" && poll.resultUrl) {
          requestCreditBalanceRefresh();
          setGenerationId(genData.id);
          setResultUrl(poll.resultUrl);
          setProgress(100);
          setPhase("done");
          onGenerationComplete?.();
          return true;
        }
        if (poll.status === "failed") {
          requestCreditBalanceRefresh();
          throw new Error(poll.errorMessage || "Генерация не удалась");
        }
      }
    } catch (err) {
      setPhase(resultUrl || isContinuation ? "done" : "error");
      phaseRef.current = resultUrl || isContinuation ? "done" : "error";
      setError(err instanceof Error ? err.message : "Ошибка генерации");
      return false;
    } finally {
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
            : remixData.message || PROMPT_REMIX_COPY.errorGeneric
        );
      }
      const nextPrompt = remixData.prompt?.trim() || "";
      if (nextPrompt.length < 8) {
        throw new Error(PROMPT_REMIX_COPY.errorGeneric);
      }
      setDraftPrompt(nextPrompt);
      setChangeRequest("");
      if (parentGenerationId) {
        await runGenerate({
          promptOverride: nextPrompt,
          parentGenerationId,
          editInstruction: requestedChange,
        });
      }
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
        await downloadGenerationResult(resultUrl, `promptshot-${generationId}.jpg`);
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
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось опубликовать");
        setIsPublished(true);
        setMenuOpen(false);
        setToast("Карточка опубликована");
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

  const jobBusy = phase === "uploading" || phase === "generating";
  const busy = jobBusy || starting;
  const controlsBusy = busy || Boolean(deletingPhotoId);
  const showCreditsCta =
    (cannotAffordAny || cannotAffordSelected || needsCredits) && !busy;
  const isMobile = layout === "mobile";
  const activePrompt = draftPrompt;
  const openPromptEditor = () => {
    setError("");
    setDockSurface("prompt");
  };
  /** Leave result chrome → idle compose (keep prompt / model / photos for editing). */
  const resetToCompose = () => {
    suppressResultHydrateRef.current = true;
    setResultUrl(null);
    setGenerationId(null);
    setSubmittedPrompt("");
    setChangeRequest("");
    setProgress(0);
    setError("");
    setNeedsCredits(false);
    setMenuOpen(false);
    setResultPreviewOpen(false);
    setIsPublished(false);
    setExpandedControl(null);
    setPromptExpanded(false);
    setPhase("idle");
    phaseRef.current = "idle";
    onDockResultChromeChange?.(false);
  };
  /** Success X: dismiss result photo, wipe prompt, then close the plate/shell. */
  const clearResultAndPrompt = () => {
    resetToCompose();
    setDraftPrompt("");
    onBack();
  };
  /**
   * Blank compose: single prompt field until a completed result exists.
   * Card seed and «Что изменить» after generation use remix (changeRequest + parent).
   */
  const useBlankPromptEditor = isBlank && !(resultUrl && generationId);
  /** Prefill (photo→prompt) must not steal focus on mobile — keyboard shrinks the sheet. */
  const autofocusPromptEditor = !isMobile || draftPrompt.trim().length < 8;
  /**
   * Result photo as plate background after completion; keep it during a follow-up
   * generate so the modal stays tall and the CTA progress stays readable.
   */
  const showResultChrome =
    Boolean(resultUrl) &&
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
  /** Fullscreen card sheets cover the panel; dock uses in-sheet expand instead. */
  const sheetPos = "absolute";
  /** Dock: stretch floating sheet for any editor surface (no viewport overlay). */
  const dockExpanded = isDock && activeDockSurface !== null;
  /** Tall plate when editor / result / in-flight generate needs height. */
  const dockTall = dockExpanded || (isDock && (showResultChrome || busy));
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
  /** Dock actions: solid fills only — never backdrop-blur (GPU dim→blur double paint). */
  const dockActionBtn = `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-[13px] font-semibold text-white transition hover:bg-white/15 active:scale-[0.99]`;

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
    if (phase === "uploading" || phase === "generating") {
      if (!isMobile) setDockPlateOpen(false);
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
  }, [isDock, isMobile, phase, resultUrl, setDockPlateOpen]);

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
          className={isDock && isMobile ? "" : "rounded-[1.75rem]"}
        />
      ) : !isDock ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.16),transparent_38%),#09090b]"
          aria-hidden
        />
      ) : null}

      {isDock && showResultChrome && phase === "done" && !dockExpanded ? (
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
                canPublish
                isPublished={isPublished}
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

      {!isDock ? (
      <header
        className={`relative z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-md ${
          isMobile ? "pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]" : "py-2"
        } ${
          showResultChrome ? "border-white/10 bg-black/15" : "border-zinc-200 bg-white/90"
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
            showResultChrome ? "text-white/85" : "text-zinc-700"
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
              canPublish
              isPublished={isPublished}
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
          isDock
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
            isDock && dockExpanded && !dockPromptExpanded ? true : undefined
          }
          className={`shadow-none ${
            dockPromptExpanded
              ? dockPromptSheetPanel
              : promptExpanded
              ? `${sheetPos} inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-0 flex-col rounded-t-3xl border border-transparent bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
              : isDock
                ? `rounded-none border-0 bg-transparent px-1 py-0.5 text-white${
                    // Transparent sheets: hide collapsed prompt under photos/model.
                    dockExpanded ? " invisible pointer-events-none" : ""
                  }`
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
                    placeholder={BLANK_PROMPT_PLACEHOLDER}
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
                {remixing
                  ? resultUrl && generationId
                    ? "Применяем и генерируем…"
                    : "Переписываем промпт…"
                  : resultUrl && generationId
                    ? "Применить и сгенерировать"
                    : "Применить изменение"}
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
                {activePrompt.trim() || (isBlank ? BLANK_PROMPT_PLACEHOLDER : "")}
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
            onClick={closePrefsSheet}
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
                ? isMobile
                  ? `${dockSheetPanelBase} overflow-hidden`
                  : `${dockSheetPanel} overflow-y-auto`
                : `${sheetPos} inset-x-0 bottom-0 z-50 max-h-[min(76dvh,38rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
            }
          >
            <div
              className={
                dockPhotosExpanded && isMobile
                  ? "mt-auto flex max-h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain"
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
            <div
              className={
                dockPhotosExpanded && isMobile
                  ? "flex flex-wrap gap-2 pb-1"
                  : "flex gap-2 overflow-x-auto pb-1"
              }
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
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
                    className={`group relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-2 transition ${
                      selected ? "ring-indigo-300" : "ring-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={selected ? "Не использовать фото" : "Использовать фото"}
                      aria-pressed={selected}
                      disabled={controlsBusy || deleting}
                      onClick={() => togglePhoto(photo.id)}
                      className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 h-full w-full disabled:opacity-50`}
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
            {!libraryLoading && !photos.length ? (
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
                : `${sheetPos} inset-x-0 bottom-0 z-50 max-h-[min(82dvh,44rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]`
            }
          >
            <div
              className={
                dockModelExpanded && isMobile
                  ? "mt-auto flex max-h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain"
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
                Модель генерации
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
                    onClick={() => setModel(item.id)}
                    className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-20 min-w-0 items-center gap-3 overflow-hidden rounded-xl p-3 text-left ring-2 transition ${
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
                      <GoogleGenerationModelIcon />
                    </span>
                    <span className="min-w-0 flex-1 pr-5">
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
                          className={`mt-1 block line-clamp-2 text-xs font-medium leading-tight ${
                            dockModelExpanded ? "text-white/60" : "text-zinc-500"
                          }`}
                        >
                          {display?.description || "Генерация изображений"}
                        </span>
                      )}
                    </span>
                    <span
                      className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        unaffordable
                          ? dockModelExpanded
                            ? "bg-rose-400/20 text-rose-300"
                            : "bg-rose-100 text-rose-600"
                          : dockModelExpanded
                            ? selected
                              ? "bg-indigo-300/90 text-zinc-950"
                              : "bg-white/10 text-white/70"
                            : selected
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-white text-zinc-500"
                      }`}
                    >
                      {item.cost} кр.
                    </span>
                  </button>
                );
              })}
            </div>

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
                  {imageSizes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
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
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-expanded={expandedControl === "photos"}
              aria-controls="inline-generation-photos"
              disabled={controlsBusy}
              onClick={() => {
                setExpandedControl((current) => (current === "photos" ? null : "photos"));
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-xl text-left ring-2 transition ${
                expandedControl === "photos"
                  ? "ring-indigo-300"
                  : glassChrome
                    ? "bg-black/20 ring-white/10 hover:ring-white/25"
                    : "bg-zinc-100 ring-zinc-200 hover:ring-zinc-300"
              } disabled:opacity-50`}
            >
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
            </button>

            <button
              type="button"
              aria-expanded={expandedControl === "model"}
              aria-controls="inline-generation-models"
              disabled={controlsBusy || !models.length}
              onClick={() => {
                setExpandedControl((current) => (current === "model" ? null : "model"));
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl p-2 text-center ring-2 transition ${
                glassChrome
                  ? expandedControl === "model"
                    ? "bg-white/10 text-white ring-indigo-300"
                    : "bg-white/5 text-white ring-white/10 hover:bg-white/10 hover:ring-white/25"
                  : expandedControl === "model"
                    ? "bg-indigo-50 text-zinc-900 ring-indigo-500"
                    : "bg-indigo-50 text-zinc-900 ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-400"
              } disabled:opacity-50`}
            >
              <span
                className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${
                  glassChrome ? "bg-white/90" : "bg-white"
                }`}
              >
                <GoogleGenerationModelIcon />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                {displayLabelForGenerationModel(
                  model,
                  models.find((item) => item.id === model)?.label
                )}
              </span>
            </button>

            <p
              className={`min-w-0 flex-1 self-center text-[13px] font-medium leading-snug ${
                glassChrome ? "text-white/70" : "text-zinc-500"
              }`}
            >
              Нажмите на квадрат, чтобы изменить выбор.
            </p>
          </div>

        </section>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
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
          isDock
            ? `mt-auto border-t border-white/10 bg-transparent pb-3${
                // Avoid footer CTA bleeding through open editor sheets.
                dockExpanded ? " invisible pointer-events-none" : ""
              }`
            : `border-t backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
                showResultChrome
                  ? "border-white/10 bg-black/15"
                  : "border-zinc-200 bg-white/90"
              }`
        }`}
      >
        <div className="flex min-w-0 gap-2">
        {phase === "done" && resultUrl && generationId ? (
          <button
            type="button"
            onClick={() => setResultPreviewOpen(true)}
            className={
              isDock
                ? dockActionBtn
                : `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/25 px-2 py-3 text-[13px] font-semibold text-white transition hover:bg-black/40 active:scale-[0.99]`
            }
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path
                d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.75" />
            </svg>
            <span className="truncate">Посмотреть</span>
          </button>
        ) : null}
        {phase === "done" && resultUrl && generationId ? (
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => void handleResultAction("download")}
            className={`${
              isDock
                ? dockActionBtn
                : `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/25 px-2 py-3 text-[13px] font-semibold text-white transition hover:bg-black/40 active:scale-[0.99]`
            } disabled:opacity-50`}
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">
              {busyAction === "download" ? "Скачиваем…" : "Скачать"}
            </span>
          </button>
        ) : null}
        {phase === "done" && resultUrl && generationId ? (
          <button
            type="button"
            disabled={busy || Boolean(busyAction)}
            onClick={resetToCompose}
            className={`${
              isDock
                ? dockActionBtn
                : `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/25 px-2 py-3 text-[13px] font-semibold text-white transition hover:bg-black/40 active:scale-[0.99]`
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.2 9A7 7 0 0 0 6.4 6.4L4 9m2 6a7 7 0 0 0 11.6 2.6L20 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">Повторить</span>
          </button>
        ) : null}
        {showCreditsCta ? (
          <PricingEntryLink
            href="/pricing"
            onClick={() =>
              reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING)
            }
            className={`flex min-h-12 min-w-0 items-center justify-center rounded-2xl bg-rose-500/85 py-3 font-semibold text-white shadow-[0_12px_28px_-14px_rgba(244,63,94,0.45)] transition hover:bg-rose-500/95 ${
              phase === "done" && resultUrl
                ? "flex-1 px-2 text-[13px]"
                : "w-full px-4 text-[15px]"
            }`}
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
                  Boolean(busyAction) ||
                  Boolean(configError) ||
                  draftPrompt.trim().length < 8))
            }
            onClick={() => {
              if (!isAuthed) {
                openAuthModal();
                return;
              }
              if (busy) return;
              if (phase === "done" && resultUrl && generationId) {
                openPromptEditor();
                return;
              }
              void runGenerate({ promptOverride: draftPrompt });
            }}
            className={`${OVERLAY_BUTTON_UA_RESET} relative isolate flex min-h-12 min-w-0 items-center justify-center overflow-hidden rounded-2xl py-3 font-semibold text-white shadow-lg shadow-indigo-950/35 transition active:scale-[0.99] disabled:cursor-not-allowed ${
              busy || !(phase === "done" && resultUrl)
                ? "w-full px-4 text-[15px]"
                : "flex-1 px-2 text-[13px]"
            } ${
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
                phase === "done" && resultUrl && !busy ? "truncate" : undefined
              }
            >
              {starting
                ? "Запускаем…"
                : phase === "uploading"
                ? `Загружаем фото · ${Math.round(progress)}%`
                : phase === "generating"
                  ? `Генерируем · ${Math.round(progress)}%`
                  : phase === "done" && resultUrl
                    ? "Что изменить"
                    : !isAuthed
                      ? "Войти"
                      : "Сгенерировать"}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Результат генерации"
                className="max-h-[min(90dvh,100%)] max-w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
