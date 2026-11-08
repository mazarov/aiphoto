import {
  GENERACIYA_FOTO_PO_OPISANIYU_PATH,
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
  GENERACIYA_PO_FOTO_PATH,
  generaciyaSeoImagePaths,
  getGeneraciyaFotoScenarioPath,
} from "@/lib/generaciya-foto-routes";
import { generaciyaScenarioFetchParams } from "@/lib/generaciya-seo-fetch";
import {
  listingCatalogHubPaths,
  resolveListingCatalogHub,
} from "@/lib/listing-catalog-hub";
import { NANO_BANANA_PATH, NANO_BANANA_PRO_PATH } from "@/lib/nano-banana-seo-copy";
import { resolveUrlToTags } from "@/lib/route-resolver";

export type HeroSeedRpcParams = {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
  limit: number;
  offset: number;
  min_cards: number;
  sort: "popular";
};

export type HeroSeedPlan =
  | { path: string; kind: "rpc"; params: HeroSeedRpcParams }
  | { path: string; kind: "kartinka" };

const GLOBAL_POPULAR: HeroSeedRpcParams = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
  limit: 50,
  offset: 0,
  min_cards: 1,
  sort: "popular",
};

function rpcPlan(path: string, params: HeroSeedRpcParams): HeroSeedPlan {
  return { path, kind: "rpc", params };
}

/**
 * One popularity snapshot per hero path. Filters match the old hero query;
 * sort is always popular. Live pages do not call this.
 */
export function listHeroSeedPlans(): HeroSeedPlan[] {
  const plans: HeroSeedPlan[] = [
    rpcPlan("/", GLOBAL_POPULAR),
    rpcPlan(NANO_BANANA_PATH, GLOBAL_POPULAR),
    rpcPlan(NANO_BANANA_PRO_PATH, GLOBAL_POPULAR),
  ];

  for (const path of listingCatalogHubPaths()) {
    const hub = resolveListingCatalogHub(path);
    if (!hub) throw new Error(`page hero seed: hub missing for ${path}`);
    const route = resolveUrlToTags(path.split("/").filter(Boolean));
    if (!route) throw new Error(`page hero seed: route missing for ${path}`);
    const params = hub.heroFetchParams(route.rpcParams);
    plans.push(rpcPlan(path, { ...params, sort: "popular" }));
  }

  for (const path of generaciyaSeoImagePaths()) {
    if (path === GENERACIYA_KARTINKA_PO_OPISANIYU_PATH) {
      plans.push({ path, kind: "kartinka" });
      continue;
    }
    if (
      path === GENERACIYA_FOTO_PO_OPISANIYU_PATH ||
      path === GENERACIYA_PO_FOTO_PATH
    ) {
      plans.push(rpcPlan(path, GLOBAL_POPULAR));
      continue;
    }
    const slug = path.slice(`${GENERACIYA_PO_FOTO_PATH}/`.length);
    const scenario = GENERACIYA_FOTO_SCENARIO_ROUTES.find((route) => route.slug === slug);
    if (!scenario || getGeneraciyaFotoScenarioPath(scenario.slug) !== path) {
      throw new Error(`page hero seed: scenario missing for ${path}`);
    }
    const params = generaciyaScenarioFetchParams(
      { dimension: scenario.dimension, tagValue: scenario.tagValue },
      true,
    );
    plans.push(rpcPlan(path, { ...params, sort: "popular" }));
  }

  return plans;
}
