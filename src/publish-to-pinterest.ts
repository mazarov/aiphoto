/**
 * Publish prompt cards to Pinterest as pins.
 *
 * Usage:
 *   npx tsx src/publish-to-pinterest.ts --limit 15
 *   npx tsx src/publish-to-pinterest.ts --limit 100 --dry-run
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "landing/.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
}

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  );
}

interface Args {
  limit: number;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = 15;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) limit = n;
    }
    if (args[i] === "--dry-run") dryRun = true;
  }
  return { limit, dryRun };
}

// ── Board mapping ──

type BoardMap = Map<string, string>; // "dimension_type:dimension_value" → pinterest_board_id

const PRIORITY: [string, string][] = [
  ["occasion_tag", "occasion"],
  ["audience_tag", "audience"],
  ["style_tag", "style"],
  ["object_tag", "object"],
  ["doc_task_tag", "doc_task"],
];

async function loadBoardMap(supabase: SupabaseClient): Promise<BoardMap> {
  const { data, error } = await supabase
    .from("prompt_clusters")
    .select("dimension_type, dimension_value, pinterest_board_id")
    .eq("page_level", "L1")
    .not("pinterest_board_id", "is", null);

  if (error) throw new Error(`Failed to load board map: ${error.message}`);

  const map: BoardMap = new Map();
  for (const row of data || []) {
    map.set(`${row.dimension_type}:${row.dimension_value}`, row.pinterest_board_id);
  }
  return map;
}

function pickBoard(
  seoTags: Record<string, string[]>,
  boardMap: BoardMap,
  fallbackBoardId: string
): string {
  for (const [tagKey, dimType] of PRIORITY) {
    const tags = seoTags[tagKey];
    if (!tags?.length) continue;
    const boardId = boardMap.get(`${dimType}:${tags[0]}`);
    if (boardId) return boardId;
  }
  return fallbackBoardId;
}

// ── Pinterest API ──

const PINTEREST_API = "https://api.pinterest.com/v5";
const MAX_RETRIES = 3;

async function refreshToken(): Promise<string> {
  const refreshTok = process.env.PINTEREST_REFRESH_TOKEN;
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;

  if (!refreshTok || !appId || !appSecret) {
    throw new Error("Missing PINTEREST_REFRESH_TOKEN / APP_ID / APP_SECRET for token refresh");
  }

  const res = await fetch(`${PINTEREST_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTok,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function createPin(
  pin: {
    title: string;
    description: string;
    link: string;
    imageUrl: string;
    boardId: string;
  },
  token: string
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${PINTEREST_API}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: pin.title.slice(0, 100),
        description: pin.description.slice(0, 500),
        link: pin.link,
        board_id: pin.boardId,
        media_source: {
          source_type: "image_url",
          url: pin.imageUrl,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    }

    if (res.status === 429) {
      console.warn(`  Rate limited (attempt ${attempt}/${MAX_RETRIES}), sleeping 60s...`);
      await sleep(60_000);
      continue;
    }

    const body = await res.text();
    throw new Error(`Pinterest API ${res.status}: ${body}`);
  }

  throw new Error("Max retries exceeded (429)");
}

// ── Card fetching ──

interface CardRow {
  id: string;
  slug: string;
  title_en: string | null;
  title_ru: string;
  seo_tags: Record<string, string[]>;
  prompt_card_media: { storage_path: string }[];
  prompt_variants: { prompt_text_en: string | null }[];
}

async function fetchCards(supabase: SupabaseClient, limit: number): Promise<CardRow[]> {
  const { data: publishedIds } = await supabase
    .from("card_distributions")
    .select("card_id")
    .eq("platform", "pinterest");

  const excludeIds = new Set((publishedIds || []).map((r: any) => r.card_id));

  const { data, error } = await supabase
    .from("prompt_cards")
    .select(`
      id, slug, title_en, title_ru, seo_tags,
      prompt_card_media!inner(storage_path),
      prompt_variants(prompt_text_en)
    `)
    .eq("is_published", true)
    .eq("prompt_card_media.is_primary", true)
    .order("source_date", { ascending: false })
    .limit(limit + excludeIds.size);

  if (error) throw new Error(`Failed to fetch cards: ${error.message}`);

  return (data || [])
    .filter((c: any) => !excludeIds.has(c.id))
    .slice(0, limit) as CardRow[];
}

// ── Description builder ──

function buildDescription(card: CardRow, link: string): string {
  const title = card.title_en || card.title_ru;
  const promptText = card.prompt_variants?.[0]?.prompt_text_en || "";
  const excerpt = promptText.slice(0, 150);

  let desc = `${title}. Ready-to-use AI photo prompt — copy and paste into ChatGPT or Gemini.`;
  if (excerpt) desc += `\n\n"${excerpt}${promptText.length > 150 ? "..." : ""}"`;
  desc += `\n\nGet this prompt and 6000+ more → ${link}`;

  return desc;
}

// ── Main ──

async function main() {
  loadEnvFiles();
  const { limit, dryRun } = parseArgs();

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let pinterestToken = process.env.PINTEREST_ACCESS_TOKEN;
  const siteDomain = process.env.SITE_DOMAIN || "promptshot.app";
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/prompt-images`;
  const fallbackBoardId = process.env.PINTEREST_FALLBACK_BOARD_ID || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!pinterestToken && !dryRun) {
    console.error("Missing PINTEREST_ACCESS_TOKEN (use --dry-run to preview)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const boardMap = await loadBoardMap(supabase);
  console.log(`Loaded ${boardMap.size} board mappings`);

  const cards = await fetchCards(supabase, limit);
  console.log(`Fetched ${cards.length} unpublished cards (limit=${limit})\n`);

  if (!cards.length) {
    console.log("Nothing to publish.");
    return;
  }

  const pauseMs = Math.max(1000, Math.floor((14 * 60 * 60 * 1000) / limit));
  let published = 0;
  let failed = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const boardId = pickBoard(card.seo_tags || {}, boardMap, fallbackBoardId);
    const title = (card.title_en || card.title_ru).slice(0, 100);
    const link = `https://${siteDomain}/p/${card.slug}/?utm_source=pinterest&utm_medium=pin`;
    const imageUrl = `${storageUrl}/${card.prompt_card_media[0]?.storage_path}`;
    const description = buildDescription(card, link);

    if (dryRun) {
      console.log(`[DRY ${i + 1}/${cards.length}] "${title}" → board=${boardId || "FALLBACK"}`);
      published++;
      continue;
    }

    if (!boardId) {
      console.warn(`  ⚠ No board for card ${card.slug}, skipping`);
      failed++;
      continue;
    }

    try {
      const pinId = await createPin(
        { title, description, link, imageUrl, boardId },
        pinterestToken!
      );

      await supabase.from("card_distributions").insert({
        card_id: card.id,
        platform: "pinterest",
        external_id: pinId,
        board_id: boardId,
        status: "published",
        published_at: new Date().toISOString(),
      });

      console.log(`✓ [${i + 1}/${cards.length}] "${title}" → pin=${pinId}`);
      published++;

      if (i < cards.length - 1) {
        await sleep(pauseMs);
      }
    } catch (err: any) {
      console.error(`✗ [${i + 1}/${cards.length}] "${title}": ${err.message}`);

      await supabase.from("card_distributions").insert({
        card_id: card.id,
        platform: "pinterest",
        status: "failed",
        board_id: boardId,
        error_message: err.message?.slice(0, 500),
      });

      failed++;
    }
  }

  console.log(`\nDone: ${published} published, ${failed} failed.`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
