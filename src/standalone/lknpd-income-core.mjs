/**
 * PromptShot → «Мой налог»: parse admin CSV, build POST /api/v1/income bodies,
 * idempotency journal. No secrets. Used by the Tampermonkey userscript and tests.
 */

export const ADMIN_PAYMENT_CSV_SEPARATOR = ";";
export const PAYMENT_ID_MARKER_PREFIX = "#ps:";
export const JOURNAL_STORAGE_KEY = "promptshot.lknpd.receipts.v1";
export const MOSCOW_OFFSET = "+03:00";
export const DEFAULT_PAYMENT_TYPE = "ACCOUNT";

export const DEFAULT_PLAN_TITLES = {
  treatment: {
    trial: "Пробный",
    start: "Оптимальный",
    pro: "Большой",
    max: "Максимум",
  },
  control: {
    trial: "Проба",
    start: "Старт",
    pro: "Про",
    max: "Максимум",
  },
};

export function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

export function parseDelimitedCsv(text, separator = ADMIN_PAYMENT_CSV_SEPARATOR) {
  const src = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === separator) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
  return { headers, records };
}

export function parseAmountRub(raw) {
  const text = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function isTruthyFlag(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function paymentIdMarker(paymentId) {
  return `${PAYMENT_ID_MARKER_PREFIX}${String(paymentId || "").trim()}`;
}

export function planTitle(planId, paywallVariant, titles = DEFAULT_PLAN_TITLES) {
  const variant = paywallVariant === "control" ? "control" : "treatment";
  const id = String(planId || "").trim();
  return titles[variant]?.[id] || id || "пакет";
}

export function buildServiceName(row, titles = DEFAULT_PLAN_TITLES) {
  const title = planTitle(row.plan_id, row.paywall_variant, titles);
  const credits = String(row.credits || "").trim();
  const creditsPart = credits ? ` · ${credits} ток.` : "";
  return `PromptShot · ${title}${creditsPart} ${paymentIdMarker(row.id)}`;
}

export function toMoscowIso(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${MOSCOW_OFFSET}`;
}

export function operationTimeFromRow(row) {
  const credited = String(row.credited_at || "").trim();
  const created = String(row.created_at || "").trim();
  return toMoscowIso(credited || created);
}

export function formatIncomeAmount(amountRub) {
  if (!Number.isFinite(amountRub)) return null;
  return Number.isInteger(amountRub) ? String(amountRub) : amountRub.toFixed(2);
}

export function buildIncomePayload(row, now = new Date(), titles = DEFAULT_PLAN_TITLES) {
  const amountRub = parseAmountRub(row.amount_rub);
  const operationTime = operationTimeFromRow(row);
  const requestTime = toMoscowIso(now);
  if (amountRub == null || amountRub <= 0 || !operationTime || !requestTime) return null;
  const amount = formatIncomeAmount(amountRub);
  return {
    operationTime,
    requestTime,
    paymentType: DEFAULT_PAYMENT_TYPE,
    ignoreMaxTotalIncomeRestriction: false,
    client: {
      contactPhone: null,
      displayName: null,
      inn: null,
      incomeType: "FROM_INDIVIDUAL",
    },
    services: [
      {
        name: buildServiceName(row, titles),
        amount,
        quantity: 1,
      },
    ],
    totalAmount: amount,
  };
}

export function parseIncomeList(json) {
  if (!json || typeof json !== "object") return [];
  const rows = json.content || json.items || json.incomes || json.records || [];
  return Array.isArray(rows) ? rows : [];
}

export function incomeServiceNames(income) {
  const services = Array.isArray(income?.services) ? income.services : [];
  return services.map((service) => String(service?.name || ""));
}

export function findIncomeByPaymentId(incomes, paymentId) {
  const id = String(paymentId || "").trim();
  if (!id) return null;
  const marker = paymentIdMarker(id);
  for (const income of incomes) {
    if (income?.cancellationInfo) continue;
    const names = incomeServiceNames(income);
    if (names.some((name) => name.includes(marker))) return income;
  }
  return null;
}

export function receiptUuidOf(income) {
  return (
    income?.approvedReceiptUuid ||
    income?.receiptUuid ||
    income?.receiptId ||
    income?.uuid ||
    null
  );
}

export function receiptUrls(inn, receiptUuid) {
  if (!inn || !receiptUuid) return { printUrl: "", jsonUrl: "" };
  const base = `https://lknpd.nalog.ru/api/v1/receipt/${inn}/${receiptUuid}`;
  return { printUrl: `${base}/print`, jsonUrl: `${base}/json` };
}

export function emptyJournal() {
  return { version: 1, receipts: {} };
}

export function parseJournal(raw) {
  if (!raw) return emptyJournal();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return emptyJournal();
    const receipts =
      parsed.receipts && typeof parsed.receipts === "object" ? parsed.receipts : {};
    return { version: 1, receipts };
  } catch {
    return emptyJournal();
  }
}

export function journalGet(journal, paymentId) {
  return journal?.receipts?.[paymentId] || null;
}

export function journalPut(journal, paymentId, entry) {
  return {
    version: 1,
    receipts: {
      ...journal.receipts,
      [paymentId]: entry,
    },
  };
}

export function classifyAdminPaymentRow(row, context = {}) {
  const journal = context.journal || emptyJournal();
  const incomes = context.incomes || [];
  const id = String(row?.id || "").trim();
  if (!id) return { kind: "skip_missing_id", row, reason: "нет id" };

  const status = String(row.status || "").trim().toLowerCase();
  if (status !== "succeeded") {
    return { kind: "skip_status", row, reason: `статус ${row.status || "пусто"}` };
  }
  if (isTruthyFlag(row.test)) {
    return { kind: "skip_test", row, reason: "test=true" };
  }

  const amountRub = parseAmountRub(row.amount_rub);
  if (amountRub == null || amountRub <= 0) {
    return { kind: "skip_amount", row, reason: "сумма" };
  }

  const operationTime = operationTimeFromRow(row);
  if (!operationTime) {
    return { kind: "skip_date", row, reason: "нет даты" };
  }

  const payload = buildIncomePayload(row, context.now);
  if (!payload) {
    return { kind: "skip_payload", row, reason: "не собрался payload" };
  }

  const journalEntry = journalGet(journal, id);
  if (journalEntry?.receiptUuid) {
    return {
      kind: "skip_journal",
      row,
      reason: "уже в журнале",
      receiptUuid: journalEntry.receiptUuid,
      payload,
      amountRub,
      operationTime,
    };
  }

  const existing = findIncomeByPaymentId(incomes, id);
  const existingUuid = receiptUuidOf(existing);
  if (existingUuid) {
    return {
      kind: "skip_fns",
      row,
      reason: "уже в ФНС",
      receiptUuid: existingUuid,
      payload,
      amountRub,
      operationTime,
    };
  }

  return {
    kind: "ready",
    row,
    payload,
    amountRub,
    operationTime,
  };
}

export function classifyAdminPayments(records, context = {}) {
  return records.map((row) => classifyAdminPaymentRow(row, context));
}

export function summarizeClassified(classified) {
  const summary = {
    total: classified.length,
    ready: 0,
    skip_test: 0,
    skip_status: 0,
    skip_amount: 0,
    skip_date: 0,
    skip_journal: 0,
    skip_fns: 0,
    skip_missing_id: 0,
    skip_payload: 0,
    readyAmountRub: 0,
  };
  for (const item of classified) {
    summary[item.kind] = (summary[item.kind] || 0) + 1;
    if (item.kind === "ready") summary.readyAmountRub += item.amountRub;
  }
  summary.readyAmountRub = Math.round(summary.readyAmountRub * 100) / 100;
  return summary;
}

export function incomesDateRange(records, now = new Date()) {
  let minMs = Infinity;
  let maxMs = now.getTime();
  for (const row of records) {
    const credited = String(row.credited_at || "").trim();
    const created = String(row.created_at || "").trim();
    const ms = new Date(credited || created).getTime();
    if (Number.isFinite(ms)) {
      if (ms < minMs) minMs = ms;
      if (ms > maxMs) maxMs = ms;
    }
  }
  if (!Number.isFinite(minMs)) minMs = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const from = new Date(minMs - 24 * 60 * 60 * 1000);
  const to = new Date(maxMs + 24 * 60 * 60 * 1000);
  return { from: toMoscowIso(from), to: toMoscowIso(to) };
}

export function serializeJournalCsv(journal) {
  const lines = [
    ["payment_id", "receipt_uuid", "amount_rub", "operation_time", "print_url", "payer_email", "registered_at"].join(";"),
  ];
  for (const [paymentId, entry] of Object.entries(journal.receipts || {})) {
    const cells = [
      paymentId,
      entry.receiptUuid || "",
      entry.amountRub ?? "",
      entry.operationTime || "",
      entry.printUrl || "",
      entry.payerEmail || "",
      entry.registeredAt || "",
    ].map((value) => {
      const raw = String(value);
      return /[;"\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    });
    lines.push(cells.join(";"));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}
