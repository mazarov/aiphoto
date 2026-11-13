import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const PREV_WEEK_FROM = "2026-09-08";
const PREV_WEEK_TO = "2026-09-14";
const THIS_WEEK_FROM = "2026-09-15";
const THIS_WEEK_TO = "2026-09-17";

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

function inRange(iso, fromDay, toDay) {
  const day = moscowDay(iso);
  return day >= fromDay && day <= toDay;
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
    if (!res.ok) throw new Error(`rest_${res.status}:${await res.text()}`);
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
  "utm_source",
  "utm_medium",
  "utm_campaign",
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

const yookassa = await restAll(`landing_yookassa_payments?${query}`);
const robokassa = await restAll(`landing_robokassa_payments?${query}`);
const allLive = [
  ...yookassa.map((r) => ({ ...r, provider: "yookassa" })),
  ...robokassa.map((r) => ({ ...r, provider: "robokassa" })),
].filter(isDirect);

function slim(row) {
  return {
    id: row.id,
    user: userKey(row),
    day: moscowDay(row.credited_at),
    creditedAt: row.credited_at,
    plan: row.plan_id || "pack",
    amount: money(row.amount_rub),
    credits: Number(row.credits || 0),
    campaign: String(row.utm_campaign || "").trim() || (row.yclid ? "yclid" : "unknown"),
  };
}

const payments = allLive.map(slim).filter((r) => r.user);

// per-user timeline
const byUser = new Map();
for (const p of payments) {
  if (!byUser.has(p.user)) byUser.set(p.user, []);
  byUser.get(p.user).push(p);
}
for (const list of byUser.values()) {
  list.sort((a, b) => String(a.creditedAt).localeCompare(String(b.creditedAt)));
}

const prevWeekPayments = payments.filter((p) =>
  inRange(p.creditedAt, PREV_WEEK_FROM, PREV_WEEK_TO),
);
const thisWeekPayments = payments.filter((p) =>
  inRange(p.creditedAt, THIS_WEEK_FROM, THIS_WEEK_TO),
);

const prevWeekUsers = new Set(prevWeekPayments.map((p) => p.user));
const thisWeekUsers = new Set(thisWeekPayments.map((p) => p.user));

// users whose FIRST ever direct payment was last week
const firstDirectLastWeek = [];
for (const [user, list] of byUser) {
  const first = list[0];
  if (inRange(first.creditedAt, PREV_WEEK_FROM, PREV_WEEK_TO)) {
    firstDirectLastWeek.push({ user, first, all: list });
  }
}

// among prev week payers (any payment last week, not necessarily first)
const prevWeekCohort = [];
for (const user of prevWeekUsers) {
  const list = byUser.get(user) || [];
  const prevPays = list.filter((p) =>
    inRange(p.creditedAt, PREV_WEEK_FROM, PREV_WEEK_TO),
  );
  const thisPays = list.filter((p) =>
    inRange(p.creditedAt, THIS_WEEK_FROM, THIS_WEEK_TO),
  );
  const firstEver = list[0];
  const firstPrevWeek = prevPays[0];
  prevWeekCohort.push({
    user,
    firstEverDay: firstEver.day,
    isNewLastWeek: inRange(firstEver.creditedAt, PREV_WEEK_FROM, PREV_WEEK_TO),
    prevWeek: {
      payments: prevPays.length,
      revenue: money(prevPays.reduce((s, p) => s + p.amount, 0)),
      firstPlan: firstPrevWeek.plan,
      firstAmount: firstPrevWeek.amount,
      days: [...new Set(prevPays.map((p) => p.day))],
    },
    thisWeek: {
      payments: thisPays.length,
      revenue: money(thisPays.reduce((s, p) => s + p.amount, 0)),
      plans: thisPays.map((p) => `${p.plan} ${p.amount}`),
      days: thisPays.map((p) => p.day),
    },
    lifetime: {
      payments: list.length,
      revenue: money(list.reduce((s, p) => s + p.amount, 0)),
    },
  });
}

const returnedThisWeek = prevWeekCohort.filter((u) => u.thisWeek.payments > 0);
const newLastWeekOnly = prevWeekCohort.filter((u) => u.isNewLastWeek);
const newLastWeekReturned = newLastWeekOnly.filter((u) => u.thisWeek.payments > 0);
const repeatFromBefore = prevWeekCohort.filter((u) => !u.isNewLastWeek);
const repeatFromBeforeReturned = repeatFromBefore.filter(
  (u) => u.thisWeek.payments > 0,
);

// this week: how many are brand new vs returning from before
const thisWeekNewUsers = [...thisWeekUsers].filter((user) => {
  const first = byUser.get(user)?.[0];
  return first && inRange(first.creditedAt, THIS_WEEK_FROM, THIS_WEEK_TO);
});
const thisWeekReturningFromPrev = [...thisWeekUsers].filter((user) =>
  prevWeekUsers.has(user),
);
const thisWeekReturningOlder = [...thisWeekUsers].filter((user) => {
  const first = byUser.get(user)?.[0];
  return (
    first &&
    !inRange(first.creditedAt, THIS_WEEK_FROM, THIS_WEEK_TO) &&
    !prevWeekUsers.has(user)
  );
});

function summarizeUsers(users) {
  let payments = 0;
  let revenue = 0;
  for (const u of users) {
    const list = byUser.get(u) || [];
    const subset = list.filter((p) =>
      inRange(p.creditedAt, THIS_WEEK_FROM, THIS_WEEK_TO),
    );
    payments += subset.length;
    revenue = money(revenue + subset.reduce((s, p) => s + p.amount, 0));
  }
  return { users: users.length, payments, revenue };
}

const report = {
  pulledAt: new Date().toISOString(),
  prevWeek: { from: PREV_WEEK_FROM, to: PREV_WEEK_TO },
  thisWeek: { from: THIS_WEEK_FROM, to: THIS_WEEK_TO },
  prevWeekCohort: {
    users: prevWeekUsers.size,
    payments: prevWeekPayments.length,
    revenue: money(prevWeekPayments.reduce((s, p) => s + p.amount, 0)),
    newDirectUsers: newLastWeekOnly.length,
    returningFromEarlier: repeatFromBefore.length,
  },
  repeatToThisWeek: {
    users: returnedThisWeek.length,
    rateAmongPrevWeek: prevWeekUsers.size
      ? money((returnedThisWeek.length / prevWeekUsers.size) * 100)
      : 0,
    payments: returnedThisWeek.reduce((s, u) => s + u.thisWeek.payments, 0),
    revenue: money(returnedThisWeek.reduce((s, u) => s + u.thisWeek.revenue, 0)),
    newLastWeekReturned: {
      users: newLastWeekReturned.length,
      rateAmongNew: newLastWeekOnly.length
        ? money((newLastWeekReturned.length / newLastWeekOnly.length) * 100)
        : 0,
    },
    repeatFromBeforeReturned: {
      users: repeatFromBeforeReturned.length,
      rateAmongRepeat: repeatFromBefore.length
        ? money((repeatFromBeforeReturned.length / repeatFromBefore.length) * 100)
        : 0,
    },
  },
  thisWeekComposition: {
    totalUsers: thisWeekUsers.size,
    totalPayments: thisWeekPayments.length,
    totalRevenue: money(thisWeekPayments.reduce((s, p) => s + p.amount, 0)),
    brandNew: summarizeUsers(thisWeekNewUsers),
    fromPrevWeek: summarizeUsers([...thisWeekReturningFromPrev]),
    fromOlderCohorts: summarizeUsers([...thisWeekReturningOlder]),
  },
  planMixPrevWeek: Object.fromEntries(
    Object.entries(
      prevWeekPayments.reduce((acc, p) => {
        const k = `${p.plan} ${p.amount}`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]),
  ),
  returnedDetails: returnedThisWeek.map((u) => ({
    prevWeekPayments: u.prevWeek.payments,
    prevWeekRevenue: u.prevWeek.revenue,
    prevFirstPlan: `${u.prevWeek.firstPlan} ${u.prevWeek.firstAmount}`,
    isNewLastWeek: u.isNewLastWeek,
    thisWeekPayments: u.thisWeek.payments,
    thisWeekRevenue: u.thisWeek.revenue,
    thisWeekPlans: u.thisWeek.plans,
    lifetimePayments: u.lifetime.payments,
    lifetimeRevenue: u.lifetime.revenue,
  })),
  notReturnedCount: prevWeekCohort.length - returnedThisWeek.length,
};

const outPath = join(root, ".tmp-direct-cohort-repeat.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: true,
  outPath,
  prevWeekUsers: report.prevWeekCohort.users,
  returnedThisWeek: report.repeatToThisWeek.users,
  rate: report.repeatToThisWeek.rateAmongPrevWeek,
  thisWeekFromPrev: report.thisWeekComposition.fromPrevWeek,
}, null, 2));
