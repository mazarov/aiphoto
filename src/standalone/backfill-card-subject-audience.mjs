#!/usr/bin/env node
/**
 * Standalone: classify who is in each published card photo (Gemini 2.5 Flash)
 * and write prompt_cards.subject_*. The DB trigger projects seo_tags.audience_tag.
 *
 * Prompt + response schema must stay in sync with
 * landing/src/lib/audience-vision-core.ts.
 *
 * DO:
 *   curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/backfill-card-subject-audience.mjs
 *   nohup node backfill-card-subject-audience.mjs --dry-run --limit 20 > backfill-card-subject-audience.log 2>&1 &
 *   ps aux | grep backfill-card-subject-audience
 *   tail -f backfill-card-subject-audience.log
 *
 * Then, after SQL 256 is applied:
 *   nohup node backfill-card-subject-audience.mjs --priority exclusive --loop > backfill-card-subject-audience.log 2>&1 &
 *   nohup node backfill-card-subject-audience.mjs --priority visual_hook --loop > backfill-card-subject-audience.log 2>&1 &
 *   nohup node backfill-card-subject-audience.mjs --priority all --loop > backfill-card-subject-audience.log 2>&1 &
 *
 * Env (already on DO): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 * GEMINI_PROXY_BASE_URL. Empty proxy stops the process. No direct Google fallback.
 * This operator backfill does not consume card_subject_audience_daily_limit.
 */

import { pathToFileURL } from "node:url";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_PROXY_BASE = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
const MODEL = "gemini-2.5-flash";

const EXCLUSIVE = ["devushka", "muzhchina", "para", "semya", "malchik", "devochka", "malysh"];

const PROMPT = `Classify who is in this photograph for catalog filtering. JSON only.

audience:
- devushka: one adult woman (about 18+)
- muzhchina: one adult man (about 18+)
- para: two adults who look like a romantic couple
- semya: at least one adult together with a child, or multiple generations
- malchik: one boy child (about 2–12) as the subject, no adult
- devochka: one girl child (about 2–12) as the subject, no adult
- malysh: one baby or toddler (about 0–2) as the subject, no adult
- none: no person, pet only, group of friends, unclear, or low certainty

Never use devushka or muzhchina for a child. A clear solo child must be malchik, devochka, or malysh — not none.

people_count: visible people.
has_visible_face: at least one clear human face.
has_child: a child is clearly present.
confidence: 0..1.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    people_count: { type: "INTEGER" },
    has_visible_face: { type: "BOOLEAN" },
    has_child: { type: "BOOLEAN" },
    audience: {
      type: "STRING",
      enum: ["devushka", "muzhchina", "para", "semya", "malchik", "devochka", "malysh", "none"],
    },
    confidence: { type: "NUMBER" },
  },
  required: ["people_count", "has_visible_face", "has_child", "audience", "confidence"],
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LOOP = args.includes("--loop");
const limit = Math.min(500, Math.max(1, intArg("--limit", 200)));
const concurrency = Math.min(6, Math.max(1, intArg("--concurrency", 4)));
const priority = priorityArg();

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export function exclusiveSlugsIn(tags) {
  const list = Array.isArray(tags) ? tags : [];
  return EXCLUSIVE.filter((slug) => list.includes(slug));
}

export function disagreementKey(textAudience, vision) {
  const from = exclusiveSlugsIn(textAudience).join("+") || "none";
  return `${from}->${vision || "empty"}`;
}

export function shouldStopBatch(failed, attempted) {
  return attempted >= 50 && failed / attempted > 0.1;
}

function priorityArg() {
  const raw = stringArg("--priority", "all");
  if (!["all", "exclusive", "visual_hook"].includes(raw)) {
    console.error("invalid --priority (all | exclusive | visual_hook)");
    process.exit(1);
  }
  return raw;
}

function stringArg(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1]) return fallback;
  return args[i + 1];
}

function intArg(name, fallback) {
  const parsed = Number.parseInt(stringArg(name, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, ms = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(name, body) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: SB,
    body: JSON.stringify(body),
  }, 30_000);
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${name} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function sniffMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

async function downloadPhoto(bucket, path) {
  const render = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${path}?width=512&quality=60`;
  const direct = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  for (const url of [render, direct]) {
    const res = await fetchWithTimeout(url, {}, 20_000);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 4 * 1024 * 1024) continue;
    return { bytes, mime: sniffMime(bytes) };
  }
  throw new Error("image_fetch_failed");
}

async function classifyPhoto(bytes, mimeType) {
  let lastError = "gemini_failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetchWithTimeout(`${GEMINI_PROXY_BASE}/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }, 30_000);
    if (res.status === 429 || res.status >= 500) {
      lastError = `gemini_${res.status}`;
      const delay = 2000 * (2 ** attempt) + Math.floor(Math.random() * 500);
      await sleep(delay);
      continue;
    }
    if (!res.ok) throw new Error(`gemini_${res.status}`);
    const payload = await res.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const parsed = JSON.parse(raw);
    if (typeof parsed.audience !== "string" || typeof parsed.confidence !== "number") {
      throw new Error("malformed");
    }
    return parsed;
  }
  throw new Error(lastError);
}

async function mapPool(items, worker) {
  const pending = items.slice();
  const runners = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function pendingFilter() {
  const base = "is_published=eq.true&subject_audience=is.null&subject_attempts=lt.3";
  if (priority === "visual_hook") return `${base}&title_ru=like.Visual%20Hook*`;
  if (priority === "exclusive") {
    return `${base}&or=(seo_tags->audience_tag.cs.["muzhchina"],seo_tags->audience_tag.cs.["para"],seo_tags->audience_tag.cs.["semya"])`;
  }
  return base;
}

async function countPending() {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/prompt_cards?select=id&limit=1&${await pendingFilter()}`,
    { headers: { ...SB, Prefer: "count=exact" } },
    20_000,
  );
  if (!res.ok) return null;
  const range = res.headers.get("content-range") || "";
  const total = range.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!GEMINI_PROXY_BASE) {
    console.error("Missing GEMINI_PROXY_BASE_URL");
    process.exit(1);
  }
  if (!DRY_RUN && !GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }
}

async function runBatch(totals) {
  const claimed = await rpc("claim_subject_audience_batch", {
    p_limit: limit,
    p_priority: priority,
    p_card_id: null,
  });
  const jobs = Array.isArray(claimed) ? claimed : [];
  const stats = { claimed: jobs.length, completed: 0, failed: 0, disagreements: {} };
  await mapPool(jobs, async (job) => {
    try {
      const photo = await downloadPhoto(job.storage_bucket, job.storage_path);
      const vision = await classifyPhoto(photo.bytes, photo.mime);
      const ok = await rpc("complete_subject_audience", {
        p_card_id: job.card_id,
        p_media_id: job.media_id,
        p_audience: vision.audience,
        p_confidence: vision.confidence,
        p_people_count: vision.people_count ?? null,
        p_model: MODEL,
      });
      if (ok !== true) throw new Error("complete_failed");
      stats.completed += 1;
      const key = disagreementKey(job.current_audience, vision.audience);
      stats.disagreements[key] = (stats.disagreements[key] || 0) + 1;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 64) : "unknown";
      await rpc("fail_subject_audience", { p_card_id: job.card_id, p_error: code });
      stats.failed += 1;
    }
    totals.seen += 1;
    if (totals.seen % 50 === 0) {
      console.log("progress", JSON.stringify({ seen: totals.seen, ...stats }));
    }
  });
  return stats;
}

async function main() {
  assertEnv();
  const started = Date.now();
  console.log(
    `[${new Date().toISOString()}] subject audience dry_run=${DRY_RUN} limit=${limit} concurrency=${concurrency} priority=${priority} loop=${LOOP} gemini_host=${new URL(GEMINI_PROXY_BASE).hostname}`,
  );
  const coverageBefore = await rpc("subject_audience_coverage", {});
  const pending = await countPending();
  console.log("coverage_before", JSON.stringify(coverageBefore));
  console.log("pending_estimate", pending);

  if (DRY_RUN) {
    console.log("dry_run", JSON.stringify({
      would_claim_up_to: pending == null ? limit : Math.min(limit, pending),
      pending,
      priority,
    }));
    return;
  }

  const totals = { seen: 0, completed: 0, failed: 0, disagreements: {} };
  do {
    const stats = await runBatch(totals);
    totals.completed += stats.completed;
    totals.failed += stats.failed;
    for (const [key, count] of Object.entries(stats.disagreements)) {
      totals.disagreements[key] = (totals.disagreements[key] || 0) + count;
    }
    console.log("batch", JSON.stringify(stats));
    if (stats.claimed === 0) break;
    if (shouldStopBatch(stats.failed, stats.claimed)) {
      console.error("stop_loss", JSON.stringify({ failed: stats.failed, attempted: stats.claimed }));
      process.exit(2);
    }
    if (!LOOP) break;
    await sleep(2000);
  } while (true);

  const coverageAfter = await rpc("subject_audience_coverage", {});
  console.log("done", JSON.stringify({
    ms: Date.now() - started,
    completed: totals.completed,
    failed: totals.failed,
    disagreements: totals.disagreements,
    coverage_after: coverageAfter,
  }));
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
