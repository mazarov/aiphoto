import type { GenerateComposeMode } from "./generate-compose-mode";
import {
  hasMoreRankedPages,
  hasMoreSearchPages,
} from "./listing-pagination";
import { composeExamplePickerListingAudience } from "./compose-example-audience";

/**
 * Catalog example picker is an image-compose tool, not a URL / funnel gate.
 * `generationSurface` stays a Metrika/API label only.
 */
export function composeShowsExampleTool(input: {
  composeMode: GenerateComposeMode;
  showResultChrome?: boolean;
}): boolean {
  if (input.showResultChrome) return false;
  return input.composeMode === "image";
}

/** Photo in, catalog example not picked, prompt still too short to generate. */
export function composeNeedsExamplePick(input: {
  composeMode: GenerateComposeMode;
  selectedPhotoCount: number;
  cardId: string | null | undefined;
  promptLength: number;
}): boolean {
  if (!composeShowsExampleTool({ composeMode: input.composeMode })) return false;
  if (input.selectedPhotoCount < 1) return false;
  if (input.cardId) return false;
  return input.promptLength < 8;
}

/** After a selfie/upload: open the example sheet unless a card already seeded compose. */
export function composeShouldAutoOpenExampleSheet(input: {
  composeMode: GenerateComposeMode;
  cardId: string | null | undefined;
}): boolean {
  if (!composeShowsExampleTool({ composeMode: input.composeMode })) return false;
  return !input.cardId;
}

export const SEO_COMPOSE_EXAMPLE_TOOL_LABEL = "Выбрать пример";
export const SEO_COMPOSE_EXAMPLE_SHEET_TITLE = "Выбрать пример";
export const SEO_COMPOSE_EXAMPLE_CONFIRM_CTA = "Выбрать";
/** Footer gate when selfie is in and catalog example is not. Opens the example sheet. */
export const SEO_COMPOSE_PICK_EXAMPLE_CTA = SEO_COMPOSE_EXAMPLE_TOOL_LABEL;
export const SEO_COMPOSE_EXAMPLE_STEP_TITLE = SEO_COMPOSE_EXAMPLE_SHEET_TITLE;

export const SEO_COMPOSE_EXAMPLE_SEARCH_PLACEHOLDER = "Найти образ";
export const SEO_COMPOSE_EXAMPLE_SEARCH_ID = "compose-example-search";

/** Picker chip «СВО»: listing `object_tag=v_forme` (военная форма / солдат). */
export const COMPOSE_EXAMPLE_SVO_FILTER = {
  label: "СВО",
  href: "/v-forme",
  dimension: "object_tag",
  value: "v_forme",
} as const;

/** Picker chip «Осень»: listing `object_tag=osen`. */
export const COMPOSE_EXAMPLE_AUTUMN_FILTER = {
  label: "Осень",
  href: "/osen",
  dimension: "object_tag",
  value: "osen",
} as const;

export const COMPOSE_EXAMPLE_PINNED_FILTERS = [
  COMPOSE_EXAMPLE_SVO_FILTER,
  COMPOSE_EXAMPLE_AUTUMN_FILTER,
] as const;

export function composeExampleQuickFilters<
  T extends { label: string; dimension: string; value: string },
>(
  hubScenarios: readonly T[],
  limit = 7,
): Array<(typeof COMPOSE_EXAMPLE_PINNED_FILTERS)[number] | T> {
  const pinnedValues = new Set<string>(
    COMPOSE_EXAMPLE_PINNED_FILTERS.map((item) => item.value),
  );
  const rest = hubScenarios.filter((item) => !pinnedValues.has(item.value));
  return [
    ...COMPOSE_EXAMPLE_PINNED_FILTERS,
    ...rest.slice(0, Math.max(0, limit - COMPOSE_EXAMPLE_PINNED_FILTERS.length)),
  ];
}

/** First picker screen: 3×4 / 4×3. More loads via sentinel. */
export const SEO_COMPOSE_EXAMPLE_LIMIT = 12;
/** Photoshoot / video are sparse in mixed newest — fetch a fuller page, then filter. */
export const SEO_COMPOSE_EXAMPLE_KIND_LIMIT = 60;

export type ComposeExampleKind = "photo" | "photoshoot" | "video";

export type ComposeExampleCardLike = {
  isPhotoshoot: boolean;
  hasPrompt: boolean;
  videoUrl: string | null;
};

export function composeExamplePickerLimit(kind: ComposeExampleKind): number {
  return kind === "photo" ? SEO_COMPOSE_EXAMPLE_LIMIT : SEO_COMPOSE_EXAMPLE_KIND_LIMIT;
}

/** Default catalog stills; photoshoot / video chips are client filters on the same listing. */
export function filterComposeExampleCards<T extends ComposeExampleCardLike>(
  cards: readonly T[],
  kind: ComposeExampleKind,
): T[] {
  return cards.filter((card) => {
    if (!card.hasPrompt) return false;
    if (kind === "photoshoot") return card.isPhotoshoot;
    if (kind === "video") return Boolean(card.videoUrl);
    return !card.isPhotoshoot;
  });
}

export function composeExamplePickerHasMore(input: {
  isSearch: boolean;
  offset: number;
  rankedBatchSize: number;
  receivedCount: number;
  requestedLimit: number;
  totalCount: number;
  searchHasMore?: boolean;
}): boolean {
  if (input.isSearch) {
    if (typeof input.searchHasMore === "boolean") return input.searchHasMore;
    return hasMoreSearchPages(input.receivedCount, input.requestedLimit);
  }
  return hasMoreRankedPages(
    input.offset,
    input.rankedBatchSize > 0 ? input.rankedBatchSize : input.receivedCount,
    input.totalCount,
  );
}

/** Public listing API only — same CDN cache as `/generaciya-foto` examples. */
export function composeExamplePickerEndpoint(input: {
  query: string;
  filter: { dimension: string; value: string } | null;
  audienceMatch?: string | null;
  kind?: ComposeExampleKind;
  offset?: number;
}): string | null {
  const trimmed = input.query.trim();
  const audienceMatch = composeExamplePickerListingAudience({
    query: trimmed,
    dismissed: false,
    audienceMatch: input.audienceMatch,
  });
  if (trimmed.length > 0 && trimmed.length < 2 && !input.filter) {
    return null;
  }
  const kind = input.kind ?? "photo";
  const limit = String(composeExamplePickerLimit(kind));
  const offset = Math.max(0, input.offset ?? 0);
  if (trimmed.length >= 2) {
    const params = new URLSearchParams({ q: trimmed, limit });
    if (offset > 0) params.set("offset", String(offset));
    return `/api/listing?${params}`;
  }
  const params = new URLSearchParams({ limit, sort: "new" });
  if (offset > 0) params.set("offset", String(offset));
  if (audienceMatch) {
    params.set("audience_tag", audienceMatch);
  }
  if (input.filter) {
    params.set(input.filter.dimension, input.filter.value);
  }
  if (audienceMatch || input.filter) {
    params.set("strict", "1");
  }
  return `/api/listing?${params}`;
}

export { composeExamplePickerListingAudience };
