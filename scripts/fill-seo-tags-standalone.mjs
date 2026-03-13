#!/usr/bin/env node
/**
 * Standalone fill-seo-tags script for running on DO server.
 * Zero dependencies — uses only Node 20 built-in fetch.
 * Supabase accessed via REST API directly.
 *
 * Usage:
 *   node fill-seo-tags-standalone.mjs                          # all untagged cards
 *   node fill-seo-tags-standalone.mjs --limit 10               # first 10
 *   node fill-seo-tags-standalone.mjs --limit 5 --dry-run      # preview
 *   node fill-seo-tags-standalone.mjs --recompute-all           # re-tag everything
 *   node fill-seo-tags-standalone.mjs --dataset ii_photolab_ChatExport_2026-03-13
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
const RECOMPUTE = args.includes("--recompute-all");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : undefined;
})();
const DATASET = (() => {
  const i = args.indexOf("--dataset");
  return i >= 0 ? args[i + 1] : undefined;
})();

// ── Known tags (inlined from tag-registry.ts) ──

const DIMENSIONS = ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"];

const KNOWN_TAGS = [
  { slug: "devushka", dim: "audience_tag", ru: "Девушки", en: "Women" },
  { slug: "muzhchina", dim: "audience_tag", ru: "Мужчины", en: "Men" },
  { slug: "para", dim: "audience_tag", ru: "Пары", en: "Couples" },
  { slug: "semya", dim: "audience_tag", ru: "Семья", en: "Family" },
  { slug: "detskie", dim: "audience_tag", ru: "Дети", en: "Kids" },
  { slug: "s_mamoy", dim: "audience_tag", ru: "С мамой", en: "With mother" },
  { slug: "s_papoy", dim: "audience_tag", ru: "С папой", en: "With father" },
  { slug: "s_parnem", dim: "audience_tag", ru: "С парнем", en: "With boyfriend" },
  { slug: "s_muzhem", dim: "audience_tag", ru: "С мужем", en: "With husband" },
  { slug: "s_podrugoy", dim: "audience_tag", ru: "С подругой", en: "With friend" },
  { slug: "s_drugom", dim: "audience_tag", ru: "С другом", en: "With friend" },
  { slug: "s_synom", dim: "audience_tag", ru: "С сыном", en: "With son" },
  { slug: "s_dochkoy", dim: "audience_tag", ru: "С дочкой", en: "With daughter" },
  { slug: "s_sestroy", dim: "audience_tag", ru: "С сестрой", en: "With sister" },
  { slug: "s_bratom", dim: "audience_tag", ru: "С братом", en: "With brother" },
  { slug: "s_babushkoy", dim: "audience_tag", ru: "С бабушкой", en: "With grandmother" },
  { slug: "malchik", dim: "audience_tag", ru: "Мальчик", en: "Boy" },
  { slug: "devochka", dim: "audience_tag", ru: "Девочка", en: "Girl" },
  { slug: "podrostok", dim: "audience_tag", ru: "Подросток", en: "Teenager" },
  { slug: "malysh", dim: "audience_tag", ru: "Малыш", en: "Baby" },
  { slug: "pokoleniy", dim: "audience_tag", ru: "Поколения", en: "Generations" },
  { slug: "vlyublennykh", dim: "audience_tag", ru: "Влюблённые", en: "Lovers" },
  { slug: "s_pitomcem", dim: "audience_tag", ru: "С питомцем", en: "With pet" },
  { slug: "beremennaya", dim: "audience_tag", ru: "Беременная", en: "Pregnant" },
  { slug: "cherno_beloe", dim: "style_tag", ru: "Чёрно-белое", en: "Black & White" },
  { slug: "realistichnoe", dim: "style_tag", ru: "Реалистичное", en: "Realistic" },
  { slug: "portret", dim: "style_tag", ru: "Портрет", en: "Portrait" },
  { slug: "3d", dim: "style_tag", ru: "3D", en: "3D" },
  { slug: "gta", dim: "style_tag", ru: "GTA", en: "GTA" },
  { slug: "studiynoe", dim: "style_tag", ru: "Студийное", en: "Studio" },
  { slug: "love_is", dim: "style_tag", ru: "Love Is", en: "Love Is" },
  { slug: "delovoe", dim: "style_tag", ru: "Деловое", en: "Business" },
  { slug: "multyashnoe", dim: "style_tag", ru: "Мультяшное", en: "Cartoon" },
  { slug: "kollazh", dim: "style_tag", ru: "Коллаж", en: "Collage" },
  { slug: "otkrytka", dim: "style_tag", ru: "Открытка", en: "Postcard" },
  { slug: "sovetskoe", dim: "style_tag", ru: "Советское", en: "Soviet" },
  { slug: "retro", dim: "style_tag", ru: "Ретро", en: "Retro" },
  { slug: "anime", dim: "style_tag", ru: "Аниме", en: "Anime" },
  { slug: "polaroid", dim: "style_tag", ru: "Полароид", en: "Polaroid" },
  { slug: "disney", dim: "style_tag", ru: "Disney", en: "Disney" },
  { slug: "selfi", dim: "style_tag", ru: "Селфи", en: "Selfie" },
  { slug: "piksar", dim: "style_tag", ru: "Pixar", en: "Pixar" },
  { slug: "neonovoe", dim: "style_tag", ru: "Неоновое", en: "Neon" },
  { slug: "street_style", dim: "style_tag", ru: "Street Style", en: "Street Style" },
  { slug: "fashion", dim: "style_tag", ru: "Fashion", en: "Fashion" },
  { slug: "glyanec", dim: "style_tag", ru: "Глянец", en: "Glossy" },
  { slug: "victorias_secret", dim: "style_tag", ru: "Victoria's Secret", en: "Victoria's Secret" },
  { slug: "barbie", dim: "style_tag", ru: "Barbie", en: "Barbie" },
  { slug: "kinematograficheskoe", dim: "style_tag", ru: "Кинематографическое", en: "Cinematic" },
  { slug: "y2k", dim: "style_tag", ru: "Y2K", en: "Y2K" },
  { slug: "lifestyle", dim: "style_tag", ru: "Лайфстайл", en: "Lifestyle" },
  { slug: "vintazhnoe", dim: "style_tag", ru: "Винтажное", en: "Vintage" },
  { slug: "fotorealizm", dim: "style_tag", ru: "Фотореализм", en: "Photorealism" },
  { slug: "minimalizm", dim: "style_tag", ru: "Минимализм", en: "Minimalism" },
  { slug: "vysokaya_moda", dim: "style_tag", ru: "Высокая мода", en: "High fashion" },
  { slug: "editorial", dim: "style_tag", ru: "Эдиториал", en: "Editorial" },
  { slug: "den_rozhdeniya", dim: "occasion_tag", ru: "День рождения", en: "Birthday" },
  { slug: "8_marta", dim: "occasion_tag", ru: "8 марта", en: "March 8" },
  { slug: "14_fevralya", dim: "occasion_tag", ru: "14 февраля", en: "Valentine's Day" },
  { slug: "23_fevralya", dim: "occasion_tag", ru: "23 февраля", en: "Feb 23" },
  { slug: "maslenica", dim: "occasion_tag", ru: "Масленица", en: "Maslenitsa" },
  { slug: "novyy_god", dim: "occasion_tag", ru: "Новый год", en: "New Year" },
  { slug: "svadba", dim: "occasion_tag", ru: "Свадьба", en: "Wedding" },
  { slug: "rozhdestvo", dim: "occasion_tag", ru: "Рождество", en: "Christmas" },
  { slug: "v_forme", dim: "object_tag", ru: "В форме", en: "In uniform" },
  { slug: "s_mashinoy", dim: "object_tag", ru: "С машиной", en: "With car" },
  { slug: "s_cvetami", dim: "object_tag", ru: "С цветами", en: "With flowers" },
  { slug: "so_znamenitostyu", dim: "object_tag", ru: "Со знаменитостью", en: "With celebrity" },
  { slug: "v_profil", dim: "object_tag", ru: "В профиль", en: "Profile" },
  { slug: "s_kotom", dim: "object_tag", ru: "С котом", en: "With cat" },
  { slug: "v_kostyume", dim: "object_tag", ru: "В костюме", en: "In suit" },
  { slug: "na_chernom_fone", dim: "object_tag", ru: "На чёрном фоне", en: "On black background" },
  { slug: "s_tortom", dim: "object_tag", ru: "С тортом", en: "With cake" },
  { slug: "zima", dim: "object_tag", ru: "Зима", en: "Winter" },
  { slug: "v_zerkale", dim: "object_tag", ru: "В зеркале", en: "In mirror" },
  { slug: "vesna", dim: "object_tag", ru: "Весна", en: "Spring" },
  { slug: "s_sobakoy", dim: "object_tag", ru: "С собакой", en: "With dog" },
  { slug: "v_lesu", dim: "object_tag", ru: "В лесу", en: "In forest" },
  { slug: "s_koronoy", dim: "object_tag", ru: "С короной", en: "With crown" },
  { slug: "na_more", dim: "object_tag", ru: "На море", en: "At sea" },
  { slug: "v_polnyy_rost", dim: "object_tag", ru: "В полный рост", en: "Full body" },
  { slug: "v_gorah", dim: "object_tag", ru: "В горах", en: "In mountains" },
  { slug: "na_ulice", dim: "object_tag", ru: "На улице", en: "Outdoor" },
  { slug: "v_mashine", dim: "object_tag", ru: "В машине", en: "In car" },
  { slug: "na_yahte", dim: "object_tag", ru: "На яхте", en: "On yacht" },
  { slug: "v_restorane", dim: "object_tag", ru: "В ресторане", en: "In restaurant" },
  { slug: "na_kryshe", dim: "object_tag", ru: "На крыше", en: "On rooftop" },
  { slug: "v_pustyne", dim: "object_tag", ru: "В пустыне", en: "In desert" },
  { slug: "pod_vodoy", dim: "object_tag", ru: "Под водой", en: "Underwater" },
  { slug: "v_gorode", dim: "object_tag", ru: "В городе", en: "In city" },
  { slug: "s_shuboj", dim: "object_tag", ru: "В шубе", en: "In fur coat" },
  { slug: "so_svechami", dim: "object_tag", ru: "Со свечами", en: "With candles" },
  { slug: "v_platye", dim: "object_tag", ru: "В платье", en: "In dress" },
  { slug: "s_bokalom", dim: "object_tag", ru: "С бокалом", en: "With glass" },
  { slug: "s_kofe", dim: "object_tag", ru: "С кофе", en: "With coffee" },
  { slug: "na_avatarku", dim: "object_tag", ru: "На аватарку", en: "For avatar" },
  { slug: "s_elkoj", dim: "object_tag", ru: "С ёлкой", en: "With Christmas tree" },
  { slug: "s_sharami", dim: "object_tag", ru: "С шарами", en: "With balloons" },
  { slug: "na_belom_fone", dim: "object_tag", ru: "На белом фоне", en: "On white background" },
  { slug: "v_interere", dim: "object_tag", ru: "В интерьере", en: "Indoors" },
  { slug: "s_podarkami", dim: "object_tag", ru: "С подарками", en: "With gifts" },
  { slug: "s_ochkami", dim: "object_tag", ru: "С очками", en: "With glasses" },
  { slug: "noch", dim: "object_tag", ru: "Ночь", en: "Night" },
];

const KNOWN_SLUGS = new Set(KNOWN_TAGS.map(t => t.slug));

function buildTagList() {
  const lines = [];
  for (const dim of DIMENSIONS) {
    lines.push(`\n${dim}:`);
    for (const t of KNOWN_TAGS.filter(t => t.dim === dim)) {
      lines.push(`  ${t.slug} — ${t.ru} (${t.en})`);
    }
  }
  return lines.join("\n");
}

// ── Supabase REST helpers ──

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
  const res = await fetch(url, {
    method: "PATCH",
    headers: SB_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update ${res.status}: ${await res.text()}`);
}

// ── Gemini ──

const SYSTEM_PROMPT = `You are a photo prompt classifier for an SEO-driven photo prompt catalog.

Given a prompt (title + text in Russian or English), assign ALL relevant tags across 5 dimensions.

STEP 1 — Use KNOWN tags from the list below whenever they match.
STEP 2 — If the prompt describes a scene, location, style, or subject NOT covered by the known tags, CREATE a new tag.

Rules for KNOWN tags:
- A tag is relevant if the prompt EXPLICITLY describes the corresponding scene/object/style/audience/event
- For audience_tag: determine by character descriptions and relationships
- For style_tag: determine by shooting technique, visual style, references
- For object_tag: determine by objects, locations, clothing category, accessories
- For occasion_tag: determine by mentions of holidays or events
- For doc_task_tag: determine by the purpose of the photo

Rules for NEW tags:
- A good new tag is something a user would SEARCH for
- The slug must be latin snake_case transliteration of the Russian concept
- Provide labelRu and labelEn
- Place new slugs in the corresponding dimension arrays AND in the "new_tags" array

DO NOT create tags for:
- Specific clothing items or colors
- Camera/technical parameters
- Generation instructions
- Appearance details, textures, lighting, emotions, poses

When in doubt — DO NOT add the tag. Precision > recall.
Return empty arrays for dimensions with no matches.

Known tags:
${buildTagList()}`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...Object.fromEntries(DIMENSIONS.map(d => [d, { type: "ARRAY", items: { type: "STRING" } }])),
    new_tags: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          slug: { type: "STRING" },
          dimension: { type: "STRING", enum: [...DIMENSIONS] },
          labelRu: { type: "STRING" },
          labelEn: { type: "STRING" },
        },
        required: ["slug", "dimension", "labelRu", "labelEn"],
      },
    },
  },
  required: [...DIMENSIONS, "new_tags"],
};

async function classifyCard(title, promptTexts) {
  const userText = [title ? `Title: ${title}` : "", `Prompt:\n${promptTexts.join("\n---\n")}`]
    .filter(Boolean).join("\n\n");

  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 1024,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;

  let str = raw;
  const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
  if (i >= 0 && j > i) str = raw.slice(i, j + 1);
  return JSON.parse(str);
}

function buildSeoTags(parsed) {
  const result = { audience_tag: [], style_tag: [], occasion_tag: [], object_tag: [], doc_task_tag: [], labels: { ru: [], en: [] } };
  const newTags = [];

  for (const dim of DIMENSIONS) {
    const arr = parsed[dim];
    if (!Array.isArray(arr)) continue;
    for (const slug of arr) {
      if (typeof slug === "string" && slug) result[dim].push(slug);
      if (!KNOWN_SLUGS.has(slug)) {
        const meta = (parsed.new_tags || []).find(t => t.slug === slug && t.dimension === dim);
        newTags.push(meta || { slug, dimension: dim, labelRu: slug, labelEn: slug });
      }
    }
  }

  const allSlugs = [...result.audience_tag, ...result.style_tag, ...result.occasion_tag, ...result.object_tag, ...result.doc_task_tag];
  const slugMap = Object.fromEntries(KNOWN_TAGS.map(t => [t.slug, t]));
  if (allSlugs.length > 0) {
    result.labels.ru = [`Промт для фото ${allSlugs.slice(0, 3).map(s => slugMap[s]?.ru || s).join(", ")}`];
    result.labels.en = [`Photo prompt: ${allSlugs.slice(0, 3).map(s => slugMap[s]?.en || s).join(", ")}`];
  }

  return { seoTags: result, newTags };
}

function score(tags) {
  let s = 0;
  for (const d of DIMENSIONS) if (tags[d]?.length > 0) s += 20;
  return Math.min(100, s);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──

async function main() {
  console.log(`\n🏷️  fill-seo-tags-standalone [dryRun=${DRY_RUN}] [recompute=${RECOMPUTE}]`);
  if (DATASET) console.log(`   dataset: ${DATASET}`);
  console.log(`   proxy: ${GEMINI_BASE}`);
  console.log(`   concurrency: ${CONCURRENCY}\n`);

  // Fetch cards
  let filter = "select=id,title_ru,seo_readiness_score&order=source_date.desc";
  if (DATASET) filter += `&source_dataset_slug=eq.${DATASET}`;
  if (!RECOMPUTE) filter += "&seo_readiness_score=eq.0";
  if (LIMIT) filter += `&limit=${LIMIT}`;

  const cards = await sbSelect("prompt_cards", filter);
  if (!cards.length) { console.log("No cards to process."); return; }
  console.log(`📋 ${cards.length} cards to process\n`);

  // Fetch prompts for all cards (batched)
  const promptMap = new Map();
  for (let i = 0; i < cards.length; i += 20) {
    const ids = cards.slice(i, i + 20).map(c => `"${c.id}"`).join(",");
    const variants = await sbSelect("prompt_variants",
      `select=card_id,prompt_text_ru,prompt_text_en&card_id=in.(${ids})&order=variant_index.asc`);
    for (const v of variants) {
      const text = (v.prompt_text_ru || v.prompt_text_en || "").trim();
      if (!text) continue;
      const arr = promptMap.get(v.card_id) || [];
      arr.push(text);
      promptMap.set(v.card_id, arr);
    }
    if (i > 0) await sleep(200);
  }

  let updated = 0, failed = 0, skipped = 0;
  const allNewTags = new Map();
  let active = 0;
  const queue = [...cards];

  async function processCard(card) {
    const prompts = promptMap.get(card.id);
    if (!prompts?.length) { skipped++; return; }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const parsed = await classifyCard(card.title_ru, prompts);
        if (parsed === null) {
          console.log(`  ⏳ Rate limited, retry ${attempt + 1}...`);
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }

        const { seoTags, newTags } = buildSeoTags(parsed);
        const s = score(seoTags);

        for (const nt of newTags) {
          const key = `${nt.dimension}:${nt.slug}`;
          const ex = allNewTags.get(key);
          if (ex) ex.count++;
          else allNewTags.set(key, { ...nt, count: 1 });
        }

        if (!DRY_RUN) {
          await sbUpdate("prompt_cards", card.id, { seo_tags: seoTags, seo_readiness_score: s });
        }

        updated++;
        const dims = DIMENSIONS.map(d => seoTags[d].length > 0 ? `${d}=[${seoTags[d].join(",")}]` : null).filter(Boolean);
        if (updated <= 5 || updated % 50 === 0) {
          console.log(`  ✓ [${updated}] ${(card.title_ru || "?").slice(0, 40)} (score=${s}) ${dims.join(" ")}`);
        }
        return;
      } catch (err) {
        if (attempt === 2) {
          failed++;
          console.log(`  ✗ ${card.id}: ${err.message.slice(0, 100)}`);
        } else {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
  }

  const running = new Set();
  for (const card of queue) {
    if (running.size >= CONCURRENCY) await Promise.race(running);
    const p = processCard(card).then(() => running.delete(p));
    running.add(p);
  }
  await Promise.all(running);

  // Report
  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated}/${cards.length}`);
  console.log(`   Failed: ${failed}, Skipped (no prompts): ${skipped}`);
  console.log(`   Dry run: ${DRY_RUN}`);

  if (allNewTags.size > 0) {
    const sorted = [...allNewTags.entries()].sort((a, b) => b[1].count - a[1].count);
    console.log(`\n🆕 New tags discovered: ${sorted.length}`);
    for (const [key, v] of sorted.slice(0, 20)) {
      console.log(`   ${String(v.count).padStart(3)}x  ${key}  "${v.labelRu}" / "${v.labelEn}"`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
