const API_ORIGIN = localStorage.getItem("stv_api_origin") || "https://promptshot.ru";
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
  selectedModel: "gemini-2.5-flash-image",
  selectedAspectRatio: "1:1",
  selectedImageSize: "1K",
  models: [...DEFAULT_MODELS],
  aspectRatios: [...DEFAULT_ASPECT_RATIOS],
  imageSizes: [...DEFAULT_IMAGE_SIZES],
  vibeId: null,
  style: null,
  prompts: [],
  results: [],
  generating: false,
  runHistory: [],
  cooldownUntil: 0,
  confirmGenerate: false,
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
  return Number(getModelConfig(state.selectedModel).cost || 1) * 3;
}

function getCooldownLeftSeconds() {
  const leftMs = Number(state.cooldownUntil || 0) - Date.now();
  if (leftMs <= 0) return 0;
  return Math.ceil(leftMs / 1000);
}

function statusLabel(status) {
  switch (status) {
    case "creating":
      return "создание";
    case "processing":
      return "генерация";
    case "completed":
      return "готово";
    case "failed":
      return "ошибка";
    default:
      return "в очереди";
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
    lighting: "Свет",
    mood: "Атмосфера",
    composition: "Композиция"
  };
  return map[String(accent || "").toLowerCase()] || String(accent || "—");
}

function formatErrorTypeLabel(errorType) {
  const map = {
    insufficient_credits: "Недостаточно кредитов",
    timeout: "Таймаут",
    unauthorized: "Требуется вход",
    network: "Сетевая ошибка",
    validation_error: "Ошибка валидации",
    session_interrupted: "Сессия прервана",
    generation_failed: "Ошибка генерации",
    unknown: "Неизвестная ошибка"
  };
  return map[String(errorType || "").toLowerCase()] || String(errorType || "—");
}

function normalizeUiError(err, fallbackText) {
  const fallback = String(fallbackText || "Произошла ошибка");
  if (!err) return fallback;

  const payload = err.payload && typeof err.payload === "object" ? err.payload : null;
  const code = String(payload?.error || "").toLowerCase();
  const message = String(payload?.message || "").trim();
  const status = Number(err.status || 0);

  if (status === 401 || status === 403 || code === "unauthorized") {
    return "Сессия истекла. Войдите заново на promptshot.ru";
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
    return { label: "Сессия активна", className: "session-ok" };
  }
  return { label: "Требуется вход", className: "session-bad" };
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
    selectedModel: state.selectedModel,
    selectedAspectRatio: state.selectedAspectRatio,
    selectedImageSize: state.selectedImageSize,
    vibeId: state.vibeId,
    style: state.style,
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

function applyPersistedState(saved) {
  if (!saved || typeof saved !== "object") return;
  state.phase = saved.phase || state.phase;
  state.sourceImageUrl = saved.sourceImageUrl || state.sourceImageUrl;
  state.sourceContext = saved.sourceContext || state.sourceContext;
  state.photoStoragePath = saved.photoStoragePath || state.photoStoragePath;
  state.selectedModel = saved.selectedModel || state.selectedModel;
  state.selectedAspectRatio = saved.selectedAspectRatio || state.selectedAspectRatio;
  state.selectedImageSize = saved.selectedImageSize || state.selectedImageSize;
  state.vibeId = saved.vibeId || state.vibeId;
  state.style = saved.style || state.style;
  state.prompts = Array.isArray(saved.prompts) ? saved.prompts : state.prompts;
  state.results = Array.isArray(saved.results) ? saved.results : state.results;
  state.runHistory = Array.isArray(saved.runHistory) ? saved.runHistory : state.runHistory;
  state.cooldownUntil = Number(saved.cooldownUntil || 0);
}

async function api(path, init = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      state.user = null;
      state.credits = 0;
      state.generating = false;
      state.phase = "idle";
      state.info = "";
      state.error = "Сессия истекла. Войдите заново на promptshot.ru";
      render();
    }
    const err = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function loadPendingVibe() {
  const result = await storageSessionGet(SESSION_VIBE_KEY);
  const vibe = result?.[SESSION_VIBE_KEY];
  if (vibe?.imageUrl) {
    state.sourceImageUrl = vibe.imageUrl;
    state.sourceContext = vibe;
    state.error = "";
    state.info = "Источник обновлен с веб-страницы";
    await storageSessionRemove(SESSION_VIBE_KEY);
    await persistState();
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
  state.info = "Ожидаем оплату... Вернитесь сюда после оплаты в Telegram";
  render();

  creditPollTimer = setInterval(async () => {
    polls += 1;
    await checkAuth();

    if (Number(state.credits || 0) > initialCredits) {
      const delta = Number(state.credits || 0) - initialCredits;
      stopCreditPolling();
      state.waitingForPayment = false;
      state.info = "";
      setToast("success", `Зачислено ${delta} кредитов!`);
      await persistState();
      render();
      return;
    }

    if (polls >= CREDIT_POLL_MAX) {
      stopCreditPolling();
      state.waitingForPayment = false;
      state.info = "Таймаут ожидания. Если вы оплатили, обновите страницу или откройте панель снова.";
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

async function runExtractAndExpand() {
  const extractData = await api("/api/vibe/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: state.sourceImageUrl })
  });
  state.vibeId = extractData.vibeId;
  state.style = extractData.style;

  const expandData = await api("/api/vibe/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vibeId: state.vibeId, style: state.style })
  });
  state.prompts = Array.isArray(expandData.prompts) ? expandData.prompts : [];
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
    row.statusDetail = "Ожидание результата...";
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
          ? `Генерация занимает больше обычного (${Math.ceil(elapsedMs / 1000)}с)`
          : `Генерация... ${Math.ceil(elapsedMs / 1000)}с`;

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
    row.statusDetail = "Результат готов";
  } catch (err) {
    row.status = "failed";
    row.progress = 0;
    row.error = normalizeUiError(err, "Неизвестная ошибка");
    row.errorType = classifyErrorType(row.error);
    row.statusDetail = "Не удалось завершить генерацию";
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
    row.error = "Сессия прервана до старта генерации. Нажмите «Повторить».";
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
  state.info = `Восстанавливаем ${inFlight.length} незавершённых задач...`;
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
              ? `Восстановление: дольше обычного (${Math.ceil(elapsedMs / 1000)}с)`
              : `Восстановление... ${Math.ceil(elapsedMs / 1000)}с`;
          render();
        });
        row.status = "completed";
        row.progress = 100;
        row.resultUrl = String(poll.resultUrl || "");
        row.error = "";
        row.errorType = "";
        row.statusDetail = "Результат восстановлен";
      } catch (err) {
        row.status = "failed";
        row.progress = 0;
        row.error = normalizeUiError(err, "Неизвестная ошибка");
        row.errorType = classifyErrorType(row.error);
        row.statusDetail = "Не удалось восстановить генерацию";
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
  state.info = `Восстановление завершено: ${completed}/3 готово, ${failed}/3 с ошибкой`;
  await persistState();
  setToast("info", `Восстановлено: ${completed}/3 готово`);
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
  state.info = "История запусков очищена";
  await persistState();
  setToast("success", "История запусков очищена");
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
  state.info = "Извлекаем стиль и создаём промпты...";
  render();

  await runExtractAndExpand();
  if (!Array.isArray(state.prompts) || state.prompts.length !== 3) {
    state.generating = false;
    throw new Error("Expand не вернул 3 промпта");
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
  state.info = "Запускаем 3 генерации...";
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
  state.info = `Готово: ${completed}/3, с ошибкой: ${failed}/3`;
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
    setToast("success", "Все 3 варианта готовы");
  } else {
    setToast("info", `Готово ${completed}/3, ошибки: ${failed}/3`);
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
  state.info = `Результаты: ${completed}/3 готово, ${failed}/3 с ошибкой`;
  await persistState();
  render();
}

async function retryAllFailed() {
  if (state.generating) return;
  const failed = state.results.filter((r) => r.status === "failed");
  if (!failed.length) return;
  state.info = `Повторяем ${failed.length} неудачных вариантов...`;
  state.error = "";
  render();
  for (const row of failed) {
    await runRowPipeline(row);
  }
  const completed = state.results.filter((r) => r.status === "completed").length;
  const failedAfter = state.results.filter((r) => r.status === "failed").length;
  state.info = `После ретрая: ${completed}/3 готово, ${failedAfter}/3 с ошибкой`;
  await refreshAuthSilently();
  await persistState();
  setToast("info", `Ретрай завершён: ${completed}/3 готово`);
  render();
}

async function resetSession() {
  state.phase = "idle";
  state.error = "";
  state.info = "Сессия очищена";
  state.photoStoragePath = "";
  state.vibeId = null;
  state.style = null;
  state.prompts = [];
  state.results = [];
  await storageLocalRemove(LOCAL_STATE_KEY);
  setToast("info", "Сессия сброшена");
  render();
}

async function clearResultsOnly() {
  state.phase = "idle";
  state.error = "";
  state.info = "Результаты очищены";
  state.vibeId = null;
  state.style = null;
  state.prompts = [];
  state.results = [];
  state.confirmGenerate = false;
  await persistState();
  setToast("info", "Результаты очищены");
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
    <div class="card">
      <p class="title">Steal This Vibe</p>
      <p class="muted ${escapeHtml(sessionHealth.className)}">Статус: ${escapeHtml(sessionHealth.label)}</p>
      <p class="muted">Войдите на promptshot.ru, чтобы продолжить.</p>
      <div class="row">
        <button class="primary" id="open-login">Открыть promptshot.ru</button>
        <button id="retry-auth">Проверить снова</button>
      </div>
      ${state.error ? `<p class="muted error-text">${escapeHtml(state.error)}</p>` : ""}
    </div>
  `;

  document.getElementById("open-login").addEventListener("click", () => {
    chrome.tabs.create({ url: API_ORIGIN });
  });
  document.getElementById("retry-auth").addEventListener("click", async () => {
    state.loading = true;
    render();
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

  const source = state.sourceImageUrl
    ? `<img class="preview" src="${escapeHtml(state.sourceImageUrl)}" alt="Source" />`
    : `<p class="muted">Наведите на картинку на любом сайте и нажмите "Steal this vibe".</p>`;

  const resultsHtml = state.results.length
    ? `<div class="grid">${state.results
        .map((row) => {
          const retryKey = row.id || `${row.accent}:${row.attempt}`;
          return `
      <div class="card">
        <p class="title">${escapeHtml(formatAccentLabel(row.accent))}</p>
        <p class="muted">Статус: ${escapeHtml(statusLabel(row.status))}</p>
        ${row.statusDetail ? `<p class="muted">${escapeHtml(row.statusDetail)}</p>` : ""}
        <p class="muted">Попытка: ${escapeHtml(String(row.attempt || 0))}</p>
        ${row.resultUrl ? `<img class="preview" src="${escapeHtml(row.resultUrl)}" alt="Result" />` : ""}
        ${row.error ? `<p class="muted error-text">${escapeHtml(row.error)}</p>` : ""}
        ${row.errorType ? `<p class="muted">Тип ошибки: ${escapeHtml(formatErrorTypeLabel(row.errorType))}</p>` : ""}
        <div class="row">
          <button data-save-id="${escapeHtml(row.id || "")}" ${row.status === "completed" && !row.saving ? "" : "disabled"}>
            ${row.saving ? "Сохраняем..." : row.saved ? "Сохранено" : "Сохранить"}
          </button>
          <button data-retry-id="${escapeHtml(retryKey)}" ${row.status === "failed" && !state.generating ? "" : "disabled"}>
            Повторить
          </button>
          ${row.resultUrl ? `<a href="${escapeHtml(row.resultUrl)}" target="_blank" rel="noreferrer">Открыть</a>` : ""}
        </div>
      </div>
    `;
        })
        .join("")}</div>`
    : "";

  const runHistoryHtml = Array.isArray(state.runHistory) && state.runHistory.length
    ? `
      <div class="card">
        <p class="title">История запусков</p>
        <p class="muted">
          запусков=${escapeHtml(String(historyStats.totalRuns))},
          успешно=${escapeHtml(String(historyStats.totalCompleted))},
          ошибок=${escapeHtml(String(historyStats.totalFailed))},
          успех=${escapeHtml(String(historyStats.avgSuccessPercent))}%,
          последняя_ошибка=${escapeHtml(historyStats.lastErrorType)}
        </p>
        <div class="row">
          <button id="export-history">Экспорт JSON</button>
          <button id="clear-history">Очистить историю</button>
        </div>
        <div class="row">
          ${accentStats
            .map(
              (s) =>
                `<span class="metric-chip">${escapeHtml(
                  `${formatAccentLabel(s.accent)}: успех ${s.successPercent}% (${s.completed}/${s.total || 0})`
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
              модель=${escapeHtml(run.model || "—")}, ratio=${escapeHtml(run.aspectRatio || "—")}, размер=${escapeHtml(run.imageSize || "—")}
            </p>
            <p class="muted">
              успешно=${escapeHtml(String(run.completed ?? 0))}, ошибок=${escapeHtml(String(run.failed ?? 0))}
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

  app.innerHTML = `
    <div class="card">
      ${
        state.toast
          ? `<div class="toast toast-${escapeHtml(state.toast.type)}">${escapeHtml(state.toast.message)}</div>`
          : ""
      }
      <p class="title">Steal This Vibe</p>
      <p class="muted">API: ${escapeHtml(API_ORIGIN)}</p>
      <p class="muted">Пользователь: ${escapeHtml(state.user.email || state.user.id || "unknown")}</p>
      <p class="muted ${escapeHtml(sessionHealth.className)}">Статус: ${escapeHtml(sessionHealth.label)}</p>
      <p class="muted">Кредиты: ${escapeHtml(String(state.credits))}</p>
      <p class="muted">Стоимость запуска: ${escapeHtml(String(requiredCredits))} кредита(ов)</p>
      ${
        needsCredits
          ? `<p class="muted error-text">Недостаточно кредитов: нужно ${escapeHtml(String(requiredCredits))}, доступно ${escapeHtml(String(state.credits))}</p>`
          : ""
      }
      ${source}
      ${
        showFirstRunHint
          ? `<p class="muted">Подсказка: наведите курсор на фото на любом сайте и нажмите кнопку "Steal this vibe". После этого вернитесь в эту панель.</p>`
          : ""
      }
      <div class="row">
        <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      <div class="row">
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
        <select id="aspect-ratio">
          ${state.aspectRatios
            .map((a) => `<option value="${escapeHtml(a.value)}">${escapeHtml(a.label)}</option>`)
            .join("")}
        </select>
        <select id="image-size">
          ${state.imageSizes
            .map((s) => `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="row">
        <button id="run-generate" class="primary" ${canGenerate ? "" : "disabled"}>
          ${state.resuming ? "Восстанавливаем..." : state.generating ? "Генерируем..." : "Сгенерировать 3 варианта"}
        </button>
        <button id="buy-credits" ${needsCredits && !state.generating ? "" : "disabled"}>
          ${state.waitingForPayment ? "Ожидаем оплату..." : "Купить кредиты ⭐"}
        </button>
        <button id="retry-all" ${failedCount > 0 && !state.generating ? "" : "disabled"}>
          Повторить все ошибки
        </button>
        <button id="clear-results" ${state.generating ? "disabled" : ""}>
          Очистить результаты
        </button>
        <button id="reset-session" ${state.generating ? "disabled" : ""}>
          Сбросить сессию
        </button>
      </div>
      ${
        state.confirmGenerate
          ? `
        <div class="row">
          <span class="muted">Подтвердить запуск: будет списано ${escapeHtml(String(requiredCredits))} кредитов</span>
          <button id="confirm-generate" class="primary" ${canGenerate ? "" : "disabled"}>Подтвердить</button>
          <button id="cancel-generate" ${state.generating ? "disabled" : ""}>Отмена</button>
        </div>
      `
          : ""
      }
      ${
        cooldownLeftSec > 0
          ? `<p class="muted">Cooldown: подождите ${escapeHtml(String(cooldownLeftSec))} сек</p>`
          : ""
      }
      ${
        state.results.length
          ? `
        <div class="progress-wrap">
          <div class="progress-bar" style="width:${escapeHtml(String(overallProgress))}%"></div>
        </div>
        <p class="muted">Общий прогресс: ${escapeHtml(String(overallProgress))}%</p>
      `
          : ""
      }
      <p class="muted">Готово: ${completedCount}/3, ошибки: ${failedCount}/3</p>
      ${state.info ? `<p class="muted">${escapeHtml(state.info)}</p>` : ""}
      ${state.error ? `<p class="muted error-text">${escapeHtml(state.error)}</p>` : ""}
    </div>
    ${resultsHtml}
    ${runHistoryHtml}
  `;

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
      state.info = "Загружаем фото...";
      render();
      await uploadPhoto(file);
      state.info = "Фото загружено";
      setToast("success", "Фото успешно загружено");
      render();
    } catch (err) {
      state.error = normalizeUiError(err, "Ошибка загрузки фото");
      setToast("error", state.error);
      render();
    }
  });

  document.getElementById("run-generate").addEventListener("click", async () => {
    state.confirmGenerate = true;
    state.error = "";
    render();
    await persistState();
  });

  const buyCreditsBtn = document.getElementById("buy-credits");
  if (buyCreditsBtn) {
    buyCreditsBtn.addEventListener("click", async () => {
      await openBuyCredits();
    });
  }

  const confirmBtn = document.getElementById("confirm-generate");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      try {
        state.confirmGenerate = false;
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
  }

  const cancelBtn = document.getElementById("cancel-generate");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      state.confirmGenerate = false;
      state.info = "Запуск отменен пользователем";
      render();
      await persistState();
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
}

function render() {
  if (state.loading) {
    app.innerHTML =
      '<div class="card"><p class="title">Steal This Vibe</p><p class="muted">Загрузка...</p></div>';
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
  await loadPendingVibe();
  await loadConfig();
  await checkAuth();
  await resumeInFlightGenerations();

  state.loading = false;
  if (state.user && !String(state.info || "").toLowerCase().includes("восстанов")) {
    setToast("info", "Готово к генерации", 1800);
  }
  render();

  setInterval(() => {
    if (!state.loading && !state.generating && getCooldownLeftSeconds() > 0) {
      render();
    }
  }, 1000);

  setInterval(() => {
    if (!state.loading) {
      refreshAuthSilently().catch(() => {});
    }
  }, AUTH_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.loading) {
      refreshAuthSilently().catch(() => {});
    }
  });
}

boot();
