import { t, toggleUiLang } from "./i18n.js";
import { createSupabaseForExtension } from "./supabase-extension.js";

const API_ORIGIN = localStorage.getItem("stv_api_origin") || "https://promptshot.ru";

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
  photoStoragePath: "",
  uploadedFileName: "",
  /** In-memory preview after upload (not persisted). */
  photoPreviewObjectUrl: "",
  /** Signed Supabase URL when blob is gone (reload); not persisted. */
  photoPreviewSignedUrl: "",
  /** Path we last resolved `photoPreviewSignedUrl` for (avoid duplicate fetches). */
  photoPreviewSignedForPath: "",
  selectedModel: "gemini-2.5-flash-image",
  selectedAspectRatio: "1:1",
  selectedImageSize: "1K",
  models: [...DEFAULT_MODELS],
  aspectRatios: [...DEFAULT_ASPECT_RATIOS],
  imageSizes: [...DEFAULT_IMAGE_SIZES],
  vibeId: null,
  style: null,
  extractModel: "",
  expandModel: "",
  prompts: [],
  results: [],
  generating: false,
  runHistory: [],
  cooldownUntil: 0,
  toast: null,
  resuming: false,
  waitingForPayment: false
};

let toastTimer = null;
let creditPollTimer = null;

function storageLocalGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result));
  });
}

function storageLocalSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

function storageLocalRemove(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

function storageSessionGet(key) {
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (result) => resolve(result));
  });
}

function storageSessionRemove(key) {
  return new Promise((resolve) => {
    chrome.storage.session.remove(key, resolve);
  });
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

function revokePhotoPreviewObjectUrl() {
  if (state.photoPreviewObjectUrl) {
    try {
      URL.revokeObjectURL(state.photoPreviewObjectUrl);
    } catch {
      /* ignore */
    }
    state.photoPreviewObjectUrl = "";
  }
}

function clearPhotoPreviewSignedUrl() {
  state.photoPreviewSignedUrl = "";
  state.photoPreviewSignedForPath = "";
}

/** Avoid parallel signed-url fetches from repeated renderMain(). */
let userPhotoPreviewRefreshPromise = null;

/**
 * After side panel reload, blob URLs are gone but `photoStoragePath` persists.
 * Fetch a time-limited signed URL so <img> can show the uploaded file.
 */
async function refreshUserPhotoPreviewIfNeeded() {
  if (!state.photoStoragePath || state.photoPreviewObjectUrl) {
    return;
  }
  if (
    state.photoPreviewSignedUrl &&
    state.photoPreviewSignedForPath === state.photoStoragePath
  ) {
    return;
  }
  if (!state.user || !accessTokenRef) {
    return;
  }
  if (userPhotoPreviewRefreshPromise) {
    return userPhotoPreviewRefreshPromise;
  }
  userPhotoPreviewRefreshPromise = (async () => {
    try {
      const q = encodeURIComponent(state.photoStoragePath);
      const data = await api(`/api/upload-generation-photo/signed-url?path=${q}`);
      const url = data?.signedUrl;
      if (typeof url === "string" && url.startsWith("http")) {
        state.photoPreviewSignedUrl = url;
        state.photoPreviewSignedForPath = state.photoStoragePath;
        render();
      }
    } catch (e) {
      console.warn("[stv] user photo signed preview:", e);
    } finally {
      userPhotoPreviewRefreshPromise = null;
    }
  })();
  return userPhotoPreviewRefreshPromise;
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
  return Number(getModelConfig(state.selectedModel).cost || 1);
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
    lighting: t("accent_lighting"),
    mood: t("accent_mood"),
    composition: t("accent_composition")
  };
  return map[String(accent || "").toLowerCase()] || String(accent || "—");
}

function formatErrorTypeLabel(errorType) {
  const map = {
    insufficient_credits: t("insufficient_credits"),
    timeout: "Timeout",
    unauthorized: t("session_bad"),
    network: "Network",
    validation_error: "Validation",
    session_interrupted: "Session",
    generation_failed: t("status_failed"),
    unknown: "Unknown"
  };
  return map[String(errorType || "").toLowerCase()] || String(errorType || "—");
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

function getHistoryStats() {
  const runs = Array.isArray(state.runHistory) ? state.runHistory : [];
  if (!runs.length) {
    return {
      totalRuns: 0,
      totalCompleted: 0,
      totalFailed: 0,
      avgSuccessPercent: 0,
      lastErrorType: "—"
    };
  }

  const totalCompleted = runs.reduce((sum, r) => sum + Number(r.completed || 0), 0);
  const totalFailed = runs.reduce((sum, r) => sum + Number(r.failed || 0), 0);
  const totalAttempts = totalCompleted + totalFailed;
  const avgSuccessPercent = totalAttempts > 0 ? Math.round((totalCompleted / totalAttempts) * 100) : 0;
  const lastFailedRun = runs.find((r) => Number(r.failed || 0) > 0);
  const lastErrorType = lastFailedRun?.errorTypes?.[0] || "—";

  return {
    totalRuns: runs.length,
    totalCompleted,
    totalFailed,
    avgSuccessPercent,
    lastErrorType
  };
}

function getAccentStats() {
  const base = {
    lighting: { completed: 0, failed: 0 },
    mood: { completed: 0, failed: 0 },
    composition: { completed: 0, failed: 0 }
  };

  const runs = Array.isArray(state.runHistory) ? state.runHistory : [];
  for (const run of runs) {
    const perAccent = run?.perAccent;
    if (!perAccent || typeof perAccent !== "object") continue;
    for (const key of Object.keys(base)) {
      const row = perAccent[key];
      if (!row || typeof row !== "object") continue;
      base[key].completed += Number(row.completed || 0);
      base[key].failed += Number(row.failed || 0);
    }
  }

  return Object.entries(base).map(([accent, row]) => {
    const total = row.completed + row.failed;
    const successPercent = total > 0 ? Math.round((row.completed / total) * 100) : 0;
    return { accent, ...row, total, successPercent };
  });
}

function getOverallProgressPercent() {
  if (!Array.isArray(state.results) || state.results.length === 0) return 0;
  const sum = state.results.reduce((acc, row) => acc + Number(row.progress || 0), 0);
  const avg = Math.round(sum / state.results.length);
  return Math.max(0, Math.min(100, avg));
}

function toSerializableState() {
  return {
    phase: state.phase,
    sourceImageUrl: state.sourceImageUrl,
    sourceContext: state.sourceContext,
    photoStoragePath: state.photoStoragePath,
    uploadedFileName: state.uploadedFileName,
    selectedModel: state.selectedModel,
    selectedAspectRatio: state.selectedAspectRatio,
    selectedImageSize: state.selectedImageSize,
    vibeId: state.vibeId,
    style: state.style,
    extractModel: state.extractModel,
    expandModel: state.expandModel,
    prompts: state.prompts,
    results: state.results,
    runHistory: state.runHistory,
    cooldownUntil: state.cooldownUntil,
    updatedAt: Date.now()
  };
}

async function persistState() {
  await storageLocalSet({ [LOCAL_STATE_KEY]: toSerializableState() });
}

async function initSupabaseAuth() {
  await storageLocalSet({ stv_api_origin: API_ORIGIN });
  supabaseClient = await createSupabaseForExtension(API_ORIGIN);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    accessTokenRef = session?.access_token ?? null;
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
    const redirectTo = chrome.runtime.getURL("sidepanel/auth-callback.html");
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error) throw error;
    if (data?.url) {
      chrome.tabs.create({ url: data.url });
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
  state.photoStoragePath = saved.photoStoragePath || state.photoStoragePath;
  state.uploadedFileName = saved.uploadedFileName || state.uploadedFileName;
  state.selectedModel = saved.selectedModel || state.selectedModel;
  state.selectedAspectRatio = saved.selectedAspectRatio || state.selectedAspectRatio;
  state.selectedImageSize = saved.selectedImageSize || state.selectedImageSize;
  state.vibeId = saved.vibeId || state.vibeId;
  state.style = saved.style || state.style;
  state.extractModel = saved.extractModel || state.extractModel;
  state.expandModel = saved.expandModel || state.expandModel;
  state.prompts = Array.isArray(saved.prompts) ? saved.prompts : state.prompts;
  state.results = Array.isArray(saved.results) ? saved.results : state.results;
  state.runHistory = Array.isArray(saved.runHistory) ? saved.runHistory : state.runHistory;
  state.cooldownUntil = Number(saved.cooldownUntil || 0);
}

async function api(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (accessTokenRef && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessTokenRef}`;
  }
  const response = await fetch(`${API_ORIGIN}${path}`, {
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
 * Cache-bust reference preview so the same CDN URL still reloads after a new click.
 */
function referenceImageSrcForUi() {
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
    await storageSessionRemove(SESSION_VIBE_KEY);
    return;
  }
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

async function uploadPhoto(file) {
  const form = new FormData();
  form.append("file", file);
  const data = await api("/api/upload-generation-photo", { method: "POST", body: form });
  state.photoStoragePath = data.storagePath;
  await persistState();
}

async function runExtract() {
  const extractData = await api("/api/vibe/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: state.sourceImageUrl })
  });
  state.vibeId = extractData.vibeId;
  state.style = extractData.style;
  state.extractModel = String(extractData.modelUsed || "");
  await persistState();
}

async function runExpand() {
  const expandData = await api("/api/vibe/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vibeId: state.vibeId, style: state.style })
  });
  state.prompts = Array.isArray(expandData.prompts) ? expandData.prompts : [];
  state.expandModel = String(expandData.modelUsed || "");
  await persistState();
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
      photoStoragePaths: [state.photoStoragePath]
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
    apiOrigin: API_ORIGIN,
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

async function generateAll() {
  if (state.generating) return;
  if (!state.sourceImageUrl) throw new Error("Нет source image");
  if (!state.photoStoragePath) throw new Error("Сначала загрузите фото");
  if (getCooldownLeftSeconds() > 0) {
    throw new Error(`Подождите ${getCooldownLeftSeconds()} сек перед новым запуском`);
  }

  const requiredCredits = getRequiredCredits();
  if (state.credits < requiredCredits) {
    throw new Error(`Недостаточно кредитов: нужно ${requiredCredits}, доступно ${state.credits}`);
  }

  state.generating = true;
  state.cooldownUntil = Date.now() + GENERATION_COOLDOWN_MS;
  const runStartedAt = Date.now();
  state.phase = "processing";
  state.error = "";
  state.info = t("run_extract");
  render();

  await runExtract();
  state.info = t("run_expand_prep");
  render();
  await runExpand();
  const allPrompts = Array.isArray(state.prompts) ? state.prompts : [];
  state.prompts = allPrompts.slice(0, 1);
  if (state.prompts.length !== 1) {
    state.generating = false;
    throw new Error(t("err_expand"));
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

  await Promise.all(state.results.map((row) => runRowPipeline(row)));

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
  state.info =
    failed === 0 ? t("all_done") : `${t("partial_done")}: ${completed}/1`;
  const perAccent = {
    lighting: { completed: 0, failed: 0 },
    mood: { completed: 0, failed: 0 },
    composition: { completed: 0, failed: 0 }
  };
  for (const row of state.results) {
    const key = String(row.accent || "");
    if (!Object.prototype.hasOwnProperty.call(perAccent, key)) continue;
    if (row.status === "completed") perAccent[key].completed += 1;
    if (row.status === "failed") perAccent[key].failed += 1;
  }

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
    perAccent
  });
  await refreshAuthSilently();
  if (failed === 0) {
    setToast("success", t("all_done"));
  } else {
    setToast("info", `${t("partial_done")} (${failed})`);
  }
  await persistState();
  render();
}

async function retryResultById(id) {
  if (state.generating) return;
  const row = state.results.find((r) => r.id === id || `${r.accent}:${r.attempt}` === id);
  if (!row) return;
  if (!state.photoStoragePath) {
    state.error = "Сначала загрузите фото";
    render();
    return;
  }
  await runRowPipeline(row);
  const completed = state.results.filter((r) => r.status === "completed").length;
  const failed = state.results.filter((r) => r.status === "failed").length;
  state.info = `${t("done_label")}: ${completed}/1, ${t("errors_label")}: ${failed}/1`;
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
  state.info = `${t("done_label")}: ${completed}/1, ${t("errors_label")}: ${failedAfter}/1`;
  await refreshAuthSilently();
  await persistState();
  setToast("info", t("all_done"));
  render();
}

async function resetSession() {
  state.phase = "idle";
  state.error = "";
  state.info = t("session_cleared");
  revokePhotoPreviewObjectUrl();
  clearPhotoPreviewSignedUrl();
  state.photoStoragePath = "";
  state.uploadedFileName = "";
  state.vibeId = null;
  state.style = null;
  state.extractModel = "";
  state.expandModel = "";
  state.prompts = [];
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
          <span class="stv-brand-mark" aria-hidden="true">P</span>
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

function renderMain() {
  const requiredCredits = getRequiredCredits();
  const cooldownLeftSec = getCooldownLeftSeconds();
  const canGenerate = Boolean(
    state.sourceImageUrl &&
      state.photoStoragePath &&
      !state.generating &&
      state.credits >= requiredCredits &&
      cooldownLeftSec === 0
  );
  const completedCount = state.results.filter((r) => r.status === "completed").length;
  const failedCount = state.results.filter((r) => r.status === "failed").length;
  const needsCredits = state.credits < requiredCredits;
  const historyStats = getHistoryStats();
  const accentStats = getAccentStats();
  const sessionHealth = getSessionHealth();
  const overallProgress = getOverallProgressPercent();
  const showFirstRunHint = !state.sourceImageUrl && (!Array.isArray(state.runHistory) || state.runHistory.length === 0);

  const userPhotoSrc = state.photoPreviewObjectUrl || state.photoPreviewSignedUrl;
  const userPhotoFrame = userPhotoSrc
    ? `<img class="stv-compare-img" src="${escapeHtml(userPhotoSrc)}" alt="" />`
    : state.photoStoragePath
      ? `<div class="stv-compare-placeholder">
          <span class="photo-saved" aria-hidden="true">✓</span>
          <span class="muted">${escapeHtml(state.uploadedFileName || t("photo_saved_label"))}</span>
        </div>`
      : `<div class="stv-compare-placeholder muted">${escapeHtml(t("compare_photo_empty"))}</div>`;

  const hasUserPhoto = Boolean(state.photoStoragePath);
  const userPhotoUploadBar = `
    <div class="stv-photo-upload-bar">
      <label class="stv-photo-file-label" for="photo-file">${escapeHtml(
        hasUserPhoto ? t("photo_replace") : t("photo_pick")
      )}</label>
      <input id="photo-file" class="stv-photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" />
    </div>`;

  const referenceFrame = state.sourceImageUrl
    ? `<img class="stv-compare-img" src="${escapeHtml(referenceImageSrcForUi())}" alt="" />`
    : `<div class="stv-compare-placeholder muted">${escapeHtml(t("source_hint"))}</div>`;

  const resultsCompareColumnHtml = state.results.length
    ? `<div class="stv-result-column">${state.results.map((row) => buildResultCompactRowHtml(row)).join("")}</div>`
    : `<div class="stv-result-column stv-result-column--empty">
        <div class="stv-photo-frame stv-result-placeholder-frame">
          <div class="stv-compare-placeholder muted">${escapeHtml(t("compare_result_empty"))}</div>
        </div>
      </div>`;

  const compareProgressHtml =
    state.results.length > 0
      ? `
          <div class="stv-compare-progress">
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${escapeHtml(String(overallProgress))}%"></div>
            </div>
            <p class="muted">${escapeHtml(t("progress_total"))}: ${escapeHtml(String(overallProgress))}%</p>
          </div>`
      : "";

  const runHistoryHtml = Array.isArray(state.runHistory) && state.runHistory.length
    ? `
      <div class="card stv-card-history">
        <p class="title">${escapeHtml(t("history_title"))}</p>
        <p class="muted">
          ${escapeHtml(t("history_runs"))}=${escapeHtml(String(historyStats.totalRuns))},
          ${escapeHtml(t("history_ok"))}=${escapeHtml(String(historyStats.totalCompleted))},
          ${escapeHtml(t("history_fail"))}=${escapeHtml(String(historyStats.totalFailed))},
          ${escapeHtml(t("metric_success"))}=${escapeHtml(String(historyStats.avgSuccessPercent))}%,
          ${escapeHtml(t("history_last_err"))}=${escapeHtml(historyStats.lastErrorType)}
        </p>
        <div class="row">
          <button id="export-history">${escapeHtml(t("history_export"))}</button>
          <button id="clear-history">${escapeHtml(t("history_clear"))}</button>
        </div>
        <div class="row">
          ${accentStats
            .map(
              (s) =>
                `<span class="metric-chip">${escapeHtml(
                  `${formatAccentLabel(s.accent)}: ${t("metric_success")} ${s.successPercent}% (${s.completed}/${s.total || 0})`
                )}</span>`
            )
            .join("")}
        </div>
        ${state.runHistory
          .map(
            (run) => `
          <div class="history-item">
            <p class="muted"><strong>${escapeHtml(formatDateTime(run.startedAt))}</strong></p>
            <p class="muted">
              ${escapeHtml(t("history_model"))}=${escapeHtml(run.model || "—")}, ${escapeHtml(t("history_ratio"))}=${escapeHtml(run.aspectRatio || "—")}, ${escapeHtml(t("history_size"))}=${escapeHtml(run.imageSize || "—")}
            </p>
            <p class="muted">
              ${escapeHtml(t("history_ok"))}=${escapeHtml(String(run.completed ?? 0))}, ${escapeHtml(t("history_fail"))}=${escapeHtml(String(run.failed ?? 0))}
            </p>
            ${
              run.perAccent && typeof run.perAccent === "object"
                ? `<p class="muted">акценты=lighting(${escapeHtml(String(run.perAccent.lighting?.completed || 0))}/${escapeHtml(String((run.perAccent.lighting?.completed || 0) + (run.perAccent.lighting?.failed || 0)))}) mood(${escapeHtml(String(run.perAccent.mood?.completed || 0))}/${escapeHtml(String((run.perAccent.mood?.completed || 0) + (run.perAccent.mood?.failed || 0)))}) composition(${escapeHtml(String(run.perAccent.composition?.completed || 0))}/${escapeHtml(String((run.perAccent.composition?.completed || 0) + (run.perAccent.composition?.failed || 0)))})</p>`
                : ""
            }
            ${
              Array.isArray(run.errorTypes) && run.errorTypes.length
                ? `<p class="muted">типы_ошибок=${escapeHtml(run.errorTypes.map(formatErrorTypeLabel).join(", "))}</p>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `
    : "";

  const pipelinePanelHtml =
    state.style && typeof state.style === "object"
      ? `<div class="card stv-card-side">
          <p class="title">${escapeHtml(t("step1_title"))}</p>
          <p class="muted">${escapeHtml(t("step1_model"))}: <code>${escapeHtml(state.extractModel || "—")}</code></p>
          <p class="muted">${escapeHtml(t("step2_model"))}: <code>${escapeHtml(state.expandModel || "—")}</code></p>
          <pre class="prompt-box">${escapeHtml(JSON.stringify(state.style, null, 2))}</pre>
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
          <span class="stv-brand-mark" aria-hidden="true">P</span>
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
              <div class="stv-photo-frame stv-photo-frame--user${hasUserPhoto ? " has-photo" : ""}">
                <div class="stv-photo-frame-content">${userPhotoFrame}</div>
                ${userPhotoUploadBar}
              </div>
            </div>
            <div class="stv-compare-col">
              <span class="stv-field-label">${escapeHtml(t("compare_col_reference"))}</span>
              <div class="stv-photo-frame">${referenceFrame}</div>
            </div>
            <div class="stv-compare-col stv-compare-col--result">
              <span class="stv-field-label">${escapeHtml(t("compare_col_result"))}</span>
              ${resultsCompareColumnHtml}
            </div>
          </div>
          ${compareProgressHtml}
          <div class="stv-actions-primary stv-actions-under-photos">
            <button type="button" id="run-generate" class="primary" ${canGenerate ? "" : "disabled"}>
              ${state.resuming ? escapeHtml(t("btn_resuming")) : state.generating ? escapeHtml(t("btn_generating")) : escapeHtml(t("btn_generate"))}
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
          </div>
        </section>

        <p class="muted">${escapeHtml(t("done_label"))}: ${completedCount}/1, ${escapeHtml(t("errors_label"))}: ${failedCount}/1</p>
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
            <p class="muted"><code>${escapeHtml(t("api"))}</code> ${escapeHtml(API_ORIGIN)}</p>
            <p class="muted">${escapeHtml(t("dev_doc_hint"))}</p>
          </div>
        </details>
      </div>
      ${pipelinePanelHtml}
      ${runHistoryHtml}
    </div>
  `;

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

  document.getElementById("photo-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.error = "";
      state.uploadedFileName = file.name;
      state.info = t("uploading_photo");
      render();
      await uploadPhoto(file);
      revokePhotoPreviewObjectUrl();
      clearPhotoPreviewSignedUrl();
      state.photoPreviewObjectUrl = URL.createObjectURL(file);
      state.info = t("photo_uploaded");
      setToast("success", t("photo_uploaded"));
      render();
    } catch (err) {
      state.error = normalizeUiError(err, "Ошибка загрузки фото");
      setToast("error", state.error);
      render();
    }
  });

  document.getElementById("run-generate").addEventListener("click", async () => {
    try {
      state.error = "";
      await generateAll();
    } catch (err) {
      state.generating = false;
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

  void refreshUserPhotoPreviewIfNeeded();
}

function render() {
  if (state.loading) {
    app.innerHTML = `
      <div class="stv-shell">
        <div class="card stv-loading-card">
          <div class="stv-brand-mark" style="margin:0 auto 12px" aria-hidden="true">P</div>
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

async function boot() {
  state.loading = true;
  render();

  await loadPersistedState();
  try {
    await initSupabaseAuth();
  } catch (e) {
    console.warn("[stv] initSupabaseAuth:", e);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "STV_PENDING_VIBE" && msg.vibe) {
      void applyPendingVibeFromStorage(msg.vibe);
      return;
    }
    if (msg?.type === "PROMPTSHOT_AUTH_DONE") {
      void (async () => {
        await refreshAccessTokenFromSupabase();
        await checkAuth();
        render();
      })();
    }
  });

  /* When side panel is already open, boot() won't run again — background still writes session.
     onChanged picks up every new "Steal this vibe" click. */
  chrome.storage.session.onChanged.addListener((changes, areaName) => {
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

  state.loading = false;
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
      refreshAuthSilently().catch(() => {});
      void tryConsumePendingVibeFromSessionPoll();
    }
  });
}

boot();
