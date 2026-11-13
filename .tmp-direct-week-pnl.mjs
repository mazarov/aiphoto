import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const text = line.trim();
    if (!text || text.startsWith("#") || !text.includes("=")) continue;
    const i = text.indexOf("=");
    let value = text.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[text.slice(0, i).trim()] = value;
  }
  return out;
}

const env = {
  ...loadEnvFile(join(root, ".env")),
  ...loadEnvFile(join(root, "landing/.env")),
  ...loadEnvFile(join(root, "landing/.env.local")),
  ...loadEnvFile(join(root, ".cursor/yandex-seo.env")),
};
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] == null) process.env[k] = v;
}

const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(
  /\/+$/,
  "",
);
const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) {
  console.error(JSON.stringify({ error: "missing_supabase_env" }));
  process.exit(1);
}

const CAMPAIGN_LABELS = {
  "713780805": "ГЕНЕРАЦИЯ",
  "713781017": "ПРОМТЫ",
  "999000823": "старый",
};

const WEEK_FROM = "2026-09-15";
const WEEK_TO = "2026-09-17";
const CUM_FROM = "2026-08-23";
const CAC_MAX = 82;

const money = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function moscowDay(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function inMoscowRange(iso, fromDay, toDay) {
  const day = moscowDay(iso);
  return day >= fromDay && day <= toDay;
}

function isDirect(row) {
  const yclid = String(row.yclid || "").trim();
  const source = String(row.utm_source || "").trim().toLowerCase();
  const medium = String(row.utm_medium || "").trim().toLowerCase();
  return Boolean(yclid) || (source === "yandex" && medium === "cpc");
}

function campaignLabel(row) {
  const campaign = String(row.utm_campaign || "").trim();
  if (CAMPAIGN_LABELS[campaign]) return CAMPAIGN_LABELS[campaign];
  if (String(row.yclid || "").trim()) return "yclid";
  return campaign || "unknown";
}

async function restAll(path) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Range: `${from}-${from + page - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `rest_${res.status}:${path.split("?")[0]}:${body.slice(0, 200)}`,
      );
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function summarizePayments(rows) {
  const users = new Set();
  let revenue = 0;
  let credits = 0;
  let fee = 0;
  let usn = 0;
  let gen = 0;
  let mpUsers = new Set();
  let mpPayments = 0;
  let mpRevenue = 0;
  let noClientId = 0;
  let noClientIdRevenue = 0;
  const byCampaign = {};
  const byDay = {};
  const payments = [];

  for (const row of rows) {
    const amount = money(row.amount_rub);
    const cr = Number(row.credits || 0);
    const f = money(amount * 0.035 * 1.22);
    const u = money(amount * 0.06);
    const g = money(cr * 0.5);
    const margin = money(amount - f - u - g);
    const user = row.auth_user_id || row.landing_user_id;
    const day = moscowDay(row.credited_at || row.created_at);
    const camp = campaignLabel(row);
    const hasClient = Boolean(String(row.ym_client_id || "").trim());

    revenue = money(revenue + amount);
    credits += cr;
    fee = money(fee + f);
    usn = money(usn + u);
    gen = money(gen + g);
    if (user) users.add(user);
    if (hasClient) {
      mpPayments += 1;
      mpRevenue = money(mpRevenue + amount);
      if (user) mpUsers.add(user);
    } else {
      noClientId += 1;
      noClientIdRevenue = money(noClientIdRevenue + amount);
    }

    byCampaign[camp] = byCampaign[camp] || { payments: 0, revenue: 0, users: new Set() };
    byCampaign[camp].payments += 1;
    byCampaign[camp].revenue = money(byCampaign[camp].revenue + amount);
    if (user) byCampaign[camp].users.add(user);

    byDay[day] = byDay[day] || { payments: 0, revenue: 0 };
    byDay[day].payments += 1;
    byDay[day].revenue = money(byDay[day].revenue + amount);

    payments.push({
      creditedAt: row.credited_at,
      day,
      plan: row.plan_id || "pack",
      amount,
      credits: cr,
      campaign: camp,
      margin,
      hasClient,
      provider: row.provider,
    });
  }

  const userCount = users.size;
  const productAfterAlloc = money(revenue - fee - usn - gen);

  return {
    payments: rows.length,
    users: userCount,
    revenue,
    avgCheck: rows.length ? money(revenue / rows.length) : 0,
    credits,
    fee,
    usn,
    gen,
    productAfterAlloc,
    mp: {
      users: mpUsers.size,
      payments: mpPayments,
      revenue: mpRevenue,
      noClientId,
      noClientIdRevenue,
    },
    byCampaign: Object.fromEntries(
      Object.entries(byCampaign).map(([k, v]) => [
        k,
        { payments: v.payments, revenue: v.revenue, users: v.users.size },
      ]),
    ),
    byDay,
    paymentRows: payments,
  };
}

function finalizePnl(payments, adsMediaRub) {
  const adsWithVat = money(adsMediaRub * 1.22);
  const realized = money(
    payments.revenue - payments.fee - payments.usn - payments.gen - adsWithVat,
  );
  const cac = payments.users ? money(adsMediaRub / payments.users) : null;
  return {
    ...payments,
    ads: {
      source: "direct_api",
      mediaRub: adsMediaRub,
      withVatRub: adsWithVat,
    },
    realized,
    cacMediaRub: cac,
    cacMaxRub: CAC_MAX,
  };
}

const select = [
  "id",
  "auth_user_id",
  "landing_user_id",
  "plan_id",
  "credits",
  "amount_rub",
  "status",
  "test",
  "credited_at",
  "created_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "yclid",
  "ym_client_id",
  "yandex_conversion_sent_at",
].join(",");

const cumFromIso = `${CUM_FROM}T00:00:00+03:00`;
const query =
  `select=${select}` +
  `&status=eq.succeeded` +
  `&credited_at=not.is.null` +
  `&credited_at=gte.${encodeURIComponent(cumFromIso)}` +
  `&or=(test.is.null,test.eq.false)` +
  `&order=credited_at.asc`;

const started = Date.now();
const yookassa = await restAll(`landing_yookassa_payments?${query}`);
const robokassa = await restAll(`landing_robokassa_payments?${query}`);

const allLive = [
  ...yookassa.map((r) => ({ ...r, provider: "yookassa" })),
  ...robokassa.map((r) => ({ ...r, provider: "robokassa" })),
].filter(isDirect);

const weekRows = allLive.filter((r) =>
  inMoscowRange(r.credited_at, WEEK_FROM, WEEK_TO),
);
const prevWeekRows = allLive.filter((r) =>
  inMoscowRange(r.credited_at, "2026-09-08", "2026-09-14"),
);

const { loadDirectEnvFile, fetchCampaignSpend } = await import(
  pathToFileURL(join(root, "src/standalone/yandex-direct-api.mjs")).href
);
loadDirectEnvFile(join(root, ".cursor/yandex-seo.env"));

let weekAds;
let prevWeekAds;
let cumAds;
try {
  weekAds = await fetchCampaignSpend({ dateFrom: WEEK_FROM, dateTo: WEEK_TO });
  prevWeekAds = await fetchCampaignSpend({
    dateFrom: "2026-09-08",
    dateTo: "2026-09-14",
  });
  cumAds = await fetchCampaignSpend({ dateFrom: CUM_FROM, dateTo: WEEK_TO });
} catch (err) {
  console.error(
    JSON.stringify({
      error: "direct_api_failed",
      message: err.message,
      code: err.code || null,
    }),
  );
  process.exit(1);
}

const weekPayments = summarizePayments(weekRows);
const prevWeekPayments = summarizePayments(prevWeekRows);
const cumPayments = summarizePayments(allLive);

const weekPnl = finalizePnl(weekPayments, weekAds.mediaRub);
const prevWeekPnl = finalizePnl(prevWeekPayments, prevWeekAds.mediaRub);
const cumPnl = finalizePnl(cumPayments, cumAds.mediaRub);

const report = {
  pulledAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  week: { from: WEEK_FROM, to: WEEK_TO },
  prevWeek: { from: "2026-09-08", to: "2026-09-14" },
  cumulative: { from: CUM_FROM, to: WEEK_TO },
  weekPnl,
  prevWeekPnl,
  cumPnl,
  weekAds,
  prevWeekAds,
  cumAds,
};

const outPath = join(root, ".tmp-direct-week-pnl.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(
  JSON.stringify({
    ok: true,
    outPath,
    week: {
      realized: weekPnl.realized,
      revenue: weekPnl.revenue,
      payments: weekPnl.payments,
      users: weekPnl.users,
      adsMedia: weekAds.mediaRub,
      adsWithVat: weekPnl.ads.withVatRub,
      cac: weekPnl.cacMediaRub,
      campaigns: weekAds.campaigns,
    },
    prevWeekRealized: prevWeekPnl.realized,
    cumulativeRealized: cumPnl.realized,
  }),
);
