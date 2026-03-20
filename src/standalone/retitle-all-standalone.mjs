#!/usr/bin/env node
/**
 * Standalone: regenerate SEO titles (ru/en/de) for all prompt cards.
 * Zero dependencies — Node 20+ built-in fetch only.
 *
 * Usage on DO:
 *   export OPENAI_API_KEY=...
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   node retitle-all-standalone.mjs --dry-run --limit 20
 *   node retitle-all-standalone.mjs --limit 200 --concurrency 3
 *   node retitle-all-standalone.mjs
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4.1-mini";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars. Export before running:");
  console.error("  export OPENAI_API_KEY=...");
  console.error("  export SUPABASE_URL=...");
  console.error("  export SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const INCLUDE_UNPUBLISHED = args.includes("--include-unpublished");
const SKIP_EXISTING = args.includes("--skip-existing");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1], 10) : undefined; })();
const CONCURRENCY = (() => { const i = args.indexOf("--concurrency"); return i >= 0 ? parseInt(args[i + 1], 10) : 4; })();

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const TITLE_MAX = 120;

const SYSTEM_PROMPT = `You are an SEO title writer for PromptShot — a catalog of ready-made AI photo generation prompts.

Users search Google/Yandex for prompts like:
- "промт девушка на яхте"
- "AI photo prompt couple in Paris"
- "KI Foto Prompt Frau im Regen"

Given the prompt text below, write 3 localized SEO titles.

FORMAT:
- RU: «Кто/Что + Где/Как + Деталь». Пример: «Девушка в вечернем платье на крыше небоскрёба»
- EN: «Who/What + Where/How + Detail». Example: «Woman in evening dress on skyscraper rooftop»
- DE: «Wer/Was + Wo/Wie + Detail». Beispiel: «Frau im Abendkleid auf Wolkenkratzer-Dach»

RULES:
- 50–120 chars each (strict)
- Start with the SUBJECT (person, object, animal)
- Include 1 distinguishing detail (location, style, mood, prop)
- Natural language — as a human would describe the photo
- No technical tokens: aspect ratios, resolution, camera params, lighting terms
- No AI instructions: "сохрани лицо", "не меняй", "create photo of"
- No generic titles: avoid just "Портрет девушки" — add what makes THIS prompt unique
- No quotes, no emojis

Return JSON only:
{"ru": "...", "en": "...", "de": "..."}`;

// ── Supabase helpers ──

async function sbGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB });
  if (!res.ok) throw new Error(`SB GET ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sbRpc(fn, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: SB,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`SB RPC ${fn} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sbHead(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "HEAD",
    headers: { ...SB, Prefer: "count=exact" },
  });
  const range = res.headers.get("content-range") || "";
  const m = range.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ── LLM ──

async function llmCall(promptText) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Prompt text:\n\n${promptText.slice(0, 1200)}` },
      ],
      max_tokens: 240,
      temperature: 0.25,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? null;
}

function parseJson(text) {
  if (!text) return null;
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

function strip(s) {
  return (s || "").replace(/[""«»"]/g, "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
}

async function generateTitles(promptText) {
  const raw = await llmCall(promptText);
  const obj = parseJson(raw);
  if (!obj) return null;
  const ru = strip(obj.ru), en = strip(obj.en), de = strip(obj.de);
  if (!ru || !en || !de) return null;
  return { ru, en, de };
}

// ── Slug ──

const CYR = {
  щ:"shch",ш:"sh",ч:"ch",ц:"ts",ж:"zh",ё:"yo",э:"e",ю:"yu",я:"ya",
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",з:"z",и:"i",й:"y",к:"k",
  л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"kh",ъ:"",ы:"y",ь:"",
};

function translit(text) {
  let s = text.toLowerCase();
  for (const [k, v] of Object.entries(CYR)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, "").replace(/[\s\-]+/g, "-").replace(/^-|-$/g, "");
  return s.slice(0, 80).replace(/-$/, "");
}

async function uniqueSlug(ruTitle, cardId, splitIdx, splitTotal) {
  const shortId = cardId.replace(/-/g, "").slice(0, 5);
  let base = translit(ruTitle) || "promt";
  if (splitTotal > 1) base = `${base}-${splitIdx + 1}`;
  let slug = `${base}-${shortId}`;
  let n = 1;
  while (true) {
    const cnt = await sbHead("prompt_cards", `slug=eq.${encodeURIComponent(slug)}&id=neq.${cardId}&select=id`);
    if (cnt === 0) break;
    n++;
    slug = `${base}-${shortId}-${n}`;
  }
  return slug;
}

// ── Helpers ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──

async function main() {
  console.log(`\n📝 retitle-all-standalone [dryRun=${DRY_RUN}]`);
  console.log(`   model: ${LLM_MODEL}, concurrency: ${CONCURRENCY}`);
  console.log(`   includeUnpublished: ${INCLUDE_UNPUBLISHED}`);
  console.log(`   skipExisting(title_de): ${SKIP_EXISTING}\n`);

  const allCards = [];
  let offset = 0;
  while (true) {
    let q = `select=id,slug,title_ru,title_en,title_de,card_split_index,card_split_total&order=id.asc&limit=500&offset=${offset}`;
    if (!INCLUDE_UNPUBLISHED) q += "&is_published=eq.true";
    const batch = await sbGet("prompt_cards", q);
    if (!batch.length) break;
    allCards.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }

  const candidates = SKIP_EXISTING
    ? allCards.filter((c) => !(typeof c.title_de === "string" && c.title_de.trim()))
    : allCards;
  const skippedExisting = allCards.length - candidates.length;
  const toProcess = LIMIT ? candidates.slice(0, LIMIT) : candidates;
  console.log(`   cards found: ${allCards.length}, skipped existing: ${skippedExisting}, processing: ${toProcess.length}\n`);
  if (!toProcess.length) return;

  const promptMap = new Map();
  const ids = toProcess.map(c => c.id);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const filter = `card_id=in.(${batch.join(",")})&select=card_id,prompt_text_ru,prompt_text_en&order=variant_index.asc`;
    const rows = await sbGet("prompt_variants", filter);
    const byCard = new Map();
    for (const r of rows) {
      if (!byCard.has(r.card_id)) byCard.set(r.card_id, []);
      byCard.get(r.card_id).push(r);
    }
    for (const [cid, vars] of byCard) {
      const text = vars.find(v => v.prompt_text_ru?.trim())?.prompt_text_ru?.trim()
                || vars.find(v => v.prompt_text_en?.trim())?.prompt_text_en?.trim();
      if (text) promptMap.set(cid, text);
    }
    if (i > 0 && i % 500 === 0) console.log(`   fetched prompts: ${i}/${ids.length}`);
  }

  let success = 0, failed = 0, noPrompt = 0, slugChanged = 0, processed = 0;
  const total = toProcess.length;
  const running = new Set();

  function logProgress() {
    processed++;
    if (processed % 25 === 0 || processed === total) {
      console.log(`  ⏳ [${processed}/${total}] updated=${success} noPrompt=${noPrompt} failed=${failed}`);
    }
  }

  async function processCard(card) {
    const prompt = promptMap.get(card.id);
    if (!prompt) { noPrompt++; logProgress(); return; }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const titles = await generateTitles(prompt);
        if (!titles) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        const newSlug = await uniqueSlug(
          titles.ru, card.id,
          card.card_split_index ?? 0,
          card.card_split_total ?? 1,
        );
        if (!DRY_RUN) {
          await sbRpc("upsert_card_titles_and_slug", {
            p_card_id: card.id,
            p_title_ru: titles.ru,
            p_title_en: titles.en,
            p_title_de: titles.de,
            p_new_slug: newSlug,
          });
        }
        success++;
        if (card.slug !== newSlug) slugChanged++;
        if (success <= 5 || success % 50 === 0) console.log(`  ✓ [${success}] RU: ${titles.ru}  |  EN: ${titles.en}  |  DE: ${titles.de}`);
        logProgress();
        return;
      } catch (err) {
        if (attempt === 2) { failed++; console.log(`  ✗ ${err.message.slice(0, 140)}`); logProgress(); }
        else await sleep(1000 * (attempt + 1));
      }
    }
  }

  for (const card of toProcess) {
    if (running.size >= CONCURRENCY) await Promise.race(running);
    const p = processCard(card).then(() => running.delete(p));
    running.add(p);
  }
  await Promise.all(running);

  console.log("\n✅ Done!");
  console.log(`   Updated: ${success}/${toProcess.length}`);
  console.log(`   No prompt: ${noPrompt}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Slug changed: ${slugChanged}`);
  console.log(`   Dry run: ${DRY_RUN}`);
}

main().catch(e => { console.error(e); process.exit(1); });
