/**
 * Read-only Yandex Direct API v5 (Reports + Campaigns.get).
 * Token from YANDEX_DIRECT_TOKEN only. Never log it.
 */
import { existsSync, readFileSync } from "node:fs";

const REPORTS_URL = "https://api.direct.yandex.com/json/v5/reports";
const CAMPAIGNS_URL = "https://api.direct.yandex.com/json/v5/campaigns";
const DEFAULT_CAMPAIGN_IDS = ["713780805", "713781017", "999000823"];

export function loadDirectEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

export function getDirectToken() {
  return String(process.env.YANDEX_DIRECT_TOKEN || "").trim();
}

export function getDirectClientLogin() {
  return String(process.env.YANDEX_DIRECT_CLIENT_LOGIN || "").trim();
}

export function defaultCampaignIds() {
  const raw = String(process.env.YANDEX_DIRECT_CAMPAIGN_IDS || "").trim();
  if (!raw) return [...DEFAULT_CAMPAIGN_IDS];
  return raw
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function money(value) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeDirectError(data) {
  const err = data?.error || data;
  if (!err || typeof err !== "object") {
    return { message: String(data ?? "Direct API error").slice(0, 300) };
  }
  return {
    error_code: err.error_code ?? err.error_string ?? null,
    error_string: err.error_string ?? err.message ?? null,
    error_detail: err.error_detail ?? null,
  };
}

function directHeaders({ acceptJson = true } = {}) {
  const token = getDirectToken();
  if (!token) {
    const err = new Error(
      "Missing YANDEX_DIRECT_TOKEN. Add it to .cursor/yandex-seo.env",
    );
    err.code = "NO_TOKEN";
    throw err;
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Accept-Language": "ru",
    "Content-Type": "application/json; charset=UTF-8",
  };
  if (acceptJson) headers.Accept = "application/json";
  const login = getDirectClientLogin();
  if (login) headers["Client-Login"] = login;
  return headers;
}

async function directJson(url, body) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: directHeaders(),
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!res.ok || data?.error) {
      const err = new Error(
        res.status === 429
          ? "Direct API quota exceeded (429). Wait and retry later."
          : `Direct API ${res.status}`,
      );
      err.status = res.status;
      err.payload = sanitizeDirectError(data);
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseTsv(text, fieldNames) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^(итого|total)\b/i.test(line));

  if (lines.length === 0) return [];

  let start = 0;
  const header = lines[0].split("\t");
  const looksLikeHeader = header.some((cell) => fieldNames.includes(cell));
  if (looksLikeHeader) start = 1;

  const rows = [];
  for (const line of lines.slice(start)) {
    const cells = line.split("\t");
    if (cells.length < fieldNames.length) continue;
    const row = {};
    fieldNames.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export async function fetchDirectCampaigns(ids = defaultCampaignIds()) {
  const payload = await directJson(CAMPAIGNS_URL, {
    method: "get",
    params: {
      SelectionCriteria: {
        Ids: ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
      },
      FieldNames: ["Id", "Name", "State", "Status"],
    },
  });
  return (payload?.result?.Campaigns || []).map((row) => ({
    id: String(row.Id),
    name: row.Name || "",
    state: row.State || null,
    status: row.Status || null,
  }));
}

export async function fetchDirectReport({
  reportType,
  fieldNames,
  dateFrom,
  dateTo,
  campaignIds = defaultCampaignIds(),
  includeVat = "NO",
}) {
  const headers = {
    ...directHeaders({ acceptJson: false }),
    returnMoneyInMicros: "false",
    processingMode: "auto",
    skipReportHeader: "true",
    skipReportSummary: "true",
  };

  const body = JSON.stringify({
    params: {
      SelectionCriteria: {
        DateFrom: dateFrom,
        DateTo: dateTo,
        Filter: [
          {
            Field: "CampaignId",
            Operator: "IN",
            Values: campaignIds.map(String),
          },
        ],
      },
      FieldNames: fieldNames,
      ReportName: `ps-${reportType}-${dateFrom}-${dateTo}-${Date.now()}`,
      ReportType: reportType,
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: includeVat,
      IncludeDiscount: "NO",
    },
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let res;
    try {
      res = await fetch(REPORTS_URL, {
        method: "POST",
        headers,
        body,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 200) {
      return parseTsv(await res.text(), fieldNames);
    }
    if (res.status === 201 || res.status === 202) {
      await sleep(2000);
      continue;
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    const err = new Error(
      res.status === 429
        ? "Direct API quota exceeded (429). Wait and retry later."
        : `Direct Reports ${res.status}`,
    );
    err.status = res.status;
    err.payload = sanitizeDirectError(data);
    throw err;
  }

  const err = new Error("Direct report was not ready after retries");
  err.status = 202;
  throw err;
}

export async function fetchCampaignSpend({
  dateFrom,
  dateTo,
  campaignIds = defaultCampaignIds(),
} = {}) {
  const rows = await fetchDirectReport({
    reportType: "CAMPAIGN_PERFORMANCE_REPORT",
    fieldNames: [
      "Date",
      "CampaignId",
      "CampaignName",
      "Impressions",
      "Clicks",
      "Cost",
    ],
    dateFrom,
    dateTo,
    campaignIds,
    includeVat: "NO",
  });

  const byCampaign = new Map();
  let lastDay = "";
  for (const row of rows) {
    const id = String(row.CampaignId || "").trim();
    const day = String(row.Date || "").slice(0, 10);
    const cost = money(row.Cost);
    const clicks = Number(row.Clicks || 0);
    const impressions = Number(row.Impressions || 0);
    const current = byCampaign.get(id) || {
      id,
      name: row.CampaignName || "",
      mediaRub: 0,
      clicks: 0,
      impressions: 0,
    };
    current.mediaRub = money(current.mediaRub + cost);
    current.clicks += Number.isFinite(clicks) ? clicks : 0;
    current.impressions += Number.isFinite(impressions) ? impressions : 0;
    byCampaign.set(id, current);
    if (day > lastDay) lastDay = day;
  }

  const campaigns = [...byCampaign.values()];
  const mediaRub = money(
    campaigns.reduce((sum, row) => sum + row.mediaRub, 0),
  );
  return {
    source: "direct_api",
    includeVat: false,
    dateFrom,
    dateTo,
    mediaRub,
    lastDay: lastDay || null,
    campaigns,
    days: rows.map((row) => ({
      date: String(row.Date || "").slice(0, 10),
      campaignId: String(row.CampaignId || ""),
      campaignName: row.CampaignName || "",
      impressions: Number(row.Impressions || 0),
      clicks: Number(row.Clicks || 0),
      mediaRub: money(row.Cost),
    })),
  };
}

export async function fetchSearchQuerySpend({
  dateFrom,
  dateTo,
  campaignIds = defaultCampaignIds(),
  limit = 80,
} = {}) {
  const rows = await fetchDirectReport({
    reportType: "SEARCH_QUERY_PERFORMANCE_REPORT",
    fieldNames: [
      "Query",
      "CampaignId",
      "CampaignName",
      "Impressions",
      "Clicks",
      "Cost",
      "AvgCpc",
    ],
    dateFrom,
    dateTo,
    campaignIds,
    includeVat: "NO",
  });

  return rows
    .map((row) => ({
      query: row.Query || "",
      campaignId: String(row.CampaignId || ""),
      campaignName: row.CampaignName || "",
      impressions: Number(row.Impressions || 0),
      clicks: Number(row.Clicks || 0),
      mediaRub: money(row.Cost),
      avgCpc: money(row.AvgCpc),
    }))
    .sort((a, b) => b.mediaRub - a.mediaRub)
    .slice(0, limit);
}
