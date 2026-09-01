const REPORTS_URL = "https://api.direct.yandex.com/json/v5/reports";
const DEFAULT_CAMPAIGN_IDS = ["713780805", "713781017", "999000823"];

export type DirectAdsLine = {
  spend_date: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string | null;
  ad_id: string | null;
  criterion_id: string | null;
  impressions: number;
  clicks: number;
  cost_rub: number;
  currency: "RUB";
};

export type DirectReportRow = {
  Date?: string;
  CampaignId?: string;
  CampaignName?: string;
  Impressions?: string | number;
  Clicks?: string | number;
  Cost?: string | number;
};

export function getDirectToken(): string {
  return String(process.env.YANDEX_DIRECT_TOKEN || "").trim();
}

export function getDirectClientLogin(): string {
  return String(process.env.YANDEX_DIRECT_CLIENT_LOGIN || "").trim();
}

export function defaultDirectCampaignIds(): string[] {
  const raw = String(process.env.YANDEX_DIRECT_CAMPAIGN_IDS || "").trim();
  if (!raw) return [...DEFAULT_CAMPAIGN_IDS];
  return raw.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean);
}

export function moneyRub(value: unknown): number {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeDirectError(data: unknown): Record<string, unknown> {
  const err = data && typeof data === "object" && "error" in data
    ? (data as { error: unknown }).error
    : data;
  if (!err || typeof err !== "object") {
    return { message: String(data ?? "Direct API error").slice(0, 300) };
  }
  const record = err as Record<string, unknown>;
  return {
    error_code: record.error_code ?? record.error_string ?? null,
    error_string: record.error_string ?? record.message ?? null,
    error_detail: record.error_detail ?? null,
  };
}

function parseTsv(text: string, fieldNames: string[]): Record<string, string>[] {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^(итого|total)\b/i.test(line));
  if (!lines.length) return [];
  let start = 0;
  const header = lines[0].split("\t");
  if (header.some((cell) => fieldNames.includes(cell))) start = 1;
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(start)) {
    const cells = line.split("\t");
    if (cells.length < fieldNames.length) continue;
    const row: Record<string, string> = {};
    fieldNames.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export function mapDirectReportToAdsLines(rows: DirectReportRow[]): DirectAdsLine[] {
  const merged = new Map<string, DirectAdsLine>();
  for (const row of rows) {
    const campaignId = String(row.CampaignId || "").trim();
    const spendDate = String(row.Date || "").slice(0, 10);
    if (!campaignId || !/^\d{4}-\d{2}-\d{2}$/.test(spendDate)) continue;
    const next: DirectAdsLine = {
      spend_date: spendDate,
      campaign_id: campaignId,
      campaign_name: String(row.CampaignName || campaignId).slice(0, 240),
      ad_group_id: null,
      ad_id: null,
      criterion_id: null,
      impressions: Math.max(0, Math.round(Number(row.Impressions || 0) || 0)),
      clicks: Math.max(0, Math.round(Number(row.Clicks || 0) || 0)),
      cost_rub: Math.max(0, moneyRub(row.Cost)),
      currency: "RUB",
    };
    const key = `${spendDate}|${campaignId}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, next);
      continue;
    }
    current.impressions += next.impressions;
    current.clicks += next.clicks;
    current.cost_rub = moneyRub(current.cost_rub + next.cost_rub);
    if (!current.campaign_name && next.campaign_name) current.campaign_name = next.campaign_name;
  }
  return [...merged.values()].sort((left, right) => (
    left.spend_date === right.spend_date
      ? left.campaign_id.localeCompare(right.campaign_id)
      : left.spend_date.localeCompare(right.spend_date)
  ));
}

export async function fetchDirectCampaignPerformance(input: {
  dateFrom: string;
  dateTo: string;
  campaignIds?: string[];
}): Promise<DirectAdsLine[]> {
  const token = getDirectToken();
  if (!token) {
    const error = new Error("missing_direct_token");
    (error as Error & { code: string }).code = "missing_direct_token";
    throw error;
  }
  const campaignIds = input.campaignIds?.length ? input.campaignIds : defaultDirectCampaignIds();
  const fieldNames = ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost"];
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Accept-Language": "ru",
    "Content-Type": "application/json; charset=UTF-8",
    returnMoneyInMicros: "false",
    processingMode: "auto",
    skipReportHeader: "true",
    skipReportSummary: "true",
  };
  const login = getDirectClientLogin();
  if (login) headers["Client-Login"] = login;

  const body = JSON.stringify({
    params: {
      SelectionCriteria: {
        DateFrom: input.dateFrom,
        DateTo: input.dateTo,
        Filter: [{ Field: "CampaignId", Operator: "IN", Values: campaignIds.map(String) }],
      },
      FieldNames: fieldNames,
      ReportName: `ps-finance-${input.dateFrom}-${input.dateTo}-${Date.now()}`,
      ReportType: "CAMPAIGN_PERFORMANCE_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "NO",
      IncludeDiscount: "NO",
    },
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(REPORTS_URL, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 200) {
      return mapDirectReportToAdsLines(parseTsv(await response.text(), fieldNames));
    }
    if (response.status === 201 || response.status === 202) {
      await sleep(2000);
      continue;
    }
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    const error = new Error(
      response.status === 429
        ? "Direct API quota exceeded (429)"
        : `Direct Reports ${response.status}`,
    );
    (error as Error & { status: number; payload: unknown }).status = response.status;
    (error as Error & { status: number; payload: unknown }).payload = sanitizeDirectError(data);
    throw error;
  }
  const error = new Error("Direct report was not ready after retries");
  (error as Error & { code: string }).code = "direct_not_ready";
  throw error;
}
