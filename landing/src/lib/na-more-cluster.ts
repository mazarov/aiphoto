import { takeHeroMarqueeCards } from "./hero-marquee";

export const NA_MORE_HUB_PATH = "/promty-dlya-foto/na-more";
export const NA_MORE_LEGACY_PATH = "/na-more";
export const NA_MORE_HUB_OBJECT_TAG = "na_more";
export const NA_MORE_HUB_LOAD_MORE_LABEL = "Больше промтов на море";
export const NA_MORE_HUB_GENERATE_CTA = "Создать фото на море";
export const NA_MORE_HUB_HERO_ARIA_LABEL = "Примеры фото на море";
export const NA_MORE_HUB_HERO_CARD_LIMIT = 16;

export const NA_MORE_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "На море",
  href: NA_MORE_HUB_PATH,
  dimension: "object_tag",
  value: NA_MORE_HUB_OBJECT_TAG,
} as const;

export type NaMoreHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type NaMoreHubFilterChip = {
  label: string;
  queryKey: NaMoreHubFilterQueryKey;
  value: string;
};

export type NaMoreHubFilterState = Partial<
  Record<NaMoreHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace na_more. */
export const NA_MORE_HUB_FILTER_CHIPS: readonly NaMoreHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function naMoreHubHeroFetchParams(routeParams: {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
}) {
  void routeParams;
  return {
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: NA_MORE_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: NA_MORE_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toNaMoreHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function naMoreHubFilterHref(chip?: NaMoreHubFilterChip | null): string {
  if (!chip) return NA_MORE_HUB_PATH;
  return `${NA_MORE_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isNaMoreHubFilterActive(
  chip: NaMoreHubFilterChip,
  state: NaMoreHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getNaMoreHubFilterNavItems(state: NaMoreHubFilterState = {}) {
  const hasActiveChip = NA_MORE_HUB_FILTER_CHIPS.some((chip) =>
    isNaMoreHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: naMoreHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...NA_MORE_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: naMoreHubFilterHref(chip),
      active: isNaMoreHubFilterActive(chip, state),
    })),
  ];
}

export function isNaMoreHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === NA_MORE_HUB_PATH;
}

export function isNaMoreClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === NA_MORE_HUB_PATH ||
    normalized.startsWith(`${NA_MORE_HUB_PATH}/`) ||
    normalized === NA_MORE_LEGACY_PATH ||
    normalized.startsWith(`${NA_MORE_LEGACY_PATH}/`)
  );
}

/** Legacy /na-more and any child slice 301 to the hub. */
export function naMoreChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === NA_MORE_HUB_PATH) return null;
  if (
    normalized === NA_MORE_LEGACY_PATH ||
    normalized.startsWith(`${NA_MORE_LEGACY_PATH}/`) ||
    normalized.startsWith(`${NA_MORE_HUB_PATH}/`)
  ) {
    return NA_MORE_HUB_PATH;
  }
  return null;
}
