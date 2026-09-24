import { takeHeroMarqueeCards } from "./hero-marquee";

export const S_SHAMPANSKIM_HUB_PATH = "/promty-dlya-foto/s-shampanskim";
export const S_SHAMPANSKIM_LEGACY_PATH = "/s-shampanskim";
export const S_SHAMPANSKIM_HUB_OBJECT_TAG = "s_shampanskim";
export const S_SHAMPANSKIM_HUB_LOAD_MORE_LABEL = "Больше промтов с шампанским";
export const S_SHAMPANSKIM_HUB_GENERATE_CTA = "Создать фото с шампанским";
export const S_SHAMPANSKIM_HUB_HERO_ARIA_LABEL = "Примеры фото с шампанским";
export const S_SHAMPANSKIM_HUB_HERO_CARD_LIMIT = 16;

export const S_SHAMPANSKIM_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "С шампанским",
  href: S_SHAMPANSKIM_HUB_PATH,
  dimension: "object_tag",
  value: S_SHAMPANSKIM_HUB_OBJECT_TAG,
} as const;

export type SShampanskimHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type SShampanskimHubFilterChip = {
  label: string;
  queryKey: SShampanskimHubFilterQueryKey;
  value: string;
};

export type SShampanskimHubFilterState = Partial<
  Record<SShampanskimHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace s_shampanskim. */
export const S_SHAMPANSKIM_HUB_FILTER_CHIPS: readonly SShampanskimHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function sShampanskimHubHeroFetchParams(routeParams: {
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
    object_tag: S_SHAMPANSKIM_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: S_SHAMPANSKIM_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toSShampanskimHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function sShampanskimHubFilterHref(chip?: SShampanskimHubFilterChip | null): string {
  if (!chip) return S_SHAMPANSKIM_HUB_PATH;
  return `${S_SHAMPANSKIM_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isSShampanskimHubFilterActive(
  chip: SShampanskimHubFilterChip,
  state: SShampanskimHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getSShampanskimHubFilterNavItems(state: SShampanskimHubFilterState = {}) {
  const hasActiveChip = S_SHAMPANSKIM_HUB_FILTER_CHIPS.some((chip) =>
    isSShampanskimHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: sShampanskimHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...S_SHAMPANSKIM_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: sShampanskimHubFilterHref(chip),
      active: isSShampanskimHubFilterActive(chip, state),
    })),
  ];
}

export function isSShampanskimHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === S_SHAMPANSKIM_HUB_PATH;
}

export function isSShampanskimClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === S_SHAMPANSKIM_HUB_PATH ||
    normalized.startsWith(`${S_SHAMPANSKIM_HUB_PATH}/`) ||
    normalized === S_SHAMPANSKIM_LEGACY_PATH ||
    normalized.startsWith(`${S_SHAMPANSKIM_LEGACY_PATH}/`)
  );
}

/** Legacy /s-shampanskim and any child slice 301 to the hub. */
export function sShampanskimChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === S_SHAMPANSKIM_HUB_PATH) return null;
  if (
    normalized === S_SHAMPANSKIM_LEGACY_PATH ||
    normalized.startsWith(`${S_SHAMPANSKIM_LEGACY_PATH}/`) ||
    normalized.startsWith(`${S_SHAMPANSKIM_HUB_PATH}/`)
  ) {
    return S_SHAMPANSKIM_HUB_PATH;
  }
  return null;
}
