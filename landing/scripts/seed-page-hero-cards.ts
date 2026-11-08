/**
 * One-time hero seed: top cards by popularity for each curated page.
 * Skips a path that already has rows, so a second run does not replace edits.
 *
 * From landing/:
 *   npx tsx scripts/seed-page-hero-cards.ts --dry-run
 *   npx tsx scripts/seed-page-hero-cards.ts
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import type { HeroSeedPlan } from "../src/lib/page-hero-seed";
import type { RouteCard } from "../src/lib/supabase";

function loadEnvFiles() {
  const landingRoot = process.cwd();
  const repoRoot = path.resolve(landingRoot, "..");
  for (const file of [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(landingRoot, ".env.local"),
    path.join(landingRoot, ".env"),
  ]) {
    if (existsSync(file)) loadDotenv({ path: file, override: false });
  }
}

function parseArgs() {
  return { dryRun: process.argv.includes("--dry-run") };
}

type Db = typeof import("../src/lib/supabase");
type SeoFetch = typeof import("../src/lib/generaciya-seo-fetch");

type SeedDeps = {
  enrichCardsWithDetails: Db["enrichCardsWithDetails"];
  fetchRouteCards: Db["fetchRouteCards"];
  takeSeedCardIds: typeof import("../src/lib/page-hero")["takeSeedCardIds"];
  generaciyaKartinkaPerTag: SeoFetch["generaciyaKartinkaPerTag"];
  interleaveGeneraciyaColumns: SeoFetch["interleaveGeneraciyaColumns"];
  baseRpcParams: Record<string, string | null>;
  kartinkaStyleTags: readonly string[];
};

async function idsWithPhotos(deps: SeedDeps, cards: readonly RouteCard[]): Promise<string[]> {
  const enriched = await deps.enrichCardsWithDetails([...cards]);
  const photos = new Map(enriched.map((card) => [card.id, card.photoUrls[0] ?? null]));
  return deps.takeSeedCardIds(
    cards.map((card) => ({ id: card.id, photoUrl: photos.get(card.id) ?? null })),
  );
}

async function kartinkaIds(deps: SeedDeps): Promise<string[]> {
  const perTag = deps.generaciyaKartinkaPerTag(true);
  const columns = await Promise.all(
    deps.kartinkaStyleTags.map(async (styleTag) => {
      const result = await deps.fetchRouteCards({
        ...deps.baseRpcParams,
        style_tag: styleTag,
        limit: perTag,
        offset: 0,
        min_cards: 1,
        sort: "popular",
      });
      return result.cards;
    }),
  );
  return idsWithPhotos(deps, deps.interleaveGeneraciyaColumns(columns, perTag));
}

async function idsForPlan(deps: SeedDeps, plan: HeroSeedPlan): Promise<string[]> {
  if (plan.kind === "kartinka") return kartinkaIds(deps);
  const result = await deps.fetchRouteCards(plan.params);
  return idsWithPhotos(deps, result.cards);
}

async function main() {
  loadEnvFiles();
  const [{ GENERACIYA_BASE_RPC_PARAMS, KARTINKA_EXAMPLE_STYLE_TAGS }, seoFetch, pageHero, seedPlans, db] =
    await Promise.all([
      import("../src/lib/generaciya-hub-data"),
      import("../src/lib/generaciya-seo-fetch"),
      import("../src/lib/page-hero"),
      import("../src/lib/page-hero-seed"),
      import("../src/lib/supabase"),
    ]);
  const deps: SeedDeps = {
    enrichCardsWithDetails: db.enrichCardsWithDetails,
    fetchRouteCards: db.fetchRouteCards,
    takeSeedCardIds: pageHero.takeSeedCardIds,
    generaciyaKartinkaPerTag: seoFetch.generaciyaKartinkaPerTag,
    interleaveGeneraciyaColumns: seoFetch.interleaveGeneraciyaColumns,
    baseRpcParams: GENERACIYA_BASE_RPC_PARAMS,
    kartinkaStyleTags: KARTINKA_EXAMPLE_STYLE_TAGS,
  };
  const { dryRun } = parseArgs();
  const supabase = db.createSupabaseServer();
  const plans = seedPlans.listHeroSeedPlans();
  let inserted = 0;
  let skipped = 0;
  let empty = 0;

  for (const plan of plans) {
    const { count, error } = await supabase
      .from("page_hero_cards")
      .select("card_id", { count: "exact", head: true })
      .eq("page_path", plan.path);
    if (error) throw new Error(`${plan.path}: ${error.message}`);
    if (pageHero.seedShouldSkip(count ?? 0)) {
      skipped += 1;
      console.log(`[seed-page-hero] skip ${plan.path} (${count} rows)`);
      continue;
    }

    const ids = await idsForPlan(deps, plan);
    if (ids.length === 0) {
      empty += 1;
      console.log(`[seed-page-hero] empty ${plan.path}`);
      continue;
    }
    console.log(`[seed-page-hero] ${dryRun ? "dry-run" : "insert"} ${plan.path} ${ids.length}`);
    if (!dryRun) {
      const { error: insertError } = await supabase.from("page_hero_cards").insert(
        ids.map((cardId) => ({ page_path: plan.path, card_id: cardId })),
      );
      if (insertError) throw new Error(`${plan.path}: ${insertError.message}`);
    }
    inserted += 1;
  }

  console.log(
    `[seed-page-hero] done ${dryRun ? "dry-run" : "inserted"}=${inserted} skipped=${skipped} empty=${empty}`,
  );
}

main().catch((error: unknown) => {
  console.error("[seed-page-hero] failed", error instanceof Error ? error.stack : error);
  process.exit(1);
});
