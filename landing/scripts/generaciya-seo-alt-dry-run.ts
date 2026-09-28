/**
 * Dry-run list of first-screen media on the 25 /generaciya URLs that still
 * have an empty seo_alt_ru. Never writes those columns and never calls Vision.
 *
 * From landing/:
 *   npx tsx scripts/generaciya-seo-alt-dry-run.ts
 *
 * Exit 0 when Supabase env is missing. `--apply` is rejected.
 * Do not set generaciya_seo_descriptive_alt_enabled until 50 frames are reviewed.
 * Non-RF Vision, if added later, must go through GEMINI_PROXY_BASE_URL.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";

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

function supabaseEnv(): { url: string; key: string } | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return { url, key };
}

async function main() {
  loadEnvFiles();
  if (process.argv.includes("--apply")) {
    console.error(
      "generaciya-seo-alt-dry-run does not write seo_alt columns and does not call Vision.",
    );
    process.exitCode = 2;
    return;
  }
  if (!supabaseEnv()) {
    console.log(
      JSON.stringify({
        event: "generaciya_seo_alt_dry_run",
        status: "skipped",
        reason: "missing_env",
      }),
    );
    return;
  }

  const routes = await import("../src/lib/generaciya-foto-routes");
  const { readGeneraciyaSeoImageFlags } = await import(
    "../src/lib/generaciya-seo-image-config"
  );
  const hub = await import("../src/lib/generaciya-hub-data");
  const { fetchRouteCards } = await import("../src/lib/supabase");
  const { generaciyaScenarioFetchParams } = await import(
    "../src/lib/generaciya-seo-fetch"
  );

  const flags = await readGeneraciyaSeoImageFlags();
  const missing: { page: string; cardId: string; mediaPath: string }[] = [];

  async function collect(
    page: string,
    result: Awaited<ReturnType<typeof hub.getGeneraciyaNewestExamples>>,
  ) {
    const prepared = await hub.prepareGeneraciyaSeoCards({
      result,
      label: page,
      flags,
      headings: [],
      fallbackTitle: (index) => `example ${index + 1}`,
    });
    for (const card of prepared.cards.slice(0, 16)) {
      for (const media of card.photoMeta) {
        if (media.seoAltRu?.trim()) continue;
        missing.push({ page, cardId: card.id, mediaPath: media.path });
      }
    }
  }

  const newest = await hub.getGeneraciyaNewestExamples(flags.firstScreenRank);
  await collect(routes.GENERACIYA_FOTO_PO_OPISANIYU_PATH, newest);
  await collect(routes.GENERACIYA_PO_FOTO_PATH, newest);
  await collect(
    routes.GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
    await hub.getGeneraciyaKartinkaExamples(flags.firstScreenRank),
  );

  for (const route of routes.GENERACIYA_FOTO_SCENARIO_ROUTES) {
    const page = routes.getGeneraciyaFotoScenarioPath(route.slug);
    try {
      const result = await fetchRouteCards(
        generaciyaScenarioFetchParams(route, flags.firstScreenRank),
      );
      await collect(page, result);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "generaciya_seo_alt_dry_run",
          status: "page_failed",
          page,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      event: "generaciya_seo_alt_dry_run",
      status: "ok",
      writes: false,
      vision: false,
      flags,
      missing: missing.length,
      sample: missing.slice(0, 50),
      note: "Do not enable generaciya_seo_descriptive_alt_enabled until 50 frames are reviewed.",
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
