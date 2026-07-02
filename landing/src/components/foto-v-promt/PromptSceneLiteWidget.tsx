"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  appendLiteRecognitionHistory,
  EXTENSION_LITE_RECOGNITION_HISTORY_KEY,
  listLiteRecognitionHistory,
  type LiteRecognitionEntry,
} from "@/lib/extension-lite-recognition-history";
import { getImagePromptAnalyzeUrl, getImagePromptSiteUrl, FOTO_V_PROMT_ANALYZE_LOCALE } from "@/lib/foto-v-promt-config";
import { widgetCopy, type WidgetCopyKey } from "@/lib/foto-v-promt-copy";
import { prepareUploadFile, noticeForUploadError } from "@/lib/image-upload-prepare";
import {
  FVP_BORDER_CARD,
  FVP_BORDER_INPUT,
  FVP_FOCUS_RING,
  FVP_RING_INSET_SOFT,
  FVP_SURFACE_IMAGE_FRAME,
  FVP_SURFACE_WIDGET_INSET,
  FVP_SURFACE_WIDGET_OUTER,
} from "./foto-v-promt-tokens";

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

type LiteErrorKind = "none" | "rate_limited" | "auth_required" | "generic";

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

export function PromptSceneLiteWidget() {
  const analyzeUrl = getImagePromptAnalyzeUrl();
  const [mainTab, setMainTab] = useState<MainTab>("analyze");
  const [panel, setPanel] = useState<Panel>("empty");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorKind, setErrorKind] = useState<LiteErrorKind>("none");
  const [notice, setNotice] = useState("");
  const [historyTick, setHistoryTick] = useState(0);
  const ranPendingRef = useRef(false);
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
          headers: { "Content-Type": "application/json" },
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

      let data: { prompt?: string; error?: string; message?: string; auth_required?: boolean };
      try {
        data = await res.json();
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      if (!res.ok) {
        if (data?.error === "rate_limited") {
          if (data.auth_required) {
            setErrorKind("auth_required");
          } else {
            setErrorKind("rate_limited");
          }
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

      appendLiteRecognitionHistory({
        style: ANALYZE_STYLE,
        prompt: data.prompt,
        image: { mode: "data_url", dataUrl },
      });
      bumpHistory();

      setPromptText(data.prompt);
      setPanel("result");
    },
    [analyzeUrl, bumpHistory],
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
          headers: { "Content-Type": "application/json" },
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

      let data: { prompt?: string; error?: string; message?: string; auth_required?: boolean };
      try {
        data = await res.json();
      } catch {
        setErrorKind("generic");
        setErrorMessage(t("errorGeneric"));
        setPanel("error");
        return;
      }

      if (!res.ok) {
        if (data?.error === "rate_limited") {
          if (data.auth_required) {
            setErrorKind("auth_required");
          } else {
            setErrorKind("rate_limited");
          }
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

      appendLiteRecognitionHistory({
        style: ANALYZE_STYLE,
        prompt: data.prompt,
        image: { mode: "image_url", imageUrl: trimmed },
      });
      bumpHistory();

      setPromptText(data.prompt);
      setPanel("result");
    },
    [analyzeUrl, bumpHistory],
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
      setMainTab("analyze");
      setPreviewUrl(parsed.dataUrl);
      await analyzeDataUrl(parsed.dataUrl);
    }
  }, [analyzeDataUrl]);

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
    const previewObjectUrl = URL.createObjectURL(file);
    objectPreviewRef.current = previewObjectUrl;
    setPanel("loading");
    setPreviewUrl(previewObjectUrl);

    try {
      uploadLog("prepare start");
      const prepared = await prepareUploadFile(file);
      uploadLog("prepare done", { ok: prepared.ok, error: prepared.ok ? undefined : prepared.error });
      if (!prepared.ok) {
        uploadLog("handleFile prepare failed", { error: prepared.error });
        revokeObjectPreview();
        setPanel("empty");
        setPreviewUrl(null);
        setNotice(noticeForUploadError(prepared.error, t));
        return;
      }

      revokeObjectPreview();
      setPreviewUrl(prepared.dataUrl);
      uploadLog("analyze start");
      await analyzeDataUrl(prepared.dataUrl);
      uploadLog("handleFile end", { ok: true });
    } catch (err) {
      uploadLog("handleFile error", {
        message: err instanceof Error ? err.message : String(err),
      });
      revokeObjectPreview();
      setPanel("empty");
      setPreviewUrl(null);
      setNotice(t("readFailed"));
    } finally {
      processingFileRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [analyzeDataUrl, revokeObjectPreview]);

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
    setPanel("empty");
    setPreviewUrl(null);
    setPromptText("");
    setErrorMessage("");
    setErrorKind("none");
    setNotice("");
  };

  const copyPrompt = async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      /* ignore */
    }
  };

  const copyHistoryPrompt = async (prompt: string) => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* ignore */
    }
  };

  const historyThumbnailSrc = (entry: LiteRecognitionEntry) =>
    entry.image.mode === "image_url" ? entry.image.imageUrl : entry.image.dataUrl;

  const recognizeAgainFromHistory = useCallback(
    (entry: LiteRecognitionEntry) => {
      setMainTab("analyze");
      if (entry.image.mode === "image_url") {
        void analyzeImageUrl(entry.image.imageUrl);
      } else {
        void analyzeDataUrl(entry.image.dataUrl);
      }
    },
    [analyzeDataUrl, analyzeImageUrl],
  );

  return (
    <div
      className={`w-full max-w-3xl rounded-2xl ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_OUTER} p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-md shadow-zinc-200/60 sm:p-5`}
    >
      <div className="mb-4 flex flex-wrap gap-1">
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
                      <button
                        type="button"
                        onClick={() => void copyHistoryPrompt(entry.prompt)}
                        className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
                      >
                        {t("historyCopyPrompt")}
                      </button>
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

          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept={FILE_INPUT_ACCEPT}
            aria-label={t("chooseFile")}
            className="sr-only"
            onChange={onFileInputEvent}
            onInput={onFileInputEvent}
          />

          {panel === "empty" ? (
        <div className="flex flex-col gap-4">
          <label
            htmlFor={fileInputId}
            className={`relative flex min-h-[11rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-indigo-400/60 hover:bg-indigo-50/30 sm:min-h-[10rem] ${FVP_FOCUS_RING}`}
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
            <p className="pointer-events-none text-sm font-medium text-zinc-800">{t("emptyTitle")}</p>
            <p className="pointer-events-none mt-1 text-xs text-zinc-500">{t("emptyHint")}</p>
            <span
              className={`pointer-events-none relative z-0 mt-4 inline-flex min-h-11 w-full max-w-[20rem] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
            >
              {t("chooseFile")}
            </span>
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
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("resultTitle")}</div>
            <pre
              className={`max-h-[min(40vh,22rem)] min-h-0 overflow-auto whitespace-pre-wrap rounded-lg ${FVP_BORDER_CARD} bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 sm:text-sm`}
            >
              {promptText}
            </pre>
            <p className="mt-1.5 text-center text-[0.65rem] text-zinc-600 sm:hidden">{t("resultScrollHint")}</p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`}
            >
              {t("copy")}
            </button>
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
          {errorKind === "rate_limited" || errorKind === "auth_required" ? (
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
                {t("limitTitle")}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
                {errorMessage || t("limitDescription")}
              </p>
              {errorKind === "auth_required" ? (
                <p className="mx-auto mt-2 max-w-sm text-center text-xs leading-relaxed text-zinc-500">
                  {t("authRequiredHint")}
                </p>
              ) : (
                <p className="mx-auto mt-2 text-center text-xs leading-relaxed text-zinc-500">
                  {t("limitResetLine")}
                </p>
              )}
              <div className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-2">
                {errorKind === "auth_required" ? (
                  <a
                    href={getImagePromptSiteUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 ${FVP_FOCUS_RING}`}
                  >
                    imageprompt.tools
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={resetEmpty}
                  className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
                >
                  {t("limitGotIt")}
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
