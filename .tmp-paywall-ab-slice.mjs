import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, setGlobalDispatcher, fetch as undiciFetch } from "undici";
import { pathToFileURL } from "node:url";

setGlobalDispatcher(
  new Agent({
    connect: { timeout: 90_000 },
    bodyTimeout: 180_000,
    headersTimeout: 180_000,
  }),
);

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";
const outPath = join(root, ".tmp-paywall-ab-slice.json");

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
};
const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(
  /\/+$/,
  "",
);
const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) {
  console.error(JSON.stringify({ error: "missing_supabase_env" }));
  process.exit(1);
}

async function restAll(path) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await undiciFetch(`${url}/rest/v1/${path}`, {
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
  "paywall_variant",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_landing_path",
  "yclid",
].join(",");

const fromIso = "2026-08-23T00:00:00+03:00";
const query =
  `select=${select}` +
  `&status=eq.succeeded` +
  `&credited_at=not.is.null` +
  `&credited_at=gte.${encodeURIComponent(fromIso)}` +
  `&or=(test.is.null,test.eq.false)` +
  `&order=credited_at.asc`;

const started = Date.now();
const yookassa = await restAll(`landing_yookassa_payments?${query}`);
const robokassa = await restAll(`landing_robokassa_payments?${query}`);

const CONTROL_PRICES = new Set([199, 399, 899, 1499]);
const TREATMENT_PRICES = new Set([99, 299, 469, 990]);
const money = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function inferCatalog(amount) {
  const n = money(amount);
  if (CONTROL_PRICES.has(n)) return "control";
  if (TREATMENT_PRICES.has(n)) return "treatment";
  return "other";
}

function moscowDay(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function moscowStamp(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function isDirect(row) {
  const yclid = String(row.yclid || "").trim();
  const source = String(row.utm_source || "").trim().toLowerCase();
  const medium = String(row.utm_medium || "").trim().toLowerCase();
  return Boolean(yclid) || (source === "yandex" && medium === "cpc");
}

function channel(row) {
  if (isDirect(row)) return "direct";
  const source = String(row.utm_source || "").trim().toLowerCase();
  if (!source) return "none";
  if (source === "yandex" || source === "google") return "organic_search";
  return source;
}

function storedVariant(row) {
  return row.paywall_variant === "control" || row.paywall_variant === "treatment"
    ? row.paywall_variant
    : "unlabeled";
}

function empty() {
  return {
    payments: 0,
    revenue: 0,
    credits: 0,
    margin: 0,
    users: new Set(),
    plans: {},
    days: {},
    channels: {},
    providers: {},
    catalogs: {},
  };
}

function add(s, row) {
  const amount = money(row.amount_rub);
  const credits = Number(row.credits || 0);
  const fee = money(amount * 0.035 * 1.22);
  const usn = money(amount * 0.06);
  const gen = money(credits * 0.5);
  const margin = money(amount - fee - usn - gen);
  const user = row.auth_user_id || row.landing_user_id;
  const plan = `${row.plan_id || "pack"} ${amount}`;
  const day = moscowDay(row.credited_at || row.created_at);
  s.payments += 1;
  s.revenue = money(s.revenue + amount);
  s.credits += credits;
  s.margin = money(s.margin + margin);
  if (user) s.users.add(user);
  s.plans[plan] = (s.plans[plan] || 0) + 1;
  s.days[day] = (s.days[day] || 0) + 1;
  const ch = channel(row);
  s.channels[ch] = (s.channels[ch] || 0) + 1;
  s.providers[row.provider] = (s.providers[row.provider] || 0) + 1;
  const cat = inferCatalog(amount);
  s.catalogs[cat] = (s.catalogs[cat] || 0) + 1;
}

function finish(s) {
  const users = s.users.size;
  return {
    payments: s.payments,
    users,
    revenue: s.revenue,
    avgCheck: s.payments ? money(s.revenue / s.payments) : 0,
    arppu: users ? money(s.revenue / users) : 0,
    credits: s.credits,
    rubPerCredit: s.credits ? money(s.revenue / s.credits) : 0,
    margin: s.margin,
    marginPerPayment: s.payments ? money(s.margin / s.payments) : 0,
    plans: s.plans,
    days: s.days,
    channels: s.channels,
    providers: s.providers,
    catalogs: s.catalogs,
  };
}

const live = [
  ...yookassa.map((r) => ({ ...r, provider: "yookassa" })),
  ...robokassa.map((r) => ({ ...r, provider: "robokassa" })),
].sort((a, b) =>
  String(a.credited_at).localeCompare(String(b.credited_at)),
);

const byStored = { control: empty(), treatment: empty(), unlabeled: empty() };
const byCatalog = { control: empty(), treatment: empty(), other: empty() };
const byChannel = {};
const daily = {};

for (const row of live) {
  add(byStored[storedVariant(row)], row);
  add(byCatalog[inferCatalog(row.amount_rub)], row);
  const ch = channel(row);
  if (!byChannel[ch]) byChannel[ch] = empty();
  add(byChannel[ch], row);
  const day = moscowDay(row.credited_at || row.created_at);
  if (!daily[day]) daily[day] = { n: 0, revenue: 0, control: 0, treatment: 0, other: 0 };
  daily[day].n += 1;
  daily[day].revenue = money(daily[day].revenue + money(row.amount_rub));
  daily[day][inferCatalog(row.amount_rub)] += 1;
}

const report = {
  pulledAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  window: {
    from: fromIso,
    to: "now",
    first: live[0]?.credited_at || null,
    last: live.at(-1)?.credited_at || null,
    firstMsk: live[0] ? moscowStamp(live[0].credited_at) : null,
    lastMsk: live.at(-1) ? moscowStamp(live.at(-1).credited_at) : null,
  },
  totals: {
    payments: live.length,
    yookassa: yookassa.length,
    robokassa: robokassa.length,
    users: new Set(live.map((r) => r.auth_user_id || r.landing_user_id)).size,
    revenue: money(live.reduce((a, r) => a + money(r.amount_rub), 0)),
    credits: live.reduce((a, r) => a + Number(r.credits || 0), 0),
  },
  byStored: {
    control: finish(byStored.control),
    treatment: finish(byStored.treatment),
    unlabeled: finish(byStored.unlabeled),
  },
  byCatalog: {
    control: finish(byCatalog.control),
    treatment: finish(byCatalog.treatment),
    other: finish(byCatalog.other),
  },
  byChannel: Object.fromEntries(
    Object.entries(byChannel).map(([k, v]) => [k, finish(v)]),
  ),
  daily,
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: true,
  outPath,
  payments: report.totals.payments,
  first: report.window.firstMsk,
  last: report.window.lastMsk,
  byCatalog: {
    control: report.byCatalog.control.payments,
    treatment: report.byCatalog.treatment.payments,
    other: report.byCatalog.other.payments,
  },
  byStored: {
    control: report.byStored.control.payments,
    treatment: report.byStored.treatment.payments,
    unlabeled: report.byStored.unlabeled.payments,
  },
}));
