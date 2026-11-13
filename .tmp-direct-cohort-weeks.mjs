import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";
const TEST_START = "2026-08-23";

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

function isDirect(row) {
  const yclid = String(row.yclid || "").trim();
  const source = String(row.utm_source || "").trim().toLowerCase();
  const medium = String(row.utm_medium || "").trim().toLowerCase();
  return Boolean(yclid) || (source === "yandex" && medium === "cpc");
}

function userKey(row) {
  return row.auth_user_id || row.landing_user_id || null;
}

function mondayOf(dayStr) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (dow - 1));
  return dt.toISOString().slice(0, 10);
}

function addDays(dayStr, n) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function weekLabel(monday) {
  const end = addDays(monday, 6);
  const fmt = (s) => {
    const [, mo, da] = s.split("-");
    return `${da}.${mo}`;
  };
  return `${fmt(monday)}–${fmt(end)}`;
}

async function restAll(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Range: `${from}-${from + 999}`,
      },
    });
    if (!res.ok) throw new Error(`rest_${res.status}:${await res.text()}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return rows;
}

const select = [
  "id",
  "auth_user_id",
  "landing_user_id",
  "plan_id",
  "amount_rub",
  "credited_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "yclid",
  "status",
  "test",
].join(",");

const fromIso = `${TEST_START}T00:00:00+03:00`;
const query =
  `select=${select}` +
  `&status=eq.succeeded` +
  `&credited_at=not.is.null` +
  `&credited_at=gte.${encodeURIComponent(fromIso)}` +
  `&or=(test.is.null,test.eq.false)` +
  `&order=credited_at.asc`;

const yookassa = await restAll(`landing_yookassa_payments?${query}`);
const robokassa = await restAll(`landing_robokassa_payments?${query}`);

const payments = [...yookassa, ...robokassa]
  .filter(isDirect)
  .map((row) => ({
    user: userKey(row),
    day: moscowDay(row.credited_at),
    week: mondayOf(moscowDay(row.credited_at)),
    creditedAt: row.credited_at,
    plan: row.plan_id || "pack",
    amount: money(row.amount_rub),
    campaign: String(row.utm_campaign || "").trim() || (row.yclid ? "yclid" : "unknown"),
  }))
  .filter((p) => p.user);

const byUser = new Map();
for (const p of payments) {
  if (!byUser.has(p.user)) byUser.set(p.user, []);
  byUser.get(p.user).push(p);
}
for (const list of byUser.values()) {
  list.sort((a, b) => String(a.creditedAt).localeCompare(String(b.creditedAt)));
}

const allWeeks = [...new Set(payments.map((p) => p.week))].sort();
const lastDay = payments.at(-1)?.day || addDays(allWeeks.at(-1), 6);

// cohort week = week of user's FIRST direct payment ever
const cohortUsers = new Map();
for (const [user, list] of byUser) {
  const first = list[0];
  const cohortWeek = first.week;
  if (!cohortUsers.has(cohortWeek)) cohortUsers.set(cohortWeek, []);
  cohortUsers.get(cohortWeek).push({ user, first, all: list });
}

function weekPayments(weekMon) {
  const weekEnd = addDays(weekMon, 6);
  return payments.filter((p) => p.day >= weekMon && p.day <= weekEnd);
}

const cohortRows = allWeeks.map((cohortWeek) => {
  const members = cohortUsers.get(cohortWeek) || [];
  const cohortPayInWeek = weekPayments(cohortWeek).filter((p) =>
    members.some((m) => m.user === p.user),
  );
  const firstPlans = {};
  for (const m of members) {
    const k = `${m.first.plan} ${m.first.amount}`;
    firstPlans[k] = (firstPlans[k] || 0) + 1;
  }

  const withinWeekRepeat = members.filter((m) => {
    const inWeek = m.all.filter(
      (p) => p.week === cohortWeek && p.day >= cohortWeek && p.day <= addDays(cohortWeek, 6),
    );
    return inWeek.length > 1;
  });

  const laterReturns = {};
  for (const targetWeek of allWeeks) {
    if (targetWeek <= cohortWeek) continue;
    const returned = members.filter((m) =>
      m.all.some((p) => p.week === targetWeek),
    );
    if (returned.length) {
      const pays = returned.flatMap((m) =>
        m.all.filter((p) => p.week === targetWeek),
      );
      laterReturns[targetWeek] = {
        users: returned.length,
        payments: pays.length,
        revenue: money(pays.reduce((s, p) => s + p.amount, 0)),
      };
    }
  }

  const everReturned = members.filter((m) => m.all.length > 1);
  const returnedLaterOnly = everReturned.filter((m) => {
    const firstWeekPays = m.all.filter((p) => p.week === cohortWeek).length;
    return m.all.length > firstWeekPays;
  });

  return {
    cohortWeek,
    label: weekLabel(cohortWeek),
    partial: addDays(cohortWeek, 6) > lastDay,
    users: members.length,
    paymentsInCohortWeek: cohortPayInWeek.length,
    revenueInCohortWeek: money(cohortPayInWeek.reduce((s, p) => s + p.amount, 0)),
    avgCheck: members.length
      ? money(cohortPayInWeek.reduce((s, p) => s + p.amount, 0) / cohortPayInWeek.length)
      : 0,
    firstPlans: Object.fromEntries(
      Object.entries(firstPlans).sort((a, b) => b[1] - a[1]),
    ),
    withinWeekRepeatUsers: withinWeekRepeat.length,
    withinWeekRepeatRate: members.length
      ? money((withinWeekRepeat.length / members.length) * 100)
      : 0,
    everRepeatUsers: everReturned.length,
    everRepeatRate: members.length
      ? money((everReturned.length / members.length) * 100)
      : 0,
    returnedLaterUsers: returnedLaterOnly.length,
    returnedLaterRate: members.length
      ? money((returnedLaterOnly.length / members.length) * 100)
      : 0,
    laterReturnsByWeek: laterReturns,
    nextWeekReturn:
      laterReturns[addDays(cohortWeek, 7)] || { users: 0, payments: 0, revenue: 0 },
  };
});

// retention matrix: cohort week x activity week
const matrix = allWeeks.map((cohortWeek) => {
  const members = new Set((cohortUsers.get(cohortWeek) || []).map((m) => m.user));
  const cells = {};
  for (const activityWeek of allWeeks) {
    if (activityWeek < cohortWeek) continue;
    const active = [...members].filter((u) =>
      (byUser.get(u) || []).some((p) => p.week === activityWeek),
    );
    cells[activityWeek] = {
      users: active.length,
      rate: members.size ? money((active.length / members.size) * 100) : 0,
    };
  }
  return { cohortWeek, label: weekLabel(cohortWeek), size: members.size, cells };
});

// summary stats
const totalUsers = byUser.size;
const everRepeat = [...byUser.values()].filter((l) => l.length > 1).length;
const crossWeekRepeat = [...byUser.values()].filter((l) => {
  const weeks = new Set(l.map((p) => p.week));
  return l.length > 1 && weeks.size > 1;
}).length;

const report = {
  pulledAt: new Date().toISOString(),
  testStart: TEST_START,
  lastPaymentDay: lastDay,
  totals: {
    users: totalUsers,
    payments: payments.length,
    revenue: money(payments.reduce((s, p) => s + p.amount, 0)),
    everRepeatUsers: everRepeat,
    everRepeatRate: money((everRepeat / totalUsers) * 100),
    crossWeekRepeatUsers: crossWeekRepeat,
    crossWeekRepeatRate: money((crossWeekRepeat / totalUsers) * 100),
  },
  cohorts: cohortRows,
  retentionMatrix: matrix,
};

const outPath = join(root, ".tmp-direct-cohort-weeks.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      cohorts: cohortRows.map((c) => ({
        label: c.label,
        users: c.users,
        rev: c.revenueInCohortWeek,
        withinRepeat: c.withinWeekRepeatRate,
        laterRepeat: c.returnedLaterRate,
        nextWeek: c.nextWeekReturn,
      })),
      crossWeekRepeatRate: report.totals.crossWeekRepeatRate,
    },
    null,
    2,
  ),
);
