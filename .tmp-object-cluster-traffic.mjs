import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";

function loadEnvFile(path) {
  const out = {};
  try {
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
  } catch {
    // missing file
  }
  return out;
}

const env = {
  ...loadEnvFile(join(root, ".env")),
  ...loadEnvFile(join(root, "landing/.env")),
  ...loadEnvFile(join(root, "landing/.env.local")),
};

const registry = readFileSync(join(root, "landing/src/lib/tag-registry.ts"), "utf8");
const tags = [];
for (const line of registry.split("\n")) {
  if (!line.includes("object_tag")) continue;
  const slug = line.match(/slug: "([^"]+)"/)?.[1];
  const label = line.match(/labelRu: "([^"]+)"/)?.[1];
  const path = line.match(/urlPath: "([^"]+)"/)?.[1];
  if (slug && path) tags.push({ slug, path, label: label || slug });
}

const organicPath =
  "/Users/azarovmaxim/.cursor/projects/Users-azarovmaxim-photo2sticker-bot-aiphoto/agent-tools/7c361856-a931-4e27-91c3-1b1a670253d4.txt";
const organic = JSON.parse(readFileSync(organicPath, "utf8"));
const organicByPath = new Map();
for (const row of organic.rows) {
  const url = row.dimensions["ym:s:startURL"];
  const path = url.replace("https://promptshot.ru", "");
  organicByPath.set(path, row.metrics);
}

const live = [];
const dead = [];
let totalVisits = 0;
let totalUsers = 0;

for (const tag of tags) {
  const m = organicByPath.get(tag.path);
  if (m?.["ym:s:visits"] > 0) {
    live.push({
      ...tag,
      visits: m["ym:s:visits"],
      users: m["ym:s:users"],
      bounceRate: Math.round(m["ym:s:bounceRate"] * 10) / 10,
    });
    totalVisits += m["ym:s:visits"];
    totalUsers += m["ym:s:users"];
  } else {
    dead.push(tag);
  }
}
live.sort((a, b) => b.visits - a.visits);

const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const clusterPaths = new Set(tags.map((t) => t.path));

let payments = [];
if (supabaseUrl && supabaseKey) {
  const fromIso = "2026-08-20T00:00:00+03:00";
  const select = [
    "id",
    "amount_rub",
    "plan_id",
    "credited_at",
    "utm_source",
    "utm_medium",
    "utm_landing_path",
    "yclid",
  ].join(",");
  const query =
    `select=${select}` +
    `&status=eq.succeeded` +
    `&credited_at=not.is.null` +
    `&credited_at=gte.${encodeURIComponent(fromIso)}` +
    `&or=(test.is.null,test.eq.false)` +
    `&order=credited_at.desc`;

  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${supabaseUrl}/rest/v1/landing_yookassa_payments?${query}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
        Range: `${from}-${from + 999}`,
      },
    });
    if (!res.ok) throw new Error(`payments_${res.status}:${await res.text()}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    payments.push(...chunk);
    if (chunk.length < 1000) break;
  }

  // Robokassa mirror table if present
  try {
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${supabaseUrl}/rest/v1/landing_robokassa_payments?${query}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json",
          Range: `${from}-${from + 999}`,
        },
      });
      if (!res.ok) break;
      const chunk = await res.json();
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      payments.push(...chunk);
      if (chunk.length < 1000) break;
    }
  } catch {
    // optional
  }
}

const clusterPayments = payments.filter((p) => clusterPaths.has(p.utm_landing_path));
const byLanding = new Map();
for (const p of clusterPayments) {
  const key = p.utm_landing_path;
  const cur = byLanding.get(key) || {
    path: key,
    label: tags.find((t) => t.path === key)?.label || key,
    payments: 0,
    revenueRub: 0,
    sources: {},
  };
  cur.payments += 1;
  cur.revenueRub += Number(p.amount_rub || 0);
  const src = `${p.utm_source || "?"} / ${p.utm_medium || "?"}`;
  cur.sources[src] = (cur.sources[src] || 0) + 1;
  byLanding.set(key, cur);
}

const paymentSummary = [...byLanding.values()].sort((a, b) => b.payments - a.payments);

const out = {
  period: { days: 30, from: "2026-08-21", to: "2026-09-19", source: "Yandex Metrica organic landings" },
  cluster: "Сцены и объекты (object_tag)",
  inventory: { totalPages: tags.length, livePages: live.length, deadPages: dead.length },
  traffic: { totalOrganicVisits: totalVisits, totalOrganicUsers: totalUsers },
  livePages: live,
  deadPages: dead.map((d) => ({ path: d.path, label: d.label })),
  payments: {
    hasDb: Boolean(supabaseUrl && supabaseKey),
    totalClusterPayments30d: clusterPayments.length,
    totalClusterRevenueRub30d: clusterPayments.reduce((s, p) => s + Number(p.amount_rub || 0), 0),
    byLandingPath: paymentSummary,
    allPayments: clusterPayments.map((p) => ({
      id: p.id,
      path: p.utm_landing_path,
      amountRub: p.amount_rub,
      planId: p.plan_id,
      creditedAt: p.credited_at,
      source: p.utm_source,
      medium: p.utm_medium,
      yclid: p.yclid,
    })),
  },
};

writeFileSync(join(root, ".tmp-object-cluster-traffic.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  live: live.length,
  dead: dead.length,
  visits: totalVisits,
  payments: clusterPayments.length,
  hasDb: out.payments.hasDb,
}, null, 2));
