/**
 * Fix cards with template/junk titles by generating proper titles from prompt text via LLM.
 *
 * Usage:
 *   npx tsx src/fix-template-titles.ts --dataset bananogenpromt_ChatExport_2026-03-13 --dry-run
 *   npx tsx src/fix-template-titles.ts --dataset bananogenpromt_ChatExport_2026-03-13
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const JUNK_PATTERNS = [
  "Сделай такое же фото в два клика",
  "Зачем платить за генерации",
  "Наша семейка ботов",
  "@Bananogenbot",
  "Выбери «Создать фото»",
];

type Args = {
  dataset: string;
  dryRun: boolean;
  limit?: number;
  concurrency: number;
};

type CardRow = {
  id: string;
  title_ru: string;
  slug: string | null;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let dataset = "";
  let concurrency = 5;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--dataset") dataset = args[i + 1] ?? "";
    if (args[i] === "--limit") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) limit = v;
    }
    if (args[i] === "--concurrency") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) concurrency = v;
    }
  }
  if (!dataset) throw new Error("Missing --dataset");
  return { dataset, dryRun, limit, concurrency };
}

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "landing", ".env.local"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", ".env.local"),
  ]) {
    if (existsSync(p)) loadDotenv({ path: p, override: false });
  }
}

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  );
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isJunkTitle(title: string): boolean {
  return JUNK_PATTERNS.some((p) => title.includes(p));
}

const CYR_MAP: Record<string, string> = {
  'щ':'shch','ш':'sh','ч':'ch','ц':'ts','ж':'zh','ё':'yo','э':'e','ю':'yu','я':'ya',
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','з':'z','и':'i','й':'y','к':'k',
  'л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
  'х':'kh','ъ':'','ы':'y','ь':'',
};

function translitSlug(text: string): string {
  let s = text.toLowerCase();
  for (const [k, v] of Object.entries(CYR_MAP)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, '').replace(/[\s\-]+/g, '-').replace(/^-|-$/g, '');
  return s.slice(0, 80).replace(/-$/, '');
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  title: string,
  cardId: string,
): Promise<string> {
  let base = translitSlug(title);
  if (!base) base = 'promt-' + cardId.slice(0, 8);
  let slug = base;
  let counter = 1;
  while (true) {
    const { count } = await supabase
      .from('prompt_cards')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .neq('id', cardId);
    if (!count || count === 0) break;
    counter++;
    slug = base + '-' + counter;
  }
  return slug;
}

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a title generator for a photo prompt catalog.

Given a photo generation prompt text in Russian, create a SHORT, descriptive title in Russian.

Rules:
- Title should be 3-7 words, describing what the photo shows
- Use natural Russian
- Focus on the SUBJECT and SETTING of the photo (e.g. "Девушка в осеннем парке", "Портрет мужчины в студии")
- Do NOT include technical terms, camera settings, or generation instructions
- Do NOT use quotes or special characters
- Return ONLY the title text, nothing else`;

async function generateTitle(apiKey: string, promptText: string): Promise<string | null> {
  const body = {
    contents: [
      { role: "user", parts: [{ text: `Generate a short Russian title for this photo prompt:\n\n${promptText.slice(0, 500)}` }] },
    ],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      maxOutputTokens: 100,
      temperature: 0.3,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 429) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const title = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!title) return null;
  return title.replace(/^["«]|["»]$/g, '').trim().slice(0, 120);
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) throw new Error("Missing Supabase URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = required("GEMINI_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Fetch cards with junk titles
  const junkCards: CardRow[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("prompt_cards")
      .select("id, title_ru, slug")
      .eq("source_dataset_slug", args.dataset)
      .range(from, from + 499);
    if (!data || data.length === 0) break;
    for (const c of data) {
      if (c.title_ru && isJunkTitle(c.title_ru)) junkCards.push(c as CardRow);
    }
    if (data.length < 500) break;
    from += 500;
  }

  const toProcess = args.limit ? junkCards.slice(0, args.limit) : junkCards;

  console.log(`\n📝 fix-template-titles [dryRun=${args.dryRun}]`);
  console.log(`   dataset: ${args.dataset}`);
  console.log(`   Junk titles found: ${junkCards.length}, processing: ${toProcess.length}\n`);

  if (toProcess.length === 0) { console.log("Nothing to fix."); return; }

  // Fetch prompts for these cards
  const promptMap = new Map<string, string>();
  const cardIds = toProcess.map((c) => c.id);
  for (let i = 0; i < cardIds.length; i += 50) {
    const batch = cardIds.slice(i, i + 50);
    const { data } = await supabase
      .from("prompt_variants")
      .select("card_id, prompt_text_ru, prompt_text_en")
      .in("card_id", batch)
      .order("variant_index", { ascending: true });
    for (const v of (data || [])) {
      if (!promptMap.has(v.card_id)) {
        const text = (v.prompt_text_ru || v.prompt_text_en || "").trim();
        if (text) promptMap.set(v.card_id, text);
      }
    }
  }

  let success = 0;
  let failed = 0;
  let noPrompt = 0;
  const active = new Set<Promise<void>>();

  const processCard = async (card: CardRow) => {
    const prompt = promptMap.get(card.id);
    if (!prompt) { noPrompt++; return; }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const newTitle = await generateTitle(apiKey, prompt);
        if (newTitle === null) {
          console.log(`  ⏳ Rate limited, retrying...`);
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }

        if (!args.dryRun) {
          await supabase.from("prompt_cards").update({ title_ru: newTitle }).eq("id", card.id);
          const newSlug = await generateUniqueSlug(supabase, newTitle, card.id);
          await supabase.from("prompt_cards").update({ slug: newSlug }).eq("id", card.id);
        }

        success++;
        if (success <= 5 || success % 50 === 0) {
          console.log(`  ✓ [${success}] "${newTitle}"`);
        }
        return;
      } catch (err) {
        if (attempt === maxRetries - 1) {
          failed++;
          console.log(`  ✗ ${(err as Error).message.slice(0, 100)}`);
        } else {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
  };

  for (const card of toProcess) {
    if (active.size >= args.concurrency) await Promise.race(active);
    const p = processCard(card).then(() => { active.delete(p); });
    active.add(p);
    if ((success + failed + noPrompt) > 0 && (success + failed + noPrompt) % 50 === 0) {
      console.log(`  ⏳ ${success + failed + noPrompt}/${toProcess.length} processed...`);
    }
  }
  await Promise.all(active);

  console.log(`\n✅ Done!`);
  console.log(`   Fixed: ${success}/${toProcess.length}`);
  console.log(`   No prompt: ${noPrompt}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Dry run: ${args.dryRun}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
