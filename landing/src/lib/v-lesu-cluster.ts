import { takeHeroMarqueeCards } from "./hero-marquee";

export const V_LESU_HUB_PATH = "/promty-dlya-foto/v-lesu";
export const V_LESU_LEGACY_PATH = "/v-lesu";
export const V_LESU_HUB_OBJECT_TAG = "v_lesu";
export const V_LESU_HUB_LOAD_MORE_LABEL = "Больше промтов в лесу";
export const V_LESU_HUB_GENERATE_CTA = "Создать фото в лесу";
export const V_LESU_HUB_HERO_ARIA_LABEL = "Примеры фото в лесу";
export const V_LESU_HUB_HERO_CARD_LIMIT = 16;

export const V_LESU_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "В лесу",
  href: V_LESU_HUB_PATH,
  dimension: "object_tag",
  value: V_LESU_HUB_OBJECT_TAG,
} as const;

export type VLesuHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type VLesuHubFilterChip = {
  label: string;
  queryKey: VLesuHubFilterQueryKey;
  value: string;
};

export type VLesuHubFilterState = Partial<
  Record<VLesuHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace v_lesu. */
export const V_LESU_HUB_FILTER_CHIPS: readonly VLesuHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function vLesuHubHeroFetchParams(routeParams: {
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
    object_tag: V_LESU_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: V_LESU_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toVLesuHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function vLesuHubFilterHref(chip?: VLesuHubFilterChip | null): string {
  if (!chip) return V_LESU_HUB_PATH;
  return `${V_LESU_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isVLesuHubFilterActive(
  chip: VLesuHubFilterChip,
  state: VLesuHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getVLesuHubFilterNavItems(state: VLesuHubFilterState = {}) {
  const hasActiveChip = V_LESU_HUB_FILTER_CHIPS.some((chip) =>
    isVLesuHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: vLesuHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...V_LESU_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: vLesuHubFilterHref(chip),
      active: isVLesuHubFilterActive(chip, state),
    })),
  ];
}

export function isVLesuHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === V_LESU_HUB_PATH;
}

export function isVLesuClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === V_LESU_HUB_PATH ||
    normalized.startsWith(`${V_LESU_HUB_PATH}/`) ||
    normalized === V_LESU_LEGACY_PATH ||
    normalized.startsWith(`${V_LESU_LEGACY_PATH}/`)
  );
}

/** Legacy /v-lesu and any child slice 301 to the hub. */
export function vLesuChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === V_LESU_HUB_PATH) return null;
  if (
    normalized === V_LESU_LEGACY_PATH ||
    normalized.startsWith(`${V_LESU_LEGACY_PATH}/`) ||
    normalized.startsWith(`${V_LESU_HUB_PATH}/`)
  ) {
    return V_LESU_HUB_PATH;
  }
  return null;
}
