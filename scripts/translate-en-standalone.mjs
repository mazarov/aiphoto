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

// ── Config ──

const GEMINI_API_KEY = "AIzaSyCCiECEtG1MtKCjx_qEHpVXfZHFMhnsiN8";
const GEMINI_BASE = "https://gemini-proxy.photo2sticker.ru";
const GEMINI_MODEL = "gemini-2.5-flash";

const SUPABASE_URL = "https://bk07-67ud-ea1y.gw-1a.dockhost.net";
const SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MjE0NzQ4MzY0OH0.g2XOTiZsxcP-57E5A7NTtiTj2TfweaxLg7Yw0Iy6GOM";

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

// ── Gemini ──

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
  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Translate this photo prompt to Russian:\n\n${promptEn}` }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──

async function main() {
  console.log(`\n🔤 translate-en-standalone [dryRun=${DRY_RUN}]`);
  if (DATASET) console.log(`   dataset: ${DATASET}`);
  console.log(`   proxy: ${GEMINI_BASE}`);
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

  async function processOne(variant) {
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
    if (running.size >= CONCURRENCY) await Promise.race(running);
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
