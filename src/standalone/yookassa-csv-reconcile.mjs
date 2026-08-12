#!/usr/bin/env node
/**
 * Standalone: reconcile YooKassa CSV export vs landing_yookassa_payments.
 * Zero deps — Node 20+ fetch only.
 *
 * Usage:
 *   node yookassa-csv-reconcile.mjs --csv /path/to/all-payments.csv
 *   node yookassa-csv-reconcile.mjs --csv /path/to/all-payments.csv --apply
 *   node yookassa-csv-reconcile.mjs --csv ... --apply --trust-csv
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY  (preferred for --apply)
 *
 * Default mode is dry-run (report only). --apply fulfills needs_fulfill rows
 * via YooKassa GET + landing_fulfill_yookassa_payment (idempotent).
 * If YooKassa keys are missing, pass --trust-csv to fulfill matched local
 * rows when CSV says «Оплачен» and provider id / amount already match DB.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const YOOKASSA_SHOP_ID = (process.env.YOOKASSA_SHOP_ID || "").trim();
const YOOKASSA_SECRET_KEY = (process.env.YOOKASSA_SECRET_KEY || "").trim();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TRUST_CSV = args.includes("--trust-csv");
const csvIdx = args.indexOf("--csv");
const csvPath =
  csvIdx >= 0 && args[csvIdx + 1] ? resolve(args[csvIdx + 1]) : null;
const outDirIdx = args.indexOf("--out-dir");
const outDir =
  outDirIdx >= 0 && args[outDirIdx + 1]
    ? resolve(args[outDirIdx + 1])
    : resolve(ROOT, "tmp");
const HAS_YK = Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY);

if (!csvPath) {
  console.error(
    "Usage: node yookassa-csv-reconcile.mjs --csv <path> [--apply] [--trust-csv] [--out-dir <dir>]",
  );
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (APPLY && !HAS_YK && !TRUST_CSV) {
  console.error(
    "Missing YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY. Pass --trust-csv to fulfill from CSV+DB match without provider GET.",
  );
  process.exit(1);
}

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0], ";");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], ";");
    const row = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]] = cols[h] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(";"));
  }
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function parseAmountRub(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: SB,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : [];
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: SB,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase PATCH ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : [];
}

async function sbRpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: SB,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase RPC ${name} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function fetchPaymentsByProviderIds(ids) {
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
  const all = [];
  for (const chunk of chunks) {
    const filter = chunk.map(encodeURIComponent).join(",");
    const rows = await sbGet(
      `/rest/v1/landing_yookassa_payments?yookassa_payment_id=in.(${filter})&select=id,auth_user_id,landing_user_id,plan_id,credits,amount_rub,idempotency_key,yookassa_payment_id,status,provider_status,test,credited_at,created_at,updated_at`,
    );
    all.push(...rows);
  }
  return all;
}

async function fetchPaymentsByIdempotencyKeys(keys) {
  if (keys.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < keys.length; i += 40) chunks.push(keys.slice(i, i + 40));
  const all = [];
  for (const chunk of chunks) {
    const filter = chunk.map(encodeURIComponent).join(",");
    const rows = await sbGet(
      `/rest/v1/landing_yookassa_payments?idempotency_key=in.(${filter})&select=id,auth_user_id,landing_user_id,plan_id,credits,amount_rub,idempotency_key,yookassa_payment_id,status,provider_status,test,credited_at,created_at,updated_at`,
    );
    all.push(...rows);
  }
  return all;
}

async function fetchAuthUserEmail(authUserId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    cache: "no-store",
  });
  if (res.status === 404) return { email: null, displayName: null };
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Auth admin user ${authUserId} → ${res.status}: ${text.slice(0, 300)}`);
  }
  const user = JSON.parse(text);
  const meta = user.user_metadata || {};
  return {
    email: typeof user.email === "string" ? user.email : null,
    displayName:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      null,
  };
}

async function fetchLandingIdentity(landingUserId) {
  const [lu, iu] = await Promise.all([
    sbGet(
      `/rest/v1/landing_users?id=eq.${encodeURIComponent(landingUserId)}&select=id,display_name,provider,credits`,
    ),
    sbGet(
      `/rest/v1/imageprompt_users?id=eq.${encodeURIComponent(landingUserId)}&select=id,email,display_name`,
    ),
  ]);
  return {
    landing: Array.isArray(lu) ? lu[0] : null,
    imageprompt: Array.isArray(iu) ? iu[0] : null,
  };
}

async function enrichIdentity(local) {
  const [auth, identity] = await Promise.all([
    fetchAuthUserEmail(local.auth_user_id),
    fetchLandingIdentity(local.landing_user_id),
  ]);
  const email =
    auth.email ||
    (identity.imageprompt && identity.imageprompt.email) ||
    null;
  const displayName =
    (identity.landing && identity.landing.display_name) ||
    auth.displayName ||
    (identity.imageprompt && identity.imageprompt.display_name) ||
    null;
  return { email, displayName };
}

function parseYooKassaPayment(value) {
  if (!value || typeof value !== "object" || !value.amount) {
    throw new Error("Invalid YooKassa payment response");
  }
  const status = value.status;
  if (!["pending", "waiting_for_capture", "succeeded", "canceled"].includes(status)) {
    throw new Error(`Unsupported YooKassa payment status: ${status}`);
  }
  const metadata = {};
  if (value.metadata && typeof value.metadata === "object") {
    for (const [k, v] of Object.entries(value.metadata)) {
      if (typeof v === "string") metadata[k] = v;
    }
  }
  return {
    id: String(value.id),
    status,
    paid: value.paid === true,
    amount: {
      value: String(value.amount.value),
      currency: String(value.amount.currency),
    },
    metadata,
    test: value.test === true,
  };
}

function assertYooKassaPaymentMatches(payment, expected) {
  if (payment.metadata.local_payment_id !== expected.localPaymentId) {
    throw new Error("YooKassa local payment metadata mismatch");
  }
  if (payment.metadata.plan_id !== expected.planId) {
    throw new Error("YooKassa plan metadata mismatch");
  }
  if (payment.amount.currency !== "RUB") {
    throw new Error("YooKassa payment currency mismatch");
  }
  const providerAmount = Number(payment.amount.value).toFixed(2);
  const expectedAmount = Number(expected.priceRub).toFixed(2);
  if (
    !Number.isFinite(Number(payment.amount.value)) ||
    !Number.isFinite(Number(expected.priceRub)) ||
    providerAmount !== expectedAmount
  ) {
    throw new Error("YooKassa payment amount mismatch");
  }
}

async function getYooKassaPayment(paymentId) {
  const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString(
    "base64",
  );
  const res = await fetch(
    `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const providerType =
      payload && typeof payload === "object" && typeof payload.type === "string"
        ? payload.type
        : "api_error";
    throw new Error(`YooKassa GET failed (${res.status}, ${providerType})`);
  }
  return parseYooKassaPayment(payload);
}

async function attachProviderIdIfNeeded(local, providerPaymentId, test) {
  if (local.yookassa_payment_id === providerPaymentId) return local;
  if (
    local.yookassa_payment_id &&
    local.yookassa_payment_id !== providerPaymentId
  ) {
    throw new Error("YooKassa provider payment id mismatch");
  }
  const updated = await sbPatch(
    `/rest/v1/landing_yookassa_payments?id=eq.${encodeURIComponent(local.id)}&yookassa_payment_id=is.null`,
    {
      yookassa_payment_id: providerPaymentId,
      test,
      updated_at: new Date().toISOString(),
    },
  );
  if (!Array.isArray(updated) || updated.length === 0) {
    // Race: re-read
    const again = await sbGet(
      `/rest/v1/landing_yookassa_payments?id=eq.${encodeURIComponent(local.id)}&select=*`,
    );
    const row = Array.isArray(again) ? again[0] : null;
    if (!row || row.yookassa_payment_id !== providerPaymentId) {
      throw new Error("Payment provider id attach failed");
    }
    return row;
  }
  return { ...local, ...updated[0] };
}

async function fulfillLocalPayment(local, providerPayment) {
  assertYooKassaPaymentMatches(providerPayment, {
    localPaymentId: local.id,
    planId: local.plan_id,
    priceRub: Number(local.amount_rub),
  });
  if (providerPayment.status !== "succeeded" || !providerPayment.paid) {
    throw new Error(
      `Provider not fulfillable: status=${providerPayment.status} paid=${providerPayment.paid}`,
    );
  }

  const attached = await attachProviderIdIfNeeded(
    local,
    providerPayment.id,
    providerPayment.test,
  );

  const fulfilled = await sbRpc("landing_fulfill_yookassa_payment", {
    p_payment_id: attached.id,
    p_yookassa_payment_id: providerPayment.id,
    p_test: providerPayment.test,
  });
  const result = Array.isArray(fulfilled) ? fulfilled[0] : fulfilled;
  return {
    credited: result?.credited === true,
    creditsAfter:
      typeof result?.credits_after === "number" ? result.credits_after : null,
    paymentStatus: result?.payment_status ?? null,
  };
}

function classify(csvRow, local) {
  const csvStatus = (csvRow["Статус платежа"] || "").trim();
  if (csvStatus !== "Оплачен") {
    return "unpaid_in_csv";
  }
  if (!local) return "missing_local";
  if (local.status === "succeeded" && local.credited_at) return "ok";
  return "needs_fulfill";
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const raw = readFileSync(csvPath, "utf8");
  const { rows: csvRows } = parseCsv(raw);

  const paidRows = [];
  const unpaidRows = [];
  for (const row of csvRows) {
    const status = (row["Статус платежа"] || "").trim();
    if (status === "Оплачен") paidRows.push(row);
    else unpaidRows.push(row);
  }

  const providerIds = paidRows
    .map((r) => (r["Идентификатор платежа"] || "").trim())
    .filter(Boolean);
  const accountNumbers = paidRows
    .map((r) => (r["Номер счёта"] || "").trim())
    .filter(Boolean);

  const [byProvider, byIdem] = await Promise.all([
    fetchPaymentsByProviderIds(providerIds),
    fetchPaymentsByIdempotencyKeys(accountNumbers),
  ]);

  const byProviderId = new Map(
    byProvider.map((p) => [p.yookassa_payment_id, p]),
  );
  const byIdemKey = new Map(byIdem.map((p) => [p.idempotency_key, p]));

  const classified = [];
  for (const csvRow of csvRows) {
    const ykId = (csvRow["Идентификатор платежа"] || "").trim();
    const account = (csvRow["Номер счёта"] || "").trim();
    let local = ykId ? byProviderId.get(ykId) : null;
    let matchVia = local ? "yookassa_payment_id" : null;
    if (!local && account) {
      local = byIdemKey.get(account) || null;
      if (local) matchVia = "idempotency_key";
    }
    const kind = classify(csvRow, local);
    classified.push({
      kind,
      matchVia,
      csv: {
        yookassa_payment_id: ykId,
        status: (csvRow["Статус платежа"] || "").trim(),
        amount_rub: parseAmountRub(csvRow["Сумма платежа"]),
        description: csvRow["Описание заказа"] || "",
        paid_at: csvRow["Дата платежа"] || "",
        created_at: csvRow["Дата создания заказа в ЮKassa"] || "",
        account_number: account,
        method: csvRow["Метод платежа"] || "",
      },
      local: local
        ? {
            id: local.id,
            auth_user_id: local.auth_user_id,
            landing_user_id: local.landing_user_id,
            plan_id: local.plan_id,
            credits: local.credits,
            amount_rub: Number(local.amount_rub),
            status: local.status,
            test: local.test === true,
            credited_at: local.credited_at,
            yookassa_payment_id: local.yookassa_payment_id,
            idempotency_key: local.idempotency_key,
          }
        : null,
    });
  }

  const needsFulfill = classified.filter((c) => c.kind === "needs_fulfill");
  const missingLocal = classified.filter((c) => c.kind === "missing_local");
  const ok = classified.filter((c) => c.kind === "ok");
  const unpaid = classified.filter((c) => c.kind === "unpaid_in_csv");

  // Enrich emails for needs_fulfill (+ missing stays without)
  for (const item of needsFulfill) {
    const identity = await enrichIdentity(item.local);
    item.email = identity.email;
    item.display_name = identity.displayName;
  }

  const applyResults = [];
  if (APPLY) {
    const modeLabel = HAS_YK ? "provider-GET" : "trust-csv";
    console.log(
      `\n--apply (${modeLabel}): fulfilling ${needsFulfill.length} payment(s)...\n`,
    );
    for (const item of needsFulfill) {
      const ykId = item.csv.yookassa_payment_id;
      try {
        let result;
        if (HAS_YK) {
          const provider = await getYooKassaPayment(ykId);
          result = await fulfillLocalPayment(item.local, provider);
        } else {
          if (item.local.yookassa_payment_id !== ykId) {
            throw new Error(
              `provider id mismatch local=${item.local.yookassa_payment_id} csv=${ykId}`,
            );
          }
          if (
            item.csv.amount_rub != null &&
            Number(item.local.amount_rub) !== Number(item.csv.amount_rub)
          ) {
            throw new Error(
              `amount mismatch local=${item.local.amount_rub} csv=${item.csv.amount_rub}`,
            );
          }
          const fulfilled = await sbRpc("landing_fulfill_yookassa_payment", {
            p_payment_id: item.local.id,
            p_yookassa_payment_id: ykId,
            p_test: item.local.test === true,
          });
          const row = Array.isArray(fulfilled) ? fulfilled[0] : fulfilled;
          result = {
            credited: row?.credited === true,
            creditsAfter:
              typeof row?.credits_after === "number" ? row.credits_after : null,
            paymentStatus: row?.payment_status ?? null,
          };
        }
        applyResults.push({
          yookassa_payment_id: ykId,
          local_id: item.local.id,
          email: item.email,
          ok: true,
          credited: result.credited,
          credits_after: result.creditsAfter,
          payment_status: result.paymentStatus,
        });
        console.log(
          `OK ${ykId} local=${item.local.id} credited=${result.credited} credits_after=${result.creditsAfter}`,
        );
      } catch (err) {
        applyResults.push({
          yookassa_payment_id: ykId,
          local_id: item.local?.id ?? null,
          email: item.email ?? null,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        console.error(`FAIL ${ykId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const apologySource = APPLY
    ? applyResults.filter((r) => r.ok && r.credited)
    : needsFulfill;

  const apologyRows = apologySource.map((item) => {
    if (APPLY) {
      const src = needsFulfill.find(
        (n) => n.csv.yookassa_payment_id === item.yookassa_payment_id,
      );
      return {
        email: item.email || "",
        display_name: src?.display_name || "",
        plan: src?.local?.plan_id || "",
        amount_rub: src?.local?.amount_rub ?? "",
        credits: src?.local?.credits ?? "",
        yookassa_payment_id: item.yookassa_payment_id,
        local_payment_id: item.local_id || "",
      };
    }
    return {
      email: item.email || "",
      display_name: item.display_name || "",
      plan: item.local.plan_id,
      amount_rub: item.local.amount_rub,
      credits: item.local.credits,
      yookassa_payment_id: item.csv.yookassa_payment_id,
      local_payment_id: item.local.id,
    };
  });

  const needsFulfillCsv = needsFulfill.map((item) => ({
    yookassa_payment_id: item.csv.yookassa_payment_id,
    local_id: item.local.id,
    email: item.email || "",
    display_name: item.display_name || "",
    plan: item.local.plan_id,
    amount_rub: item.local.amount_rub,
    credits: item.local.credits,
    local_status: item.local.status,
    credited_at: item.local.credited_at || "",
    match_via: item.matchVia || "",
    csv_paid_at: item.csv.paid_at,
  }));

  const missingCsv = missingLocal.map((item) => ({
    yookassa_payment_id: item.csv.yookassa_payment_id,
    account_number: item.csv.account_number,
    amount_rub: item.csv.amount_rub ?? "",
    description: item.csv.description,
    csv_paid_at: item.csv.paid_at,
  }));

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    csv_path: csvPath,
    generated_at: new Date().toISOString(),
    summary: {
      csv_total: csvRows.length,
      unpaid_in_csv: unpaid.length,
      ok: ok.length,
      needs_fulfill: needsFulfill.length,
      missing_local: missingLocal.length,
      apply_ok: APPLY ? applyResults.filter((r) => r.ok).length : null,
      apply_credited: APPLY
        ? applyResults.filter((r) => r.ok && r.credited).length
        : null,
      apply_failed: APPLY ? applyResults.filter((r) => !r.ok).length : null,
    },
    needs_fulfill: needsFulfill,
    missing_local: missingLocal,
    apply_results: APPLY ? applyResults : undefined,
  };

  const reportPath = resolve(outDir, "yk-reconcile-report.json");
  const needsPath = resolve(outDir, "yk-reconcile-needs-fulfill.csv");
  const missingPath = resolve(outDir, "yk-reconcile-missing-local.csv");
  const apologyPath = resolve(outDir, "yk-apology-recipients.csv");

  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeCsv(
    needsPath,
    [
      "yookassa_payment_id",
      "local_id",
      "email",
      "display_name",
      "plan",
      "amount_rub",
      "credits",
      "local_status",
      "credited_at",
      "match_via",
      "csv_paid_at",
    ],
    needsFulfillCsv,
  );
  writeCsv(
    missingPath,
    [
      "yookassa_payment_id",
      "account_number",
      "amount_rub",
      "description",
      "csv_paid_at",
    ],
    missingCsv,
  );
  writeCsv(
    apologyPath,
    [
      "email",
      "display_name",
      "plan",
      "amount_rub",
      "credits",
      "yookassa_payment_id",
      "local_payment_id",
    ],
    apologyRows,
  );

  console.log("\n=== YooKassa CSV reconcile ===");
  console.log(`mode: ${APPLY ? "apply" : "dry-run"}`);
  console.log(`csv: ${csvPath}`);
  console.log(`total rows: ${csvRows.length}`);
  console.log(`  unpaid_in_csv:   ${unpaid.length}`);
  console.log(`  ok (credited):   ${ok.length}`);
  console.log(`  needs_fulfill:   ${needsFulfill.length}`);
  console.log(`  missing_local:   ${missingLocal.length}`);
  if (APPLY) {
    console.log(
      `  apply: ok=${report.summary.apply_ok} credited=${report.summary.apply_credited} failed=${report.summary.apply_failed}`,
    );
  }
  console.log("\nOutputs:");
  console.log(`  ${reportPath}`);
  console.log(`  ${needsPath}`);
  console.log(`  ${missingPath}`);
  console.log(`  ${apologyPath}`);

  if (needsFulfill.length > 0) {
    console.log("\nneeds_fulfill:");
    for (const item of needsFulfill) {
      console.log(
        `  ${item.csv.yookassa_payment_id}  local=${item.local.id}  status=${item.local.status}  email=${item.email || "?"}  plan=${item.local.plan_id}  ${item.local.amount_rub}₽`,
      );
    }
  }
  if (missingLocal.length > 0) {
    console.log("\nmissing_local (manual review, not auto-applied):");
    for (const item of missingLocal) {
      console.log(
        `  ${item.csv.yookassa_payment_id}  account=${item.csv.account_number}  ${item.csv.amount_rub}₽  ${item.csv.description}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
