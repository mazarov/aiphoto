#!/usr/bin/env node
/**
 * Standalone: enqueue + process Gemini Embedding 2 jobs for canonical card photos.
 * Zero npm deps — Node 20+ fetch only.
 *
 * DO:
 *   curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/backfill-card-image-embeddings.mjs
 *   nohup node backfill-card-image-embeddings.mjs --dry-run --limit 20 > backfill-card-image-embeddings.log 2>&1 &
 *   ps aux | grep backfill-card-image-embeddings
 *   tail -f backfill-card-image-embeddings.log
 *
 * Env (already on DO): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 * GEMINI_PROXY_BASE_URL. Embeddings go through the proxy when the URL is set.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const MODEL = (process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2").trim();
const DIRECT_GEMINI_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_PROXY_BASE = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
const USE_GEMINI_PROXY = envFlag("GEMINI_EMBEDDING_USE_PROXY", true);
const GEMINI_BASE = USE_GEMINI_PROXY && GEMINI_PROXY_BASE
  ? GEMINI_PROXY_BASE
  : DIRECT_GEMINI_BASE;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limit = intArg("--limit", 80);
const concurrency = Math.min(8, Math.max(1, intArg("--concurrency", 2)));
const generationArg = args.includes("--generation") ? intArg("--generation", 1) : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!DRY_RUN && !GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

function envFlag(name, fallback) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function intArg(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const parsed = Number.parseInt(args[i + 1], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  }, 20_000);
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${name} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function sniffMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  return "";
}

async function downloadPhoto(bucket, path) {
  const render = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${path}?width=768&quality=70`;
  const direct = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  for (const url of [render, direct]) {
    const res = await fetchWithTimeout(url, {}, 20_000);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) continue;
    const mime = sniffMime(bytes) || "image/jpeg";
    return { bytes, mime };
  }
  throw new Error("image_fetch_failed");
}

async function embedImage(bytes, mimeType) {
  const res = await fetchWithTimeout(`${GEMINI_BASE}/v1beta/models/${MODEL}:embedContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: Buffer.from(bytes).toString("base64"),
            },
          },
        ],
      },
      output_dimensionality: 768,
    }),
  }, 45_000);
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const payload = await res.json();
  const values = payload?.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) throw new Error("malformed_vector");
  if (values.some((value) => !Number.isFinite(Number(value)))) throw new Error("malformed_vector");
  return values;
}

async function mapPool(items, worker) {
  const pending = items.slice();
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const started = Date.now();
  console.log(
    `[${new Date().toISOString()}] visual embeddings dry_run=${DRY_RUN} limit=${limit} concurrency=${concurrency} generation=${generationArg ?? "active"} gemini_host=${new URL(GEMINI_BASE).hostname}`,
  );

  const coverageBefore = await rpc("visual_embedding_coverage", {
    p_generation: generationArg,
  });
  console.log("coverage_before", JSON.stringify(coverageBefore));

  if (DRY_RUN) {
    const published = coverageBefore?.published_with_photo ?? 0;
    const ready = coverageBefore?.ready ?? 0;
    const missing = Math.max(0, published - ready);
    console.log("dry_run", JSON.stringify({
      would_enqueue_up_to: Math.min(limit, missing),
      missing,
      pending: coverageBefore?.pending ?? 0,
      retry: coverageBefore?.retry ?? 0,
      dead: coverageBefore?.dead ?? 0,
    }));
    return;
  }

  const enqueued = await rpc("enqueue_missing_visual_embedding_jobs", {
    p_generation: generationArg,
    p_limit: limit,
  });
  console.log("enqueued", enqueued);

  const jobs = await rpc("claim_visual_embedding_jobs", {
    p_limit: limit,
    p_lease_seconds: 600,
  });
  const claimed = Array.isArray(jobs) ? jobs : [];
  console.log("claimed", claimed.length);

  const stats = { completed: 0, failed: 0, errors: {} };
  await mapPool(claimed, async (job) => {
    try {
      const photo = await downloadPhoto(job.storage_bucket, job.storage_path);
      const vector = await embedImage(photo.bytes, photo.mime);
      const ok = await rpc("complete_visual_embedding_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_embedding: `[${vector.join(",")}]`,
        p_fingerprint: job.source_fingerprint,
        p_model: MODEL,
      });
      if (ok !== true) throw new Error("complete_failed");
      stats.completed += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 64) : "unknown";
      stats.errors[code] = (stats.errors[code] || 0) + 1;
      await rpc("fail_visual_embedding_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_error_code: code,
      });
      stats.failed += 1;
    }
  });

  const coverageAfter = await rpc("visual_embedding_coverage", {
    p_generation: generationArg,
  });
  console.log("done", JSON.stringify({
    ms: Date.now() - started,
    enqueued,
    claimed: claimed.length,
    ...stats,
    coverage_after: coverageAfter,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
