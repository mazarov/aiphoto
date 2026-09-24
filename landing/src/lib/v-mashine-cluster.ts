import { takeHeroMarqueeCards } from "./hero-marquee";

export const V_MASHINE_HUB_PATH = "/promty-dlya-foto/v-mashine";
export const V_MASHINE_LEGACY_PATH = "/v-mashine";
export const V_MASHINE_HUB_OBJECT_TAG = "v_mashine";
export const V_MASHINE_HUB_LOAD_MORE_LABEL = "Больше промтов в машине";
export const V_MASHINE_HUB_GENERATE_CTA = "Создать фото в машине";
export const V_MASHINE_HUB_HERO_ARIA_LABEL = "Примеры фото в машине";
export const V_MASHINE_HUB_HERO_CARD_LIMIT = 16;

export const V_MASHINE_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "В машине",
  href: V_MASHINE_HUB_PATH,
  dimension: "object_tag",
  value: V_MASHINE_HUB_OBJECT_TAG,
} as const;

export type VMashineHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type VMashineHubFilterChip = {
  label: string;
  queryKey: VMashineHubFilterQueryKey;
  value: string;
};

export type VMashineHubFilterState = Partial<
  Record<VMashineHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace v_mashine. */
export const V_MASHINE_HUB_FILTER_CHIPS: readonly VMashineHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function vMashineHubHeroFetchParams(routeParams: {
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
    object_tag: V_MASHINE_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: V_MASHINE_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toVMashineHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function vMashineHubFilterHref(chip?: VMashineHubFilterChip | null): string {
  if (!chip) return V_MASHINE_HUB_PATH;
  return `${V_MASHINE_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isVMashineHubFilterActive(
  chip: VMashineHubFilterChip,
  state: VMashineHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getVMashineHubFilterNavItems(state: VMashineHubFilterState = {}) {
  const hasActiveChip = V_MASHINE_HUB_FILTER_CHIPS.some((chip) =>
    isVMashineHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: vMashineHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...V_MASHINE_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: vMashineHubFilterHref(chip),
      active: isVMashineHubFilterActive(chip, state),
    })),
  ];
}

export function isVMashineHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === V_MASHINE_HUB_PATH;
}

export function isVMashineClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === V_MASHINE_HUB_PATH ||
    normalized.startsWith(`${V_MASHINE_HUB_PATH}/`) ||
    normalized === V_MASHINE_LEGACY_PATH ||
    normalized.startsWith(`${V_MASHINE_LEGACY_PATH}/`)
  );
}

/** Legacy /v-mashine and any child slice 301 to the hub. */
export function vMashineChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === V_MASHINE_HUB_PATH) return null;
  if (
    normalized === V_MASHINE_LEGACY_PATH ||
    normalized.startsWith(`${V_MASHINE_LEGACY_PATH}/`) ||
    normalized.startsWith(`${V_MASHINE_HUB_PATH}/`)
  ) {
    return V_MASHINE_HUB_PATH;
  }
  return null;
}
