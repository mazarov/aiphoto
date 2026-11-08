/**
 * Operator panel + cabinet session client for PromptShot → «Мой налог».
 * Receives the core module so Tampermonkey can load it from an embedded blob.
 */

export const REGISTER_DELAY_MS = 800;
export const INCOMES_PAGE_SIZE = 100;
export const INCOMES_MAX_PAGES = 20;

export function createCabinetSession() {
  return {
    bearer: null,
    extraHeaders: {},
    inn: null,
    displayName: null,
  };
}

function headerGet(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  return (
    headers[name] ||
    headers[name.toLowerCase()] ||
    headers[name.toUpperCase()] ||
    null
  );
}

function captureHeaders(session, headers) {
  const authorization = headerGet(headers, "Authorization") || headerGet(headers, "authorization");
  if (authorization && /^Bearer\s+\S+/i.test(authorization)) {
    session.bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  }
  const extra = {};
  const copyNames = ["x-device-id", "device-id", "x-request-id"];
  for (const name of copyNames) {
    const value = headerGet(headers, name);
    if (value) extra[name] = value;
  }
  if (Object.keys(extra).length) session.extraHeaders = { ...session.extraHeaders, ...extra };
}

function walkForToken(session, value, depth = 0) {
  if (session.bearer || value == null || depth > 6) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        walkForToken(session, JSON.parse(trimmed), depth + 1);
      } catch {
        return;
      }
    }
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      (lower === "token" ||
        lower === "accesstoken" ||
        lower === "access_token") &&
      typeof nested === "string" &&
      nested.length > 20 &&
      !nested.includes(" ")
    ) {
      session.bearer = nested;
      return;
    }
    walkForToken(session, nested, depth + 1);
  }
}

export function scanStorageForToken(session, storage) {
  if (!storage) return;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      walkForToken(session, storage.getItem(key));
      if (session.bearer) return;
    }
  } catch {
    /* ignore opaque storage */
  }
}

export function installCabinetHooks(session, target = globalThis) {
  if (target.__psLknpdHooksInstalled) return session;
  target.__psLknpdHooksInstalled = true;
  const nativeFetch = target.fetch?.bind(target);
  if (nativeFetch) {
    target.fetch = function hookedFetch(input, init) {
      captureHeaders(session, init?.headers);
      return nativeFetch(input, init);
    };
    session.nativeFetch = nativeFetch;
  }
  const XHR = target.XMLHttpRequest;
  if (XHR?.prototype?.setRequestHeader) {
    const nativeSet = XHR.prototype.setRequestHeader;
    XHR.prototype.setRequestHeader = function setRequestHeader(name, value) {
      captureHeaders(session, { [name]: value });
      return nativeSet.call(this, name, value);
    };
  }
  scanStorageForToken(session, target.localStorage);
  scanStorageForToken(session, target.sessionStorage);
  return session;
}

export async function cabinetRequest(session, path, options = {}) {
  const fetchImpl = session.nativeFetch || globalThis.fetch.bind(globalThis);
  const headers = {
    Accept: "application/json, text/plain, */*",
    ...session.extraHeaders,
    ...(options.headers || {}),
  };
  if (session.bearer) headers.Authorization = `Bearer ${session.bearer}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }
  const response = await fetchImpl(`https://lknpd.nalog.ru/api/v1${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers,
    body: options.body,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (response.status === 401) {
    throw new Error("Сессия кабинета истекла. Обновите страницу и войдите снова.");
  }
  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.code)) || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

function request(session, path, options) {
  if (typeof session.request === "function") return session.request(path, options);
  return cabinetRequest(session, path, options);
}

export async function loadCabinetProfile(session) {
  const user = await request(session, "/user");
  session.inn = user?.inn || session.inn;
  session.displayName = user?.displayName || user?.fio || session.displayName;
  return user;
}

export async function loadCabinetIncomes(session, core, records, now = new Date()) {
  const range = core.incomesDateRange(records, now);
  const all = [];
  for (let page = 0; page < INCOMES_MAX_PAGES; page += 1) {
    const offset = page * INCOMES_PAGE_SIZE;
    const query = new URLSearchParams({
      from: range.from,
      to: range.to,
      offset: String(offset),
      limit: String(INCOMES_PAGE_SIZE),
      sortBy: "OPERATION_TIME_DESC",
    });
    const json = await request(session, `/incomes?${query}`);
    const rows = core.parseIncomeList(json);
    all.push(...rows);
    if (rows.length < INCOMES_PAGE_SIZE) break;
  }
  return all;
}

export async function registerIncome(session, payload) {
  return request(session, "/income", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readJournal(core) {
  try {
    return core.parseJournal(localStorage.getItem(core.JOURNAL_STORAGE_KEY));
  } catch {
    return core.emptyJournal();
  }
}

function writeJournal(core, journal) {
  localStorage.setItem(core.JOURNAL_STORAGE_KEY, JSON.stringify(journal));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function appendHtml(root, html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  root.appendChild(template.content);
}

export function bootLknpdIncome(core, options = {}) {
  const session = options.session || createCabinetSession();
  if (typeof options.request === "function") {
    session.request = options.request;
  }
  if (!session.request) {
    session.request = (path, reqOptions) => cabinetRequest(session, path, reqOptions);
  }
  if (!options.skipHooks) installCabinetHooks(session, options.target || globalThis);
  if (document.getElementById("ps-lknpd-root")) return session;

  const host = document.createElement("div");
  host.id = "ps-lknpd-root";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.right = "16px";
  host.style.bottom = "16px";
  host.style.zIndex = "2147483646";
  const shadow = host.attachShadow({ mode: "open" });
  appendHtml(shadow, `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: Inter, system-ui, sans-serif; }
      .panel {
        width: 420px; max-height: 84vh; overflow: auto;
        background: #12141a; color: #f3f4f6; border: 1px solid #2a2f3a;
        border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.35); padding: 14px;
      }
      h1 { font-size: 14px; margin: 0 0 8px; font-weight: 700; }
      .sub { color: #9aa3b2; font-size: 12px; line-height: 1.4; margin-bottom: 10px; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
      button, label.file {
        background: #1f6feb; color: white; border: 0; border-radius: 8px;
        padding: 7px 10px; font-size: 12px; cursor: pointer;
      }
      button.secondary { background: #2a2f3a; }
      button.danger { background: #b42318; }
      button:disabled { opacity: .45; cursor: not-allowed; }
      label.file input { display: none; }
      .stat { font-size: 12px; color: #d0d5dd; }
      .log, table { width: 100%; font-size: 11px; }
      .log {
        background: #0b0d12; border-radius: 8px; padding: 8px; min-height: 72px;
        white-space: pre-wrap; color: #cdd5e0; margin-top: 8px;
      }
      table { border-collapse: collapse; margin-top: 8px; }
      th, td { border-bottom: 1px solid #2a2f3a; padding: 4px 3px; text-align: left; vertical-align: top; }
      .ok { color: #3dd68c; }
      .warn { color: #f5a524; }
    </style>
    <div class="panel">
      <h1>PromptShot → Мой налог</h1>
      <div class="sub">CSV успешных оплат из админки. Регистрация через API кабинета, не кликер. Сначала dry-run.</div>
      <div class="stat" id="session">Сессия: ищу токен…</div>
      <div class="row">
        <label class="file">Загрузить CSV<input id="file" type="file" accept=".csv,text/csv"></label>
        <button class="secondary" id="probe">Проверить сессию</button>
      </div>
      <div class="stat" id="summary">Файл не загружен</div>
      <div class="row">
        <label class="stat"><input id="dry" type="checkbox" checked> Dry-run</label>
        <button id="run" disabled>Зарегистрировать</button>
        <button class="secondary" id="export">Журнал CSV</button>
      </div>
      <table id="preview"></table>
      <div class="log" id="log"></div>
    </div>
  `);
  (options.mount || document.documentElement).appendChild(host);

  const $ = (id) => shadow.getElementById(id);
  const logEl = $("log");
  const sessionEl = $("session");
  const summaryEl = $("summary");
  const previewEl = $("preview");
  const runBtn = $("run");
  const dryEl = $("dry");
  let classified = [];
  let busy = false;

  const log = (line, kind = "") => {
    const stamp = new Date().toLocaleTimeString("ru-RU");
    logEl.textContent += `${stamp} ${line}\n`;
    if (kind) logEl.className = `log ${kind}`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const renderSession = () => {
    if (session.inn) {
      sessionEl.innerHTML = `Сессия: <span class="ok">ок</span> · ИНН ${session.inn}${
        session.displayName ? ` · ${session.displayName}` : ""
      }`;
      return;
    }
    if (session.bearer) {
      sessionEl.innerHTML = `Сессия: токен есть, профиль ещё не прочитан`;
      return;
    }
    sessionEl.innerHTML =
      `Сессия: <span class="warn">нет Bearer</span>. Откройте «Продажи», чтобы кабинет сам сходил в API.`;
  };

  const renderPreview = () => {
    const readyCount = classified.filter((item) => item.kind === "ready").length;
    if (!classified.length) {
      previewEl.innerHTML = "";
      runBtn.disabled = true;
      return;
    }
    previewEl.innerHTML = `
      <tr><th>Статус</th><th>Сумма</th><th>Дата</th><th>Услуга</th></tr>
      ${classified.slice(0, 12).map((item) => `
        <tr>
          <td>${item.kind === "ready" ? "готово" : item.reason}</td>
          <td>${item.amountRub ?? item.row.amount_rub ?? ""}</td>
          <td>${(item.operationTime || "").slice(0, 16)}</td>
          <td>${item.payload?.services?.[0]?.name || ""}</td>
        </tr>
      `).join("")}
      ${classified.length > 12 ? `<tr><td colspan="4">… ещё ${classified.length - 12}</td></tr>` : ""}
    `;
    runBtn.disabled = busy || readyCount === 0;
  };

  const probe = async () => {
    scanStorageForToken(session, globalThis.localStorage);
    scanStorageForToken(session, globalThis.sessionStorage);
    try {
      await loadCabinetProfile(session);
      log(`Профиль кабинета: ИНН ${session.inn || "?"}`);
    } catch (error) {
      log(`Профиль: ${error.message}`, "warn");
    }
    renderSession();
  };

  const classifyCurrent = async (records) => {
    const journal = readJournal(core);
    let incomes = [];
    try {
      incomes = await loadCabinetIncomes(session, core, records);
      log(`Сверка ФНС: ${incomes.length} чеков в диапазоне CSV`);
    } catch (error) {
      log(`Сверка ФНС недоступна, только локальный журнал: ${error.message}`, "warn");
    }
    classified = core.classifyAdminPayments(records, { journal, incomes });
    const summary = core.summarizeClassified(classified);
    summaryEl.textContent =
      `Строк ${summary.total}: готово ${summary.ready} на ${summary.readyAmountRub} ₽ · журнал ${summary.skip_journal} · ФНС ${summary.skip_fns} · test ${summary.skip_test} · статус ${summary.skip_status} · без id ${summary.skip_missing_id}`;
    renderPreview();
    return summary;
  };

  $("file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { records } = core.parseDelimitedCsv(text);
    if (!records.length) {
      log("CSV пустой или без строк", "warn");
      return;
    }
    log(`CSV: ${file.name}, строк ${records.length}`);
    await probe();
    await classifyCurrent(records);
  });

  $("probe").addEventListener("click", () => {
    probe();
  });

  $("export").addEventListener("click", () => {
    downloadText(
      `promptshot-lknpd-journal-${new Date().toISOString().slice(0, 10)}.csv`,
      core.serializeJournalCsv(readJournal(core)),
    );
  });

  runBtn.addEventListener("click", async () => {
    const ready = classified.filter((item) => item.kind === "ready");
    if (!ready.length || busy) return;
    if (dryEl.checked) {
      log(`Dry-run: ${ready.length} чеков, POST не уходит. Снимите галку, чтобы зарегистрировать.`);
      return;
    }
    if (!session.inn && !session.bearer) {
      log("Нет сессии кабинета", "warn");
      return;
    }
    const sum = ready.reduce((acc, item) => acc + item.amountRub, 0);
    const ok = window.confirm(
      `Зарегистрировать ${ready.length} чеков на ${sum} ₽ в «Мой налог»?\nЭто создаст доход в ФНС. Дубли скрипт отсекает по #ps:<payment_id>.`,
    );
    if (!ok) return;
    busy = true;
    runBtn.disabled = true;
    let journal = readJournal(core);
    try {
      await probe();
      for (let i = 0; i < ready.length; i += 1) {
        const item = ready[i];
        const again = core.classifyAdminPaymentRow(item.row, {
          journal,
          incomes: [],
        });
        if (again.kind !== "ready") {
          log(`Пропуск ${item.row.id}: ${again.reason}`);
          continue;
        }
        try {
          const response = await registerIncome(session, item.payload);
          const receiptUuid =
            response?.approvedReceiptUuid || core.receiptUuidOf(response);
          if (!receiptUuid) throw new Error("нет approvedReceiptUuid");
          const urls = core.receiptUrls(session.inn, receiptUuid);
          journal = core.journalPut(journal, item.row.id, {
            receiptUuid,
            amountRub: item.amountRub,
            operationTime: item.operationTime,
            printUrl: urls.printUrl,
            payerEmail: item.row.payer_email || "",
            registeredAt: new Date().toISOString(),
          });
          writeJournal(core, journal);
          item.kind = "skip_journal";
          item.reason = "только что зарегистрирован";
          log(`ОК ${item.amountRub} ₽ → ${receiptUuid} ${urls.printUrl}`, "ok");
        } catch (error) {
          log(`Ошибка ${item.row.id}: ${error.message}`, "warn");
          if (/истекла/.test(error.message)) break;
        }
        if (i < ready.length - 1) await sleep(REGISTER_DELAY_MS);
      }
    } finally {
      busy = false;
      const leftover = classified.filter((item) => item.kind === "ready");
      runBtn.disabled = leftover.length === 0;
      renderPreview();
    }
  });

  renderSession();
  probe();
  return session;
}
