import { t, toggleUiLang } from "./i18n.js";
import { getStvRuntime } from "./stv-config.js";

function rt() {
  return getStvRuntime();
}

let supabaseClient = null;
let accessTokenRef = null;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000;
const LONG_RUNNING_MS = 45000;
const GENERATION_COOLDOWN_MS = 20000;
const AUTH_REFRESH_MS = 30000;
const CREDIT_POLL_INTERVAL = 5000;
const CREDIT_POLL_MAX = 60;
const SESSION_VIBE_KEY = "pendingVibe";
const LOCAL_STATE_KEY = "stv_state_v2";
const MAX_RUN_HISTORY = 10;
const TOAST_TIMEOUT_MS = 3200;
/** Включает режим как в коммите 2c23ce94: 3 промпта → 3 параллельных `POST /api/generate`. См. docs/22-03-stv-single-generation-flow.md §3 */
const TRIPLE_VARIANT_FLOW_LS_KEY = "stv_triple_variant_flow";
/** Matches POST /api/generate validation (max 4 user images). */
const MAX_USER_PHOTOS = 4;
/** Signed GET URLs expire server-side (~24h); refresh before that. */
const SIGNED_PREVIEW_MAX_AGE_MS = 22 * 60 * 60 * 1000;

function isSignedPreviewStillUsable(p) {
  if (!p?.storagePath) return false;
  const url = p.signedPreviewUrl;
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  if (p.signedForPath && p.signedForPath !== p.storagePath) return false;
  const at = Number(p.signedPreviewSavedAt || 0);
  if (!at) return true;
  return Date.now() - at < SIGNED_PREVIEW_MAX_AGE_MS;
}

async function fetchSignedUrlForStoragePath(storagePath) {
  const q = encodeURIComponent(storagePath);
  const data = await api(`/api/upload-generation-photo/signed-url?path=${q}`);
  const url = data?.signedUrl;
  if (typeof url !== "string" || !url.startsWith("http")) return null;
  return url;
}

/** After upload: fill signed URL for <img> and for chrome.storage persist (no Bearer on reopen). */
async function applySignedPreviewToItem(item) {
  if (!item?.storagePath) return;
  try {
    const url = await fetchSignedUrlForStoragePath(item.storagePath);
    if (url) {
      item.signedPreviewUrl = url;
      item.signedForPath = item.storagePath;
      item.signedPreviewSavedAt = Date.now();
    }
  } catch (e) {
    console.warn("[stv] signed preview for item", item.storagePath, e);
  }
}

/** Brand mark: star inside gradient tile (aligned with content-script `.stv-ob-mark`). */
const STV_MARK_STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="stv-mark-star"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.656-1.077 2.104 0l2.052 4.96 5.35.434c1.161.094 1.548 1.603.748 2.384l-4.09 3.941 1.14 5.348c.25 1.17-1.036 2.017-2.1 1.51l-4.828-2.29-4.827 2.29c-1.064.507-2.35-.34-2.1-1.51l1.14-5.348-4.09-3.941c-.8-.781-.413-2.384.748-2.384l5.35-.434 2.052-4.96Z" clip-rule="evenodd"/></svg>`;

/** Presets for POST /api/vibe/extract `extractTemperature`; null = omit (API default). */
const EXTRACT_TEMPERATURE_PRESETS = [0.1, 0.3, 0.6, 0.9, 1];

function normalizePersistedExtractTemperature(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const hit = EXTRACT_TEMPERATURE_PRESETS.find((x) => Math.abs(x - value) < 1e-6);
  return hit !== undefined ? hit : null;
}

function extractTemperatureSelectValue(stateValue) {
  if (stateValue === null || stateValue === undefined) return "";
  const n = normalizePersistedExtractTemperature(stateValue);
  return n !== null ? String(n) : "";
}

function isTripleVariantFlowEnabled() {
  try {
    const v = localStorage.getItem(TRIPLE_VARIANT_FLOW_LS_KEY);
    return v === "1" || String(v).toLowerCase() === "true";
  } catch {
    return false;
  }
}

function getPromptsPerRun() {
  return isTripleVariantFlowEnabled() ? 3 : 1;
}

const DEFAULT_MODELS = [
  { id: "gemini-2.5-flash-image", label: "Flash", cost: 1 },
  { id: "gemini-3-pro-image-preview", label: "Pro", cost: 2 },
  { id: "gemini-3.1-flash-image-preview", label: "Ultra", cost: 3 }
];
const DEFAULT_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" }
];
const DEFAULT_IMAGE_SIZES = [
  { value: "1K", label: "1K (1024)" },
  { value: "2K", label: "2K (2048)" },
  { value: "4K", label: "4K (4096)" }
];

const app = document.getElementById("app");

const state = {
  loading: true,
  phase: "idle",
  error: "",
  info: "",
  user: null,
  credits: 0,
  sourceImageUrl: "",
  sourceContext: null,
  /**
   * Optional style reference from disk (one file). Mutually exclusive with sourceImageUrl steal/embed.
   * Persisted: storagePath + fileName only. Ephemeral: previewObjectUrl, signed*, previewBust.
   */
  referencePhoto: null,
  /** True while fetching signed preview for persisted referencePhoto after reload. */
  referencePhotoPreviewLoading: false,
  /**
   * User subject photos for generation (order = API order).
   * Persisted: storagePath + fileName only. Ephemeral: previewObjectUrl, signed*, uploading.
   */
  userPhotos: [],
  /** True while fetching signed preview URLs after reload. */
  userPhotosPreviewLoading: false,
  selectedModel: "gemini-2.5-flash-image",
  selectedAspectRatio: "1:1",
  selectedImageSize: "1K",
  models: [...DEFAULT_MODELS],
  aspectRatios: [...DEFAULT_ASPECT_RATIOS],
  imageSizes: [...DEFAULT_IMAGE_SIZES],
  vibeId: null,
  /** UGC card attribution when opened from landing embed */
  landingCardId: null,
  style: null,
  extractModel: "",
  expandModel: "",
  prompts: [],
  /** When API returns mergedPrompt (legacy 2c23 single-gen), use this for POST /api/generate instead of prompts[0]. */
  mergedForSingleGeneration: "",
  /** Full text sent to Gemini (prefix + bridge + expanded prompt), from expand response */
  finalPromptForGeneration: "",
  finalPromptAssumesTwoImages: false,
  /** Server: split prompt + grooming refs — show hair/makeup checkboxes */
  vibeGroomingControlsAvailable: false,
  groomingPolicy: { applyHair: true, applyMakeup: true },
  /** After expand: wait for user to adjust grooming, then continue image gen */
  awaitingContinueGenerate: false,
  pendingRunStartedAt: 0,
  results: [],
  generating: false,
  runHistory: [],
  cooldownUntil: 0,
  toast: null,
  resuming: false,
  waitingForPayment: false,
  /** 0–100 during extract/expand/assemble (before result rows exist); reset when idle */
  pipelinePrepPercent: 0,
  /** Primary button label while generating: extract | expand | assemble | generate */
  runStage: "idle",
  /** null = omit temperature on extract (provider default); else one of EXTRACT_TEMPERATURE_PRESETS */
  extractTemperature: null
};

let toastTimer = null;
let creditPollTimer = null;
let assembleDebounceTimer = null;
let promptBodyPersistTimer = null;

function storageLocalGet(key) {
  return rt().platform.storage.local.get(key);
}

function storageLocalSet(obj) {
  return rt().platform.storage.local.set(obj);
}

function storageLocalRemove(key) {
  return rt().platform.storage.local.remove(key);
}

function storageSessionGet(key) {
  return rt().platform.storage.session.get(key);
}

function storageSessionRemove(key) {
  return rt().platform.storage.session.remove(key);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Body text sent as `prompt` to `POST /api/generate` (server runs `assembleVibeFinalPrompt` on it). */
function getGenerationPromptBodyForUi() {
  const m = state.mergedForSingleGeneration;
  if (typeof m === "string" && m.trim()) return m;
  const p0 = Array.isArray(state.prompts) ? state.prompts[0] : null;
  if (p0 && typeof p0.prompt === "string") return p0.prompt;
  return "";
}

function applyGenerationPromptBodyFromUi(text) {
  const v = typeof text === "string" ? text : String(text ?? "");
  state.mergedForSingleGeneration = v;
  const prompts = Array.isArray(state.prompts) ? state.prompts : [];
  if (!prompts.length) {
    state.prompts = v.trim() ? [{ accent: "scene", prompt: v }] : [];
    return;
  }
  state.prompts = prompts.map((p) => ({
    accent: typeof p.accent === "string" && p.accent ? p.accent : "scene",
    prompt: v
  }));
}

/** Safe inside double-quoted HTML attributes (e.g. img src). Do not use full escapeHtml on blob: URLs beyond this. */
function escapeHtmlAttrUrl(url) {
  return String(url)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function revokeAllUserPhotoObjectUrls() {
  for (const p of state.userPhotos) {
    if (p.previewObjectUrl) {
      try {
        URL.revokeObjectURL(p.previewObjectUrl);
      } catch {
        /* ignore */
      }
      p.previewObjectUrl = "";
    }
  }
}

function clearAllUserPhotoSignedUrls() {
  for (const p of state.userPhotos) {
    p.signedPreviewUrl = "";
    p.signedForPath = "";
  }
}

function userPhotoStoragePaths() {
  return state.userPhotos.map((p) => p.storagePath).filter(Boolean);
}

function hasUserPhotos() {
  return state.userPhotos.length > 0;
}

function hasReference() {
  return Boolean(state.sourceImageUrl) || Boolean(state.referencePhoto?.storagePath);
}

function clearUrlReference() {
  state.sourceImageUrl = "";
  state.sourceContext = null;
}

function clearReferenceUpload() {
  const p = state.referencePhoto;
  if (!p) return;
  if (p.previewObjectUrl) {
    try {
      URL.revokeObjectURL(p.previewObjectUrl);
    } catch {
      /* ignore */
    }
  }
  state.referencePhoto = null;
  state.referencePhotoPreviewLoading = false;
}

function removeReference() {
  if (state.referencePhoto?.storagePath) {
    clearReferenceUpload();
  } else {
    clearUrlReference();
  }
}

/** Avoid parallel signed-url fetches from repeated renderMain(). */
let userPhotosSignedRefreshPromise = null;

function userPhotosNeedSignedPreviews() {
  return state.userPhotos.some((p) => p.storagePath && !p.previewObjectUrl && !isSignedPreviewStillUsable(p));
}

/**
 * After reload, blob URLs are gone; fetch signed URL per stored path for <img> previews.
 * Requires Bearer: extension panel often has no site cookies, so we refresh Supabase session if needed.
 */
async function refreshUserPhotosSignedPreviews() {
  if (!state.user) {
    state.userPhotosPreviewLoading = false;
    return;
  }
  if (!accessTokenRef && supabaseClient) {
    await refreshAccessTokenFromSupabase();
  }
  if (!accessTokenRef) {
    state.userPhotosPreviewLoading = false;
    return;
  }
  const need = state.userPhotos.filter(
    (p) => p.storagePath && !p.previewObjectUrl && !isSignedPreviewStillUsable(p)
  );
  if (!need.length) {
    state.userPhotosPreviewLoading = false;
    return;
  }
  if (userPhotosSignedRefreshPromise) {
    return userPhotosSignedRefreshPromise;
  }
  userPhotosSignedRefreshPromise = (async () => {
    state.userPhotosPreviewLoading = true;
    render();
    try {
      const settled = await Promise.allSettled(
        need.map(async (p) => {
          const q = encodeURIComponent(p.storagePath);
          const data = await api(`/api/upload-generation-photo/signed-url?path=${q}`);
          const url = data?.signedUrl;
          const item = state.userPhotos.find((x) => x.storagePath === p.storagePath);
          if (item && typeof url === "string" && url.startsWith("http")) {
            item.signedPreviewUrl = url;
            item.signedForPath = p.storagePath;
            item.signedPreviewSavedAt = Date.now();
          }
        })
      );
      for (let i = 0; i < settled.length; i += 1) {
        const r = settled[i];
        if (r.status === "rejected") {
          console.warn("[stv] user photos signed preview:", need[i]?.storagePath, r.reason);
        }
      }
    } finally {
      userPhotosSignedRefreshPromise = null;
      state.userPhotosPreviewLoading = false;
      await persistState();
      render();
    }
  })();
  return userPhotosSignedRefreshPromise;
}

let referencePhotoSignedRefreshPromise = null;

function referencePhotoNeedSignedPreview() {
  const p = state.referencePhoto;
  return Boolean(p?.storagePath && !p.previewObjectUrl && !isSignedPreviewStillUsable(p));
}

async function refreshReferencePhotoSignedPreview() {
  if (!state.user) {
    state.referencePhotoPreviewLoading = false;
    return;
  }
  if (!accessTokenRef && supabaseClient) {
    await refreshAccessTokenFromSupabase();
  }
  if (!accessTokenRef) {
    state.referencePhotoPreviewLoading = false;
    return;
  }
  const p = state.referencePhoto;
  if (!p?.storagePath || p.previewObjectUrl || isSignedPreviewStillUsable(p)) {
    state.referencePhotoPreviewLoading = false;
    return;
  }
  if (referencePhotoSignedRefreshPromise) {
    return referencePhotoSignedRefreshPromise;
  }
  referencePhotoSignedRefreshPromise = (async () => {
    state.referencePhotoPreviewLoading = true;
    render();
    try {
      const q = encodeURIComponent(p.storagePath);
      const data = await api(`/api/upload-generation-photo/signed-url?path=${q}`);
      const url = data?.signedUrl;
      const item = state.referencePhoto;
      if (item && typeof url === "string" && url.startsWith("http")) {
        item.signedPreviewUrl = url;
        item.signedForPath = p.storagePath;
        item.signedPreviewSavedAt = Date.now();
        item.previewBust = Date.now();
      }
    } catch (err) {
      console.warn("[stv] reference photo signed preview:", p?.storagePath, err);
    } finally {
      referencePhotoSignedRefreshPromise = null;
      state.referencePhotoPreviewLoading = false;
      await persistState();
      render();
    }
  })();
  return referencePhotoSignedRefreshPromise;
}

function refreshPersistedPhotoPreviews() {
  void refreshUserPhotosSignedPreviews();
  void refreshReferencePhotoSignedPreview();
}

function removeUserPhotoAt(index) {
  const p = state.userPhotos[index];
  if (!p) return;
  if (p.previewObjectUrl) {
    try {
      URL.revokeObjectURL(p.previewObjectUrl);
    } catch {
      /* ignore */
    }
  }
  state.userPhotos.splice(index, 1);
}

function clearToastTimer() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function stopCreditPolling() {
  if (creditPollTimer) {
    clearInterval(creditPollTimer);
    creditPollTimer = null;
  }
}

function setToast(type, message, timeoutMs = TOAST_TIMEOUT_MS) {
  state.toast = { type, message: String(message || "") };
  render();
  clearToastTimer();
  toastTimer = setTimeout(() => {
    state.toast = null;
    render();
  }, timeoutMs);
}

function getModelConfig(modelId) {
  return state.models.find((m) => m.id === modelId) || state.models[0] || DEFAULT_MODELS[0];
}

function getRequiredCredits() {
  return Number(getModelConfig(state.selectedModel).cost || 1) * getPromptsPerRun();
}

function getCooldownLeftSeconds() {
  const leftMs = Number(state.cooldownUntil || 0) - Date.now();
  if (leftMs <= 0) return 0;
  return Math.ceil(leftMs / 1000);
}

function statusLabel(status) {
  switch (status) {
    case "creating":
      return t("status_creating");
    case "processing":
      return t("status_processing");
    case "completed":
      return t("status_completed");
    case "failed":
      return t("status_failed");
    default:
      return t("status_queued");
  }
}

function getAdaptivePollIntervalMs(elapsedMs) {
  if (elapsedMs < 15000) return POLL_INTERVAL_MS;
  if (elapsedMs < 45000) return 3500;
  if (elapsedMs < 90000) return 5000;
  return 6500;
}

function classifyErrorType(message) {
  const text = String(message || "").toLowerCase();
  if (!text) return "unknown";
  if (text.includes("недостаточно кредитов")) return "insufficient_credits";
  if (text.includes("таймаут")) return "timeout";
  if (
    text.includes("unauthorized") ||
    text.includes("авториза") ||
    text.includes("сессия истекла") ||
    text.includes("войдите заново") ||
    text.includes("требуется вход")
  ) {
    return "unauthorized";
  }
  if (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("соедин") ||
    text.includes("не удалось получить изображение")
  ) {
    return "network";
  }
  if (
    text.includes("validation") ||
    text.includes("проверьте параметры") ||
    text.includes("некорректные параметры")
  ) {
    return "validation_error";
  }
  if (text.includes("ошибк")) return "generation_failed";
  return "unknown";
}

function formatAccentLabel(accent) {
  const map = {
    scene: t("accent_scene"),
    lighting: t("accent_lighting"),
    mood: t("accent_mood"),
    composition: t("accent_composition")
  };
  return map[String(accent || "").toLowerCase()] || String(accent || "—");
}

/** Компактная карточка результата для колонки шага 1. */
function buildResultCompactRowHtml(row) {
  const retryKey = row.id || `${row.accent}:${row.attempt}`;
  const hasThumb = Boolean(row.resultUrl);
  const statusText = `${escapeHtml(statusLabel(row.status))}`;

  return `
      <div class="stv-result-compact${hasThumb ? " has-thumb" : ""}">
        ${hasThumb ? `<img class="stv-result-thumb" src="${escapeHtml(row.resultUrl)}" alt="" />` : ""}
        <div class="stv-result-overlay-top">
          <span class="stv-result-accent-badge">${escapeHtml(formatAccentLabel(row.accent))}</span>
          <span class="stv-result-status-badge stv-result-status--${escapeHtml(row.status || "pending")}">${statusText}</span>
        </div>
        <div class="stv-result-overlay-bottom">
          ${row.error ? `<p class="stv-result-err">${escapeHtml(row.error)}</p>` : ""}
          ${row.statusDetail && !hasThumb ? `<p class="stv-result-detail">${escapeHtml(row.statusDetail)}</p>` : ""}
          <div class="stv-result-actions">
            <button type="button" data-save-id="${escapeHtml(row.id || "")}" ${row.status === "completed" && !row.saving ? "" : "disabled"}>
              ${row.saving ? escapeHtml(t("btn_saving")) : row.saved ? escapeHtml(t("btn_saved")) : escapeHtml(t("btn_save"))}
            </button>
            <button type="button" data-retry-id="${escapeHtml(retryKey)}" ${row.status === "failed" && !state.generating ? "" : "disabled"}>
              ${escapeHtml(t("btn_retry"))}
            </button>
            ${hasThumb ? `<a href="${escapeHtml(row.resultUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t("btn_open"))}</a>` : ""}
          </div>
        </div>
      </div>`;
}

function normalizeUiError(err, fallbackText) {
  const fallback = String(fallbackText || "Произошла ошибка");
  if (!err) return fallback;

  const payload = err.payload && typeof err.payload === "object" ? err.payload : null;
  const code = String(payload?.error || "").toLowerCase();
  const message = String(payload?.message || "").trim();
  const status = Number(err.status || 0);

  if (status === 401 || status === 403 || code === "unauthorized") {
    return t("err_session");
  }
  if (code === "insufficient_credits") {
    const required = Number(payload?.required || 0);
    const available = Number(payload?.available || 0);
    if (required > 0 || available >= 0) {
      return `Недостаточно кредитов: нужно ${required}, доступно ${available}`;
    }
    return "Недостаточно кредитов";
  }
  if (code === "validation_error") {
    return message || "Проверьте параметры запроса";
  }
  if (code === "fetch_failed") {
    return "Не удалось получить изображение по ссылке. Попробуйте другую картинку.";
  }
  if (code === "extract_failed") {
    return "Не удалось извлечь стиль изображения. Попробуйте снова.";
  }
  if (code === "expand_failed") {
    return "Не удалось подготовить варианты промптов. Попробуйте снова.";
  }
  if (code === "save_failed") {
    return "Не удалось сохранить результат. Попробуйте позже.";
  }
  if (status >= 500) {
    return message || "Временная ошибка сервера. Попробуйте снова.";
  }
  if (message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function getSessionHealth() {
  if (state.user) {
    return { label: t("session_ok"), className: "session-ok" };
  }
  return { label: t("session_bad"), className: "session-bad" };
}

function modelLabelForRun(modelId) {
  const cfg = getModelConfig(modelId);
  if (!cfg) return String(modelId || "—");
  return `${cfg.label} (${cfg.cost})`;
}

function historyResultUrl(run) {
  const u = run?.resultUrl;
  return typeof u === "string" && u.startsWith("http") ? u : "";
}

function historyPromptText(run) {
  const p = run?.prompt;
  return typeof p === "string" ? p : "";
}

function buildRunHistoryCardHtml(run, idx) {
  const url = historyResultUrl(run);
  const promptText = historyPromptText(run);
  const modelLine = modelLabelForRun(run.model);
  const ratio = run.aspectRatio || "—";
  const size = run.imageSize || "—";
  const when = formatDateTime(run.startedAt);
  const failed = Number(run.failed || 0) > 0;
  const thumb = url
    ? `<img class="stv-history-thumb-img" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />`
    : `<div class="stv-history-thumb-fallback muted">${escapeHtml(
        failed ? t("history_failed_thumb") : t("history_no_thumb")
      )}</div>`;

  return `
    <article class="stv-history-card">
      <div class="stv-history-thumb" aria-hidden="true">${thumb}</div>
      <div class="stv-history-body">
        <p class="stv-history-date muted">${escapeHtml(when)}</p>
        <div class="stv-history-chips" aria-label="${escapeHtml(t("history_params_label"))}">
          <span class="stv-history-chip" title="${escapeHtml(t("field_model"))}">${escapeHtml(modelLine)}</span>
          <span class="stv-history-chip" title="${escapeHtml(t("field_ratio"))}">${escapeHtml(ratio)}</span>
          <span class="stv-history-chip" title="${escapeHtml(t("field_size"))}">${escapeHtml(size)}</span>
        </div>
        <div class="stv-history-actions row">
          <button type="button" data-history-download="${idx}" ${url ? "" : "disabled"}>${escapeHtml(t("history_download"))}</button>
          <button type="button" data-history-open="${idx}" ${url ? "" : "disabled"}>${escapeHtml(t("history_open"))}</button>
          <button type="button" data-history-prompt="${idx}" ${promptText.trim() ? "" : "disabled"}>${escapeHtml(
            t("history_prompt")
          )}</button>
        </div>
        <details class="stv-history-prompt-details">
          <summary>${escapeHtml(t("history_prompt_toggle"))}</summary>
          <pre class="prompt-box stv-history-prompt-pre">${escapeHtml(promptText || "—")}</pre>
        </details>
      </div>
    </article>`;
}

async function downloadHistoryResultByUrl(url, baseName) {
  const safeName = String(baseName || `promptshot-${Date.now()}`).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const extGuess = (() => {
    try {
      const p = new URL(url).pathname.toLowerCase();
      if (p.endsWith(".png")) return ".png";
      if (p.endsWith(".webp")) return ".webp";
      if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return ".jpg";
    } catch {
      /* ignore */
    }
    return ".png";
  })();
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const dl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dl;
    a.download = safeName.endsWith(".png") || safeName.endsWith(".jpg") ? safeName : `${safeName}${extGuess}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dl);
    setToast("success", t("history_downloaded"));
  } catch (e) {
    console.warn("[stv] history download:", e);
    window.open(url, "_blank", "noopener,noreferrer");
    setToast("info", t("history_download_fallback"));
  }
}

function bindRunHistoryActions() {
  const list = document.getElementById("stv-history-list");
  if (!list) return;
  list.addEventListener("click", (ev) => {
    const el = ev.target instanceof HTMLElement ? ev.target.closest("button[data-history-download],button[data-history-open],button[data-history-prompt]") : null;
    if (!el) return;
    const idx = Number(el.getAttribute("data-history-download") ?? el.getAttribute("data-history-open") ?? el.getAttribute("data-history-prompt"));
    if (!Number.isFinite(idx) || idx < 0) return;
    const run = state.runHistory?.[idx];
    if (!run) return;

    if (el.hasAttribute("data-history-download")) {
      const url = historyResultUrl(run);
      if (!url) return;
      void downloadHistoryResultByUrl(url, `stv-${run.id || idx}`);
      return;
    }
    if (el.hasAttribute("data-history-open")) {
      const url = historyResultUrl(run);
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (el.hasAttribute("data-history-prompt")) {
      const text = historyPromptText(run);
      if (!text.trim()) return;
      const card = el.closest(".stv-history-card");
      const det = card?.querySelector(".stv-history-prompt-details");
      if (det) det.open = true;
      void navigator.clipboard.writeText(text).then(
        () => setToast("success", t("history_prompt_copied")),
        () => setToast("error", t("history_prompt_copy_failed"))
      );
    }
  });
}

/**
 * Full bar 0–100%: first half = prep (extract → expand → assemble) from `pipelinePrepPercent`,
 * second half = image job polling from average `row.progress`.
 * During prep we ignore stale `state.results` from a previous run (they stayed at 100% and broke the bar).
 */
const PREP_PROGRESS_SHARE = 50;
const GEN_PROGRESS_SHARE = 50;

const IN_FLIGHT_STATUSES = new Set(["queued", "creating", "processing"]);

function isPrepRunStage() {
  return (
    state.runStage === "extract" ||
    state.runStage === "expand" ||
    state.runStage === "assemble"
  );
}

function averageRowProgress(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  const sum = rows.reduce((acc, row) => acc + Number(row.progress || 0), 0);
  return Math.round(sum / rows.length);
}

function resultsHaveInFlightWork() {
  const rows = Array.isArray(state.results) ? state.results : [];
  return rows.some((r) => IN_FLIGHT_STATUSES.has(String(r.status || "")));
}

function shouldShowCompareProgressBar() {
  return state.generating || state.resuming || resultsHaveInFlightWork();
}

function getOverallProgressPercent() {
  const rows = Array.isArray(state.results) ? state.results : [];
  const rowAvg = averageRowProgress(rows);

  if (state.generating || state.resuming) {
    if (state.generating && isPrepRunStage()) {
      const prep = Math.max(0, Math.min(100, Number(state.pipelinePrepPercent || 0)));
      return Math.max(0, Math.min(100, Math.round((prep / 100) * PREP_PROGRESS_SHARE)));
    }
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(PREP_PROGRESS_SHARE + (rowAvg / 100) * GEN_PROGRESS_SHARE)
      )
    );
  }

  if (resultsHaveInFlightWork()) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(PREP_PROGRESS_SHARE + (rowAvg / 100) * GEN_PROGRESS_SHARE)
      )
    );
  }

  return 0;
}

function primaryGenerateButtonLabel() {
  if (state.resuming) return t("btn_resuming");
  if (!state.generating) return t("btn_generate");
  if (state.runStage === "extract") return t("btn_stage_extract");
  if (state.runStage === "expand") return t("btn_stage_expand");
  if (state.runStage === "assemble") return t("btn_stage_assemble");
  return t("btn_generating");
}

function toSerializableState() {
  return {
    phase: state.phase,
    sourceImageUrl: state.sourceImageUrl,
    sourceContext: state.sourceContext,
    referencePhoto:
      state.referencePhoto?.storagePath && String(state.referencePhoto.storagePath).trim()
        ? (() => {
            const rp = state.referencePhoto;
            const base = {
              storagePath: String(rp.storagePath).trim(),
              fileName: String(rp.fileName || "")
            };
            if (isSignedPreviewStillUsable(rp)) {
              base.signedPreviewUrl = rp.signedPreviewUrl;
              base.signedForPath = String(rp.storagePath).trim();
              base.signedPreviewSavedAt = Number(rp.signedPreviewSavedAt || 0) || Date.now();
            }
            return base;
          })()
        : null,
    userPhotos: state.userPhotos.map((p) => {
      const row = { storagePath: p.storagePath, fileName: p.fileName };
      if (isSignedPreviewStillUsable(p)) {
        row.signedPreviewUrl = p.signedPreviewUrl;
        row.signedForPath = p.storagePath;
        row.signedPreviewSavedAt = Number(p.signedPreviewSavedAt || 0) || Date.now();
      }
      return row;
    }),
    selectedModel: state.selectedModel,
    selectedAspectRatio: state.selectedAspectRatio,
    selectedImageSize: state.selectedImageSize,
    vibeId: state.vibeId,
    landingCardId: state.landingCardId,
    style: state.style,
    extractModel: state.extractModel,
    expandModel: state.expandModel,
    prompts: state.prompts,
    mergedForSingleGeneration: state.mergedForSingleGeneration,
    finalPromptForGeneration: state.finalPromptForGeneration,
    finalPromptAssumesTwoImages: state.finalPromptAssumesTwoImages,
    vibeGroomingControlsAvailable: state.vibeGroomingControlsAvailable,
    groomingPolicy: state.groomingPolicy,
    awaitingContinueGenerate: state.awaitingContinueGenerate,
    pendingRunStartedAt: state.pendingRunStartedAt,
    results: state.results,
    runHistory: state.runHistory,
    cooldownUntil: state.cooldownUntil,
    extractTemperature: normalizePersistedExtractTemperature(state.extractTemperature),
    updatedAt: Date.now()
  };
}

async function persistState() {
  await storageLocalSet({ [LOCAL_STATE_KEY]: toSerializableState() });
}

async function initSupabaseAuth() {
  const origin = rt().getApiOrigin();
  await storageLocalSet({ stv_api_origin: origin });
  supabaseClient = await rt().createSupabaseClient(origin);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    accessTokenRef = session?.access_token ?? null;
    /* Token can arrive after first paint; signed preview fetch would have no-op'd without Bearer. */
    if (
      state.user &&
      accessTokenRef &&
      (userPhotosNeedSignedPreviews() || referencePhotoNeedSignedPreview())
    ) {
      refreshPersistedPhotoPreviews();
    }
  });
  const { data } = await supabaseClient.auth.getSession();
  accessTokenRef = data.session?.access_token ?? null;
}

async function refreshAccessTokenFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    accessTokenRef = data.session?.access_token ?? null;
  } catch {
    /* ignore */
  }
}

async function startGoogleSignIn() {
  try {
    if (!supabaseClient) await initSupabaseAuth();
    const redirectTo = rt().platform.getOAuthCallbackUrl();
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error) throw error;
    if (data?.url) {
      rt().platform.openOAuthUrl(data.url);
    }
  } catch (err) {
    state.error = normalizeUiError(err, "OAuth failed");
    setToast("error", state.error);
    render();
  }
}

async function signOutExtension() {
  try {
    await supabaseClient?.auth.signOut();
  } catch {
    /* ignore */
  }
  accessTokenRef = null;
  state.user = null;
  state.credits = 0;
  await checkAuth();
  render();
}

function applyPersistedState(saved) {
  if (!saved || typeof saved !== "object") return;
  state.phase = saved.phase || state.phase;
  state.sourceImageUrl = saved.sourceImageUrl || state.sourceImageUrl;
  state.sourceContext = saved.sourceContext || state.sourceContext;
  const savedRef = saved.referencePhoto;
  if (
    savedRef &&
    typeof savedRef === "object" &&
    typeof savedRef.storagePath === "string" &&
    String(savedRef.storagePath).trim()
  ) {
    const refPath = String(savedRef.storagePath).trim();
    const refRow = {
      storagePath: refPath,
      fileName: String(savedRef.fileName || ""),
      previewObjectUrl: "",
      signedPreviewUrl: "",
      signedForPath: "",
      signedPreviewSavedAt: 0,
      previewBust: 0,
      uploading: false
    };
    if (
      typeof savedRef.signedPreviewUrl === "string" &&
      savedRef.signedPreviewUrl.startsWith("http") &&
      String(savedRef.signedForPath || refPath) === refPath
    ) {
      refRow.signedPreviewUrl = savedRef.signedPreviewUrl;
      refRow.signedForPath = refPath;
      refRow.signedPreviewSavedAt = Number(savedRef.signedPreviewSavedAt || 0);
    }
    state.referencePhoto = refRow;
    state.sourceImageUrl = "";
    state.sourceContext = null;
  } else {
    state.referencePhoto = null;
    state.referencePhotoPreviewLoading = false;
  }
  if (Array.isArray(saved.userPhotos) && saved.userPhotos.length) {
    state.userPhotos = saved.userPhotos
      .filter((p) => p && typeof p.storagePath === "string" && String(p.storagePath).trim())
      .map((p) => {
        const path = String(p.storagePath).trim();
        const row = {
          storagePath: path,
          fileName: String(p.fileName || ""),
          previewObjectUrl: "",
          signedPreviewUrl: "",
          signedForPath: "",
          signedPreviewSavedAt: 0,
          uploading: false
        };
        if (
          typeof p.signedPreviewUrl === "string" &&
          p.signedPreviewUrl.startsWith("http") &&
          String(p.signedForPath || path) === path
        ) {
          row.signedPreviewUrl = p.signedPreviewUrl;
          row.signedForPath = path;
          row.signedPreviewSavedAt = Number(p.signedPreviewSavedAt || 0);
        }
        return row;
      })
      .slice(0, MAX_USER_PHOTOS);
  } else if (saved.photoStoragePath && String(saved.photoStoragePath).trim()) {
    state.userPhotos = [
      {
        storagePath: String(saved.photoStoragePath).trim(),
        fileName: String(saved.uploadedFileName || ""),
        previewObjectUrl: "",
        signedPreviewUrl: "",
        signedForPath: "",
        signedPreviewSavedAt: 0,
        uploading: false
      }
    ];
  } else if (Array.isArray(saved.userPhotos)) {
    state.userPhotos = [];
  }
  state.selectedModel = saved.selectedModel || state.selectedModel;
  state.selectedAspectRatio = saved.selectedAspectRatio || state.selectedAspectRatio;
  state.selectedImageSize = saved.selectedImageSize || state.selectedImageSize;
  state.vibeId = saved.vibeId || state.vibeId;
  state.landingCardId =
    typeof saved.landingCardId === "string" && saved.landingCardId.trim()
      ? saved.landingCardId.trim()
      : state.landingCardId;
  state.style = saved.style || state.style;
  state.extractModel = saved.extractModel || state.extractModel;
  state.expandModel = saved.expandModel || state.expandModel;
  state.prompts = Array.isArray(saved.prompts) ? saved.prompts : state.prompts;
  state.mergedForSingleGeneration =
    typeof saved.mergedForSingleGeneration === "string"
      ? saved.mergedForSingleGeneration
      : state.mergedForSingleGeneration;
  state.finalPromptForGeneration =
    typeof saved.finalPromptForGeneration === "string" ? saved.finalPromptForGeneration : state.finalPromptForGeneration;
  state.finalPromptAssumesTwoImages = Boolean(saved.finalPromptAssumesTwoImages);
  state.vibeGroomingControlsAvailable = Boolean(saved.vibeGroomingControlsAvailable);
  if (saved.groomingPolicy && typeof saved.groomingPolicy === "object") {
    state.groomingPolicy = {
      applyHair: saved.groomingPolicy.applyHair !== false,
      applyMakeup: saved.groomingPolicy.applyMakeup !== false
    };
  }
  state.awaitingContinueGenerate = Boolean(saved.awaitingContinueGenerate);
  state.pendingRunStartedAt = Number(saved.pendingRunStartedAt || 0);
  state.results = Array.isArray(saved.results) ? saved.results : state.results;
  state.runHistory = Array.isArray(saved.runHistory) ? saved.runHistory : state.runHistory;
  state.cooldownUntil = Number(saved.cooldownUntil || 0);
  state.extractTemperature = normalizePersistedExtractTemperature(saved.extractTemperature);
}

async function api(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (accessTokenRef && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessTokenRef}`;
  }
  const response = await fetch(`${rt().getApiOrigin()}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      try {
        await supabaseClient?.auth.signOut();
      } catch {
        /* ignore */
      }
      accessTokenRef = null;
      state.user = null;
      state.credits = 0;
      state.generating = false;
      state.runStage = "idle";
      state.pipelinePrepPercent = 0;
      state.phase = "idle";
      state.info = "";
      state.error = t("err_session");
      render();
    }
    const err = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/**
 * Cache-bust reference preview (URL steal or uploaded file preview).
 */
function referenceImageSrcForUi() {
  const rp = state.referencePhoto;
  if (rp?.storagePath) {
    const src = rp.previewObjectUrl || rp.signedPreviewUrl || "";
    if (!src) return "";
    /* Appending ?query to blob: breaks loading in Chrome extension panel. */
    if (src.startsWith("blob:")) {
      return src;
    }
    const bust = Number(rp.previewBust || 0);
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}_stvref=${bust}`;
  }
  const u = state.sourceImageUrl;
  if (!u) return "";
  const at = Number(state.sourceContext?.at || 0);
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}_stv=${at}`;
}

/**
 * Apply vibe from session storage (first open or subsequent "Steal this vibe" while panel stays open).
 */
async function applyPendingVibeFromStorage(vibe) {
  const url = vibe?.imageUrl;
  if (typeof url !== "string" || !url.startsWith("http")) return;
  const at = Number(vibe.at || 0);
  if (state.sourceImageUrl === url && Number(state.sourceContext?.at || 0) === at) {
    clearReferenceUpload();
    await storageSessionRemove(SESSION_VIBE_KEY);
    return;
  }
  clearReferenceUpload();
  state.sourceImageUrl = url;
  state.sourceContext = vibe;
  state.error = "";
  state.info = t("info_source_updated");
  await storageSessionRemove(SESSION_VIBE_KEY);
  await persistState();
  /* Always re-render: !state.loading guard missed updates during boot / race with onMessage. */
  render();
}

/** Poll session storage — sendMessage / onChanged often do not reach the side panel from the SW. */
async function tryConsumePendingVibeFromSessionPoll() {
  if (state.loading) return;
  const result = await storageSessionGet(SESSION_VIBE_KEY);
  const vibe = result?.[SESSION_VIBE_KEY];
  if (!vibe?.imageUrl) return;
  await applyPendingVibeFromStorage(vibe);
}

async function loadPendingVibe() {
  const result = await storageSessionGet(SESSION_VIBE_KEY);
  const vibe = result?.[SESSION_VIBE_KEY];
  if (vibe?.imageUrl) {
    await applyPendingVibeFromStorage(vibe);
  }
}

/** Web embed: seed reference image and card id from URL (landing iframe). */
async function applyEmbedQueryParams() {
  if (rt().platform.id !== "web" || typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get("cardId");
    if (cardId && cardId.trim()) {
      state.landingCardId = cardId.trim();
    }
    const src = params.get("sourceImageUrl");
    if (src && /^https?:\/\//i.test(src.trim())) {
      await applyPendingVibeFromStorage({ imageUrl: src.trim(), at: Date.now() });
    }
  } catch {
    /* ignore */
  }
}

async function loadConfig() {
  try {
    const data = await api("/api/generation-config");
    if (Array.isArray(data.models) && data.models.length) {
      state.models = data.models.map((m) => ({
        id: String(m.id),
        label: String(m.label || m.id),
        cost: Number(m.cost || 1)
      }));
    }
    if (Array.isArray(data.aspectRatios) && data.aspectRatios.length) {
      state.aspectRatios = data.aspectRatios.map((a) => ({
        value: String(a.value),
        label: String(a.label || a.value)
      }));
    }
    if (Array.isArray(data.imageSizes) && data.imageSizes.length) {
      state.imageSizes = data.imageSizes.map((s) => ({
        value: String(s.value),
        label: String(s.label || s.value)
      }));
    }
    // Preserve user's persisted selections when they are valid.
    const availableModels = new Set(state.models.map((m) => m.id));
    const availableRatios = new Set(state.aspectRatios.map((a) => a.value));
    const availableSizes = new Set(state.imageSizes.map((s) => s.value));

    if (!availableModels.has(state.selectedModel) && data.defaults?.model) {
      state.selectedModel = String(data.defaults.model);
    }
    if (!availableRatios.has(state.selectedAspectRatio) && data.defaults?.aspectRatio) {
      state.selectedAspectRatio = String(data.defaults.aspectRatio);
    }
    if (!availableSizes.has(state.selectedImageSize) && data.defaults?.imageSize) {
      state.selectedImageSize = String(data.defaults.imageSize);
    }
  } catch {
    // Silent fallback to defaults.
  }
}

async function checkAuth() {
  try {
    const data = await api("/api/me");
    state.user = data.user || null;
    state.credits = Number(data.credits || 0);
    state.error = "";
  } catch (err) {
    state.user = null;
    state.credits = 0;
    if (err.status !== 401) {
      state.error = normalizeUiError(err, "Не удалось проверить авторизацию");
    }
  }
}

async function refreshAuthSilently() {
  const prevUserId = state.user?.id || null;
  const prevCredits = Number(state.credits || 0);
  await refreshAccessTokenFromSupabase();
  await checkAuth();

  const currentUserId = state.user?.id || null;
  const currentCredits = Number(state.credits || 0);
  if (prevUserId !== currentUserId || prevCredits !== currentCredits) {
    render();
    await persistState();
  }
  /* Blob previews lost after unload; fill signed URLs for persisted paths. */
  if (state.user && accessTokenRef && (userPhotosNeedSignedPreviews() || referencePhotoNeedSignedPreview())) {
    refreshPersistedPhotoPreviews();
  }
}

function toAbsoluteTelegramDeepLink(url) {
  const u = String(url || "").trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u) || u.startsWith("tg:")) return u;
  // Server returned bare "BotName?start=..." — relative URLs break inside extension sidepanel
  if (/^[A-Za-z0-9_]+\?/.test(u)) {
    return `https://t.me/${u}`;
  }
  return u;
}

async function openBuyCredits() {
  try {
    const data = await api("/api/buy-credits-link", { method: "POST" });
    if (!data?.deepLink) {
      throw new Error("Ссылка для оплаты не получена");
    }
    window.open(toAbsoluteTelegramDeepLink(data.deepLink), "_blank");
    startCreditPolling();
  } catch (err) {
    const message = normalizeUiError(err, "Не удалось получить ссылку на оплату");
    state.error = message;
    setToast("error", message);
    render();
  }
}

function startCreditPolling() {
  stopCreditPolling();
  const initialCredits = Number(state.credits || 0);
  let polls = 0;
  state.waitingForPayment = true;
  state.info = t("payment_wait");
  render();

  creditPollTimer = setInterval(async () => {
    polls += 1;
    await checkAuth();

    if (Number(state.credits || 0) > initialCredits) {
      const delta = Number(state.credits || 0) - initialCredits;
      stopCreditPolling();
      state.waitingForPayment = false;
      state.info = "";
      setToast("success", `${t("credits_added")}: ${delta}`);
      await persistState();
      render();
      return;
    }

    if (polls >= CREDIT_POLL_MAX) {
      stopCreditPolling();
      state.waitingForPayment = false;
      state.info = t("payment_timeout");
      render();
      return;
    }

    render();
  }, CREDIT_POLL_INTERVAL);
}

async function uploadUserPhotoFile(file) {
  if (state.userPhotos.length >= MAX_USER_PHOTOS) {
    return;
  }
  const form = new FormData();
  form.append("file", file);
  const data = await api("/api/upload-generation-photo", { method: "POST", body: form });
  state.userPhotos.push({
    storagePath: data.storagePath,
    fileName: file.name,
    previewObjectUrl: URL.createObjectURL(file),
    signedPreviewUrl: "",
    signedForPath: "",
    signedPreviewSavedAt: 0,
    uploading: false
  });
  const last = state.userPhotos[state.userPhotos.length - 1];
  await applySignedPreviewToItem(last);
  await persistState();
}

async function uploadReferencePhotoFile(file) {
  const form = new FormData();
  form.append("file", file);
  const data = await api("/api/upload-generation-photo", { method: "POST", body: form });
  clearReferenceUpload();
  clearUrlReference();
  state.referencePhoto = {
    storagePath: data.storagePath,
    fileName: file.name,
    previewObjectUrl: URL.createObjectURL(file),
    signedPreviewUrl: "",
    signedForPath: "",
    signedPreviewSavedAt: 0,
    previewBust: Date.now(),
    uploading: false
  };
  await applySignedPreviewToItem(state.referencePhoto);
  await persistState();
}

async function resolveExtractImageUrl() {
  if (state.referencePhoto?.storagePath) {
    const q = encodeURIComponent(state.referencePhoto.storagePath);
    const data = await api(`/api/upload-generation-photo/signed-url?path=${q}`);
    const url = data?.signedUrl;
    if (typeof url !== "string" || !url.startsWith("http")) {
      throw new Error("Не удалось получить ссылку на референс для extract");
    }
    return url;
  }
  return state.sourceImageUrl;
}

async function runExtract() {
  const imageUrl = await resolveExtractImageUrl();
  const extractBody = { imageUrl };
  const et = normalizePersistedExtractTemperature(state.extractTemperature);
  if (et !== null) {
    extractBody.extractTemperature = et;
  }
  const extractData = await api("/api/vibe/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(extractBody)
  });
  state.vibeId = extractData.vibeId;
  state.style = extractData.style;
  state.extractModel = String(extractData.modelUsed || "");
  state.mergedForSingleGeneration = "";
  state.finalPromptForGeneration = "";
  state.finalPromptAssumesTwoImages = false;
  await persistState();
}

async function runExpand() {
  state.finalPromptForGeneration = "";
  state.finalPromptAssumesTwoImages = false;
  state.vibeGroomingControlsAvailable = false;
  state.mergedForSingleGeneration = "";
  const expandData = await api("/api/vibe/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vibeId: state.vibeId,
      style: state.style,
      groomingPolicy: {
        applyHair: state.groomingPolicy.applyHair,
        applyMakeup: state.groomingPolicy.applyMakeup
      }
    })
  });
  state.prompts = Array.isArray(expandData.prompts) ? expandData.prompts : [];
  state.mergedForSingleGeneration = String(expandData.mergedPrompt || "").trim();
  state.expandModel = String(expandData.modelUsed || "");
  state.finalPromptForGeneration = String(expandData.finalPromptForGeneration || "").trim();
  state.finalPromptAssumesTwoImages = Boolean(expandData.finalPromptAssumesTwoImages);
  state.vibeGroomingControlsAvailable = Boolean(expandData.vibeGroomingControlsAvailable);
  await persistState();
}

async function runAssemblePromptNow() {
  if (!state.vibeId || !state.vibeGroomingControlsAvailable) return;
  const data = await api("/api/vibe/assemble-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vibeId: state.vibeId,
      groomingPolicy: {
        applyHair: state.groomingPolicy.applyHair,
        applyMakeup: state.groomingPolicy.applyMakeup
      }
    })
  });
  state.prompts = Array.isArray(data.prompts) ? data.prompts : state.prompts;
  state.finalPromptForGeneration = String(data.finalPromptForGeneration || "").trim();
  state.finalPromptAssumesTwoImages = Boolean(data.finalPromptAssumesTwoImages);
  await persistState();
}

function scheduleAssemblePrompt() {
  if (!state.vibeId) return;
  clearTimeout(assembleDebounceTimer);
  assembleDebounceTimer = setTimeout(async () => {
    assembleDebounceTimer = null;
    if (state.generating) return;
    try {
      if (state.vibeGroomingControlsAvailable) {
        await runAssemblePromptNow();
      } else {
        await runExpand();
      }
      render();
    } catch (err) {
      setToast("error", normalizeUiError(err, state.vibeGroomingControlsAvailable ? "assemble" : "expand"));
    }
  }, 280);
}

async function createGeneration(promptVariant) {
  const data = await api("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: promptVariant.prompt,
      model: state.selectedModel,
      aspectRatio: state.selectedAspectRatio,
      imageSize: state.selectedImageSize,
      vibeId: state.vibeId,
      cardId: state.landingCardId || null,
      photoStoragePaths: userPhotoStoragePaths()
    })
  });
  return String(data.id);
}

async function pollOne(id, onTick) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const data = await api(`/api/generations/${id}`);
    const elapsedMs = Date.now() - startedAt;
    if (typeof onTick === "function") {
      onTick({ data, elapsedMs });
    }
    if (data.status === "completed") return data;
    if (data.status === "failed") {
      throw new Error(data.errorMessage || "Генерация завершилась ошибкой");
    }
    await sleep(getAdaptivePollIntervalMs(elapsedMs));
  }
  throw new Error("Таймаут генерации");
}

async function runRowPipeline(row) {
  row.attempt = Number(row.attempt || 0) + 1;
  row.status = "creating";
  row.error = "";
  row.resultUrl = "";
  row.progress = 5;
  render();
  await persistState();

  try {
    row.id = await createGeneration(row);
    row.status = "processing";
    row.progress = 40;
    row.statusDetail = t("gen_wait");
    render();
    await persistState();

    let lastProgress = row.progress;
    let lastPersistAt = Date.now();
    const poll = await pollOne(row.id, ({ data, elapsedMs }) => {
      const mappedProgress =
        data.status === "pending" ? 45 : data.status === "processing" ? 70 : data.status === "completed" ? 100 : 40;
      row.progress = Math.max(row.progress, mappedProgress);
      row.statusDetail =
        elapsedMs >= LONG_RUNNING_MS
          ? `${t("gen_slow")} (${Math.ceil(elapsedMs / 1000)}s)`
          : `${t("gen_wait")} ${Math.ceil(elapsedMs / 1000)}s`;

      const now = Date.now();
      const shouldRender = row.progress !== lastProgress || now - lastPersistAt > 7000;
      if (shouldRender) {
        lastProgress = row.progress;
        lastPersistAt = now;
        render();
      }
    });
    row.status = "completed";
    row.progress = 100;
    row.resultUrl = String(poll.resultUrl || "");
    row.error = "";
    row.errorType = "";
    row.statusDetail = t("result_ready");
  } catch (err) {
    row.status = "failed";
    row.progress = 0;
    row.error = normalizeUiError(err, "Неизвестная ошибка");
    row.errorType = classifyErrorType(row.error);
    row.statusDetail = t("gen_failed");
  }

  render();
  await persistState();
}

async function resumeInFlightGenerations() {
  const inFlight = state.results.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      ["creating", "processing"].includes(String(row.status || "")) &&
      typeof row.id === "string" &&
      row.id.trim().length > 0
  );

  const queuedWithoutId = state.results.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      String(row.status || "") === "queued" &&
      (!row.id || !String(row.id).trim())
  );

  if (!inFlight.length && !queuedWithoutId.length) return;

  for (const row of queuedWithoutId) {
    row.status = "failed";
    row.progress = 0;
    row.error = t("session_retry_hint");
    row.errorType = "session_interrupted";
    row.statusDetail = "Ожидает ручного повтора";
  }

  if (!inFlight.length) {
    await persistState();
    render();
    return;
  }

  state.resuming = true;
  state.generating = true;
  state.phase = "processing";
  state.info = t("restore_line");
  state.error = "";
  render();
  await persistState();

  await Promise.all(
    inFlight.map(async (row) => {
      try {
        const poll = await pollOne(row.id, ({ data, elapsedMs }) => {
          const mappedProgress =
            data.status === "pending"
              ? 45
              : data.status === "processing"
                ? 70
                : data.status === "completed"
                  ? 100
                  : 40;
          row.progress = Math.max(Number(row.progress || 0), mappedProgress);
          row.statusDetail =
            elapsedMs >= LONG_RUNNING_MS
              ? `${t("restore_slow")} (${Math.ceil(elapsedMs / 1000)}s)`
              : `${t("restore_wait")} ${Math.ceil(elapsedMs / 1000)}s`;
          render();
        });
        row.status = "completed";
        row.progress = 100;
        row.resultUrl = String(poll.resultUrl || "");
        row.error = "";
        row.errorType = "";
        row.statusDetail = t("result_ready");
      } catch (err) {
        row.status = "failed";
        row.progress = 0;
        row.error = normalizeUiError(err, "Неизвестная ошибка");
        row.errorType = classifyErrorType(row.error);
        row.statusDetail = t("restore_failed");
      }
      await persistState();
      render();
    })
  );

  const completed = state.results.filter((r) => r.status === "completed").length;
  const failed = state.results.filter((r) => r.status === "failed").length;
  state.resuming = false;
  state.generating = false;
  state.phase = "done";
  state.info = `${t("restore_done")}: ${completed}/${inFlight.length || 1}`;
  await persistState();
  setToast("info", `${t("restore_done")}: ${completed}`);
  render();
}

async function appendRunHistory(entry) {
  state.runHistory = [entry, ...(state.runHistory || [])].slice(0, MAX_RUN_HISTORY);
  await persistState();
}

function exportRunHistory() {
  const payload = {
    exportedAt: new Date().toISOString(),
    apiOrigin: rt().getApiOrigin(),
    runs: state.runHistory || []
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `steal-this-vibe-run-history-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function clearRunHistory() {
  state.runHistory = [];
  state.info = t("history_cleared");
  await persistState();
  setToast("success", t("history_cleared"));
  render();
}

async function completeGenerationAfterExpand(runStartedAt) {
  const ta = document.getElementById("stv-gen-prompt-body");
  if (ta && typeof ta.value === "string") {
    applyGenerationPromptBodyFromUi(ta.value);
  }

  const n = getPromptsPerRun();
  const allPrompts = Array.isArray(state.prompts) ? state.prompts : [];

  if (n === 1) {
    const merged = String(state.mergedForSingleGeneration || "").trim();
    if (merged) {
      state.prompts = [{ accent: "scene", prompt: merged }];
    } else {
      state.prompts = allPrompts.slice(0, 1);
    }
    if (state.prompts.length !== 1) {
      state.generating = false;
      state.runStage = "idle";
      state.pipelinePrepPercent = 0;
      throw new Error(t("err_expand"));
    }
  } else {
    state.prompts = allPrompts;
    if (state.prompts.length !== 3) {
      state.generating = false;
      state.runStage = "idle";
      state.pipelinePrepPercent = 0;
      throw new Error(t("err_expand_three"));
    }
  }

  state.results = state.prompts.map((p) => ({
    id: "",
    accent: p.accent,
    prompt: p.prompt,
    status: "queued",
    progress: 0,
    resultUrl: "",
    error: "",
    statusDetail: "",
    attempt: 0,
    saving: false
  }));
  state.info = t("run_generate");
  render();
  await persistState();

  if (n === 1) {
    const genRow = state.results[0];
    if (!genRow) {
      state.generating = false;
      state.runStage = "idle";
      state.pipelinePrepPercent = 0;
      throw new Error(t("err_expand"));
    }
    await runRowPipeline(genRow);
  } else {
    await Promise.all(state.results.map((row) => runRowPipeline(row)));
  }

  const completed = state.results.filter((r) => r.status === "completed").length;
  const failed = state.results.filter((r) => r.status === "failed").length;
  const errorTypes = [
    ...new Set(
      state.results
        .filter((r) => r.status === "failed")
        .map((r) => r.errorType || classifyErrorType(r.error || ""))
        .filter(Boolean)
    )
  ];
  state.phase = "done";
  state.generating = false;
  state.runStage = "idle";
  state.pipelinePrepPercent = 0;
  state.awaitingContinueGenerate = false;
  state.pendingRunStartedAt = 0;
  state.info =
    failed === 0 ? t("all_done") : `${t("partial_done")}: ${completed}/${n}`;
  const perAccent = {
    scene: { completed: 0, failed: 0 },
    lighting: { completed: 0, failed: 0 },
    mood: { completed: 0, failed: 0 },
    composition: { completed: 0, failed: 0 }
  };
  for (const row of state.results) {
    const key = String(row.accent || "scene");
    if (!Object.prototype.hasOwnProperty.call(perAccent, key)) continue;
    if (row.status === "completed") perAccent[key].completed += 1;
    if (row.status === "failed") perAccent[key].failed += 1;
  }

  const primaryHistoryRow =
    state.results.find((r) => r.status === "completed" && r.resultUrl) ||
    state.results.find((r) => r.status === "completed") ||
    state.results[0];
  const genId =
    primaryHistoryRow && typeof primaryHistoryRow.id === "string" && primaryHistoryRow.id.trim()
      ? String(primaryHistoryRow.id).trim()
      : null;
  await appendRunHistory({
    id: String(runStartedAt),
    startedAt: runStartedAt,
    finishedAt: Date.now(),
    model: state.selectedModel,
    aspectRatio: state.selectedAspectRatio,
    imageSize: state.selectedImageSize,
    sourceImageUrl: state.sourceImageUrl,
    vibeId: state.vibeId || null,
    completed,
    failed,
    errorTypes,
    perAccent,
    generationId: genId,
    resultUrl:
      primaryHistoryRow && primaryHistoryRow.status === "completed" && primaryHistoryRow.resultUrl
        ? String(primaryHistoryRow.resultUrl)
        : "",
    prompt: primaryHistoryRow && typeof primaryHistoryRow.prompt === "string" ? primaryHistoryRow.prompt : ""
  });
  await refreshAuthSilently();
  if (failed === 0) {
    setToast("success", n === 3 ? t("all_done_triple") : t("all_done"));
  } else {
    setToast("info", `${t("partial_done")} (${failed})`);
  }
  await persistState();
  render();
}

async function generateAll() {
  if (state.generating || state.awaitingContinueGenerate) return;
  if (!hasReference()) throw new Error("Нет source image");
  if (!hasUserPhotos()) throw new Error("Сначала загрузите фото");
  if (getCooldownLeftSeconds() > 0) {
    throw new Error(`Подождите ${getCooldownLeftSeconds()} сек перед новым запуском`);
  }

  const requiredCredits = getRequiredCredits();
  if (state.credits < requiredCredits) {
    throw new Error(`Недостаточно кредитов: нужно ${requiredCredits}, доступно ${state.credits}`);
  }

  state.awaitingContinueGenerate = false;
  state.pendingRunStartedAt = 0;
  state.generating = true;
  state.cooldownUntil = Date.now() + GENERATION_COOLDOWN_MS;
  const runStartedAt = Date.now();
  state.phase = "processing";
  state.error = "";
  state.pipelinePrepPercent = 6;
  state.runStage = "extract";
  state.info = t("run_extract");
  render();

  await runExtract();
  state.pipelinePrepPercent = 36;
  state.runStage = "expand";
  state.info = t("run_expand_prep");
  render();
  await runExpand();

  if (state.vibeGroomingControlsAvailable) {
    state.pipelinePrepPercent = 72;
    state.runStage = "assemble";
    state.info = t("run_assemble");
    render();
    await runAssemblePromptNow();
  }

  state.pipelinePrepPercent = 100;
  state.runStage = "generate";
  state.info = t("run_generate");
  render();
  await completeGenerationAfterExpand(runStartedAt);
}

async function continueGenerateAfterGrooming() {
  if (!state.awaitingContinueGenerate || state.generating) return;
  const runStartedAt = state.pendingRunStartedAt || Date.now();
  state.awaitingContinueGenerate = false;
  state.pendingRunStartedAt = 0;
  state.generating = true;
  state.phase = "processing";
  state.pipelinePrepPercent = 100;
  state.runStage = "generate";
  state.error = "";
  state.info = t("run_generate");
  render();
  await persistState();
  try {
    await completeGenerationAfterExpand(runStartedAt);
  } catch (err) {
    state.generating = false;
    state.phase = "idle";
    throw err;
  }
}

async function retryResultById(id) {
  if (state.generating) return;
  const row = state.results.find((r) => r.id === id || `${r.accent}:${r.attempt}` === id);
  if (!row) return;
  const ta = document.getElementById("stv-gen-prompt-body");
  if (ta && typeof ta.value === "string") {
    applyGenerationPromptBodyFromUi(ta.value);
    const body = String(state.mergedForSingleGeneration || "").trim();
    if (body) row.prompt = body;
  }
  if (!hasUserPhotos()) {
    state.error = "Сначала загрузите фото";
    render();
    return;
  }
  await runRowPipeline(row);
  const completed = state.results.filter((r) => r.status === "completed").length;
  const failed = state.results.filter((r) => r.status === "failed").length;
  const pr = getPromptsPerRun();
  state.info = `${t("done_label")}: ${completed}/${pr}, ${t("errors_label")}: ${failed}/${pr}`;
  await persistState();
  render();
}

async function retryAllFailed() {
  if (state.generating) return;
  const failed = state.results.filter((r) => r.status === "failed");
  if (!failed.length) return;
  state.info = t("retry_line");
  state.error = "";
  render();
  for (const row of failed) {
    await runRowPipeline(row);
  }
  const completed = state.results.filter((r) => r.status === "completed").length;
  const failedAfter = state.results.filter((r) => r.status === "failed").length;
  const pr = getPromptsPerRun();
  state.info = `${t("done_label")}: ${completed}/${pr}, ${t("errors_label")}: ${failedAfter}/${pr}`;
  await refreshAuthSilently();
  await persistState();
  setToast("info", t("all_done"));
  render();
}

async function resetSession() {
  state.phase = "idle";
  state.error = "";
  state.info = t("session_cleared");
  revokeAllUserPhotoObjectUrls();
  clearAllUserPhotoSignedUrls();
  state.userPhotos = [];
  state.userPhotosPreviewLoading = false;
  clearReferenceUpload();
  clearUrlReference();
  state.vibeId = null;
  state.style = null;
  state.extractModel = "";
  state.expandModel = "";
  state.prompts = [];
  state.mergedForSingleGeneration = "";
  state.finalPromptForGeneration = "";
  state.finalPromptAssumesTwoImages = false;
  state.vibeGroomingControlsAvailable = false;
  state.groomingPolicy = { applyHair: true, applyMakeup: true };
  state.awaitingContinueGenerate = false;
  state.pendingRunStartedAt = 0;
  state.results = [];
  await storageLocalRemove(LOCAL_STATE_KEY);
  setToast("info", t("session_cleared"));
  render();
}

async function clearResultsOnly() {
  state.phase = "idle";
  state.error = "";
  state.info = t("results_cleared");
  state.vibeId = null;
  state.style = null;
  state.extractModel = "";
  state.expandModel = "";
  state.prompts = [];
  state.mergedForSingleGeneration = "";
  state.finalPromptForGeneration = "";
  state.finalPromptAssumesTwoImages = false;
  state.vibeGroomingControlsAvailable = false;
  state.groomingPolicy = { applyHair: true, applyMakeup: true };
  state.awaitingContinueGenerate = false;
  state.pendingRunStartedAt = 0;
  state.results = [];
  await persistState();
  setToast("info", t("results_cleared"));
  render();
}

async function saveResultById(id) {
  const row = state.results.find((r) => r.id === id);
  if (!row || row.status !== "completed" || !row.id) return;
  row.saving = true;
  render();
  try {
    const data = await api("/api/vibe/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vibeId: state.vibeId,
        generationId: row.id,
        prompt: row.prompt,
        accent: row.accent
      })
    });

    row.saving = false;
    row.saved = true;
    const autoTagCount = Number(data?.autoTagCount || 0);
    if (data.cardUrl) {
      window.open(data.cardUrl, "_blank");
      if (autoTagCount > 0) {
        setToast("success", `Сохранено: +${autoTagCount} SEO-тегов, карточка открыта`);
      } else {
        setToast("success", "Сохранено и открыта карточка");
      }
    } else {
      if (autoTagCount > 0) {
        state.info = `Сохранено. Определено ${autoTagCount} SEO-тегов, карточка будет опубликована позже.`;
      } else {
        state.info = "Сохранено. Карточка будет опубликована позже.";
      }
      setToast("success", "Сохранено");
    }
    await refreshAuthSilently();
  } catch (err) {
    row.saving = false;
    state.error = normalizeUiError(err, "Ошибка сохранения");
    setToast("error", state.error);
  }
  await persistState();
  render();
}

function renderAuthRequired() {
  const sessionHealth = getSessionHealth();
  app.innerHTML = `
    <div class="stv-shell">
      <header class="stv-topbar">
        <div class="stv-brand">
          <span class="stv-brand-mark" aria-hidden="true">${STV_MARK_STAR_SVG}</span>
          <div class="stv-brand-text">
            <span class="stv-brand-name">PromptShot</span>
            <span class="stv-brand-sub">${escapeHtml(t("brand_sub"))}</span>
          </div>
        </div>
        <div class="stv-topbar-actions">
          <button type="button" class="stv-tool-btn" id="toggle-lang">${escapeHtml(t("lang_toggle"))}</button>
        </div>
      </header>
      <div class="card stv-card-main">
        <p class="muted ${escapeHtml(sessionHealth.className)}">${escapeHtml(t("status"))}: ${escapeHtml(sessionHealth.label)}</p>
        <p class="muted">${escapeHtml(t("auth_hint"))}</p>
        <div class="stv-actions-primary">
          <button type="button" class="primary" id="btn-google">${escapeHtml(t("btn_google"))}</button>
          <button type="button" id="retry-auth">${escapeHtml(t("btn_retry_auth"))}</button>
        </div>
        ${state.error ? `<p class="muted error-text">${escapeHtml(state.error)}</p>` : ""}
      </div>
    </div>
  `;

  const langBtnAuth = document.getElementById("toggle-lang");
  if (langBtnAuth) {
    langBtnAuth.addEventListener("click", () => {
      toggleUiLang();
      render();
    });
  }

  document.getElementById("btn-google").addEventListener("click", () => {
    void startGoogleSignIn();
  });
  document.getElementById("retry-auth").addEventListener("click", async () => {
    state.loading = true;
    render();
    await refreshAccessTokenFromSupabase();
    await checkAuth();
    state.loading = false;
    render();
  });
}

function buildUserPhotosBlockHtml() {
  const n = state.userPhotos.length;
  const atMax = n >= MAX_USER_PHOTOS;
  const fileInput = `<input id="photo-file" class="stv-photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" />`;

  let canvas = "";
  if (n === 0) {
    canvas = `<label class="stv-user-photo-empty" for="photo-file" aria-label="${escapeHtml(t("photo_pick"))}">
        <span class="stv-user-photo-empty-plus" aria-hidden="true">+</span>
      </label>`;
  } else {
    canvas = `<div class="stv-user-photos-grid">${state.userPhotos
      .map((p, i) => {
        const src = p.previewObjectUrl || p.signedPreviewUrl || "";
        let inner;
        if (p.uploading) {
          inner = `<div class="stv-user-photo-thumb-placeholder muted">${escapeHtml(t("uploading_photo"))}</div>`;
        } else if (src) {
          inner = `<img class="stv-user-photo-thumb" src="${escapeHtmlAttrUrl(src)}" alt="" />`;
        } else if (state.userPhotosPreviewLoading) {
          inner = `<div class="stv-user-photo-thumb-placeholder muted">${escapeHtml(t("photo_preview_loading"))}</div>`;
        } else {
          inner = `<div class="stv-user-photo-thumb-placeholder muted"><span class="photo-saved" aria-hidden="true">✓</span></div>`;
        }
        return `<div class="stv-user-photo-cell">
          ${inner}
          <button type="button" class="stv-user-photo-remove" data-remove-photo="${String(i)}" aria-label="${escapeHtml(t("photo_remove_aria"))}">×</button>
        </div>`;
      })
      .join("")}</div>`;
  }

  const addOverlay =
    n > 0 && !atMax
      ? `<div class="stv-user-photos-overlay-bottom">
          <div class="stv-result-actions">
            <label for="photo-file" class="stv-overlay-pill-btn">${escapeHtml(t("photo_add_overlay"))}</label>
          </div>
        </div>`
      : "";

  return `<div class="stv-user-photos-block">
      <div class="stv-user-photos-canvas">${canvas}</div>
      ${addOverlay}
      ${fileInput}
    </div>`;
}

function buildReferenceFrameHtml() {
  const refFileInput = `<input id="reference-photo-file" class="stv-reference-file-input" type="file" accept="image/jpeg,image/png,image/webp" />`;
  if (!hasReference()) {
    return `${refFileInput}
      <div class="stv-reference-frame-inner stv-reference-frame-inner--empty">
        <label class="stv-reference-empty-plus-wrap" for="reference-photo-file" aria-label="${escapeHtml(t("reference_pick_aria"))}">
          <span class="stv-user-photo-empty-plus" aria-hidden="true">+</span>
        </label>
        <p class="muted stv-reference-empty-hint">${escapeHtml(t("reference_empty_hint"))}</p>
      </div>`;
  }
  const src = referenceImageSrcForUi();
  const rp = state.referencePhoto;
  const loadingUpload =
    rp?.storagePath &&
    !rp.previewObjectUrl &&
    (!rp.signedPreviewUrl || state.referencePhotoPreviewLoading);
  let main;
  if (loadingUpload) {
    main = `<div class="stv-compare-placeholder muted">${escapeHtml(t("photo_preview_loading"))}</div>`;
  } else if (src) {
    main = `<img class="stv-compare-img" src="${escapeHtmlAttrUrl(src)}" alt="" />`;
  } else {
    main = `<div class="stv-compare-placeholder muted">${escapeHtml(t("photo_preview_loading"))}</div>`;
  }
  return `${refFileInput}
    <div class="stv-reference-frame-inner stv-reference-frame-inner--filled">
      ${main}
      <button type="button" class="stv-user-photo-remove" data-remove-reference="1" aria-label="${escapeHtml(t("reference_remove_aria"))}">×</button>
    </div>`;
}

function renderMain() {
  const requiredCredits = getRequiredCredits();
  const promptsPerRunUi = getPromptsPerRun();
  const cooldownLeftSec = getCooldownLeftSeconds();
  const canGenerate = Boolean(
    hasReference() &&
      hasUserPhotos() &&
      !state.generating &&
      !state.awaitingContinueGenerate &&
      state.credits >= requiredCredits &&
      cooldownLeftSec === 0
  );
  const completedCount = state.results.filter((r) => r.status === "completed").length;
  const failedCount = state.results.filter((r) => r.status === "failed").length;
  const needsCredits = state.credits < requiredCredits;
  const sessionHealth = getSessionHealth();
  const overallProgress = getOverallProgressPercent();
  const showFirstRunHint =
    !hasReference() && (!Array.isArray(state.runHistory) || state.runHistory.length === 0);

  const hasUserPhoto = hasUserPhotos();
  const userPhotosInner = buildUserPhotosBlockHtml();

  const referenceFrame = buildReferenceFrameHtml();

  const resultsCompareColumnHtml = state.results.length
    ? `<div class="stv-result-column">${state.results.map((row) => buildResultCompactRowHtml(row)).join("")}</div>`
    : `<div class="stv-result-column stv-result-column--empty">
        <div class="stv-photo-frame stv-result-placeholder-frame">
          <div class="stv-compare-placeholder muted">${escapeHtml(t("compare_result_empty"))}</div>
        </div>
      </div>`;

  const showCompareProgress = shouldShowCompareProgressBar();
  const compareProgressHtml = showCompareProgress
    ? `
          <div class="stv-compare-progress">
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${escapeHtml(String(overallProgress))}%"></div>
            </div>
            <p class="muted">${escapeHtml(t("progress_total"))}: ${escapeHtml(String(overallProgress))}%</p>
          </div>`
    : "";

  const runCount = Array.isArray(state.runHistory) ? state.runHistory.length : 0;
  const runHistoryHtml =
    runCount > 0
      ? `
      <div class="card stv-card-history">
        <div class="stv-history-toolbar">
          <p class="title stv-history-title">${escapeHtml(t("history_title"))}</p>
          <p class="muted stv-history-count">${escapeHtml(t("history_count_prefix"))} ${escapeHtml(String(runCount))}</p>
        </div>
        <div class="row stv-history-toolbar-actions">
          <button type="button" id="export-history">${escapeHtml(t("history_export"))}</button>
          <button type="button" id="clear-history">${escapeHtml(t("history_clear"))}</button>
        </div>
        <div class="stv-history-list" id="stv-history-list">
          ${state.runHistory.map((run, idx) => buildRunHistoryCardHtml(run, idx)).join("")}
        </div>
      </div>
    `
      : "";

  const finalPromptHint =
    state.finalPromptAssumesTwoImages === true ? t("final_prompt_hint_two") : t("final_prompt_hint_one");
  const assembledPreviewBlock =
    String(state.finalPromptForGeneration || "").trim().length > 0
      ? `<details class="stv-disclosure stv-disclosure--assembled-preview">
          <summary>${escapeHtml(t("final_prompt_preview_summary"))}</summary>
          <pre class="prompt-box stv-assembled-prompt-preview">${escapeHtml(state.finalPromptForGeneration)}</pre>
        </details>`
      : "";
  const finalPromptBody = `<textarea id="stv-gen-prompt-body" class="prompt-box prompt-box--final-prompt" rows="14" spellcheck="false" autocomplete="off" aria-label="${escapeHtml(t("gen_prompt_label"))}" placeholder="${escapeHtml(t("final_prompt_empty"))}"></textarea>
          <p class="muted stv-prompt-edit-hint">${escapeHtml(t("prompt_body_editable_hint"))}</p>
          ${assembledPreviewBlock}`;

  /**
   * Hair / makeup: always visible; user can set preferences anytime. Server assemble runs only after
   * reference extract+expand when vibeGroomingControlsAvailable (see scheduleAssemblePrompt).
   */
  const groomingHintKey = !state.vibeGroomingControlsAvailable
    ? "grooming_unlock_hint"
    : state.awaitingContinueGenerate
      ? "grooming_adjust_hint"
      : "grooming_ready_hint";
  const groomingMainSectionHtml = `<div class="stv-grooming-block stv-grooming-block--main">
          <p class="stv-subtitle">${escapeHtml(t("grooming_title"))}</p>
          <p class="muted stv-grooming-hint">${escapeHtml(t(groomingHintKey))}</p>
          <label class="stv-check stv-grooming-check">
            <input type="checkbox" id="grooming-hair" ${state.groomingPolicy.applyHair ? "checked" : ""} />
            <span>${escapeHtml(t("grooming_hair"))}</span>
          </label>
          <label class="stv-check stv-grooming-check">
            <input type="checkbox" id="grooming-makeup" ${state.groomingPolicy.applyMakeup ? "checked" : ""} />
            <span>${escapeHtml(t("grooming_makeup"))}</span>
          </label>
          ${
            state.awaitingContinueGenerate
              ? `<div class="stv-grooming-continue">
            <button type="button" class="primary" id="btn-continue-generate">${escapeHtml(t("btn_continue_generate"))}</button>
          </div>`
              : ""
          }
        </div>`;

  const pipelinePanelHtml =
    state.style && typeof state.style === "object"
      ? `<div class="card stv-card-side">
          <p class="title">${escapeHtml(t("step1_title"))}</p>
          <p class="muted">${escapeHtml(t("step1_model"))}: <code>${escapeHtml(state.extractModel || "—")}</code></p>
          <p class="muted">${escapeHtml(t("step2_model"))}: <code>${escapeHtml(state.expandModel || "—")}</code></p>
          <pre class="prompt-box">${escapeHtml(JSON.stringify(state.style, null, 2))}</pre>
          <p class="stv-subtitle">${escapeHtml(t("step1_final_prompt_title"))}</p>
          <p class="muted">${escapeHtml(finalPromptHint)}</p>
          ${finalPromptBody}
          <div class="row" style="margin-top:8px">
            <button type="button" id="pipeline-spec-btn">${escapeHtml(t("btn_pipeline_spec"))}</button>
          </div>
          <pre id="pipeline-spec-out" class="prompt-box" style="display:none; margin-top:8px; max-height:240px;"></pre>
        </div>`
      : "";

  app.innerHTML = `
    <div class="stv-shell">
      <header class="stv-topbar">
        <div class="stv-brand">
          <span class="stv-brand-mark" aria-hidden="true">${STV_MARK_STAR_SVG}</span>
          <div class="stv-brand-text">
            <span class="stv-brand-name">PromptShot</span>
            <span class="stv-brand-sub">${escapeHtml(t("brand_sub"))}</span>
          </div>
        </div>
        <div class="stv-topbar-actions">
          <button type="button" class="stv-tool-btn" id="toggle-lang">${escapeHtml(t("lang_toggle"))}</button>
          <button type="button" class="stv-tool-btn" id="sign-out">${escapeHtml(t("btn_sign_out"))}</button>
        </div>
      </header>

      <div class="card stv-card-main">
        ${
          state.toast
            ? `<div class="toast toast-${escapeHtml(state.toast.type)}">${escapeHtml(state.toast.message)}</div>`
            : ""
        }

        <div class="stv-meta-strip">
          <div class="stv-meta-credits">${escapeHtml(t("credits"))}: ${escapeHtml(String(state.credits))} <span>· ${escapeHtml(t("cost_run"))} ${escapeHtml(String(requiredCredits))} ${escapeHtml(t("credit_word"))}</span></div>
          <div class="stv-meta-row ${escapeHtml(sessionHealth.className)}">${escapeHtml(t("status"))}: ${escapeHtml(sessionHealth.label)}</div>
          <div class="stv-meta-row">${escapeHtml(t("user"))}: ${escapeHtml(state.user.email || state.user.id || "—")}</div>
          ${
            needsCredits
              ? `<div class="stv-meta-row error-text">${escapeHtml(t("insufficient_credits"))}: ${escapeHtml(String(requiredCredits))} / ${escapeHtml(String(state.credits))}</div>`
              : ""
          }
        </div>

        <section class="stv-section">
          <div class="stv-section-head">
            <span class="stv-step" aria-hidden="true">1</span>
            <h2 class="stv-section-title">${escapeHtml(t("section_photos_compare"))}</h2>
          </div>
          <div class="stv-compare-grid">
            <div class="stv-compare-col">
              <span class="stv-field-label">${escapeHtml(t("compare_col_your_photo"))}</span>
              <div class="stv-photo-frame stv-photo-frame--user stv-photo-frame--user-multi${hasUserPhoto ? " has-user-photos" : ""}">
                <div class="stv-photo-frame-content stv-photo-frame-content--multi">${userPhotosInner}</div>
              </div>
            </div>
            <div class="stv-compare-col">
              <span class="stv-field-label">${escapeHtml(t("compare_col_reference"))}</span>
              <div class="stv-photo-frame stv-photo-frame--reference">${referenceFrame}</div>
            </div>
            <div class="stv-compare-col stv-compare-col--result">
              <span class="stv-field-label">${escapeHtml(t("compare_col_result"))}</span>
              ${resultsCompareColumnHtml}
            </div>
          </div>
          ${groomingMainSectionHtml}
          ${compareProgressHtml}
          <div class="stv-actions-primary stv-actions-under-photos">
            <button type="button" id="run-generate" class="primary" ${canGenerate ? "" : "disabled"}>
              ${escapeHtml(primaryGenerateButtonLabel())}
            </button>
            <button type="button" id="buy-credits" class="${needsCredits ? "primary" : ""}" ${needsCredits && !state.generating ? "" : "disabled"}>
              ${state.waitingForPayment ? escapeHtml(t("btn_waiting_payment")) : escapeHtml(t("btn_buy_credits"))}
            </button>
          </div>
          ${
            cooldownLeftSec > 0
              ? `<p class="muted">${escapeHtml(t("cooldown"))}: ${escapeHtml(String(cooldownLeftSec))} ${escapeHtml(t("cooldown_sec"))}</p>`
              : ""
          }
          ${
            showFirstRunHint
              ? `<p class="muted stv-compare-hint">${escapeHtml(t("first_run_hint"))}</p>`
              : ""
          }
        </section>

        <section class="stv-section">
          <div class="stv-section-head">
            <span class="stv-step" aria-hidden="true">2</span>
            <h2 class="stv-section-title">${escapeHtml(t("section_settings"))}</h2>
          </div>
          <div class="stv-fields">
            <label class="stv-field" for="model">
              <span class="stv-field-label">${escapeHtml(t("field_model"))}</span>
              <select id="model">
                ${state.models
                  .map(
                    (m) =>
                      `<option value="${escapeHtml(m.id)}">${escapeHtml(
                        `${m.label} (${m.cost})`
                      )}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label class="stv-field" for="aspect-ratio">
              <span class="stv-field-label">${escapeHtml(t("field_ratio"))}</span>
              <select id="aspect-ratio">
                ${state.aspectRatios
                  .map((a) => `<option value="${escapeHtml(a.value)}">${escapeHtml(a.label)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="stv-field" for="image-size">
              <span class="stv-field-label">${escapeHtml(t("field_size"))}</span>
              <select id="image-size">
                ${state.imageSizes
                  .map((s) => `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="stv-field" for="extract-temperature">
              <span class="stv-field-label">${escapeHtml(t("field_extract_temperature"))}</span>
              <select id="extract-temperature">
                <option value="" ${extractTemperatureSelectValue(state.extractTemperature) === "" ? "selected" : ""}>${escapeHtml(t("extract_temp_default"))}</option>
                <option value="0.1" ${extractTemperatureSelectValue(state.extractTemperature) === "0.1" ? "selected" : ""}>${escapeHtml(t("extract_temp_01"))}</option>
                <option value="0.3" ${extractTemperatureSelectValue(state.extractTemperature) === "0.3" ? "selected" : ""}>${escapeHtml(t("extract_temp_03"))}</option>
                <option value="0.6" ${extractTemperatureSelectValue(state.extractTemperature) === "0.6" ? "selected" : ""}>${escapeHtml(t("extract_temp_06"))}</option>
                <option value="0.9" ${extractTemperatureSelectValue(state.extractTemperature) === "0.9" ? "selected" : ""}>${escapeHtml(t("extract_temp_09"))}</option>
                <option value="1" ${extractTemperatureSelectValue(state.extractTemperature) === "1" ? "selected" : ""}>${escapeHtml(t("extract_temp_10"))}</option>
              </select>
              <span class="muted stv-field-hint">${escapeHtml(t("field_extract_temperature_hint"))}</span>
            </label>
          </div>
        </section>

        <p class="muted">${escapeHtml(t("done_label"))}: ${completedCount}/${promptsPerRunUi}, ${escapeHtml(t("errors_label"))}: ${failedCount}/${promptsPerRunUi}</p>
        ${state.info ? `<p class="muted">${escapeHtml(state.info)}</p>` : ""}
        ${state.error ? `<p class="muted error-text">${escapeHtml(state.error)}</p>` : ""}

        <details class="stv-disclosure">
          <summary>${escapeHtml(t("more_actions"))}</summary>
          <div class="stv-disclosure-body">
            <div class="row">
              <button type="button" id="retry-all" ${failedCount > 0 && !state.generating ? "" : "disabled"}>
                ${escapeHtml(t("btn_retry_all"))}
              </button>
              <button type="button" id="clear-results" ${state.generating ? "disabled" : ""}>
                ${escapeHtml(t("btn_clear_results"))}
              </button>
              <button type="button" id="reset-session" ${state.generating ? "disabled" : ""}>
                ${escapeHtml(t("btn_reset_session"))}
              </button>
            </div>
          </div>
        </details>

        <details class="stv-disclosure stv-disclosure--dev">
          <summary>${escapeHtml(t("dev_details"))}</summary>
          <div class="stv-disclosure-body">
            <p class="muted"><code>${escapeHtml(t("api"))}</code> ${escapeHtml(rt().getApiOrigin())}</p>
            <p class="muted">${escapeHtml(t("dev_doc_hint"))}</p>
            <label class="muted stv-dev-flag-label">
              <input type="checkbox" id="stv-dev-triple-flow" ${isTripleVariantFlowEnabled() ? "checked" : ""} />
              <span>${escapeHtml(t("dev_flag_triple_label"))}</span>
            </label>
            <p class="muted stv-dev-flag-hint">${escapeHtml(t("dev_flag_triple_hint"))}</p>
          </div>
        </details>
      </div>
      ${pipelinePanelHtml}
      ${runHistoryHtml}
    </div>
  `;

  const tripleFlowCb = document.getElementById("stv-dev-triple-flow");
  if (tripleFlowCb) {
    tripleFlowCb.addEventListener("change", () => {
      try {
        if (tripleFlowCb.checked) {
          localStorage.setItem(TRIPLE_VARIANT_FLOW_LS_KEY, "1");
        } else {
          localStorage.removeItem(TRIPLE_VARIANT_FLOW_LS_KEY);
        }
      } catch {
        /* ignore */
      }
      render();
    });
  }

  const promptBodyTa = document.getElementById("stv-gen-prompt-body");
  if (promptBodyTa) {
    if (document.activeElement !== promptBodyTa) {
      promptBodyTa.value = getGenerationPromptBodyForUi();
    }
    promptBodyTa.addEventListener("input", () => {
      applyGenerationPromptBodyFromUi(promptBodyTa.value);
      clearTimeout(promptBodyPersistTimer);
      promptBodyPersistTimer = setTimeout(() => {
        promptBodyPersistTimer = null;
        void persistState();
      }, 400);
    });
  }

  const pipelineSpecBtn = document.getElementById("pipeline-spec-btn");
  if (pipelineSpecBtn) {
    pipelineSpecBtn.addEventListener("click", async () => {
      try {
        const d = await api("/api/vibe/pipeline-spec");
        const out = document.getElementById("pipeline-spec-out");
        if (out) {
          out.style.display = "block";
          out.textContent = JSON.stringify(d, null, 2);
        }
      } catch (err) {
        setToast("error", normalizeUiError(err, "pipeline-spec"));
      }
    });
  }

  const groomingHair = document.getElementById("grooming-hair");
  if (groomingHair) {
    groomingHair.addEventListener("change", async () => {
      state.groomingPolicy.applyHair = groomingHair.checked;
      await persistState();
      scheduleAssemblePrompt();
    });
  }
  const groomingMakeup = document.getElementById("grooming-makeup");
  if (groomingMakeup) {
    groomingMakeup.addEventListener("change", async () => {
      state.groomingPolicy.applyMakeup = groomingMakeup.checked;
      await persistState();
      scheduleAssemblePrompt();
    });
  }
  const continueGenBtn = document.getElementById("btn-continue-generate");
  if (continueGenBtn) {
    continueGenBtn.addEventListener("click", async () => {
      try {
        state.error = "";
        await continueGenerateAfterGrooming();
      } catch (err) {
        state.generating = false;
        state.runStage = "idle";
        state.pipelinePrepPercent = 0;
        state.phase = "idle";
        state.error = normalizeUiError(err, "Ошибка генерации");
        setToast("error", state.error);
        render();
        await persistState();
      }
    });
  }

  const signOutBtn = document.getElementById("sign-out");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      void signOutExtension();
    });
  }
  const langBtn = document.getElementById("toggle-lang");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      toggleUiLang();
      render();
    });
  }

  const modelEl = document.getElementById("model");
  modelEl.value = state.selectedModel;
  modelEl.addEventListener("change", async (e) => {
    state.selectedModel = e.target.value;
    await persistState();
    render();
  });

  const arEl = document.getElementById("aspect-ratio");
  arEl.value = state.selectedAspectRatio;
  arEl.addEventListener("change", async (e) => {
    state.selectedAspectRatio = e.target.value;
    await persistState();
  });

  const szEl = document.getElementById("image-size");
  szEl.value = state.selectedImageSize;
  szEl.addEventListener("change", async (e) => {
    state.selectedImageSize = e.target.value;
    await persistState();
  });

  const extractTempEl = document.getElementById("extract-temperature");
  if (extractTempEl) {
    extractTempEl.value = extractTemperatureSelectValue(state.extractTemperature);
    extractTempEl.addEventListener("change", async (e) => {
      const raw = String(e.target.value || "").trim();
      state.extractTemperature = raw === "" ? null : normalizePersistedExtractTemperature(Number(raw));
      await persistState();
    });
  }

  const photoFileInput = document.getElementById("photo-file");
  if (photoFileInput) {
    photoFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (state.userPhotos.length >= MAX_USER_PHOTOS) {
        setToast("info", t("photo_max_reached"));
        render();
        return;
      }
      try {
        state.error = "";
        state.info = t("uploading_photo");
        render();
        await uploadUserPhotoFile(file);
        state.info = t("photo_uploaded");
        setToast("success", state.userPhotos.length > 1 ? t("photo_added") : t("photo_uploaded"));
        render();
      } catch (err) {
        state.error = normalizeUiError(err, "Ошибка загрузки фото");
        setToast("error", state.error);
        render();
      }
    });
  }

  const referenceFileInput = document.getElementById("reference-photo-file");
  if (referenceFileInput) {
    referenceFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        state.error = "";
        state.info = t("uploading_photo");
        render();
        await uploadReferencePhotoFile(file);
        state.info = t("reference_uploaded");
        setToast("success", t("reference_uploaded"));
        render();
      } catch (err) {
        state.error = normalizeUiError(err, "Ошибка загрузки референса");
        setToast("error", state.error);
        render();
      }
    });
  }

  app.querySelectorAll("[data-remove-reference]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      removeReference();
      await persistState();
      render();
    });
  });

  app.querySelectorAll("[data-remove-photo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const raw = btn.getAttribute("data-remove-photo");
      const idx = Number(raw);
      if (!Number.isFinite(idx) || idx < 0) return;
      removeUserPhotoAt(idx);
      await persistState();
      render();
    });
  });

  document.getElementById("run-generate").addEventListener("click", async () => {
    try {
      state.error = "";
      await generateAll();
    } catch (err) {
      state.generating = false;
      state.runStage = "idle";
      state.pipelinePrepPercent = 0;
      state.phase = "idle";
      state.error = normalizeUiError(err, "Ошибка генерации");
      setToast("error", state.error);
      render();
      await persistState();
    }
  });

  const buyCreditsBtn = document.getElementById("buy-credits");
  if (buyCreditsBtn) {
    buyCreditsBtn.addEventListener("click", async () => {
      await openBuyCredits();
    });
  }

  document.getElementById("retry-all").addEventListener("click", async () => {
    await retryAllFailed();
  });

  document.getElementById("clear-results").addEventListener("click", async () => {
    await clearResultsOnly();
  });

  document.getElementById("reset-session").addEventListener("click", async () => {
    await resetSession();
  });

  app.querySelectorAll("[data-save-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      const id = node.getAttribute("data-save-id");
      if (!id) return;
      await saveResultById(id);
    });
  });

  app.querySelectorAll("[data-retry-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      const id = node.getAttribute("data-retry-id");
      if (!id) return;
      await retryResultById(id);
    });
  });

  const exportBtn = document.getElementById("export-history");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportRunHistory());
  }

  const clearHistoryBtn = document.getElementById("clear-history");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", async () => {
      await clearRunHistory();
    });
  }

  bindRunHistoryActions();
  refreshPersistedPhotoPreviews();
}

function render() {
  if (state.loading) {
    app.innerHTML = `
      <div class="stv-shell">
        <div class="card stv-loading-card">
          <div class="stv-brand-mark" style="margin:0 auto 12px" aria-hidden="true">${STV_MARK_STAR_SVG}</div>
          <p class="title">${escapeHtml(t("title_app"))}</p>
          <p class="muted">${escapeHtml(t("loading"))}</p>
        </div>
      </div>`;
    return;
  }
  if (!state.user) {
    renderAuthRequired();
    return;
  }
  renderMain();
}

async function loadPersistedState() {
  const result = await storageLocalGet(LOCAL_STATE_KEY);
  const saved = result?.[LOCAL_STATE_KEY];
  applyPersistedState(saved);
}

export async function boot() {
  state.loading = true;
  render();

  await loadPersistedState();
  await applyEmbedQueryParams();
  try {
    await initSupabaseAuth();
  } catch (e) {
    console.warn("[stv] initSupabaseAuth:", e);
  }

  rt().platform.runtime.onMessage?.((msg) => {
    if (msg?.type === "STV_PENDING_VIBE" && msg.vibe) {
      void applyPendingVibeFromStorage(msg.vibe);
      return;
    }
    if (msg?.type === "PROMPTSHOT_AUTH_DONE") {
      void (async () => {
        await refreshAccessTokenFromSupabase();
        await checkAuth();
        refreshPersistedPhotoPreviews();
        render();
      })();
    }
  });

  /* When side panel is already open, boot() won't run again — background still writes session.
     onChanged picks up every new "Steal this vibe" click. */
  rt().platform.storage.session.onChanged?.((changes, areaName) => {
    if (areaName !== "session") return;
    const ch = changes[SESSION_VIBE_KEY];
    const next = ch?.newValue;
    if (!next || typeof next.imageUrl !== "string" || !next.imageUrl.startsWith("http")) return;
    void applyPendingVibeFromStorage(next);
  });

  await loadPendingVibe();
  await loadConfig();
  await checkAuth();
  await resumeInFlightGenerations();

  /* Ensure Bearer for signed preview URLs after cold open (storage/session timing). */
  if (supabaseClient && state.user) {
    try {
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (!error && data?.session?.access_token) {
        accessTokenRef = data.session.access_token;
      }
    } catch {
      await refreshAccessTokenFromSupabase();
    }
  }

  state.loading = false;
  /* Await preview fetch before first paint — otherwise thumbnails stay broken after panel reopen. */
  await Promise.all([refreshUserPhotosSignedPreviews(), refreshReferencePhotoSignedPreview()]);
  if (state.user && state.phase === "idle" && !state.generating && !state.resuming) {
    setToast("info", t("toast_ready"), 1800);
  }
  render();

  setInterval(() => {
    if (!state.loading && !state.generating && getCooldownLeftSeconds() > 0) {
      render();
    }
  }, 1000);

  const VIBE_SESSION_POLL_MS = 350;
  setInterval(() => {
    if (document.visibilityState !== "visible" || state.loading) return;
    void tryConsumePendingVibeFromSessionPoll();
  }, VIBE_SESSION_POLL_MS);

  setInterval(() => {
    if (!state.loading) {
      refreshAuthSilently().catch(() => {});
    }
  }, AUTH_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.loading) {
      void (async () => {
        await refreshAuthSilently();
        refreshPersistedPhotoPreviews();
        void tryConsumePendingVibeFromSessionPoll();
      })();
    }
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !state.loading) {
      void (async () => {
        await refreshAuthSilently();
        refreshPersistedPhotoPreviews();
      })();
    }
  });

  /* Reduce losing userPhotos paths if the panel closes before persistState() finishes. */
  window.addEventListener("pagehide", () => {
    void persistState();
  });
}
