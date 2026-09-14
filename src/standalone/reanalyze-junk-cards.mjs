#!/usr/bin/env node
/**
 * Re-analyze published cards with junk/generic titles or junk slugs.
 * Gemini vision → photoreal prompt + short SEO titles.
 * Slug text is rebuilt from the new title; the trailing short id stays.
 * Old /p/{slug} → 301 via upsert_card_titles_and_slug.
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
/** Full `/p/{slug}` token, including `-2cd88`. Google has no 128 cap; this stays SERP-short. */
export const CARD_SLUG_MAX_LEN = 128;
/** Same translit window as ingest / retitle-all. */
export const CARD_SLUG_TEXT_MAX_LEN = 80;

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

const CYR = {
  щ: "shch",
  ш: "sh",
  ч: "ch",
  ц: "ts",
  ж: "zh",
  ё: "yo",
  э: "e",
  ю: "yu",
  я: "ya",
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ъ: "",
  ы: "y",
  ь: "",
};

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

export function cardSlugShortId(slug) {
  const m = String(slug || "")
    .trim()
    .match(/-([a-f0-9]{4,8})$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function translitSlugText(text) {
  let s = String(text || "").toLowerCase();
  for (const [k, v] of Object.entries(CYR)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, "").replace(/[\s\-]+/g, "-").replace(/^-|-$/g, "");
  return s.slice(0, CARD_SLUG_TEXT_MAX_LEN).replace(/-$/, "");
}

export function isJunkCardSlug(slug) {
  const raw = String(slug || "").trim();
  if (!raw) return false;
  const text = raw.replace(/-([a-f0-9]{4,8})$/i, "");
  if (!text) return false;

  for (const g of GENERIC_EXACT) {
    const gSlug = translitSlugText(g);
    if (!gSlug) continue;
    if (gSlug === "promt") {
      if (text === "promt" || /^promt-\d+$/.test(text)) return true;
      continue;
    }
    if (text === gSlug || text.startsWith(`${gSlug}-`)) return true;
  }
  for (const p of JUNK_PREFIXES) {
    const pSlug = translitSlugText(p);
    if (pSlug && pSlug.length >= 8 && text.includes(pSlug)) return true;
  }
  return false;
}

export function buildCardSlug(titleRu, currentSlug, cardId, splitIndex = 0, splitTotal = 1) {
  const code =
    cardSlugShortId(currentSlug) ||
    String(cardId || "")
      .replace(/-/g, "")
      .slice(0, 5);
  let base = translitSlugText(titleRu) || "promt";
  if (splitTotal > 1) base = `${base}-${splitIndex + 1}`;
  const suffix = `-${code}`;
  const maxBase = Math.max(1, Math.min(CARD_SLUG_TEXT_MAX_LEN, CARD_SLUG_MAX_LEN - suffix.length));
  base = base.slice(0, maxBase).replace(/-$/, "") || "promt";
  const slug = `${base}${suffix}`;
  return slug.length <= CARD_SLUG_MAX_LEN ? slug : slug.slice(0, CARD_SLUG_MAX_LEN).replace(/-$/, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}, ms = 120_000) {
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
    120_000,
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
    120_000,
  );
  if (!res.ok) {
    throw new Error(`SB PATCH ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function sbHeadCount(table, query) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    { method: "HEAD", headers: { ...SB, Prefer: "count=exact" } },
    120_000,
  );
  const range = res.headers.get("content-range") || "";
  const m = range.match(/\/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

async function sbRpc(fn, params) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/rpc/${fn}`,
    {
      method: "POST",
      headers: SB,
      body: JSON.stringify(params),
    },
    120_000,
  );
  if (!res.ok) {
    throw new Error(`SB RPC ${fn} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function uniqueSlug(card, titleRu) {
  const base = buildCardSlug(
    titleRu,
    card.slug,
    card.id,
    card.card_split_index ?? 0,
    card.card_split_total ?? 1,
  );
  const code = cardSlugShortId(base);
  const prefix = code ? base.slice(0, -(code.length + 1)) : base;
  let slug = base;
  let n = 1;
  while (true) {
    const cnt = await sbHeadCount(
      "prompt_cards",
      `slug=eq.${encodeURIComponent(slug)}&id=neq.${card.id}&select=id`,
    );
    if (!cnt) break;
    n += 1;
    slug = `${prefix}-${n}-${code}`;
  }
  return slug;
}

async function loadPublishedCards() {
  const cards = [];
  let offset = 0;
  while (true) {
    const batch = await sbGet(
      "prompt_cards",
      `select=id,slug,title_ru,title_en,title_de,card_split_index,card_split_total,is_published&is_published=eq.true&order=id.asc&limit=500&offset=${offset}`,
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
    const res = await fetchWithTimeout(url, {}, 60_000);
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
    const ru = String(parsed.ru || "")
      .replace(/["«»]/g, "")
      .trim();
    const en = String(parsed.en || "")
      .replace(/["«»]/g, "")
      .trim();
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

async function writePrompt(cardId, prompt) {
  const variant = await loadVariant0(cardId);
  if (variant?.id) {
    await sbPatch("prompt_variants", `id=eq.${variant.id}`, {
      prompt_text_ru: prompt,
      match_strategy: "junk_reanalyze",
    });
    return;
  }
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/prompt_variants`,
    {
      method: "POST",
      headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify({
        card_id: cardId,
        variant_index: 0,
        label_raw: "reanalyze",
        prompt_text_ru: prompt,
        prompt_text_en: null,
        match_strategy: "junk_reanalyze",
      }),
    },
    120_000,
  );
  if (!res.ok) {
    throw new Error(`variant_insert_${res.status}`);
  }
}

async function writeTitlesAndSlug(card, titles, newSlug) {
  await sbRpc("upsert_card_titles_and_slug", {
    p_card_id: card.id,
    p_title_ru: titles.ru,
    p_title_en: titles.en,
    p_title_de: card.title_de ?? null,
    p_new_slug: newSlug,
  });
}

function patternKey(card) {
  if (isJunkCardTitle(card.title_ru)) {
    const t = normalizeTitle(card.title_ru);
    const prefix = JUNK_PREFIXES.find((p) => t.startsWith(p) || t.includes(p));
    if (prefix) return prefix;
    if (GENERIC_EXACT.includes(t)) return t;
  }
  return "junk_slug";
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

function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
}

function requireGemini() {
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }
  if (!GEMINI_PROXY_BASE) {
    console.error("Missing GEMINI_PROXY_BASE_URL — stop, do not call Google directly");
    process.exit(1);
  }
}

async function main() {
  requireSupabase();
  console.log(
    `\nreanalyze-junk-cards dryRun=${DRY_RUN} limit=${LIMIT || "all"} concurrency=${CONCURRENCY}`,
  );

  const published = await loadPublishedCards();
  const junk = published.filter((c) => isJunkCardTitle(c.title_ru) || isJunkCardSlug(c.slug));
  const slugOnly = junk.filter((c) => !isJunkCardTitle(c.title_ru));
  const needGemini = junk.filter((c) => isJunkCardTitle(c.title_ru));
  const ordered = [...slugOnly, ...needGemini];
  const byPattern = {};
  for (const card of junk) {
    const key = patternKey(card);
    byPattern[key] = (byPattern[key] || 0) + 1;
  }
  const toProcess = LIMIT ? ordered.slice(0, LIMIT) : ordered;
  const processGemini = toProcess.filter((c) => isJunkCardTitle(c.title_ru)).length;
  const processSlugOnly = toProcess.length - processGemini;
  console.log(
    `   published=${published.length} junk=${junk.length} slug_only=${slugOnly.length} need_gemini=${needGemini.length} process=${toProcess.length} (slug_only=${processSlugOnly} gemini=${processGemini})`,
  );
  console.log("   patterns", JSON.stringify(byPattern));

  if (!toProcess.length) return;

  if (!DRY_RUN && processGemini) {
    requireGemini();
    console.log(`   gemini_host=${new URL(GEMINI_PROXY_BASE).hostname} model=${GEMINI_MODEL}`);
  }

  const geminiIds = toProcess.filter((c) => isJunkCardTitle(c.title_ru)).map((c) => c.id);
  const media = geminiIds.length ? await loadPrimaryMedia(geminiIds) : new Map();
  const noPhoto = geminiIds.filter((id) => !media.get(id)).length;
  console.log(`   gemini_with_photo=${geminiIds.length - noPhoto} gemini_no_photo=${noPhoto}`);
  console.log("   sample:");
  for (const card of toProcess.slice(0, 8)) {
    const preview = isJunkCardTitle(card.title_ru)
      ? `${card.slug}  ←  ${card.title_ru}`
      : `${card.slug}  →  ${buildCardSlug(card.title_ru, card.slug, card.id)}  ←  ${card.title_ru}`;
    console.log(`     ${preview}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — no Gemini, no writes. Slug text would change; short id stays.");
    return;
  }

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;
  let slugsChanged = 0;

  await mapPool(toProcess, async (card) => {
    const slugBefore = card.slug;
    const codeBefore = cardSlugShortId(slugBefore);
    const analyze = isJunkCardTitle(card.title_ru);
    try {
      let titles = {
        ru: card.title_ru,
        en: card.title_en || card.title_ru,
      };
      if (analyze) {
        const photo = media.get(card.id);
        if (!photo?.storage_bucket || !photo?.storage_path) {
          skipped++;
          processed++;
          console.log(`  skip no_photo ${card.slug}`);
          return;
        }
        const image = await downloadPhoto(photo.storage_bucket, photo.storage_path);
        const prompt = await analyzePhoto(image.bytes, image.mime);
        titles = await titlesFromPrompt(prompt);
        await writePrompt(card.id, prompt);
      }
      const newSlug = await uniqueSlug(card, titles.ru);
      if (newSlug !== slugBefore || analyze) {
        await writeTitlesAndSlug(card, titles, newSlug);
      }
      const check = await sbGet("prompt_cards", `id=eq.${card.id}&select=slug,title_ru`);
      if (check[0]?.slug !== newSlug) {
        throw new Error(`slug_mismatch:${newSlug}->${check[0]?.slug}`);
      }
      if (codeBefore && cardSlugShortId(check[0].slug) !== codeBefore) {
        throw new Error(`slug_code_changed:${codeBefore}->${cardSlugShortId(check[0].slug)}`);
      }
      if (slugBefore !== newSlug) slugsChanged++;
      ok++;
      processed++;
      console.log(`  ✓ [${ok}] ${slugBefore} → /p/${newSlug}  |  ${titles.ru}`);
    } catch (err) {
      failed++;
      processed++;
      console.log(
        `  ✗ ${card.slug}: ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`,
      );
      await sleep(1500);
    }
    if (processed % 10 === 0) {
      console.log(`  ⏳ ${processed}/${toProcess.length} ok=${ok} fail=${failed} skip=${skipped} slugs=${slugsChanged}`);
    }
  });

  console.log(
    `\nDone ok=${ok} failed=${failed} skipped=${skipped} slugs_changed=${slugsChanged} short_id_kept=yes`,
  );
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
