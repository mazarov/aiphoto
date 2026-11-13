import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";
const outPath = join(root, ".tmp-userbase-retention.json");

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
        `rest_${res.status}:${path.split("?")[0]}:${body.slice(0, 240)}`,
      );
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((1000 * part) / whole) / 10;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function inc(map, key, by = 1) {
  map[key] = (map[key] || 0) + by;
}

function bucketHours(h) {
  if (h < 24) return "0–24ч";
  if (h < 72) return "1–3д";
  if (h < 168) return "3–7д";
  if (h < 336) return "7–14д";
  if (h < 720) return "14–30д";
  return "30д+";
}

function bucketRecencyDays(d) {
  if (d == null) return "нет генерации";
  if (d <= 7) return "0–7д";
  if (d <= 14) return "8–14д";
  if (d <= 30) return "15–30д";
  if (d <= 60) return "31–60д";
  return "60д+";
}

function spendTier(rub) {
  if (rub <= 0) return "0";
  if (rub < 100) return "1–99";
  if (rub < 300) return "100–299";
  if (rub < 500) return "300–499";
  if (rub < 1000) return "500–999";
  if (rub < 2000) return "1000–1999";
  return "2000+";
}

function moscowWeek(iso) {
  const d = new Date(iso);
  const msk = new Date(d.getTime() + 3 * 3600 * 1000);
  const day = msk.getUTCDay() || 7;
  msk.setUTCDate(msk.getUTCDate() - day + 1);
  return msk.toISOString().slice(0, 10);
}

const now = Date.now();
const MS_H = 3600 * 1000;
const MS_D = 24 * MS_H;

console.error("fetch payments / users / gens / offers / mail");

const [
  yk,
  rk,
  users,
  gens,
  offers,
  mail,
  mailDue,
] = await Promise.all([
  restAll(
    "landing_yookassa_payments?select=landing_user_id,plan_id,credits,amount_rub,status,test,credited_at,created_at,offer_id&order=credited_at.asc",
  ),
  restAll(
    "landing_robokassa_payments?select=landing_user_id,plan_id,credits,amount_rub,status,test,credited_at,created_at,offer_id&order=credited_at.asc",
  ).catch((err) => {
    if (String(err).includes("rest_404") || String(err).includes("PGRST205")) {
      return [];
    }
    throw err;
  }),
  restAll("landing_users?select=id,credits,created_at"),
  restAll(
    "landing_generations?select=user_id,status,credits_spent,credits_refunded,client_source,created_at,generation_completed_at&client_source=neq.admin",
  ),
  restAll(
    "landing_pricing_offers?select=id,shared_user_id,percent,source_template_id,expires_at,consumed_at,created_at",
  ),
  restAll(
    "landing_mail_outbox?select=template_id,kind,status,sent_at,created_at",
  ).catch((err) => {
    if (String(err).includes("rest_404") || String(err).includes("PGRST205")) {
      return [];
    }
    throw err;
  }),
  restAll(
    "landing_mail_due?select=template_id,status,due_at,shared_user_id",
  ).catch((err) => {
    if (String(err).includes("rest_404") || String(err).includes("PGRST205")) {
      return [];
    }
    throw err;
  }),
]);

const live = [...yk, ...rk]
  .filter(
    (p) =>
      p.status === "succeeded" &&
      p.credited_at &&
      p.test !== true,
  )
  .map((p) => ({
    userId: p.landing_user_id,
    planId: String(p.plan_id || "unknown"),
    credits: num(p.credits),
    amountRub: num(p.amount_rub),
    creditedAt: p.credited_at,
    createdAt: p.created_at,
    offerId: p.offer_id || null,
    ts: new Date(p.credited_at).getTime(),
  }))
  .sort((a, b) => a.ts - b.ts);

const byUser = new Map();
for (const p of live) {
  const row = byUser.get(p.userId) || {
    payments: [],
    spend: 0,
    granted: 0,
    first: null,
    second: null,
  };
  row.payments.push(p);
  row.spend += p.amountRub;
  row.granted += p.credits;
  if (!row.first) row.first = p;
  else if (!row.second) row.second = p;
  byUser.set(p.userId, row);
}

const userCredits = new Map();
const userCreated = new Map();
for (const u of users) {
  userCredits.set(u.id, num(u.credits));
  userCreated.set(u.id, u.created_at);
}

const lastGen = new Map();
const firstGen = new Map();
const spentByUser = new Map();
const completedGensByUser = new Map();
let completedGens = 0;
let spentCredits = 0;
let refundedCredits = 0;
let gensUnmatchedPaid = 0;

for (const g of gens) {
  const spent = num(g.credits_spent);
  if (g.credits_refunded) refundedCredits += spent;
  else if (spent > 0) {
    spentCredits += spent;
    spentByUser.set(g.user_id, (spentByUser.get(g.user_id) || 0) + spent);
  }
  if (g.status !== "completed") continue;
  completedGens += 1;
  completedGensByUser.set(
    g.user_id,
    (completedGensByUser.get(g.user_id) || 0) + 1,
  );
  const t = new Date(g.generation_completed_at || g.created_at).getTime();
  if (!firstGen.has(g.user_id) || t < firstGen.get(g.user_id)) {
    firstGen.set(g.user_id, t);
  }
  if (!lastGen.has(g.user_id) || t > lastGen.get(g.user_id)) {
    lastGen.set(g.user_id, t);
  }
}

for (const userId of completedGensByUser.keys()) {
  if (!byUser.has(userId)) gensUnmatchedPaid += 1;
}

const paidIds = [...byUser.keys()];
const paidCount = paidIds.length;
const neverPaid = users.length - paidCount;
const repeatPayers = paidIds.filter((id) => byUser.get(id).payments.length >= 2);
const oncePayers = paidIds.filter((id) => byUser.get(id).payments.length === 1);
const threePlus = paidIds.filter((id) => byUser.get(id).payments.length >= 3);

const revenue = live.reduce((s, p) => s + p.amountRub, 0);
const revenueFirst = paidIds.reduce((s, id) => s + byUser.get(id).first.amountRub, 0);
const revenueRepeat = revenue - revenueFirst;
const granted = live.reduce((s, p) => s + p.credits, 0);

const leftoverPaid = paidIds.reduce((s, id) => s + (userCredits.get(id) || 0), 0);
const leftoverAll = users.reduce((s, u) => s + num(u.credits), 0);

function lastGenDays(id) {
  const t = lastGen.get(id);
  if (!t) return null;
  return (now - t) / MS_D;
}

const segments = {
  paid: paidCount,
  paid_active: 0,
  paid_quiet: 0,
  empty: 0,
  trial_only: 0,
  paid_unused: 0,
  paid_leftover_quiet: 0,
  paid_empty_quiet: 0,
};

for (const id of paidIds) {
  const credits = userCredits.get(id) || 0;
  const last = lastGen.get(id);
  const quiet = !last || last <= now - 14 * MS_D;
  const higher = byUser.get(id).payments.some((p) => p.planId !== "trial");
  if (credits > 0 && last && last > now - 14 * MS_D) segments.paid_active += 1;
  if (quiet) segments.paid_quiet += 1;
  if (credits === 0) segments.empty += 1;
  if (!higher) segments.trial_only += 1;
  if ((completedGensByUser.get(id) || 0) === 0) segments.paid_unused += 1;
  if (quiet && credits > 0) segments.paid_leftover_quiet += 1;
  if (quiet && credits === 0) segments.paid_empty_quiet += 1;
}

const firstPlan = {};
const firstPlanRepeat = {};
const firstPlanRevenue2 = {};
const secondGivenFirst = {};
const paymentCountDist = {};
const spendTiers = {};
const timeToSecondH = [];
const timeToSecondBuckets = {};
const recencyPaid = {};
const recencyEmptyQuiet = {};
const firstWeek = {};
const firstWeekRepeat = {};

for (const id of paidIds) {
  const row = byUser.get(id);
  const nPay = row.payments.length;
  inc(paymentCountDist, nPay >= 5 ? "5+" : String(nPay));
  inc(spendTiers, spendTier(row.spend));
  inc(firstPlan, row.first.planId);
  inc(recencyPaid, bucketRecencyDays(lastGenDays(id)));
  if (nPay >= 2) {
    inc(firstPlanRepeat, row.first.planId);
    firstPlanRevenue2[row.first.planId] =
      (firstPlanRevenue2[row.first.planId] || 0) + row.second.amountRub;
    const key = `${row.first.planId}→${row.second.planId}`;
    inc(secondGivenFirst, key);
    const hours = (row.second.ts - row.first.ts) / MS_H;
    timeToSecondH.push(hours);
    inc(timeToSecondBuckets, bucketHours(hours));
  }
  const w = moscowWeek(row.first.creditedAt);
  inc(firstWeek, w);
  if (nPay >= 2) inc(firstWeekRepeat, w);
  if ((userCredits.get(id) || 0) === 0 && (!lastGen.get(id) || lastGen.get(id) <= now - 14 * MS_D)) {
    inc(recencyEmptyQuiet, bucketRecencyDays(lastGenDays(id)));
  }
}

timeToSecondH.sort((a, b) => a - b);

const firstPlanRows = Object.keys(firstPlan)
  .sort((a, b) => firstPlan[b] - firstPlan[a])
  .map((plan) => {
    const n = firstPlan[plan];
    const repeats = firstPlanRepeat[plan] || 0;
    return {
      plan,
      firstBuyers: n,
      sharePct: pct(n, paidCount),
      secondBuyers: repeats,
      secondRatePct: pct(repeats, n),
      secondRevenueRub: round2(firstPlanRevenue2[plan] || 0),
    };
  });

const matureCutoff = now - 7 * MS_D;
const maturePaid = paidIds.filter((id) => byUser.get(id).first.ts <= matureCutoff);
const matureRepeat7 = maturePaid.filter((id) => {
  const row = byUser.get(id);
  return row.second && row.second.ts <= row.first.ts + 7 * MS_D;
});
const mature30 = paidIds.filter((id) => byUser.get(id).first.ts <= now - 30 * MS_D);
const matureRepeat30 = mature30.filter((id) => {
  const row = byUser.get(id);
  return row.second && row.second.ts <= row.first.ts + 30 * MS_D;
});

const lowOffers = offers.filter((o) => o.source_template_id === "low_balance_upgrade");
const lowByUser = new Map();
for (const o of lowOffers) {
  if (!lowByUser.has(o.shared_user_id)) lowByUser.set(o.shared_user_id, o);
}
const lowEligible = [...lowByUser.keys()];
const lowMature7 = lowEligible.filter(
  (id) => new Date(lowByUser.get(id).created_at).getTime() <= now - 7 * MS_D,
);
const lowMature30 = lowEligible.filter(
  (id) => new Date(lowByUser.get(id).created_at).getTime() <= now - 30 * MS_D,
);

function offerRepeat(id, withinMs) {
  const o = lowByUser.get(id);
  const row = byUser.get(id);
  if (!o || !row) return false;
  const start = new Date(o.created_at).getTime();
  return row.payments.some((p) => {
    if (p.ts <= start) return false;
    if (withinMs != null && p.ts > start + withinMs) return false;
    return true;
  });
}

const low = {
  offers: lowOffers.length,
  uniqueUsers: lowEligible.length,
  converted24h: lowEligible.filter((id) => offerRepeat(id, 24 * MS_H)).length,
  converted7d: lowEligible.filter((id) => offerRepeat(id, 7 * MS_D)).length,
  convertedEver: lowEligible.filter((id) => offerRepeat(id, null)).length,
  mature7: lowMature7.length,
  mature7_repeat7: lowMature7.filter((id) => offerRepeat(id, 7 * MS_D)).length,
  mature30: lowMature30.length,
  mature30_repeat30: lowMature30.filter((id) => offerRepeat(id, 30 * MS_D)).length,
  usedOfferId: live.filter((p, i, arr) => {
    const prev = arr.filter((x) => x.userId === p.userId && x.ts < p.ts);
    return prev.length >= 1 && p.offerId;
  }).length,
};

low.converted24hPct = pct(low.converted24h, low.uniqueUsers);
low.converted7dPct = pct(low.converted7d, low.uniqueUsers);
low.convertedEverPct = pct(low.convertedEver, low.uniqueUsers);
low.mature7RatePct = pct(low.mature7_repeat7, low.mature7);
low.mature30RatePct = pct(low.mature30_repeat30, low.mature30);

const offerBySource = {};
for (const o of offers) inc(offerBySource, o.source_template_id || "unknown");

const mailByTemplate = {};
const mailByStatus = {};
for (const m of mail) {
  inc(mailByStatus, m.status || "unknown");
  if (m.status === "sent") inc(mailByTemplate, m.template_id || "unknown");
}

const spend500 = paidIds.filter((id) => byUser.get(id).spend >= 500);
const spend1000 = paidIds.filter((id) => byUser.get(id).spend >= 1000);
const onceSpend = oncePayers.reduce((s, id) => s + byUser.get(id).spend, 0);
const repeatSpend = repeatPayers.reduce((s, id) => s + byUser.get(id).spend, 0);

const leftoverQuietRubProxy = paidIds
  .filter((id) => {
    const last = lastGen.get(id);
    return (userCredits.get(id) || 0) > 0 && (!last || last <= now - 14 * MS_D);
  })
  .reduce((s, id) => s + (userCredits.get(id) || 0), 0);

const leftoverList = paidIds
  .map((id) => userCredits.get(id) || 0)
  .filter((n) => n > 0)
  .sort((a, b) => b - a);
const leftoverTop10 = leftoverList.slice(0, Math.max(1, Math.ceil(leftoverList.length * 0.1)))
  .reduce((s, n) => s + n, 0);

const whatIfForever20 = {
  note: "Если бы все повторные чеки уже прошедших плательщиков были −20%. Исторический контрфактуал, не прогноз спроса.",
  repeatRevenueActualRub: round2(revenueRepeat),
  repeatRevenueAt20OffRub: round2(revenueRepeat * 0.8),
  givenAwayRub: round2(revenueRepeat * 0.2),
};

const whatIfLoyalty = {
  usersSpendGe500: spend500.length,
  usersSpendGe500Pct: pct(spend500.length, paidCount),
  usersSpendGe1000: spend1000.length,
  usersSpendGe1000Pct: pct(spend1000.length, paidCount),
  note: "Пороги 500/1000 ₽ — доля уже заплативших, которым лестница дала бы статус почти сразу.",
};

const cohortWeeks = Object.keys(firstWeek)
  .sort()
  .map((week) => {
    const n = firstWeek[week];
    const r = firstWeekRepeat[week] || 0;
    return {
      weekStartMoscow: week,
      firstPayers: n,
      withSecond: r,
      secondRatePct: pct(r, n),
    };
  });

const onceState = { leftover_recent: 0, leftover_quiet: 0, empty_recent: 0, empty_quiet: 0, unused: 0 };
const trialOnce = { leftover_recent: 0, leftover_quiet: 0, empty_recent: 0, empty_quiet: 0, unused: 0 };
let trialOnceLeftoverCredits = 0;
let emptyRecent = 0;
let emptyRecentTrialOnly = 0;
const secondIn24h = { trial_to_trial: 0, trial_to_higher: 0, other: 0, withOfferId: 0, withoutOfferId: 0 };
let secondTrialRevenue = 0;
let secondHigherFromTrialRevenue = 0;
const repeatPayPlans = {};

for (const id of oncePayers) {
  const credits = userCredits.get(id) || 0;
  const last = lastGen.get(id);
  const recent = last && last > now - 14 * MS_D;
  const unused = (completedGensByUser.get(id) || 0) === 0;
  const firstTrial = byUser.get(id).first.planId === "trial";
  let key;
  if (unused) key = "unused";
  else if (credits > 0 && recent) key = "leftover_recent";
  else if (credits > 0) key = "leftover_quiet";
  else if (recent) key = "empty_recent";
  else key = "empty_quiet";
  onceState[key] += 1;
  if (firstTrial) {
    trialOnce[key] += 1;
    if (credits > 0) trialOnceLeftoverCredits += credits;
  }
}

for (const id of paidIds) {
  const credits = userCredits.get(id) || 0;
  const last = lastGen.get(id);
  const recent = last && last > now - 14 * MS_D;
  if (credits === 0 && recent) {
    emptyRecent += 1;
    if (!byUser.get(id).payments.some((p) => p.planId !== "trial")) {
      emptyRecentTrialOnly += 1;
    }
  }
}

for (const id of repeatPayers) {
  const row = byUser.get(id);
  const hours = (row.second.ts - row.first.ts) / MS_H;
  if (hours < 24) {
    if (row.first.planId === "trial" && row.second.planId === "trial") {
      secondIn24h.trial_to_trial += 1;
    } else if (row.first.planId === "trial" && row.second.planId !== "trial") {
      secondIn24h.trial_to_higher += 1;
    } else {
      secondIn24h.other += 1;
    }
    if (row.second.offerId) secondIn24h.withOfferId += 1;
    else secondIn24h.withoutOfferId += 1;
  }
  if (row.first.planId === "trial" && row.second.planId === "trial") {
    secondTrialRevenue += row.second.amountRub;
  }
  if (row.first.planId === "trial" && row.second.planId !== "trial") {
    secondHigherFromTrialRevenue += row.second.amountRub;
  }
  for (let i = 1; i < row.payments.length; i += 1) {
    inc(repeatPayPlans, row.payments[i].planId);
  }
}

const winbackEligible14Ids = paidIds.filter((id) => {
  const d = lastGenDays(id);
  return d != null && d >= 14 && d < 30;
});
const winbackEligible30Ids = paidIds.filter((id) => {
  const d = lastGenDays(id);
  return d != null && d >= 30;
});
const winbackEligible14 = winbackEligible14Ids.length;
const winbackEligible30 = winbackEligible30Ids.length;
const winbackDueByUser = new Map();
for (const d of mailDue) {
  if (d.template_id !== "winback_14") continue;
  winbackDueByUser.set(d.shared_user_id, d.status);
}
function winbackCoverage(ids) {
  const out = { none: 0, cancelled: 0, scheduled: 0, done: 0 };
  for (const id of ids) {
    const st = winbackDueByUser.get(id);
    if (!st) out.none += 1;
    else out[st] = (out[st] || 0) + 1;
  }
  return out;
}

const mailDueByTemplate = {};
const mailDueByStatus = {};
const winbackDue = { scheduled: 0, overdue: 0, future: 0, cancelled: 0, done: 0 };
for (const d of mailDue) {
  inc(mailDueByStatus, `${d.template_id || "unknown"}:${d.status || "unknown"}`);
  inc(mailDueByTemplate, d.template_id || "unknown");
  if (d.template_id === "winback_14") {
    if (d.status === "cancelled") winbackDue.cancelled += 1;
    else if (d.status === "done") winbackDue.done += 1;
    else if (d.status === "scheduled") {
      winbackDue.scheduled += 1;
      const dueTs = d.due_at ? new Date(d.due_at).getTime() : 0;
      if (dueTs && dueTs <= now) winbackDue.overdue += 1;
      else winbackDue.future += 1;
    }
  }
}

const trialNeverHigher = paidIds.filter((id) => {
  const row = byUser.get(id);
  return row.first.planId === "trial" && !row.payments.some((p) => p.planId !== "trial");
});

const report = {
  asOf: new Date().toISOString(),
  timezoneNote: "Недели и «сегодня» считаются от now UTC; бакеты часов/дней — абсолютные интервалы.",
  identityNote:
    "Плательщик = landing_user_id живой YooKassa/Robokassa (succeeded + credited, не test). Генерации client_source≠admin. Email не читали.",
  funnel: {
    landingUsers: users.length,
    paidUsers: paidCount,
    paidPctOfUsers: pct(paidCount, users.length),
    neverPaid: Math.max(0, neverPaid),
    oncePayers: oncePayers.length,
    repeatPayers: repeatPayers.length,
    threePlusPayers: threePlus.length,
    repeatRatePct: pct(repeatPayers.length, paidCount),
    mature7d: maturePaid.length,
    secondWithin7d: matureRepeat7.length,
    secondWithin7dPct: pct(matureRepeat7.length, maturePaid.length),
    mature30d: mature30.length,
    secondWithin30d: matureRepeat30.length,
    secondWithin30dPct: pct(matureRepeat30.length, mature30.length),
  },
  money: {
    livePayments: live.length,
    revenueRub: round2(revenue),
    revenueFirstRub: round2(revenueFirst),
    revenueRepeatRub: round2(revenueRepeat),
    revenueRepeatSharePct: pct(revenueRepeat, revenue),
    avgCheckRub: live.length ? round2(revenue / live.length) : 0,
    avgSpendPerPayerRub: paidCount ? round2(revenue / paidCount) : 0,
    oncePayersSpendRub: round2(onceSpend),
    repeatPayersSpendRub: round2(repeatSpend),
    grantedCredits: granted,
    spentCredits: spentCredits,
    refundedCredits,
    leftoverCreditsAll: leftoverAll,
    leftoverCreditsPaid: leftoverPaid,
    leftoverQuietPaidCredits: leftoverQuietRubProxy,
    generationCostGrantedRub: round2(granted * 0.5),
    generationCostSpentRub: round2(spentCredits * 0.5),
    unusedPaidLiabilityRub: round2(leftoverPaid * 0.5),
  },
  segments,
  firstPlan: firstPlanRows,
  secondGivenFirst: Object.entries(secondGivenFirst)
    .sort((a, b) => b[1] - a[1])
    .map(([pair, count]) => ({ pair, count, shareOfRepeatPct: pct(count, repeatPayers.length) })),
  paymentCountDist,
  spendTiers,
  timeToSecond: {
    n: timeToSecondH.length,
    p50Hours: timeToSecondH.length ? round1(quantile(timeToSecondH, 0.5)) : null,
    p75Hours: timeToSecondH.length ? round1(quantile(timeToSecondH, 0.75)) : null,
    p50Days: timeToSecondH.length ? round1(quantile(timeToSecondH, 0.5) / 24) : null,
    p75Days: timeToSecondH.length ? round1(quantile(timeToSecondH, 0.75) / 24) : null,
    buckets: timeToSecondBuckets,
  },
  recencyPaid,
  recencyEmptyQuiet,
  cohortsByFirstPayWeek: cohortWeeks,
  lowBalanceUpgrade: low,
  offersBySource: offerBySource,
  mailSentByTemplate: mailByTemplate,
  mailByStatus,
  leftoverConcentration: {
    paidWithLeftover: leftoverList.length,
    leftoverTop10SharePct: pct(leftoverTop10, leftoverPaid),
  },
  whatIfForever20,
  whatIfLoyalty,
  gensUnmatchedToPayers: gensUnmatchedPaid,
  oncePayersState: onceState,
  trialOncePayersState: trialOnce,
  trialOnceLeftoverCredits,
  emptyRecent,
  emptyRecentTrialOnly,
  secondIn24h,
  secondTrialRevenueRub: round2(secondTrialRevenue),
  secondHigherFromTrialRevenueRub: round2(secondHigherFromTrialRevenue),
  repeatPaymentPlans: repeatPayPlans,
  trialNeverHigher: trialNeverHigher.length,
  trialNeverHigherPctOfTrialFirst: pct(trialNeverHigher.length, firstPlan.trial || 0),
  winbackEligible14,
  winbackEligible30,
  winbackCoverage14: winbackCoverage(winbackEligible14Ids),
  winbackCoverage30: winbackCoverage(winbackEligible30Ids),
  winbackDue,
  mailDueByTemplate,
  mailDueByStatus,
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, out: outPath, paid: paidCount, live: live.length }));
