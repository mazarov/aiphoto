import { takeHeroMarqueeCards } from "./hero-marquee";

export const V_ZERKALE_HUB_PATH = "/promty-dlya-foto/v-zerkale";
export const V_ZERKALE_LEGACY_PATH = "/v-zerkale";
export const V_ZERKALE_HUB_OBJECT_TAG = "v_zerkale";
export const V_ZERKALE_HUB_LOAD_MORE_LABEL = "Больше промтов в зеркале";
export const V_ZERKALE_HUB_GENERATE_CTA = "Создать фото в зеркале";
export const V_ZERKALE_HUB_HERO_ARIA_LABEL = "Примеры фото в зеркале";
export const V_ZERKALE_HUB_HERO_CARD_LIMIT = 16;

export const V_ZERKALE_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "В зеркале",
  href: V_ZERKALE_HUB_PATH,
  dimension: "object_tag",
  value: V_ZERKALE_HUB_OBJECT_TAG,
} as const;

export type VZerkaleHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type VZerkaleHubFilterChip = {
  label: string;
  queryKey: VZerkaleHubFilterQueryKey;
  value: string;
};

export type VZerkaleHubFilterState = Partial<
  Record<VZerkaleHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace v_zerkale. */
export const V_ZERKALE_HUB_FILTER_CHIPS: readonly VZerkaleHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Пара", queryKey: "audience", value: "para" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function vZerkaleHubHeroFetchParams(routeParams: {
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
    object_tag: V_ZERKALE_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: V_ZERKALE_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toVZerkaleHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function vZerkaleHubFilterHref(chip?: VZerkaleHubFilterChip | null): string {
  if (!chip) return V_ZERKALE_HUB_PATH;
  return `${V_ZERKALE_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isVZerkaleHubFilterActive(
  chip: VZerkaleHubFilterChip,
  state: VZerkaleHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getVZerkaleHubFilterNavItems(state: VZerkaleHubFilterState = {}) {
  const hasActiveChip = V_ZERKALE_HUB_FILTER_CHIPS.some((chip) =>
    isVZerkaleHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: vZerkaleHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...V_ZERKALE_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: vZerkaleHubFilterHref(chip),
      active: isVZerkaleHubFilterActive(chip, state),
    })),
  ];
}

export function isVZerkaleHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === V_ZERKALE_HUB_PATH;
}

export function isVZerkaleClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === V_ZERKALE_HUB_PATH ||
    normalized.startsWith(`${V_ZERKALE_HUB_PATH}/`) ||
    normalized === V_ZERKALE_LEGACY_PATH ||
    normalized.startsWith(`${V_ZERKALE_LEGACY_PATH}/`)
  );
}

/** Legacy /v-zerkale and any child slice 301 to the hub. */
export function vZerkaleChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === V_ZERKALE_HUB_PATH) return null;
  if (
    normalized === V_ZERKALE_LEGACY_PATH ||
    normalized.startsWith(`${V_ZERKALE_LEGACY_PATH}/`) ||
    normalized.startsWith(`${V_ZERKALE_HUB_PATH}/`)
  ) {
    return V_ZERKALE_HUB_PATH;
  }
  return null;
}
