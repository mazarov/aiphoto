#!/usr/bin/env node
/**
 * Ledger P&L for PromptShot Yandex Direct search.
 * Prints JSON only. Never prints env values or payment ids.
 *
 * Usage (repo root):
 *   node .cursor/skills/direct-daily-pnl/scripts/pull.mjs
 *   node .cursor/skills/direct-daily-pnl/scripts/pull.mjs --ads-media=2542
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const CREDIT_RUB = 0.5;
const TAX_RATE = 0.06;
const ACQUIRING_RATE = 0.035;
const VAT_RATE = 0.22;
const CAC_MAX_RUB = 82;
const SCALE_MIN_FIRST_PAYERS = 5;
const DEFAULT_FROM = "2026-08-23";

const CAMPAIGNS = {
  "713780805": "ГЕНЕРАЦИЯ",
  "713781017": "ПРОМТЫ",
  "999000823": "старый",
};

const PLAN_RU = {
  trial: "пробный",
  start: "старт",
  pro: "про",
  max: "максимум",
};

function parseArgs(argv) {
  const out = { adsMedia: null, from: DEFAULT_FROM };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--ads-media=")) {
      const value = Number(arg.slice("--ads-media=".length));
      if (!Number.isFinite(value) || value < 0) {
        fail("bad_ads_media");
      }
      out.adsMedia = money(value);
    } else if (arg.startsWith("--from=")) {
      const value = arg.slice("--from=".length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("bad_from");
      out.from = value;
    } else {
      fail(`unknown_arg:${arg}`);
    }
  }
  return out;
}

function fail(code) {
  console.error(JSON.stringify({ error: code }));
  process.exit(1);
}

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

function loadEnv() {
  return {
    ...loadEnvFile(join(root, ".env")),
    ...loadEnvFile(join(root, "landing/.env")),
    ...loadEnvFile(join(root, "landing/.env.local")),
    ...loadEnvFile(join(root, ".cursor/yandex-seo.env")),
  };
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function moscowParts(iso) {
  const date = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function moscowDay(iso) {
  const p = moscowParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

function moscowStamp(iso) {
  const p = moscowParts(iso);
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

function periodStartIso(fromDay) {
  return `${fromDay}T00:00:00+03:00`;
}

function isDirect(row) {
  const yclid = String(row.yclid || "").trim();
  const source = String(row.utm_source || "").trim().toLowerCase();
  const medium = String(row.utm_medium || "").trim().toLowerCase();
  return Boolean(yclid) || (source === "yandex" && medium === "cpc");
}

function campaignLabel(row) {
  const id = String(row.utm_campaign || "").trim();
  if (CAMPAIGNS[id]) return CAMPAIGNS[id];
  if (id) return id;
  return String(row.yclid || "").trim() ? "yclid" : "нет метки";
}

function planLabel(planId, amount) {
  const name = PLAN_RU[planId] || planId || "пакет";
  return `${name} ${Number(amount)}`;
}

function acquiringTotal(amount) {
  const fee = money(amount * ACQUIRING_RATE);
  const vat = money(fee * VAT_RATE);
  return { fee, vat, total: money(fee + vat) };
}

async function restAll(url, key, path) {
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
      fail(`rest_${res.status}:${path.split("?")[0]}:${body.slice(0, 160)}`);
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function inFilter(ids) {
  return ids.map((id) => `"${id}"`).join(",");
}

const args = parseArgs(process.argv);
const env = loadEnv();
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] == null) process.env[key] = value;
}
const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(
  /\/+$/,
  "",
);
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !supabaseKey) fail("missing_supabase_env");

const now = new Date();
const todayMsk = moscowDay(now.toISOString());
const yesterday = new Date(`${todayMsk}T00:00:00+03:00`);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayMsk = moscowDay(yesterday.toISOString());
const fromIso = periodStartIso(args.from);

const paymentSelect = [
  "id",
  "auth_user_id",
  "landing_user_id",
  "plan_id",
  "credits",
  "amount_rub",
  "credited_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_landing_path",
  "yclid",
  "ym_client_id",
  "yandex_conversion_sent_at",
  "yandex_conversion_error",
  "yandex_conversion_attempts",
].join(",");

const paymentQuery =
  `select=${paymentSelect}` +
  `&status=eq.succeeded` +
  `&credited_at=not.is.null` +
  `&credited_at=gte.${encodeURIComponent(fromIso)}` +
  `&or=(test.is.null,test.eq.false)` +
  `&order=credited_at.asc`;

const [yookassa, robokassa] = await Promise.all([
  restAll(supabaseUrl, supabaseKey, `landing_yookassa_payments?${paymentQuery}`),
  restAll(supabaseUrl, supabaseKey, `landing_robokassa_payments?${paymentQuery}`),
]);

const live = [
  ...yookassa.map((row) => ({ ...row, provider: "yookassa" })),
  ...robokassa.map((row) => ({ ...row, provider: "robokassa" })),
]
  .filter(isDirect)
  .sort((a, b) => String(a.credited_at).localeCompare(String(b.credited_at)));

const userIds = [...new Set(live.map((row) => row.auth_user_id).filter(Boolean))];
const landingIds = [
  ...new Set(live.map((row) => row.landing_user_id).filter(Boolean)),
];

let users = [];
let generations = [];
if (landingIds.length) {
  users = await restAll(
    supabaseUrl,
    supabaseKey,
    `landing_users?select=id,credits&id=in.(${inFilter(landingIds)})`,
  );
}
if (userIds.length) {
  generations = await restAll(
    supabaseUrl,
    supabaseKey,
    `landing_generations?select=user_id,credits_spent,credits_refunded,model` +
      `&credits_spent=gt.0&user_id=in.(${inFilter(userIds)})`,
  );
}

let adsLines = [];
let adsImportError = null;
{
  const campaignFilter = Object.keys(CAMPAIGNS)
    .map((id) => `"${id}"`)
    .join(",");
  const adsRes = await fetch(
    `${supabaseUrl}/rest/v1/admin_finance_ads_lines?select=spend_date,campaign_id,campaign_name,cost_rub,clicks,impressions` +
      `&spend_date=gte.${args.from}&campaign_id=in.(${campaignFilter})`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
        Range: "0-999",
      },
    },
  );
  if (adsRes.ok) {
    const chunk = await adsRes.json();
    adsLines = Array.isArray(chunk) ? chunk : [];
  } else {
    adsImportError = `http_${adsRes.status}`;
  }
}

const creditsByUser = new Map(users.map((row) => [row.id, Number(row.credits || 0)]));
const unusedCredits = landingIds.reduce(
  (sum, id) => sum + Math.max(0, Number(creditsByUser.get(id) || 0)),
  0,
);

const genSpent = generations
  .filter((row) => row.credits_refunded !== true)
  .reduce((sum, row) => sum + Number(row.credits_spent || 0), 0);

const genByModel = {};
for (const row of generations) {
  if (row.credits_refunded === true) continue;
  const model = row.model || "unknown";
  genByModel[model] = (genByModel[model] || 0) + 1;
}

const payments = live.map((row) => {
  const amount = money(row.amount_rub);
  const credits = Number(row.credits || 0);
  const fee = acquiringTotal(amount);
  const tax = money(amount * TAX_RATE);
  const gen = money(credits * CREDIT_RUB);
  const unused = Math.max(0, Number(creditsByUser.get(row.landing_user_id) || 0));
  return {
    when: moscowStamp(row.credited_at),
    day: moscowDay(row.credited_at),
    plan: planLabel(row.plan_id, amount),
    amount,
    credits,
    unused,
    fee: fee.total,
    feeNet: fee.fee,
    feeVat: fee.vat,
    tax,
    gen,
    margin: money(amount - fee.total - tax - gen),
    camp: campaignLabel(row),
    mpSent: Boolean(row.yandex_conversion_sent_at),
    mpError: row.yandex_conversion_error || null,
    hasClientId: Boolean(String(row.ym_client_id || "").trim()),
    provider: row.provider,
  };
});

const revenue = money(payments.reduce((sum, row) => sum + row.amount, 0));
const acquiring = money(payments.reduce((sum, row) => sum + row.fee, 0));
const acquiringFee = money(payments.reduce((sum, row) => sum + row.feeNet, 0));
const acquiringVat = money(payments.reduce((sum, row) => sum + row.feeVat, 0));
const tax = money(payments.reduce((sum, row) => sum + row.tax, 0));
const creditsGranted = payments.reduce((sum, row) => sum + row.credits, 0);
const genAccrual = money(creditsGranted * CREDIT_RUB);
const creditsOther = Math.max(0, creditsGranted - genSpent - unusedCredits);
const afterVariable = money(revenue - acquiring - tax - genAccrual);

const adsFromImport = adsLines.reduce((sum, row) => sum + Number(row.cost_rub || 0), 0);
const adsLastDay = adsLines.reduce((latest, row) => {
  const day = String(row.spend_date || "").slice(0, 10);
  return day > latest ? day : latest;
}, "");

let ads = {
  source: "missing",
  mediaRub: null,
  vatRub: null,
  totalRub: null,
  lastDay: adsLastDay || null,
  stale: false,
  importError: adsImportError,
  byCampaign: [],
};
if (args.adsMedia != null) {
  ads = {
    source: "cabinet",
    mediaRub: args.adsMedia,
    vatRub: money(args.adsMedia * VAT_RATE),
    totalRub: money(args.adsMedia * (1 + VAT_RATE)),
    lastDay: todayMsk,
    stale: false,
    byCampaign: [],
  };
} else {
  try {
    const { fetchCampaignSpend, getDirectToken } = await import(
      pathToFileURL(join(root, "src/standalone/yandex-direct-api.mjs")).href
    );
    if (getDirectToken()) {
      const spend = await fetchCampaignSpend({
        dateFrom: args.from,
        dateTo: todayMsk,
      });
      ads = {
        source: "direct_api",
        mediaRub: spend.mediaRub,
        vatRub: money(spend.mediaRub * VAT_RATE),
        totalRub: money(spend.mediaRub * (1 + VAT_RATE)),
        lastDay: spend.lastDay,
        stale: false,
        byCampaign: spend.campaigns,
      };
    }
  } catch (err) {
    ads.importError = err instanceof Error ? err.message : String(err);
  }
}
if (ads.source === "missing" && adsLines.length) {
  const mediaRub = money(adsFromImport);
  ads = {
    source: "admin_finance_ads_lines",
    mediaRub,
    vatRub: money(mediaRub * VAT_RATE),
    totalRub: money(mediaRub * (1 + VAT_RATE)),
    lastDay: adsLastDay || null,
    stale: Boolean(adsLastDay && adsLastDay < todayMsk),
  };
}

const realized = ads.totalRub == null ? null : money(afterVariable - ads.totalRub);
const firstPayers = new Set(live.map((row) => row.landing_user_id)).size;
const cacMedia =
  ads.mediaRub != null && firstPayers > 0 ? money(ads.mediaRub / firstPayers) : null;
const cacCash =
  ads.totalRub != null && firstPayers > 0 ? money(ads.totalRub / firstPayers) : null;

const mpPayments = payments.filter((row) => row.mpSent);
const noMp = payments.filter((row) => !row.mpSent);
const mpPeople = new Set(
  live.filter((row) => row.yandex_conversion_sent_at).map((row) => row.landing_user_id),
).size;
const mpRevenue = money(mpPayments.reduce((sum, row) => sum + row.amount, 0));
const noMpRevenue = money(noMp.reduce((sum, row) => sum + row.amount, 0));

const yesterdayPayments = payments.filter((row) => row.day === yesterdayMsk);
const yesterdayRevenue = money(
  yesterdayPayments.reduce((sum, row) => sum + row.amount, 0),
);

const canScale =
  firstPayers >= SCALE_MIN_FIRST_PAYERS &&
  cacMedia != null &&
  cacMedia <= CAC_MAX_RUB;

const payload = {
  asOf: `${moscowStamp(now.toISOString())} MSK`,
  timezone: "Europe/Moscow",
  period: `${args.from} 00:00 — ${todayMsk}`,
  from: args.from,
  today: todayMsk,
  yesterday: yesterdayMsk,
  constants: {
    creditRub: CREDIT_RUB,
    taxRate: TAX_RATE,
    acquiringRate: ACQUIRING_RATE,
    vatRate: VAT_RATE,
    cacMaxRub: CAC_MAX_RUB,
    scaleMinFirstPayers: SCALE_MIN_FIRST_PAYERS,
  },
  payments: payments.length,
  users: firstPayers,
  revenue,
  acquiring: acquiringFee,
  acquiringVat,
  acquiringTotal: acquiring,
  tax,
  creditsGranted,
  creditsSpentGens: genSpent,
  creditsOther,
  creditsUnused: unusedCredits,
  genAccrual,
  genByModel,
  ads,
  afterVariable,
  realized,
  cacMedia,
  cacCash,
  canScale,
  scaleBlockedReason: canScale
    ? null
    : firstPayers < SCALE_MIN_FIRST_PAYERS
      ? "мало_плательщиков"
      : cacMedia != null && cacMedia > CAC_MAX_RUB
        ? "cac_выше_82"
        : "нет_расхода_рекламы",
  mp: {
    payments: mpPayments.length,
    people: mpPeople,
    revenue: mpRevenue,
    noMpPayments: noMp.length,
    noMpRevenue,
    repeats: Math.max(0, mpPayments.length - mpPeople),
  },
  yesterdaySlice: {
    day: yesterdayMsk,
    payments: yesterdayPayments.length,
    revenue: yesterdayRevenue,
  },
  rows: payments,
};

console.log(JSON.stringify(payload));
