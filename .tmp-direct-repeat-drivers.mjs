import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = "/Users/azarovmaxim/photo2sticker-bot/aiphoto";
const outPath = `${root}/.tmp-direct-repeat-drivers.json`;
const cohortWeeks = new Set(["2026-08-24", "2026-08-31", "2026-09-07"]);
const MS_DAY = 86_400_000;

function envFile(path) {
  const result = {};
  if (!existsSync(path)) return result;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[line.slice(0, i).trim()] = value;
  }
  return result;
}

const env = {
  ...envFile(`${root}/.env`),
  ...envFile(`${root}/landing/.env`),
  ...envFile(`${root}/landing/.env.local`),
};
const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) process.exit(1);

async function restAll(path) {
  const result = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Range: `${from}-${from + 999}`,
      },
    });
    if (!response.ok) throw new Error(`rest_${response.status}`);
    const rows = await response.json();
    if (!rows.length) break;
    result.push(...rows);
    if (rows.length < 1000) break;
  }
  return result;
}

const num = (value) => Number(value || 0);
const round1 = (value) => Math.round(value * 10) / 10;
const pct = (a, b) => (b ? round1((a / b) * 100) : null);

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return round1(sorted[low]);
  return round1(sorted[low] * (high - index) + sorted[high] * (index - low));
}

function dayMoscow(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function weekMoscow(iso) {
  const [year, month, day] = dayMoscow(iso).split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

function isDirect(row) {
  return (
    Boolean(String(row.yclid || "").trim()) ||
    (String(row.utm_source || "").toLowerCase() === "yandex" &&
      String(row.utm_medium || "").toLowerCase() === "cpc")
  );
}

function category(text) {
  const value = String(text || "").toLowerCase();
  if (/(birthday|день рожден|торт|свеч)/.test(value)) return "birthday";
  if (/(couple|пар[аы]|влюб|romantic|wedding|свад)/.test(value)) return "couple";
  if (/(family|семь|ребен|ребён|детск|mother|father|mom|dad|мам|пап)/.test(value)) return "family/kids";
  if (/(business|делов|office|офис|linkedin|corporate|професси)/.test(value)) return "business";
  if (/(fashion|beauty|макияж|модн|glamour|luxury|плать|outfit)/.test(value)) return "fashion/beauty";
  if (/(portrait|портрет|headshot|selfie|селфи|woman|man|girl|boy|девуш|мужчин)/.test(value)) return "portrait";
  return "other";
}

const [paymentRows, balances] = await Promise.all([
  restAll(
    "landing_yookassa_payments?select=landing_user_id,auth_user_id,plan_id,credits,amount_rub,credited_at,utm_source,utm_medium,yclid,status,test&status=eq.succeeded&credited_at=not.is.null&order=credited_at.asc",
  ),
  restAll("landing_users?select=id,credits"),
]);

const payments = paymentRows
  .filter((row) => row.test !== true)
  .map((row) => ({
    user: row.landing_user_id || row.auth_user_id,
    ts: new Date(row.credited_at).getTime(),
    week: weekMoscow(row.credited_at),
    plan: String(row.plan_id || "unknown"),
    credits: num(row.credits),
    amount: num(row.amount_rub),
    direct: isDirect(row),
  }))
  .filter((row) => row.user)
  .sort((a, b) => a.ts - b.ts);

const byUser = new Map();
for (const payment of payments) {
  if (!byUser.has(payment.user)) byUser.set(payment.user, []);
  byUser.get(payment.user).push(payment);
}
const balanceByUser = new Map(balances.map((row) => [row.id, num(row.credits)]));

const directUsers = [...byUser.entries()]
  .filter(([, list]) => cohortWeeks.has(list[0].week) && list[0].direct)
  .map(([id]) => id);
const generationRows = [];
for (let i = 0; i < directUsers.length; i += 60) {
  const ids = directUsers.slice(i, i + 60);
  generationRows.push(
    ...(await restAll(
      `landing_generations?select=user_id,status,credits_spent,credits_refunded,created_at,generation_completed_at,prompt_text,card_id,modality,edit_kind,parent_generation_id,vibe_id,client_source&user_id=in.(${ids.join(",")})&client_source=neq.admin&order=created_at.asc`,
    )),
  );
}

const gensByUser = new Map();
for (const row of generationRows) {
  const ts = new Date(row.generation_completed_at || row.created_at).getTime();
  const item = {
    ...row,
    ts,
    completed: row.status === "completed",
    charged: row.status === "completed" && !row.credits_refunded,
    category: category(row.prompt_text),
  };
  if (!gensByUser.has(row.user_id)) gensByUser.set(row.user_id, []);
  gensByUser.get(row.user_id).push(item);
}

const now = Date.now();
const mature = directUsers
  .map((id) => {
    const paymentList = byUser.get(id);
    const first = paymentList[0];
    const second = paymentList[1] || null;
    const windowEnd = first.ts + 7 * MS_DAY;
    const gens = (gensByUser.get(id) || []).filter(
      (g) => g.ts >= first.ts && g.ts <= windowEnd,
    );
    const completed = gens.filter((g) => g.completed);
    const categories = new Set(completed.map((g) => g.category));
    const genDays = new Set(
      completed.map((g) => dayMoscow(g.generation_completed_at || g.created_at)),
    );
    return {
      id,
      first,
      second,
      repeat7: Boolean(second && second.ts <= windowEnd),
      secondHours: second ? (second.ts - first.ts) / 3_600_000 : null,
      completed,
      attempts: gens.length,
      spent: completed
        .filter((g) => g.charged)
        .reduce((sum, g) => sum + num(g.credits_spent), 0),
      first24hCompleted: completed.filter((g) => g.ts <= first.ts + MS_DAY).length,
      genDays: genDays.size,
      birthday: categories.has("birthday"),
      usedCatalog: completed.some((g) => g.card_id),
      usedCustom: completed.some((g) => !g.card_id && !g.vibe_id && !g.parent_generation_id),
      balance: balanceByUser.get(id) || 0,
    };
  })
  .filter((row) => row.first.ts <= now - 7 * MS_DAY);

function summarize(rows) {
  const categories = {};
  for (const row of rows) {
    for (const gen of row.completed) {
      categories[gen.category] = (categories[gen.category] || 0) + 1;
    }
  }
  return {
    users: rows.length,
    firstArppuRub: rows.length
      ? round1(rows.reduce((sum, row) => sum + row.first.amount, 0) / rows.length)
      : null,
    firstCreditsMean: rows.length
      ? round1(rows.reduce((sum, row) => sum + row.first.credits, 0) / rows.length)
      : null,
    completed7dMean: rows.length
      ? round1(rows.reduce((sum, row) => sum + row.completed.length, 0) / rows.length)
      : null,
    completed7dP50: quantile(rows.map((row) => row.completed.length), 0.5),
    completed24hMean: rows.length
      ? round1(rows.reduce((sum, row) => sum + row.first24hCompleted, 0) / rows.length)
      : null,
    spent7dMean: rows.length
      ? round1(rows.reduce((sum, row) => sum + row.spent, 0) / rows.length)
      : null,
    spentVsFirstGrantPct: rows.length
      ? pct(
          rows.reduce((sum, row) => sum + row.spent, 0),
          rows.reduce((sum, row) => sum + row.first.credits, 0),
        )
      : null,
    generatedMultiDayUsers: rows.filter((row) => row.genDays >= 2).length,
    generatedMultiDayRatePct: pct(
      rows.filter((row) => row.genDays >= 2).length,
      rows.length,
    ),
    noSuccessfulGenerationUsers: rows.filter((row) => !row.completed.length).length,
    birthdayUsers: rows.filter((row) => row.birthday).length,
    birthdayUserRatePct: pct(
      rows.filter((row) => row.birthday).length,
      rows.length,
    ),
    catalogUsers: rows.filter((row) => row.usedCatalog).length,
    customUsers: rows.filter((row) => row.usedCustom).length,
    currentEmptyUsers: rows.filter((row) => row.balance === 0).length,
    currentEmptyRatePct: pct(
      rows.filter((row) => row.balance === 0).length,
      rows.length,
    ),
    currentBalanceP50: quantile(rows.map((row) => row.balance), 0.5),
    contentCategories: Object.fromEntries(
      Object.entries(categories).sort((a, b) => b[1] - a[1]),
    ),
  };
}

const repeaters = mature.filter((row) => row.repeat7);
const nonRepeaters = mature.filter((row) => !row.repeat7);
const secondPairs = {};
for (const row of repeaters) {
  const pair = `${row.first.plan}→${row.second.plan}`;
  secondPairs[pair] = (secondPairs[pair] || 0) + 1;
}

const report = {
  asOf: new Date().toISOString(),
  matureDirectUsers: mature.length,
  d7RepeatUsers: repeaters.length,
  d7RepeatRatePct: pct(repeaters.length, mature.length),
  timeToSecondHours: {
    p25: quantile(repeaters.map((row) => row.secondHours), 0.25),
    p50: quantile(repeaters.map((row) => row.secondHours), 0.5),
    p75: quantile(repeaters.map((row) => row.secondHours), 0.75),
  },
  secondPairs: Object.fromEntries(
    Object.entries(secondPairs).sort((a, b) => b[1] - a[1]),
  ),
  repeaters: summarize(repeaters),
  nonRepeaters: summarize(nonRepeaters),
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, outPath, report }, null, 2));
