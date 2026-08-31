import type { TagEntry } from "./tag-registry";
import { type SeoContent, getSeoContent } from "./seo-content";
import type { ResolvedRoute } from "./route-resolver";
import { seoComboKey } from "./den-rozhdeniya-cluster";
import {
  buildPromptListingSeoContent,
  enrichPromptListingHead,
} from "./prompt-listing-fotosessii-seo";

/**
 * Get SEO content for a resolved route.
 * Priority: combo key / L1 slug in seo-content.ts → fotosessii prompt template (L2/L3 / L1 fallback).
 */
export function getSeoForRoute(route: ResolvedRoute): SeoContent {
  const comboManual =
    route.level >= 2 ? getSeoContent(seoComboKey(route.tags)) : null;
  if (comboManual) return comboManual;

  if (route.level === 1) {
    const manual = getSeoContent(route.primaryTag.slug);
    if (manual) return enrichPromptListingHead(manual, route.tags);
    return buildPromptListingSeoContent(route.tags);
  }

  return buildPromptListingSeoContent(route.tags);
}
