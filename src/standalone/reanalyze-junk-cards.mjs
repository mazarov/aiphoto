#!/usr/bin/env node
/**
 * Re-analyze published cards with junk/generic titles.
 * Gemini vision → photoreal prompt + short SEO titles. Slug is never written.
 *
 * DO:
 *   curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/reanalyze-junk-cards.mjs
 *   nohup node reanalyze-junk-cards.mjs --dry-run > reanalyze-junk-cards.log 2>&1 &
 *   nohup node reanalyze-junk-cards.mjs --limit 20 --concurrency 1 > reanalyze-junk-cards.log 2>&1 &
 *   ps aux | grep reanalyze-junk-cards
 *   tail -f reanalyze-junk-cards.log
 *
 * Env already on DO: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 * GEMINI_PROXY_BASE_URL. Do not export secrets.
 */

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_PROXY_BASE = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
const GEMINI_MODEL = process.env.GEMINI_ANALYZE_MODEL || "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 400 * 1024;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = intArg("--limit", 0);
const CONCURRENCY = Math.min(3, Math.max(1, intArg("--concurrency", 1)));

const JUNK_PREFIXES = [
  "сделай такое же фото",
  "зачем платить за генерации",
  "наша семейка ботов",
  "@bananogenbot",
  "выбери «создать фото»",
  "выбери \"создать фото\"",
  "выбери создать фото",
];

const GENERIC_EXACT = [
  "подборка дня",
  "мужской промпт",
  "селфи в зеркале",
  "фото в зеркале",
  "селфи в машине",
  "happy birthday",
  "фото у бассейна",
  "выпускной",
  "майские",
  "моя генерация",
  "моя фотосессия",
  "промт",
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!DRY_RUN) {
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }
  if (!GEMINI_PROXY_BASE) {
    console.error("Missing GEMINI_PROXY_BASE_URL — stop, do not call Google directly");
    process.exit(1);
  }
}

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const ANALYZE_PROMPT = `LANGUAGE (mandatory):
- Keep every section heading exactly in English: Visual Hook, Scene, Genre, Pose, Lighting, Camera, Mood, Color, Clothing, Makeup, Composition, Avoid.
- Write every section body in Russian.

You are an expert AI image analyst. Describe THIS photo faithfully.
Output ONLY the labeled sections, each heading on its own line, body on the next. No markdown.

Visual Hook:
One concise art-direction sentence. Do not catalogue the whole scene.

Scene:
Where it is and what is happening. Use "the subject"; do not describe identity.

Genre:
Photographic genre.

Pose:
Visible pose only.

Lighting:
Key light and shadows.

Camera:
Framing and angle.

Mood:
Atmosphere.

Color:
Palette and grade.

Clothing:
Visible garments.

Makeup:
Visible makeup or "not visible".

Composition:
Crop and placement.

Avoid:
Anti-drift constraints.`;

const TITLE_PROMPT = `You write short SEO titles for a Russian AI-photo prompt catalog.

Given the photoreal prompt below, return JSON only:
{"ru":"...","en":"..."}

Rules:
- RU: 3–7 words, «кто/что + где/деталь». Example: «Девушка в красном платье у окна»
- EN: same meaning
- 20–80 characters
- No "Visual Hook", no "промт", no "PromptShot", no UI copy, no quotes, no emojis
- Unique to THIS image, not generic "Портрет девушки"`;

function intArg(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const parsed = Number.parseInt(args[i + 1], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTitle(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isJunkCardTitle(raw) {
  const t = normalizeTitle(raw);
  if (!t) return false;
  if (GENERIC_EXACT.includes(t)) return true;
  return JUNK_PREFIXES.some((p) => t.startsWith(p) || t.includes(p));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}, ms = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sbGet(table, query) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    { headers: SB },
    30_000,
  );
  if (!res.ok) {
    throw new Error(`SB GET ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify(body),
    },
    30_000,
  );
  if (!res.ok) {
    throw new Error(`SB PATCH ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function loadPublishedCards() {
  const cards = [];
  let offset = 0;
  while (true) {
    const batch = await sbGet(
      "prompt_cards",
      `select=id,slug,title_ru,is_published&is_published=eq.true&order=id.asc&limit=500&offset=${offset}`,
    );
    if (!batch.length) break;
    cards.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }
  return cards;
}

async function loadPrimaryMedia(cardIds) {
  const byCard = new Map();
  for (let i = 0; i < cardIds.length; i += 40) {
    const batch = cardIds.slice(i, i + 40);
    const rows = await sbGet(
      "prompt_card_media",
      `card_id=in.(${batch.join(",")})&select=card_id,storage_bucket,storage_path,is_primary,media_index&order=is_primary.desc,media_index.asc`,
    );
    for (const row of rows) {
      if (!byCard.has(row.card_id)) byCard.set(row.card_id, row);
    }
  }
  return byCard;
}

async function loadVariant0(cardId) {
  const rows = await sbGet(
    "prompt_variants",
    `card_id=eq.${cardId}&variant_index=eq.0&select=id,prompt_text_ru&limit=1`,
  );
  return rows[0] || null;
}

function sniffMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

async function downloadPhoto(bucket, path) {
  const render = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${path}?width=768&quality=70`;
  const direct = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  for (const url of [render, direct]) {
    const res = await fetchWithTimeout(url, {}, 20_000);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) continue;
    return { bytes, mime: sniffMime(bytes) };
  }
  throw new Error("image_fetch_failed");
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text || "")
    .join("")
    .trim();
}

async function geminiGenerate(parts, maxTokens, timeoutMs) {
  const url = `${GEMINI_PROXY_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    throw new Error(`gemini_http_${res.status}:${(await res.text()).slice(0, 180)}`);
  }
  const text = extractGeminiText(await res.json());
  if (!text) throw new Error("gemini_empty");
  return text;
}

async function analyzePhoto(bytes, mime) {
  const raw = await geminiGenerate(
    [
      { text: ANALYZE_PROMPT },
      {
        inline_data: {
          mime_type: mime,
          data: Buffer.from(bytes).toString("base64"),
        },
      },
    ],
    4096,
    90_000,
  );
  const prompt = `${raw}\n\nCRITICAL RULES\n- Сохранить: структуру лица, черты, тон кожи, цвет глаз, пропорции.\n- Объект должен выглядеть естественно сфотографированным в сцене, а не вставленным.\n- Фотореалистичный результат, высокая детализация текстур.`;
  return prompt;
}

function parseTitleJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const ru = String(parsed.ru || "").replace(/["«»]/g, "").trim();
    const en = String(parsed.en || "").replace(/["«»]/g, "").trim();
    if (!ru || ru.length < 8 || ru.length > 80) return null;
    if (isJunkCardTitle(ru)) return null;
    if (/visual hook|промт для фото/i.test(ru)) return null;
    return { ru, en: en || ru };
  } catch {
    return null;
  }
}

async function titlesFromPrompt(prompt) {
  const raw = await geminiGenerate(
    [{ text: `${TITLE_PROMPT}\n\nPrompt:\n${prompt.slice(0, 1600)}` }],
    256,
    30_000,
  );
  const titles = parseTitleJson(raw);
  if (!titles) throw new Error("title_parse_failed");
  return titles;
}

async function writePromptAndTitles(card, prompt, titles) {
  const variant = await loadVariant0(card.id);
  if (variant?.id) {
    await sbPatch("prompt_variants", `id=eq.${variant.id}`, {
      prompt_text_ru: prompt,
      match_strategy: "junk_reanalyze",
    });
  } else {
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/prompt_variants`,
      {
        method: "POST",
        headers: { ...SB, Prefer: "return=minimal" },
        body: JSON.stringify({
          card_id: card.id,
          variant_index: 0,
          label_raw: "reanalyze",
          prompt_text_ru: prompt,
          prompt_text_en: null,
          match_strategy: "junk_reanalyze",
        }),
      },
      30_000,
    );
    if (!res.ok) {
      throw new Error(`variant_insert_${res.status}`);
    }
  }
  await sbPatch("prompt_cards", `id=eq.${card.id}`, {
    title_ru: titles.ru,
    title_en: titles.en,
    updated_at: new Date().toISOString(),
  });
}

function patternKey(title) {
  const t = normalizeTitle(title);
  const prefix = JUNK_PREFIXES.find((p) => t.startsWith(p) || t.includes(p));
  if (prefix) return prefix;
  if (GENERIC_EXACT.includes(t)) return t;
  return "other";
}

async function mapPool(items, worker) {
  const pending = items.slice();
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length || 1) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log(
    `\nreanalyze-junk-cards dryRun=${DRY_RUN} limit=${LIMIT || "all"} concurrency=${CONCURRENCY}`,
  );
  if (!DRY_RUN) {
    console.log(`   gemini_host=${new URL(GEMINI_PROXY_BASE).hostname} model=${GEMINI_MODEL}`);
  }

  const published = await loadPublishedCards();
  const junk = published.filter((c) => isJunkCardTitle(c.title_ru));
  const byPattern = {};
  for (const card of junk) {
    const key = patternKey(card.title_ru);
    byPattern[key] = (byPattern[key] || 0) + 1;
  }
  const toProcess = LIMIT ? junk.slice(0, LIMIT) : junk;
  console.log(`   published=${published.length} junk=${junk.length} process=${toProcess.length}`);
  console.log("   patterns", JSON.stringify(byPattern));

  if (!toProcess.length) return;

  const media = await loadPrimaryMedia(toProcess.map((c) => c.id));
  const noPhoto = toProcess.filter((c) => !media.get(c.id)).length;
  console.log(`   with_photo=${toProcess.length - noPhoto} no_photo=${noPhoto}`);
  console.log("   sample:");
  for (const card of toProcess.slice(0, 8)) {
    console.log(`     ${card.slug}  ←  ${card.title_ru}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — no Gemini, no writes, slugs untouched.");
    return;
  }

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;

  await mapPool(toProcess, async (card) => {
    const photo = media.get(card.id);
    if (!photo?.storage_bucket || !photo?.storage_path) {
      skipped++;
      processed++;
      console.log(`  skip no_photo ${card.slug}`);
      return;
    }
    const slugBefore = card.slug;
    try {
      const image = await downloadPhoto(photo.storage_bucket, photo.storage_path);
      const prompt = await analyzePhoto(image.bytes, image.mime);
      const titles = await titlesFromPrompt(prompt);
      await writePromptAndTitles(card, prompt, titles);
      const check = await sbGet(
        "prompt_cards",
        `id=eq.${card.id}&select=slug,title_ru`,
      );
      if (check[0]?.slug !== slugBefore) {
        throw new Error(`slug_changed:${slugBefore}->${check[0]?.slug}`);
      }
      ok++;
      processed++;
      console.log(`  ✓ [${ok}] ${slugBefore} → ${titles.ru}`);
    } catch (err) {
      failed++;
      processed++;
      console.log(`  ✗ ${card.slug}: ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`);
      await sleep(1500);
    }
    if (processed % 10 === 0) {
      console.log(`  ⏳ ${processed}/${toProcess.length} ok=${ok} fail=${failed} skip=${skipped}`);
    }
  });

  console.log(`\nDone ok=${ok} failed=${failed} skipped=${skipped} slugs_unchanged=yes`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
