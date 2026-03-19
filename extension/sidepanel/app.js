const API_ORIGIN = localStorage.getItem("stv_api_origin") || "https://promptshot.ru";
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000;
const STORAGE_KEY = "pendingVibe";

const app = document.getElementById("app");

const state = {
  loading: true,
  error: "",
  user: null,
  credits: 0,
  sourceImageUrl: "",
  sourceContext: null,
  photoStoragePath: "",
  selectedModel: "gemini-2.5-flash-image",
  selectedAspectRatio: "1:1",
  selectedImageSize: "1K",
  vibeId: null,
  style: null,
  prompts: [],
  results: []
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, init = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function loadPendingVibe() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  if (result?.[STORAGE_KEY]?.imageUrl) {
    state.sourceImageUrl = result[STORAGE_KEY].imageUrl;
    state.sourceContext = result[STORAGE_KEY];
    await chrome.storage.session.remove(STORAGE_KEY);
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
      state.error = "Не удалось проверить авторизацию";
    }
  }
}

async function uploadPhoto(file) {
  const form = new FormData();
  form.append("file", file);
  const data = await api("/api/upload-generation-photo", { method: "POST", body: form });
  state.photoStoragePath = data.storagePath;
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
  state.prompts = expandData.prompts || [];
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
  return {
    id: data.id,
    accent: promptVariant.accent,
    prompt: promptVariant.prompt,
    status: "pending",
    progress: 0,
    resultUrl: ""
  };
}

async function pollOne(id) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const data = await api(`/api/generations/${id}`);
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(data.errorMessage || "Генерация завершилась ошибкой");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Таймаут генерации");
}

async function generateAll() {
  if (!state.sourceImageUrl) throw new Error("Нет source image");
  if (!state.photoStoragePath) throw new Error("Сначала загрузите фото");

  await runExtractAndExpand();
  if (!Array.isArray(state.prompts) || state.prompts.length !== 3) {
    throw new Error("Expand не вернул 3 промпта");
  }

  const created = await Promise.all(state.prompts.map(createGeneration));
  state.results = created;
  render();

  await Promise.all(
    state.results.map(async (row) => {
      row.status = "processing";
      render();
      const poll = await pollOne(row.id);
      row.status = "completed";
      row.progress = 100;
      row.resultUrl = poll.resultUrl || "";
      render();
    })
  );
}

async function saveResult(row) {
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

  if (data.cardUrl) {
    window.open(data.cardUrl, "_blank");
  } else {
    alert("Сохранено. Карточка будет опубликована позже.");
  }
}

function renderAuthRequired() {
  app.innerHTML = `
    <div class="card">
      <p class="title">Steal This Vibe</p>
      <p class="muted">Войдите на promptshot.ru, чтобы продолжить.</p>
      <div class="row">
        <button class="primary" id="open-login">Открыть promptshot.ru</button>
        <button id="retry-auth">Проверить снова</button>
      </div>
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
  const source = state.sourceImageUrl
    ? `<img class="preview" src="${escapeHtml(state.sourceImageUrl)}" alt="Source" />`
    : `<p class="muted">Наведите на картинку на любом сайте и нажмите "Steal this vibe".</p>`;

  const resultsHtml = state.results.length
    ? `<div class="grid">${state.results
        .map(
          (row) => `
      <div class="card">
        <p class="title">${escapeHtml(row.accent)}</p>
        <p class="muted">${escapeHtml(row.status)}</p>
        ${row.resultUrl ? `<img class="preview" src="${escapeHtml(row.resultUrl)}" alt="Result" />` : ""}
        <div class="row">
          <button data-save-id="${escapeHtml(row.id)}" ${row.resultUrl ? "" : "disabled"}>Save</button>
          ${row.resultUrl ? `<a href="${escapeHtml(row.resultUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
        </div>
      </div>
    `
        )
        .join("")}</div>`
    : "";

  app.innerHTML = `
    <div class="card">
      <p class="title">Steal This Vibe</p>
      <p class="muted">Пользователь: ${escapeHtml(state.user.email || state.user.id || "unknown")}</p>
      <p class="muted">Кредиты: ${escapeHtml(String(state.credits))}</p>
      ${source}
      <div class="row">
        <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      <p class="muted">Модель (1 кредит за Flash, всего 3 генерации за запуск):</p>
      <div class="row">
        <select id="model">
          <option value="gemini-2.5-flash-image">Flash (1)</option>
          <option value="gemini-3-pro-image-preview">Pro (2)</option>
          <option value="gemini-3.1-flash-image-preview">Ultra (3)</option>
        </select>
        <button id="run-generate" class="primary">Сгенерировать 3 варианта</button>
      </div>
      ${state.error ? `<p class="muted" style="color:#ff8080">${escapeHtml(state.error)}</p>` : ""}
    </div>
    ${resultsHtml}
  `;

  const modelEl = document.getElementById("model");
  modelEl.value = state.selectedModel;
  modelEl.addEventListener("change", (e) => {
    state.selectedModel = e.target.value;
  });

  document.getElementById("photo-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.error = "";
      render();
      await uploadPhoto(file);
      state.error = "Фото загружено";
      render();
    } catch (err) {
      state.error = err.message || "Ошибка загрузки фото";
      render();
    }
  });

  document.getElementById("run-generate").addEventListener("click", async () => {
    try {
      state.error = "";
      state.results = [];
      render();
      await generateAll();
    } catch (err) {
      state.error = err.message || "Ошибка генерации";
      render();
    }
  });

  app.querySelectorAll("[data-save-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      const row = state.results.find((x) => x.id === node.getAttribute("data-save-id"));
      if (!row) return;
      try {
        await saveResult(row);
      } catch (err) {
        alert(err.message || "Ошибка сохранения");
      }
    });
  });
}

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="card"><p class="title">Steal This Vibe</p><p class="muted">Загрузка...</p></div>`;
    return;
  }
  if (!state.user) {
    renderAuthRequired();
    return;
  }
  renderMain();
}

async function boot() {
  state.loading = true;
  render();
  await loadPendingVibe();
  await checkAuth();
  state.loading = false;
  render();
}

boot();
