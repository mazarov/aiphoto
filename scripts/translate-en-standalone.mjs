#!/usr/bin/env node
/**
 * Standalone translate EN→RU script for running on DO server.
 * Zero dependencies — uses only Node 20 built-in fetch.
 *
 * Usage:
 *   node translate-en-standalone.mjs                                    # all EN-only variants
 *   node translate-en-standalone.mjs --limit 10                         # first 10
 *   node translate-en-standalone.mjs --limit 5 --dry-run                # preview
 *   node translate-en-standalone.mjs --dataset ii_photolab_ChatExport_2026-03-13
 */

// ── Config (from env) ──

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4.1-mini";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars. Export before running:");
  console.error("  export OPENAI_API_KEY=...");
  console.error("  export SUPABASE_URL=...");
  console.error("  export SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

const CONCURRENCY = 5;

// ── CLI args ──

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1], 10) : undefined; })();
const DATASET = (() => { const i = args.indexOf("--dataset"); return i >= 0 ? args[i + 1] : undefined; })();

// ── Supabase REST ──

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbSelect(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbUpdate(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, { method: "PATCH", headers: SB_HEADERS, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Supabase update ${res.status}: ${await res.text()}`);
}

// ── LLM ──

const SYSTEM_PROMPT = `You are a professional translator for a photo prompt catalog.

Translate the given English photo generation prompt into natural Russian.

Rules:
- Keep the meaning and style instructions intact
- Use natural Russian phrasing, not word-by-word translation
- Preserve technical terms that are commonly used in Russian as-is (e.g. bokeh, HDR)
- Keep formatting: if the original has line breaks or commas separating parts, maintain that structure
- Do NOT add explanations, just return the translated prompt text
- Return ONLY the translated text, nothing else`;

async function translate(promptEn) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Translate this photo prompt to Russian:\n\n${promptEn}` },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──

async function main() {
  console.log(`\n🔤 translate-en-standalone [dryRun=${DRY_RUN}]`);
  if (DATASET) console.log(`   dataset: ${DATASET}`);
  console.log(`   model: ${LLM_MODEL}, base: ${OPENAI_BASE}`);
  console.log(`   concurrency: ${CONCURRENCY}\n`);

  // Step 1: get card IDs (optionally filtered by dataset)
  let cardFilter = "select=id";
  if (DATASET) cardFilter += `&source_dataset_slug=eq.${DATASET}`;
  cardFilter += "&order=source_date.desc&limit=5000";
  const cards = await sbSelect("prompt_cards", cardFilter);
  const cardIds = cards.map(c => c.id);
  if (!cardIds.length) { console.log("No cards found."); return; }

  // Step 2: fetch EN-only variants (prompt_text_ru is null or empty)
  const enOnly = [];
  for (let i = 0; i < cardIds.length; i += 50) {
    const ids = cardIds.slice(i, i + 50).map(id => `"${id}"`).join(",");
    const variants = await sbSelect("prompt_variants",
      `select=id,card_id,prompt_text_en,prompt_text_ru&card_id=in.(${ids})&order=variant_index.asc`);
    for (const v of variants) {
      const hasEn = v.prompt_text_en && v.prompt_text_en.trim();
      const noRu = !v.prompt_text_ru || !v.prompt_text_ru.trim();
      if (hasEn && noRu) enOnly.push(v);
    }
    if (i > 0) await sleep(200);
  }

  const toProcess = LIMIT ? enOnly.slice(0, LIMIT) : enOnly;
  console.log(`   EN-only variants: ${enOnly.length}, processing: ${toProcess.length}\n`);
  if (!toProcess.length) { console.log("Nothing to translate."); return; }

  let success = 0, failed = 0, rateLimited = 0;
  let consecutive403 = 0;
  let stopped = false;

  async function processOne(variant) {
    if (stopped) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const translated = await translate(variant.prompt_text_en);
        if (translated === null) {
          rateLimited++;
          const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
          console.log(`  ⏳ Rate limited, retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }

        consecutive403 = 0;

        if (!DRY_RUN) {
          await sbUpdate("prompt_variants", variant.id, {
            prompt_text_ru: translated,
            prompt_normalized_ru: translated,
          });
        }

        success++;
        if (success <= 5 || success % 50 === 0) {
          const preview = translated.slice(0, 80).replace(/\n/g, " ");
          console.log(`  ✓ [${success}] ${preview}...`);
        }
        return;
      } catch (err) {
        const is403 = err.message.includes("403");
        if (is403) {
          consecutive403++;
          if (consecutive403 >= 3) {
            console.error(`\n🛑 3 consecutive 403 errors — stopping early. Fix API access and re-run.`);
            stopped = true;
            return;
          }
        }
        if (attempt === 2) {
          failed++;
          console.log(`  ✗ ${err.message.slice(0, 100)}`);
        } else {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
  }

  const running = new Set();
  for (const v of toProcess) {
    if (stopped) break;
    if (running.size >= CONCURRENCY) await Promise.race(running);
    if (stopped) break;
    const p = processOne(v).then(() => running.delete(p));
    running.add(p);
  }
  await Promise.all(running);

  console.log(`\n✅ Done!`);
  console.log(`   Translated: ${success}/${toProcess.length}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Rate limited retries: ${rateLimited}`);
  console.log(`   Dry run: ${DRY_RUN}`);
}

main().catch(e => { console.error(e); process.exit(1); });
