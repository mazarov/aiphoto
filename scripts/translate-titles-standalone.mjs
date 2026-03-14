#!/usr/bin/env node
/**
 * Standalone translate EN titles → RU for running on DO server.
 * Zero dependencies — uses only Node 20 built-in fetch.
 *
 * Idempotent: skips cards where title_ru is already in Russian.
 * Stops after 3 consecutive 403 errors.
 *
 * Usage:
 *   node translate-titles-standalone.mjs --dataset ii_photolab_ChatExport_2026-03-14
 *   node translate-titles-standalone.mjs --dataset ii_photolab_ChatExport_2026-03-14 --dry-run
 *   node translate-titles-standalone.mjs --dataset ii_photolab_ChatExport_2026-03-14 --limit 10
 */

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

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1], 10) : undefined; })();
const DATASET = (() => { const i = args.indexOf("--dataset"); return i >= 0 ? args[i + 1] : undefined; })();

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

function isEnglishTitle(title) {
  if (!title) return false;
  const cyr = (title.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (title.match(/[A-Za-z]/g) || []).length;
  return lat > cyr;
}

const CYR_MAP = {
  'щ':'shch','ш':'sh','ч':'ch','ц':'ts','ж':'zh','ё':'yo','э':'e','ю':'yu','я':'ya',
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','з':'z','и':'i','й':'y','к':'k',
  'л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
  'х':'kh','ъ':'','ы':'y','ь':'',
};

function translitSlug(text) {
  let s = text.toLowerCase();
  for (const [k, v] of Object.entries(CYR_MAP)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, '').replace(/[\s\-]+/g, '-').replace(/^-|-$/g, '');
  return s.slice(0, 80).replace(/-$/, '');
}

const SYSTEM_PROMPT = `You are a title generator for a photo prompt catalog.

Given a photo generation prompt title in English, create a SHORT, descriptive title in Russian.

Rules:
- Title should be 3-7 words, describing what the photo shows
- Use natural Russian
- Focus on the SUBJECT and SETTING (e.g. "Девушка в осеннем парке", "Портрет мужчины в студии")
- Do NOT include technical terms, camera settings, or generation instructions
- Do NOT use quotes or special characters
- Return ONLY the title text, nothing else`;

async function translateTitle(titleEn) {
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
        { role: "user", content: `Create a short Russian title for this photo prompt title:\n\n${titleEn}` },
      ],
      max_tokens: 100,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content?.trim() || null;
  if (!text) return null;
  return text.replace(/^["«]|["»]$/g, '').trim().slice(0, 120);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n📝 translate-titles-standalone [dryRun=${DRY_RUN}]`);
  if (DATASET) console.log(`   dataset: ${DATASET}`);
  console.log(`   model: ${LLM_MODEL}, base: ${OPENAI_BASE}`);
  console.log(`   concurrency: ${CONCURRENCY}\n`);

  let filter = "select=id,title_ru,slug&order=source_date.desc&limit=5000";
  if (DATASET) filter += `&source_dataset_slug=eq.${DATASET}`;
  const allCards = await sbSelect("prompt_cards", filter);

  const enCards = allCards.filter(c => isEnglishTitle(c.title_ru));
  const toProcess = LIMIT ? enCards.slice(0, LIMIT) : enCards;

  console.log(`   Total cards: ${allCards.length}, EN titles: ${enCards.length}, processing: ${toProcess.length}\n`);
  if (!toProcess.length) { console.log("Nothing to translate."); return; }

  let success = 0, failed = 0;
  let consecutive403 = 0;
  let stopped = false;

  async function processCard(card) {
    if (stopped) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const newTitle = await translateTitle(card.title_ru);
        if (newTitle === null) {
          console.log(`  ⏳ Rate limited, retrying...`);
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }

        consecutive403 = 0;
        const newSlug = translitSlug(newTitle);

        if (!DRY_RUN) {
          await sbUpdate("prompt_cards", card.id, { title_ru: newTitle, slug: newSlug || card.slug });
        }

        success++;
        if (success <= 5 || success % 100 === 0) {
          console.log(`  ✓ [${success}] "${newTitle}"`);
        }
        return;
      } catch (err) {
        const is403 = err.message.includes("403");
        if (is403) {
          consecutive403++;
          if (consecutive403 >= 3) {
            console.error(`\n🛑 3 consecutive 403 errors — stopping early.`);
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
  for (const card of toProcess) {
    if (stopped) break;
    if (running.size >= CONCURRENCY) await Promise.race(running);
    if (stopped) break;
    const p = processCard(card).then(() => running.delete(p));
    running.add(p);
  }
  await Promise.all(running);

  console.log(`\n✅ Done!`);
  console.log(`   Translated: ${success}/${toProcess.length}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Dry run: ${DRY_RUN}`);
}

main().catch(e => { console.error(e); process.exit(1); });
