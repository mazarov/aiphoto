import type { TagEntry } from "./tag-registry";
import { type SeoContent, getSeoContent } from "./seo-content";
import type { ResolvedRoute } from "./route-resolver";
import { seoComboKey } from "./den-rozhdeniya-cluster";
import { buildPromptListingSeoContent } from "./prompt-listing-seo";

/**
 * Get SEO content for a resolved route.
 * Priority: combo key / L1 slug in seo-content.ts → catalog prompt template.
 * Photoshoot intent belongs exclusively to /ii-fotosessiya/*.
 */
export function getSeoForRoute(route: ResolvedRoute): SeoContent {
  const comboManual =
    route.level >= 2 ? getSeoContent(seoComboKey(route.tags)) : null;
  if (comboManual) return comboManual;

  if (route.level === 1) {
    const manual = getSeoContent(route.primaryTag.slug);
    if (manual) return manual;
    return buildPromptListingSeoContent(route.tags);
  }

  return buildPromptListingSeoContent(route.tags);
}
