import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";
const outPath = join(root, ".tmp-four-week-retention.json");
const cohortWeeks = [
  "2026-08-24",
  "2026-08-31",
  "2026-09-07",
  "2026-09-14",
];
const firstCohortDay = cohortWeeks[0];
const MS_DAY = 86_400_000;

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
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Range: `${from}-${from + 999}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `rest_${res.status}:${path.split("?")[0]}:${body.slice(0, 240)}`,
      );
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return rows;
}

const n = (value) => {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
};
const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;
const pct = (part, whole) => (whole ? round1((part / whole) * 100) : null);

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return round1(sorted[lo]);
  return round1(sorted[lo] * (hi - index) + sorted[hi] * (index - lo));
}

function moscowDay(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function mondayOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

function addDays(day, amount) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function directPayment(row) {
  const yclid = String(row.yclid || "").trim();
  const source = String(row.utm_source || "").trim().toLowerCase();
  const medium = String(row.utm_medium || "").trim().toLowerCase();
  return Boolean(yclid) || (source === "yandex" && medium === "cpc");
}

function userId(row) {
  return row.landing_user_id || row.auth_user_id || null;
}

function generationKind(g) {
  if (g.modality === "video") return "video";
  if (g.edit_kind === "photoshoot") return "photoshoot";
  if (g.edit_kind === "camera_orbit") return "camera_orbit";
  if (g.edit_kind === "local_edit" || g.parent_generation_id) return "edit/remix";
  if (g.vibe_id) return "photo_to_prompt";
  if (g.card_id) return "catalog_card";
  return "custom_prompt";
}

function contentCategory(text) {
  const value = String(text || "").toLowerCase();
  const checks = [
    ["birthday", /(birthday|день рожден|торт|свеч)/],
    ["couple", /(couple|пар[аы]|влюб|romantic|wedding|свад)/],
    ["family/kids", /(family|семь|ребен|ребён|детск|mother|father|mom|dad|мам|пап)/],
    ["business", /(business|делов|office|офис|linkedin|corporate|професси)/],
    ["fashion/beauty", /(fashion|beauty|макияж|модн|glamour|luxury|плать|outfit)/],
    ["holiday", /(new year|christmas|новый год|рождеств|halloween|8 march|8 марта)/],
    ["travel/outdoor", /(travel|beach|mountain|street|city|nature|лес|пляж|гор|улиц|город)/],
    ["product/object", /(product photo|товар|предметн|packshot|food|еда|машин|car\\b)/],
    ["portrait", /(portrait|портрет|headshot|close-up|крупн.*план|selfie|селфи|woman|man|girl|boy|девуш|мужчин)/],
  ];
  for (const [label, regex] of checks) {
    if (regex.test(value)) return label;
  }
  return "other";
}

console.error("fetch payments / users");
const [yk, rk, users] = await Promise.all([
  restAll(
    "landing_yookassa_payments?select=landing_user_id,auth_user_id,plan_id,credits,amount_rub,status,test,credited_at,created_at,utm_source,utm_medium,utm_campaign,yclid&status=eq.succeeded&credited_at=not.is.null&order=credited_at.asc",
  ),
  restAll(
    "landing_robokassa_payments?select=landing_user_id,auth_user_id,plan_id,credits,amount_rub,status,test,credited_at,created_at,utm_source,utm_medium,utm_campaign,yclid&status=eq.succeeded&credited_at=not.is.null&order=credited_at.asc",
  ).catch((error) => {
    if (String(error).includes("rest_404") || String(error).includes("PGRST205")) {
      return [];
    }
    throw error;
  }),
  restAll("landing_users?select=id,credits,created_at"),
]);

const payments = [...yk, ...rk]
  .filter((row) => row.test !== true && row.credited_at && userId(row))
  .map((row) => ({
    userId: userId(row),
    ts: new Date(row.credited_at).getTime(),
    creditedAt: row.credited_at,
    day: moscowDay(row.credited_at),
    week: mondayOf(moscowDay(row.credited_at)),
    plan: String(row.plan_id || "unknown"),
    credits: n(row.credits),
    amount: n(row.amount_rub),
    direct: directPayment(row),
  }))
  .sort((a, b) => a.ts - b.ts);

const paymentsByUser = new Map();
for (const payment of payments) {
  if (!paymentsByUser.has(payment.userId)) paymentsByUser.set(payment.userId, []);
  paymentsByUser.get(payment.userId).push(payment);
}

const cohortUserIds = [...paymentsByUser.entries()]
  .filter(([, list]) => cohortWeeks.includes(list[0].week))
  .map(([id]) => id);

console.error(`fetch generations for ${cohortUserIds.length} cohort users`);
const generations = [];
for (let i = 0; i < cohortUserIds.length; i += 60) {
  const ids = cohortUserIds.slice(i, i + 60);
  generations.push(
    ...(await restAll(
      `landing_generations?select=id,user_id,status,credits_spent,credits_refunded,created_at,generation_completed_at,model,requested_model,executed_model,modality,edit_kind,card_id,vibe_id,parent_generation_id,client_source,prompt_text&user_id=in.(${ids.join(",")})&created_at=gte.${encodeURIComponent(`${firstCohortDay}T00:00:00+03:00`)}&client_source=neq.admin&order=created_at.asc`,
    )),
  );
}

const balanceByUser = new Map(users.map((row) => [row.id, n(row.credits)]));
const generationsByUser = new Map();
for (const row of generations) {
  const ts = new Date(row.generation_completed_at || row.created_at).getTime();
  const generation = {
    ...row,
    ts,
    day: moscowDay(row.generation_completed_at || row.created_at),
    week: mondayOf(moscowDay(row.generation_completed_at || row.created_at)),
    completed: row.status === "completed",
    charged: row.status === "completed" && !row.credits_refunded,
    kind: generationKind(row),
  };
  if (!generationsByUser.has(row.user_id)) generationsByUser.set(row.user_id, []);
  generationsByUser.get(row.user_id).push(generation);
}

const cardIds = [
  ...new Set(
    generations
      .map((row) => row.card_id)
      .filter(Boolean),
  ),
];
const cardsById = new Map();
console.error(`fetch ${cardIds.length} referenced cards`);
for (let i = 0; i < cardIds.length; i += 30) {
  const ids = cardIds.slice(i, i + 30);
  const rows = await restAll(
    `prompt_cards?select=id,title_ru,slug,seo_tags,source_dataset_slug&id=in.(${ids.join(",")})`,
  );
  for (const row of rows) cardsById.set(row.id, row);
}

const now = Date.now();

function secondWithin(user, days) {
  const list = paymentsByUser.get(user) || [];
  if (list.length < 2) return false;
  return list[1].ts <= list[0].ts + days * MS_DAY;
}

function summarize(memberIds, cohortWeek) {
  const ids = new Set(memberIds);
  const members = [...ids].map((id) => {
    const paymentList = paymentsByUser.get(id) || [];
    const first = paymentList[0];
    const gens = (generationsByUser.get(id) || []).filter((g) => g.ts >= first.ts);
    const completed = gens.filter((g) => g.completed);
    const charged = gens.filter((g) => g.charged);
    const afterWeek = addDays(cohortWeek, 7);
    const nextWeekEnd = addDays(cohortWeek, 13);
    const nextWeekGens = completed.filter(
      (g) => g.day >= afterWeek && g.day <= nextWeekEnd,
    );
    const nextWeekPayments = paymentList.filter(
      (p) => p.day >= afterWeek && p.day <= nextWeekEnd,
    );
    const generationDays = new Set(completed.map((g) => g.day));
    const generationWeeks = new Set(completed.map((g) => g.week));
    const lastGen = completed.at(-1);
    return {
      id,
      first,
      payments: paymentList,
      gens,
      completed,
      charged,
      balance: balanceByUser.get(id) || 0,
      nextWeekGens,
      nextWeekPayments,
      generationDays: generationDays.size,
      generationWeeks: generationWeeks.size,
      lastGen,
    };
  });

  const firstRevenue = members.reduce((sum, m) => sum + m.first.amount, 0);
  const totalRevenue = members.reduce(
    (sum, m) => sum + m.payments.reduce((s, p) => s + p.amount, 0),
    0,
  );
  const totalPayments = members.reduce((sum, m) => sum + m.payments.length, 0);
  const repeat = members.filter((m) => m.payments.length >= 2);
  const mature1 = members.filter((m) => m.first.ts <= now - MS_DAY);
  const mature3 = members.filter((m) => m.first.ts <= now - 3 * MS_DAY);
  const mature7 = members.filter((m) => m.first.ts <= now - 7 * MS_DAY);
  const d1Repeat = mature1.filter((m) => secondWithin(m.id, 1));
  const d3Repeat = mature3.filter((m) => secondWithin(m.id, 3));
  const d7Repeat = mature7.filter((m) => secondWithin(m.id, 7));
  const completedUsers = members.filter((m) => m.completed.length > 0);
  const completed24h = members.filter((m) =>
    m.completed.some((g) => g.ts <= m.first.ts + MS_DAY),
  );
  const completed7d = mature7.filter((m) =>
    m.completed.some((g) => g.ts <= m.first.ts + 7 * MS_DAY),
  );
  const nextWeekActive = members.filter((m) => m.nextWeekGens.length > 0);
  const nextWeekPay = members.filter((m) => m.nextWeekPayments.length > 0);
  const nextWeekActiveNoPay = members.filter(
    (m) => m.nextWeekGens.length > 0 && m.nextWeekPayments.length === 0,
  );
  const noRepeat = members.filter((m) => m.payments.length === 1);
  const noRepeatUnused = noRepeat.filter((m) => m.completed.length === 0);
  const noRepeatEmpty = noRepeat.filter(
    (m) => m.completed.length > 0 && m.balance === 0,
  );
  const noRepeatLeftover = noRepeat.filter((m) => m.balance > 0);
  const multiDay = members.filter((m) => m.generationDays >= 2);
  const multiWeek = members.filter((m) => m.generationWeeks >= 2);

  const completedGens = members.flatMap((m) => m.completed);
  const allGens = members.flatMap((m) => m.gens);
  const attempts = allGens.length;
  const failed = allGens.filter((g) => g.status === "failed").length;
  const spent = members.reduce(
    (sum, m) =>
      sum +
      m.charged.reduce((s, g) => s + n(g.credits_spent), 0),
    0,
  );
  const granted = members.reduce(
    (sum, m) => sum + m.payments.reduce((s, p) => s + p.credits, 0),
    0,
  );

  const kinds = {};
  const models = {};
  const content = {};
  const cardTitles = {};
  for (const g of completedGens) {
    kinds[g.kind] = (kinds[g.kind] || 0) + 1;
    const model = String(g.executed_model || g.requested_model || g.model || "unknown");
    models[model] = (models[model] || 0) + 1;
    const card = g.card_id ? cardsById.get(g.card_id) : null;
    const title = card?.title_ru || "";
    const category = contentCategory(`${title}\n${g.prompt_text || ""}`);
    content[category] = (content[category] || 0) + 1;
    if (title) cardTitles[title] = (cardTitles[title] || 0) + 1;
  }

  const sortedObject = (value, limit = null) =>
    Object.fromEntries(
      Object.entries(value)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit || undefined),
    );

  return {
    users: members.length,
    firstRevenueRub: round2(firstRevenue),
    firstArppuRub: members.length ? round2(firstRevenue / members.length) : null,
    totalPayments,
    totalRevenueRub: round2(totalRevenue),
    repeatUsers: repeat.length,
    repeatRatePct: pct(repeat.length, members.length),
    d1: {
      mature: mature1.length,
      repeatUsers: d1Repeat.length,
      repeatRatePct: pct(d1Repeat.length, mature1.length),
    },
    d3: {
      mature: mature3.length,
      repeatUsers: d3Repeat.length,
      repeatRatePct: pct(d3Repeat.length, mature3.length),
    },
    d7: {
      mature: mature7.length,
      repeatUsers: d7Repeat.length,
      repeatRatePct: pct(d7Repeat.length, mature7.length),
      generatedUsers: completed7d.length,
      generatedRatePct: pct(completed7d.length, mature7.length),
    },
    nextWeek: {
      paymentUsers: nextWeekPay.length,
      paymentRatePct: pct(nextWeekPay.length, members.length),
      generationUsers: nextWeekActive.length,
      generationRatePct: pct(nextWeekActive.length, members.length),
      activeNoPayUsers: nextWeekActiveNoPay.length,
    },
    generation: {
      users: completedUsers.length,
      userRatePct: pct(completedUsers.length, members.length),
      within24hUsers: completed24h.length,
      within24hRatePct: pct(completed24h.length, members.length),
      attempts,
      completed: completedGens.length,
      failed,
      failureRatePct: pct(failed, attempts),
      completedPerUserMean: members.length
        ? round1(completedGens.length / members.length)
        : null,
      completedPerUserP50: quantile(
        members.map((m) => m.completed.length),
        0.5,
      ),
      completedPerUserP75: quantile(
        members.map((m) => m.completed.length),
        0.75,
      ),
      multiDayUsers: multiDay.length,
      multiDayRatePct: pct(multiDay.length, members.length),
      multiWeekUsers: multiWeek.length,
      multiWeekRatePct: pct(multiWeek.length, members.length),
      grantedCredits: granted,
      spentCredits: spent,
      spentSharePct: pct(spent, granted),
      currentBalanceCredits: members.reduce((sum, m) => sum + m.balance, 0),
      balanceP50: quantile(
        members.map((m) => m.balance),
        0.5,
      ),
      kinds: sortedObject(kinds),
      models: sortedObject(models),
      contentCategories: sortedObject(content),
      topCards: sortedObject(cardTitles, 8),
    },
    noRepeatState: {
      users: noRepeat.length,
      unusedUsers: noRepeatUnused.length,
      unusedSharePct: pct(noRepeatUnused.length, noRepeat.length),
      emptyUsers: noRepeatEmpty.length,
      emptySharePct: pct(noRepeatEmpty.length, noRepeat.length),
      leftoverUsers: noRepeatLeftover.length,
      leftoverSharePct: pct(noRepeatLeftover.length, noRepeat.length),
      leftoverCredits: noRepeatLeftover.reduce((sum, m) => sum + m.balance, 0),
    },
  };
}

const cohorts = [];
for (const week of cohortWeeks) {
  const allIds = [];
  const directIds = [];
  const nonDirectIds = [];
  for (const [id, list] of paymentsByUser) {
    const first = list[0];
    if (first.week !== week) continue;
    allIds.push(id);
    if (first.direct) directIds.push(id);
    else nonDirectIds.push(id);
  }
  cohorts.push({
    week,
    end: addDays(week, 6),
    partial: addDays(week, 6) > moscowDay(new Date().toISOString()),
    all: summarize(allIds, week),
    direct: summarize(directIds, week),
    nonDirect: summarize(nonDirectIds, week),
  });
}

const matureWeeks = cohorts.slice(0, 3);
const combinedIds = (segment) => {
  const ids = [];
  for (const cohort of matureWeeks) {
    for (const [id, list] of paymentsByUser) {
      const first = list[0];
      if (first.week !== cohort.week) continue;
      if (segment === "direct" && !first.direct) continue;
      if (segment === "nonDirect" && first.direct) continue;
      ids.push(id);
    }
  }
  return [...new Set(ids)];
};

const report = {
  asOf: new Date().toISOString(),
  timezone: "Europe/Moscow",
  definitions: {
    cohort: "week of first-ever live payment",
    direct:
      "first-ever live payment has yclid or utm_source=yandex + utm_medium=cpc",
    repeat: "second live payment by same landing user",
    generation:
      "non-admin landing_generations after first payment; completed is successful",
    content:
      "heuristic keyword classification of public card title + prompt text; only aggregates are output",
  },
  dataQuality: {
    livePayments: payments.length,
    paidUsers: paymentsByUser.size,
    generationRowsSinceFirstCohort: generations.length,
    generationUsers: generationsByUser.size,
    usersRows: users.length,
    cardsResolved: cardsById.size,
  },
  cohorts,
  matureThreeWeeks: {
    all: summarize(combinedIds("all"), cohortWeeks[0]),
    direct: summarize(combinedIds("direct"), cohortWeeks[0]),
    nonDirect: summarize(combinedIds("nonDirect"), cohortWeeks[0]),
  },
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      dataQuality: report.dataQuality,
      cohorts: report.cohorts.map((cohort) => ({
        week: cohort.week,
        allUsers: cohort.all.users,
        allD7: cohort.all.d7,
        directUsers: cohort.direct.users,
        directD7: cohort.direct.d7,
        directGeneration: {
          userRatePct: cohort.direct.generation.userRatePct,
          spentSharePct: cohort.direct.generation.spentSharePct,
          noRepeatState: cohort.direct.noRepeatState,
        },
      })),
    },
    null,
    2,
  ),
);
