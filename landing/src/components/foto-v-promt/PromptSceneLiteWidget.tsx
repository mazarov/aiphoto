"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  appendLiteRecognitionHistory,
  EXTENSION_LITE_RECOGNITION_HISTORY_KEY,
  listLiteRecognitionHistory,
  type LiteRecognitionEntry,
} from "@/lib/extension-lite-recognition-history";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePricingModal } from "@/context/PricingModalContext";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { getImagePromptAnalyzeUrl, FOTO_V_PROMT_ANALYZE_LOCALE } from "@/lib/foto-v-promt-config";
import {
  buildAnalyzeRequestHeaders,
  fetchAnalyzeQuota,
  type AnalyzeQuotaPayload,
} from "@/lib/image-prompt-analyze-client";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_ANALYZE_AUTH_REQUIRED,
  YM_GOAL_ANALYZE_FREE_SUCCESS,
  YM_GOAL_ANALYZE_NO_CREDITS,
  YM_GOAL_ANALYZE_PAID_SUCCESS,
  YM_GOAL_ANALYZE_QUOTA_UNAVAILABLE,
} from "@/lib/yandex-metrika";
import { FOTO_V_PROMT_HERO, widgetCopy, type WidgetCopyKey } from "@/lib/foto-v-promt-copy";
import {
  PHOTO_PROMPT_UPLOAD_MAX_PX,
  PHOTO_PROMPT_UPLOAD_QUALITY,
} from "@/lib/generate-photo-prompt";
import { prepareUploadFile, noticeForUploadError } from "@/lib/image-upload-prepare";
import {
  clearFotoVPromtResultSnapshot,
  persistFotoVPromtResultSnapshot,
  readFotoVPromtResultSnapshot,
} from "@/lib/foto-v-promt-result-snapshot";
import { AnalyzePaidNotice, AnalyzeQuotaChip } from "./AnalyzeQuotaChip";
import { FotoVPromtCopyButton } from "./FotoVPromtCopyButton";
import { FotoVPromtGenerateButton } from "./FotoVPromtGenerateButton";
import {
  FVP_BORDER_CARD,
  FVP_BORDER_INPUT,
  FVP_FOCUS_RING,
  FVP_IMMERSIVE_ACTION,
  FVP_IMMERSIVE_ACTION_PRIMARY,
  FVP_IMMERSIVE_FOCUS_RING,
  FVP_RING_INSET_SOFT,
  FVP_SURFACE_IMAGE_FRAME,
  FVP_SURFACE_WIDGET_INSET,
  FVP_SURFACE_WIDGET_OUTER,
} from "./foto-v-promt-tokens";

export type PromptSceneLiteVariant = "catalog" | "immersive";

const HISTORY_HASH_PREFIX = "#extension-lite-history";

const STORAGE_KEY = "extension_lite_pending";

const FILE_INPUT_ACCEPT =
  ".jpg,.jpeg,.jpe,.png,.webp,image/jpeg,image/png,image/webp,image/*";

function t(key: WidgetCopyKey): string {
  return widgetCopy(key);
}

function isUploadDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return localStorage.getItem("aid_upload_debug") === "1";
  } catch {
    return false;
  }
}

function clonePickerFile(file: File): File {
  const mime = file.type || "application/octet-stream";
  return new File([file.slice(0, file.size, mime)], file.name, { type: mime });
}

function uploadLog(step: string, data?: Record<string, unknown>) {
  if (!isUploadDebugEnabled()) return;
  if (data) console.debug("[aid-upload]", step, data);
  else console.debug("[aid-upload]", step);
}

const ANALYZE_STYLE = "photoreal" as const;

type Panel = "empty" | "loading" | "result" | "error";

type LiteErrorKind =
  | "none"
  | "rate_limited"
  | "auth_required"
  | "no_credits"
  | "quota_unavailable"
  | "generic";

type PendingAnalyze =
  | { kind: "data_url"; value: string }
  | { kind: "image_url"; value: string };

type MainTab = "analyze" | "history";

function looksLikeHttpImageUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Compact preview: fixed small frame; image scales inside with object-contain. */
function ImagePreviewFrame({
  src,
  variant = "default",
}: {
  src: string;
  variant?: "default" | "dimmed";
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[min(100%,18rem)] overflow-hidden rounded-xl ${FVP_SURFACE_WIDGET_INSET} ${FVP_RING_INSET_SOFT} sm:max-w-[20rem] ${
        variant === "dimmed" ? "opacity-75" : ""
      }`}
    >
      <div className="flex h-44 w-full items-center justify-center p-2 sm:h-48 sm:p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}

/** Empty-state hero: a visual reference becomes a structured prompt. */
function EmptyUploadHero({ immersive }: { immersive: boolean }) {
  const titleClass = immersive
    ? "text-lg font-semibold tracking-tight text-zinc-50"
    : "text-lg font-semibold tracking-tight text-zinc-900";
  const leadClass = immersive
    ? "mt-2 max-w-[18rem] text-sm leading-relaxed text-zinc-400"
    : "mt-2 max-w-[18rem] text-sm leading-relaxed text-zinc-600";
  const arrowClass = immersive ? "text-zinc-300" : "text-zinc-400";
  const tileGlow = immersive
    ? "shadow-[0_0_28px_-4px_rgba(139,92,246,0.55)]"
    : "shadow-[0_8px_28px_-6px_rgba(99,102,241,0.35)]";

  return (
    <div className="pointer-events-none flex w-full max-w-sm flex-col items-center text-center">
      <div className="relative flex items-center gap-3 py-1" aria-hidden>
        <div
          className={`pointer-events-none absolute -inset-x-6 -inset-y-2 rounded-full blur-2xl ${
            immersive
              ? "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.28),rgba(59,130,246,0.12)_45%,transparent_70%)]"
              : "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),rgba(59,130,246,0.1)_45%,transparent_70%)]"
          }`}
        />

        {/* Reference tile: a small editorial scene, not a generic upload icon. */}
        <div
          className={`relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[1.15rem] bg-gradient-to-b from-violet-400 via-indigo-400 to-sky-300 ring-1 ring-white/25 ${tileGlow}`}
        >
          <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.9)]" />
          <div className="absolute -bottom-5 -left-5 h-12 w-16 rotate-12 rounded-[50%] bg-violet-900/70" />
          <div className="absolute -bottom-4 right-[-1rem] h-11 w-16 -rotate-12 rounded-[50%] bg-indigo-950/65" />
          <div className="absolute bottom-0 left-1/2 h-9 w-3 -translate-x-1/2 rounded-t-full bg-zinc-950/85" />
          <div className="absolute bottom-7 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-zinc-950/85" />
          <div className="absolute inset-1 rounded-[0.9rem] ring-1 ring-inset ring-white/30" />
        </div>

        <svg className={`relative h-5 w-5 shrink-0 ${arrowClass}`} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h12m0 0l-4.5-4.5M17 12l-4.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Prompt tile: document, text lines and AI sparkle. */}
        <div
          className={`relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 ${tileGlow}`}
        >
          <div className="relative h-[3.3rem] w-[2.8rem] rounded-lg border border-white/75 bg-zinc-950/35 p-2 shadow-inner">
            <span className="block text-left text-[10px] font-bold leading-none text-white">T</span>
            <span className="mt-1.5 block h-0.5 w-full rounded-full bg-white/85" />
            <span className="mt-1 block h-0.5 w-4/5 rounded-full bg-white/70" />
            <span className="mt-1 block h-0.5 w-3/5 rounded-full bg-fuchsia-200/90" />
          </div>
          <svg className="absolute right-1.5 top-1.5 h-4 w-4 text-white" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5l1.2 3.3L12.5 6 9.2 7.2 8 10.5 6.8 7.2 3.5 6l3.3-1.2L8 1.5z" fill="currentColor" />
          </svg>
        </div>
      </div>

      <p className={`mt-5 ${titleClass}`}>{t("emptyTitle")}</p>
      <p className={leadClass}>{t("emptyLead")}</p>
    </div>
  );
}

function EmptyUploadGuidance({ immersive }: { immersive: boolean }) {
  const chipBase =
    "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-medium";
  const doChip = immersive
    ? `${chipBase} bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20`
    : `${chipBase} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200`;
  const dontChip = immersive
    ? `${chipBase} bg-white/[0.035] text-zinc-400 ring-1 ring-inset ring-white/10`
    : `${chipBase} bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200`;

  return (
    <div className="pointer-events-none mt-4 flex w-full max-w-[17rem] flex-col items-center">
      <div className="flex w-full gap-2">
        <div className={doChip}>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {t("emptyDo")}
        </div>
        <div className={dontChip}>
          <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
          {t("emptyDont")}
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{t("emptyHint")}</p>
    </div>
  );
}

export function PromptSceneLiteWidget({
  variant = "catalog",
  onClose,
}: {
  variant?: PromptSceneLiteVariant;
  onClose?: () => void;
} = {}) {
  const analyzeUrl = getImagePromptAnalyzeUrl();
  const immersive = variant === "immersive";
  const { user, openAuthModal } = useAuth();
  const { seedPhotoPrompt } = useGenerateDock();
  const { open: openPricing } = usePricingModal();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const [mainTab, setMainTab] = useState<MainTab>("analyze");
  const [panel, setPanel] = useState<Panel>("empty");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorKind, setErrorKind] = useState<LiteErrorKind>("none");
  const [notice, setNotice] = useState("");
  const [quota, setQuota] = useState<AnalyzeQuotaPayload | null>(null);
  const [paidNotice, setPaidNotice] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const ranPendingRef = useRef(false);
  const pendingAnalyzeRef = useRef<PendingAnalyze | null>(null);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectPreviewRef = useRef<string | null>(null);
  const processingFileRef = useRef(false);

  const revokeObjectPreview = useCallback(() => {
    if (!objectPreviewRef.current) return;
    URL.revokeObjectURL(objectPreviewRef.current);
    objectPreviewRef.current = null;
  }, []);

  const openFilePicker = useCallback(() => {
    const el = fileInputRef.current;
    if (!el) return;
    uploadLog("picker open");
    if (typeof el.showPicker === "function") {
      void el.showPicker();
      return;
    }
    el.click();
  }, []);

  const bumpHistory = useCallback(() => setHistoryTick((n) => n + 1), []);

  const refreshQuota = useCallback(async () => {
    const next = await fetchAnalyzeQuota();
    if (next) setQuota(next);
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota, isAuthed]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // continue restore
    }
    const snap = readFotoVPromtResultSnapshot();
    if (!snap) return;
    setPromptText(snap.promptText);
    if (snap.previewUrl) setPreviewUrl(snap.previewUrl);
    setPanel("result");
    setMainTab("analyze");
  }, []);

  useEffect(() => {
    if (panel !== "result" || !promptText.trim()) return;
    persistFotoVPromtResultSnapshot({ promptText, previewUrl });
  }, [panel, promptText, previewUrl]);

  const historyItems = useMemo(() => {
    void historyTick;
    return listLiteRecognitionHistory();
  }, [historyTick]);

  const hasHistory = historyItems.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      // Do not depend on mainTab here: if URL hash stays #extension-lite-history while the user
      // switches back to Analyze, re-running applyHash must not forcibly reopen History.
      if (window.location.hash === HISTORY_HASH_PREFIX) {
        setMainTab("history");
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExt = () => bumpHistory();
    window.addEventListener("extension-lite-recognition-history", onExt);
    const onStorage = (e: StorageEvent) => {
      if (
        e.storageArea === window.localStorage &&
        e.key === EXTENSION_LITE_RECOGNITION_HISTORY_KEY
      ) {
        bumpHistory();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("extension-lite-recognition-history", onExt);
      window.removeEventListener("storage", onStorage);
    };
  }, [bumpHistory]);

  useEffect(() => {
    return () => {
      revokeObjectPreview();
    };
  }, [revokeObjectPreview]);

  const analyzeDataUrl = useCallback(
    async (dataUrl: string) => {
      setPanel("loading");
      setPreviewUrl(dataUrl);
      setErrorMessage("");
      setErrorKind("none");

      let res: Response;
      try {
        res = await fetch(analyzeUrl, {
          method: "POST",
          headers: buildAnalyzeRequestHeaders(),
          body: JSON.stringify({
            image_base64: dataUrl,
            style: ANALYZE_STYLE,
            locale: FOTO_V_PROMT_ANALYZE_LOCALE,
          }),
          credentials: "include",
        });
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorConnection"));
        setPanel("error");
        return;
      }

      let data: {
        prompt?: string;
        error?: string;
        message?: string;
        auth_required?: boolean;
        no_credits?: boolean;
        quota?: AnalyzeQuotaPayload;
      };
      try {
        data = await res.json();
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      if (data.quota) setQuota(data.quota);

      if (!res.ok) {
        pendingAnalyzeRef.current = { kind: "data_url", value: dataUrl };
        if (data?.error === "auth_required" || data?.auth_required) {
          setErrorKind("auth_required");
          setErrorMessage(data?.message || t("limitDescription"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_AUTH_REQUIRED);
          openAuthModal("analyze_quota");
        } else if (data?.error === "no_credits" || data?.no_credits) {
          setErrorKind("no_credits");
          setErrorMessage(data?.message || t("noCreditsDescription"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_NO_CREDITS);
          openPricing();
        } else if (data?.error === "quota_unavailable") {
          setErrorKind("quota_unavailable");
          setErrorMessage(data?.message || t("quotaUnavailable"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_QUOTA_UNAVAILABLE);
        } else if (data?.error === "rate_limited") {
          setErrorKind(data.auth_required ? "auth_required" : "rate_limited");
          setErrorMessage(data?.message || t("errorRateLimited"));
        } else {
          setErrorKind("generic");
          setErrorMessage(data?.message || t("errorGeneric"));
        }
        setPanel("error");
        return;
      }

      if (!data?.prompt) {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      pendingAnalyzeRef.current = null;
      appendLiteRecognitionHistory({
        style: ANALYZE_STYLE,
        prompt: data.prompt,
        image: { mode: "data_url", dataUrl },
      });
      bumpHistory();
      if (data.quota?.credits_charged) {
        setPaidNotice(true);
        requestCreditBalanceRefresh();
        reachYandexMetrikaGoal(YM_GOAL_ANALYZE_PAID_SUCCESS);
      } else {
        setPaidNotice(false);
        reachYandexMetrikaGoal(YM_GOAL_ANALYZE_FREE_SUCCESS);
      }
      setPromptText(data.prompt);
      setPanel("result");
    },
    [analyzeUrl, bumpHistory, openAuthModal, openPricing],
  );

  const analyzeImageUrl = useCallback(
    async (imageUrl: string) => {
      const trimmed = imageUrl.trim();
      if (!looksLikeHttpImageUrl(trimmed)) {
        setNotice(t("errorInvalidUrl"));
        return;
      }
      setMainTab("analyze");
      setNotice("");
      setPanel("loading");
      setPreviewUrl(trimmed);
      setErrorMessage("");
      setErrorKind("none");

      let res: Response;
      try {
        res = await fetch(analyzeUrl, {
          method: "POST",
          headers: buildAnalyzeRequestHeaders(),
          body: JSON.stringify({
            image_url: trimmed,
            style: ANALYZE_STYLE,
            locale: FOTO_V_PROMT_ANALYZE_LOCALE,
          }),
          credentials: "include",
        });
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorConnection"));
        setPanel("error");
        return;
      }

      let data: {
        prompt?: string;
        error?: string;
        message?: string;
        auth_required?: boolean;
        no_credits?: boolean;
        quota?: AnalyzeQuotaPayload;
      };
      try {
        data = await res.json();
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      if (data.quota) setQuota(data.quota);

      if (!res.ok) {
        pendingAnalyzeRef.current = { kind: "image_url", value: trimmed };
        if (data?.error === "auth_required" || data?.auth_required) {
          setErrorKind("auth_required");
          setErrorMessage(data?.message || t("limitDescription"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_AUTH_REQUIRED);
          openAuthModal("analyze_quota");
        } else if (data?.error === "no_credits" || data?.no_credits) {
          setErrorKind("no_credits");
          setErrorMessage(data?.message || t("noCreditsDescription"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_NO_CREDITS);
          openPricing();
        } else if (data?.error === "quota_unavailable") {
          setErrorKind("quota_unavailable");
          setErrorMessage(data?.message || t("quotaUnavailable"));
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_QUOTA_UNAVAILABLE);
        } else if (data?.error === "rate_limited") {
          setErrorKind(data.auth_required ? "auth_required" : "rate_limited");
          setErrorMessage(data?.message || t("errorRateLimited"));
        } else {
          setErrorKind("generic");
          setErrorMessage(data?.message || t("errorGeneric"));
        }
        setPanel("error");
        return;
      }

      if (!data?.prompt) {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      pendingAnalyzeRef.current = null;
      appendLiteRecognitionHistory({
        style: ANALYZE_STYLE,
        prompt: data.prompt,
        image: { mode: "image_url", imageUrl: trimmed },
      });
      bumpHistory();
      if (data.quota?.credits_charged) {
        setPaidNotice(true);
        requestCreditBalanceRefresh();
        reachYandexMetrikaGoal(YM_GOAL_ANALYZE_PAID_SUCCESS);
      } else {
        setPaidNotice(false);
        reachYandexMetrikaGoal(YM_GOAL_ANALYZE_FREE_SUCCESS);
      }
      setPromptText(data.prompt);
      setPanel("result");
    },
    [analyzeUrl, bumpHistory, openAuthModal, openPricing],
  );

  const tryConsumePendingFromStorage = useCallback(async () => {
    if (ranPendingRef.current || typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    ranPendingRef.current = true;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    let parsed: { dataUrl?: string; error?: string };
    try {
      parsed = JSON.parse(raw) as { dataUrl?: string; error?: string };
    } catch {
      return;
    }

    if (parsed.error === "fetch_failed") {
      setNotice(t("noticeFetchFailed"));
      return;
    }
    if (parsed.dataUrl && typeof parsed.dataUrl === "string") {
      seedPhotoPrompt(
        { previewUrl: parsed.dataUrl, dataUrl: parsed.dataUrl },
        { entrySource: "foto_v_promt" }
      );
      onClose?.();
    }
  }, [onClose, seedPhotoPrompt]);

  // Extension content script may fill sessionStorage after first paint; poll briefly so
  // we do not miss a one-shot CustomEvent if it fired before this listener attached.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < 25 && !cancelled; i++) {
        await tryConsumePendingFromStorage();
        if (ranPendingRef.current) break;
        if (i < 24) await new Promise((r) => setTimeout(r, 120));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tryConsumePendingFromStorage]);

  useEffect(() => {
    const onExtensionPending = () => {
      void tryConsumePendingFromStorage();
    };
    window.addEventListener("extension-lite-pending", onExtensionPending);
    return () => window.removeEventListener("extension-lite-pending", onExtensionPending);
  }, [tryConsumePendingFromStorage]);

  const handleFile = useCallback(async (file: File) => {
    if (processingFileRef.current) return;
    processingFileRef.current = true;
    uploadLog("handleFile start", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    setMainTab("analyze");
    setNotice("");
    revokeObjectPreview();
    setPanel("empty");
    setPreviewUrl(null);

    try {
      uploadLog("prepare start");
      const prepared = await prepareUploadFile(file, {
        maxPx: PHOTO_PROMPT_UPLOAD_MAX_PX,
        quality: PHOTO_PROMPT_UPLOAD_QUALITY,
      });
      uploadLog("prepare done", { ok: prepared.ok, error: prepared.ok ? undefined : prepared.error });
      if (!prepared.ok) {
        uploadLog("handleFile prepare failed", { error: prepared.error });
        setNotice(noticeForUploadError(prepared.error, t));
        return;
      }

      uploadLog("dock handoff");
      seedPhotoPrompt(
        { previewUrl: prepared.dataUrl, dataUrl: prepared.dataUrl },
        { entrySource: "foto_v_promt" }
      );
      onClose?.();
      uploadLog("handleFile end", { ok: true });
    } catch (err) {
      uploadLog("handleFile error", {
        message: err instanceof Error ? err.message : String(err),
      });
      setNotice(t("readFailed"));
    } finally {
      processingFileRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onClose, revokeObjectPreview, seedPhotoPrompt]);

  const onFileInputEvent = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      if (processingFileRef.current) return;
      const input = e.currentTarget;
      const f = input.files?.[0] ?? null;
      uploadLog("input change", {
        filesLength: f ? 1 : 0,
        name: f?.name,
        type: f?.type,
        size: f?.size,
      });
      if (!f) {
        input.value = "";
        setNotice(t("noticePickerRejected"));
        return;
      }
      const stable = clonePickerFile(f);
      void handleFile(stable);
    },
    [handleFile],
  );

  useEffect(() => {
    if (panel !== "empty" || mainTab !== "analyze") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) {
        const f = item.getAsFile();
        if (f) {
          void handleFile(f);
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [panel, mainTab, handleFile]);

  const resetEmpty = () => {
    revokeObjectPreview();
    pendingAnalyzeRef.current = null;
    clearFotoVPromtResultSnapshot();
    setPanel("empty");
    setPreviewUrl(null);
    setPromptText("");
    setErrorMessage("");
    setErrorKind("none");
    setNotice("");
    setPaidNotice(false);
  };

  const retryPendingAnalyze = () => {
    const pending = pendingAnalyzeRef.current;
    if (!pending) {
      resetEmpty();
      return;
    }
    if (pending.kind === "data_url") {
      void analyzeDataUrl(pending.value);
      return;
    }
    void analyzeImageUrl(pending.value);
  };

  const historyThumbnailSrc = (entry: LiteRecognitionEntry) =>
    entry.image.mode === "image_url" ? entry.image.imageUrl : entry.image.dataUrl;

  const recognizeAgainFromHistory = useCallback(
    (entry: LiteRecognitionEntry) => {
      if (entry.image.mode === "image_url") {
        void analyzeImageUrl(entry.image.imageUrl);
        return;
      }
      seedPhotoPrompt(
        { previewUrl: entry.image.dataUrl, dataUrl: entry.image.dataUrl },
        { entrySource: "foto_v_promt" }
      );
      onClose?.();
    },
    [analyzeImageUrl, onClose, seedPhotoPrompt],
  );

  const showImmersiveBackdrop =
    immersive &&
    mainTab === "analyze" &&
    Boolean(previewUrl) &&
    (panel === "loading" || panel === "result" || panel === "error");

  if (immersive) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#09090b] text-zinc-50">
        <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#09090b]/90 px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-50">
            {FOTO_V_PROMT_HERO.title}
          </p>
          <AnalyzeQuotaChip
            quota={quota}
            tone="dark"
            onSignIn={() => openAuthModal("analyze_quota")}
            onTopUp={() => openPricing()}
          />
        </header>
        {showImmersiveBackdrop && previewUrl ? (
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgb(9 9 11 / 0.45) 0%, rgb(9 9 11 / 0.16) 42%, rgb(9 9 11 / 0.55) 100%), linear-gradient(90deg, rgb(9 9 11 / 0.3) 0%, rgb(9 9 11 / 0.1) 55%, rgb(9 9 11 / 0.34) 100%)",
              }}
            />
          </div>
        ) : null}

        <nav
          className="relative z-10 mx-3 mt-2 flex shrink-0 gap-1 rounded-xl bg-zinc-900/80 p-1 ring-1 ring-inset ring-white/10 backdrop-blur-md"
          aria-label="Основная навигация"
        >
          <button
            type="button"
            onClick={() => setMainTab("analyze")}
            className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition ${FVP_IMMERSIVE_FOCUS_RING} ${
              mainTab === "analyze"
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            {t("tabAnalyze")}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("history")}
            className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition ${FVP_IMMERSIVE_FOCUS_RING} ${
              mainTab === "history"
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            {t("tabHistory")}
          </button>
        </nav>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {mainTab === "history" ? (
            hasHistory ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-zinc-400">{t("historyIntro")}</p>
                <ul className="list-none space-y-3">
                  {historyItems.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex gap-3 rounded-xl bg-zinc-900/70 p-3 ring-1 ring-inset ring-white/10 backdrop-blur-md"
                    >
                      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-inset ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={historyThumbnailSrc(entry)}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
                          {new Date(entry.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="mt-1 line-clamp-3 text-xs leading-snug text-zinc-200">
                          {entry.prompt}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => recognizeAgainFromHistory(entry)}
                            className={`inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 ${FVP_IMMERSIVE_FOCUS_RING}`}
                          >
                            {t("historyRecognizeAgain")}
                          </button>
                          <FotoVPromtCopyButton
                            text={entry.prompt}
                            idleLabel={t("historyCopyPrompt")}
                            className={`inline-flex min-h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 ${FVP_IMMERSIVE_FOCUS_RING}`}
                          />
                          <FotoVPromtGenerateButton
                            promptText={entry.prompt}
                            variant="sm"
                            label={t("generate")}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-10">
                <div className="text-zinc-500" aria-hidden>
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.35" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <h3 className="mt-4 text-center text-base font-semibold tracking-tight text-zinc-50">
                  {t("historyEmptyTitle")}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
                  {t("historyEmptyDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => setMainTab("analyze")}
                  className={`mt-6 inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10 ${FVP_IMMERSIVE_FOCUS_RING}`}
                >
                  {t("historyEmptyCta")}
                </button>
              </div>
            )
          ) : (
            <>
              {notice ? (
                <p className="mb-3 text-sm text-amber-200/90">{notice}</p>
              ) : null}

              {panel === "empty" ? (
                <label
                  htmlFor={fileInputId}
                  className={`relative flex min-h-[16rem] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 px-4 py-8 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-colors hover:border-indigo-400/40 hover:from-zinc-900 hover:to-zinc-950 ${FVP_IMMERSIVE_FOCUS_RING}`}
                  onClick={(e) => {
                    if (e.target instanceof HTMLInputElement) return;
                    e.preventDefault();
                    openFilePicker();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("border-indigo-400/70");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("border-indigo-400/70");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-indigo-400/70");
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handleFile(f);
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_70%)]"
                    aria-hidden
                  />
                  <EmptyUploadHero immersive />
                  <span
                    className={`relative mt-5 inline-flex min-h-11 w-full max-w-[17rem] items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 ${FVP_IMMERSIVE_FOCUS_RING}`}
                  >
                    {t("chooseFile")}
                    <input
                      ref={fileInputRef}
                      id={fileInputId}
                      type="file"
                      accept={FILE_INPUT_ACCEPT}
                      aria-label={t("chooseFile")}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      onChange={onFileInputEvent}
                      onInput={onFileInputEvent}
                    />
                  </span>
                  <EmptyUploadGuidance immersive />
                </label>
              ) : null}

              {panel === "loading" && previewUrl ? (
                <div className="flex flex-1 flex-col items-center justify-end gap-4 pb-6">
                  <div className="w-full max-w-sm rounded-2xl bg-zinc-950/55 px-4 py-5 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
                    <p className="text-center text-sm text-zinc-200">{t("analyzing")}</p>
                    <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-700">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-400/90" />
                    </div>
                    <button
                      type="button"
                      onClick={resetEmpty}
                      className={`mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-zinc-200 hover:bg-white/10 ${FVP_IMMERSIVE_FOCUS_RING}`}
                    >
                      {t("tryAgain")}
                    </button>
                  </div>
                </div>
              ) : null}

              {panel === "result" && previewUrl ? (
                <div className="flex min-h-0 flex-1 flex-col justify-end">
                  <div className="relative mx-auto flex w-full max-w-md min-h-0 max-h-full flex-col overflow-hidden rounded-3xl bg-zinc-950/70 p-4 ring-1 ring-inset ring-white/12 backdrop-blur-xl">
                    <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {t("resultTitle")}
                    </div>
                    {paidNotice ? (
                      <div className="mt-2 flex justify-center">
                        <AnalyzePaidNotice tone="dark" />
                      </div>
                    ) : null}
                    <pre className="mt-3 min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-left text-[13px] leading-relaxed text-zinc-100">
                      {promptText}
                    </pre>
                    <div className="mt-4 flex w-full flex-col items-stretch gap-2.5">
                      <FotoVPromtCopyButton
                        text={promptText}
                        idleLabel={t("copy")}
                        className={`${FVP_IMMERSIVE_ACTION_PRIMARY} ${FVP_IMMERSIVE_FOCUS_RING}`}
                      />
                      <FotoVPromtGenerateButton
                        promptText={promptText}
                        variant="immersive"
                        label={t("generate")}
                      />
                      <button
                        type="button"
                        onClick={resetEmpty}
                        className={`${FVP_IMMERSIVE_ACTION} ${FVP_IMMERSIVE_FOCUS_RING}`}
                      >
                        {t("tryAgain")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {panel === "error" ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-6">
                  <div className="w-full max-w-sm rounded-2xl bg-zinc-950/70 px-4 py-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
                    {errorKind === "rate_limited" ||
                    errorKind === "auth_required" ||
                    errorKind === "no_credits" ||
                    errorKind === "quota_unavailable" ? (
                      <div className="flex flex-col items-center text-center">
                        <h3 className="text-base font-semibold tracking-tight text-zinc-50">
                          {errorKind === "no_credits"
                            ? t("noCreditsTitle")
                            : errorKind === "quota_unavailable"
                              ? t("quotaUnavailable")
                              : t("limitTitle")}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                          {errorMessage ||
                            (errorKind === "no_credits"
                              ? t("noCreditsDescription")
                              : t("limitDescription"))}
                        </p>
                        <div className="mt-6 flex w-full flex-col gap-2">
                          {errorKind === "auth_required" ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (isAuthed) {
                                  retryPendingAnalyze();
                                  return;
                                }
                                openAuthModal("analyze_quota");
                              }}
                              className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 ${FVP_IMMERSIVE_FOCUS_RING}`}
                            >
                              {isAuthed ? t("retryAnalyze") : t("signInContinue")}
                            </button>
                          ) : null}
                          {errorKind === "no_credits" ? (
                            <button
                              type="button"
                              onClick={() => openPricing()}
                              className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 ${FVP_IMMERSIVE_FOCUS_RING}`}
                            >
                              {t("topUpTokens")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={
                              errorKind === "quota_unavailable"
                                ? retryPendingAnalyze
                                : resetEmpty
                            }
                            className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10 ${FVP_IMMERSIVE_FOCUS_RING}`}
                          >
                            {errorKind === "quota_unavailable"
                              ? t("retryAnalyze")
                              : t("limitGotIt")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed text-red-300">
                          {errorMessage || t("errorGeneric")}
                        </p>
                        <button
                          type="button"
                          onClick={resetEmpty}
                          className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 ${FVP_IMMERSIVE_FOCUS_RING}`}
                        >
                          {t("tryAgain")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-3xl rounded-2xl ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_OUTER} p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-md shadow-zinc-200/60 sm:p-5`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1">
          <button
            type="button"
            onClick={() => setMainTab("analyze")}
            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition ${FVP_FOCUS_RING} ${
              mainTab === "analyze"
                ? "bg-indigo-600 text-white shadow"
                : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {t("tabAnalyze")}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("history")}
            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition ${FVP_FOCUS_RING} ${
              mainTab === "history"
                ? "bg-indigo-600 text-white shadow"
                : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {t("tabHistory")}
          </button>
        </div>
        <AnalyzeQuotaChip
          quota={quota}
          tone="light"
          onSignIn={() => openAuthModal("analyze_quota")}
          onTopUp={() => openPricing()}
        />
      </div>

      {mainTab === "history" ? (
        hasHistory ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">{t("historyIntro")}</p>
            <ul className="max-h-[min(60vh,28rem)] list-none space-y-3 overflow-y-auto pr-0.5">
              {historyItems.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex gap-3 rounded-xl ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_INSET} p-3 ${FVP_RING_INSET_SOFT}`}
                >
                  <div
                    className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg ${FVP_SURFACE_IMAGE_FRAME} ${FVP_RING_INSET_SOFT}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={historyThumbnailSrc(entry)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
                      {new Date(entry.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-snug text-zinc-700">{entry.prompt}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => recognizeAgainFromHistory(entry)}
                        className={`inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
                      >
                        {t("historyRecognizeAgain")}
                      </button>
                      <FotoVPromtCopyButton
                        text={entry.prompt}
                        idleLabel={t("historyCopyPrompt")}
                        className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
                      />
                      <FotoVPromtGenerateButton
                        promptText={entry.prompt}
                        variant="sm"
                        label={t("generate")}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-6">
            <div className="text-zinc-500" aria-hidden>
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.35" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <h3 className="mt-4 text-center text-base font-semibold tracking-tight text-zinc-900">
              {t("historyEmptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
              {t("historyEmptyDescription")}
            </p>
            <div className="mx-auto mt-6 w-full max-w-xs">
              <button
                type="button"
                onClick={() => setMainTab("analyze")}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
              >
                {t("historyEmptyCta")}
              </button>
            </div>
          </div>
        )
      ) : (
        <>
          {notice ? <p className="mb-3 text-sm text-amber-700">{notice}</p> : null}

          {panel === "empty" ? (
        <div className="flex flex-col gap-4">
          <label
            htmlFor={fileInputId}
            className={`relative flex min-h-[14rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-4 py-8 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] transition-colors hover:border-indigo-400/50 hover:from-indigo-50/40 hover:to-white sm:min-h-[12rem] ${FVP_FOCUS_RING}`}
            onClick={(e) => {
              if (e.target instanceof HTMLInputElement) return;
              e.preventDefault();
              openFilePicker();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-indigo-500/60");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-indigo-500/60");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-indigo-500/60");
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.1),transparent_70%)]"
              aria-hidden
            />
            <EmptyUploadHero immersive={false} />
            <span
              className={`relative z-0 mt-5 inline-flex min-h-11 w-full max-w-[17rem] items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/70 transition hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
            >
              {t("chooseFile")}
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                aria-label={t("chooseFile")}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={onFileInputEvent}
                onInput={onFileInputEvent}
              />
            </span>
            <EmptyUploadGuidance immersive={false} />
          </label>
        </div>
      ) : null}

      {panel === "loading" && previewUrl ? (
        <div className="flex flex-col gap-4">
          <ImagePreviewFrame src={previewUrl} />
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-zinc-600">{t("analyzing")}</p>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500/80" />
            </div>
          </div>
        </div>
      ) : null}

      {panel === "result" && previewUrl ? (
        <div className="flex min-h-0 flex-col gap-4">
          <ImagePreviewFrame src={previewUrl} />
          <div className="min-h-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("resultTitle")}</div>
              {paidNotice ? <AnalyzePaidNotice tone="light" /> : null}
            </div>
            <pre
              className={`max-h-[min(40vh,22rem)] min-h-0 overflow-auto whitespace-pre-wrap rounded-lg ${FVP_BORDER_CARD} bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 sm:text-sm`}
            >
              {promptText}
            </pre>
            <p className="mt-1.5 text-center text-[0.65rem] text-zinc-600 sm:hidden">{t("resultScrollHint")}</p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <FotoVPromtCopyButton
              text={promptText}
              idleLabel={t("copy")}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`}
            />
            <FotoVPromtGenerateButton
              promptText={promptText}
              variant="md"
              label={t("generate")}
            />
            <button
              type="button"
              onClick={resetEmpty}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg px-5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 sm:w-auto sm:min-w-[10rem] ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
            >
              {t("tryAgain")}
            </button>
          </div>
        </div>
      ) : null}

      {panel === "error" ? (
        <div className="flex flex-col gap-5">
          {previewUrl ? <ImagePreviewFrame src={previewUrl} variant="dimmed" /> : null}
          {errorKind === "rate_limited" ||
          errorKind === "auth_required" ||
          errorKind === "no_credits" ||
          errorKind === "quota_unavailable" ? (
            <div className="flex flex-col items-center px-4 py-6">
              <div className="text-zinc-500" aria-hidden>
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" opacity="0.35" />
                  <path d="M12 7v5l3.5 2" opacity="0.95" />
                </svg>
              </div>
              <h3 className="mt-4 text-center text-base font-semibold tracking-tight text-zinc-900">
                {errorKind === "no_credits"
                  ? t("noCreditsTitle")
                  : errorKind === "quota_unavailable"
                    ? t("quotaUnavailable")
                    : t("limitTitle")}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
                {errorMessage ||
                  (errorKind === "no_credits"
                    ? t("noCreditsDescription")
                    : t("limitDescription"))}
              </p>
              <div className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-2">
                {errorKind === "auth_required" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthed) {
                        retryPendingAnalyze();
                        return;
                      }
                      openAuthModal("analyze_quota");
                    }}
                    className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
                  >
                    {isAuthed ? t("retryAnalyze") : t("signInContinue")}
                  </button>
                ) : null}
                {errorKind === "no_credits" ? (
                  <button
                    type="button"
                    onClick={() => openPricing()}
                    className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
                  >
                    {t("topUpTokens")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={
                    errorKind === "quota_unavailable" ? retryPendingAnalyze : resetEmpty
                  }
                  className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
                >
                  {errorKind === "quota_unavailable" ? t("retryAnalyze") : t("limitGotIt")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-red-600">{errorMessage || t("errorGeneric")}</p>
              <button
                type="button"
                onClick={resetEmpty}
                className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`}
              >
                {t("tryAgain")}
              </button>
            </>
          )}
        </div>
      ) : null}

        </>
      )}
    </div>
  );
}
