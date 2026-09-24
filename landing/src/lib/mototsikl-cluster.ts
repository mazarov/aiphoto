import { takeHeroMarqueeCards } from "./hero-marquee";

export const MOTOTSIKL_HUB_PATH = "/promty-dlya-foto/mototsikl";
export const MOTOTSIKL_LEGACY_PATH = "/mototsikl";
export const MOTOTSIKL_HUB_OBJECT_TAG = "mototsikl";
export const MOTOTSIKL_HUB_LOAD_MORE_LABEL = "Больше промтов на мотоцикле";
export const MOTOTSIKL_HUB_GENERATE_CTA = "Создать фото на мотоцикле";
export const MOTOTSIKL_HUB_HERO_ARIA_LABEL = "Примеры фото на мотоцикле";
export const MOTOTSIKL_HUB_HERO_CARD_LIMIT = 16;

export const MOTOTSIKL_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "Мотоцикл",
  href: MOTOTSIKL_HUB_PATH,
  dimension: "object_tag",
  value: MOTOTSIKL_HUB_OBJECT_TAG,
} as const;

export type MototsiklHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type MototsiklHubFilterChip = {
  label: string;
  queryKey: MototsiklHubFilterQueryKey;
  value: string;
};

export type MototsiklHubFilterState = Partial<
  Record<MototsiklHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace mototsikl. */
export const MOTOTSIKL_HUB_FILTER_CHIPS: readonly MototsiklHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function mototsiklHubHeroFetchParams(routeParams: {
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
    object_tag: MOTOTSIKL_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: MOTOTSIKL_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toMototsiklHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function mototsiklHubFilterHref(chip?: MototsiklHubFilterChip | null): string {
  if (!chip) return MOTOTSIKL_HUB_PATH;
  return `${MOTOTSIKL_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isMototsiklHubFilterActive(
  chip: MototsiklHubFilterChip,
  state: MototsiklHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getMototsiklHubFilterNavItems(state: MototsiklHubFilterState = {}) {
  const hasActiveChip = MOTOTSIKL_HUB_FILTER_CHIPS.some((chip) =>
    isMototsiklHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: mototsiklHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...MOTOTSIKL_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: mototsiklHubFilterHref(chip),
      active: isMototsiklHubFilterActive(chip, state),
    })),
  ];
}

export function isMototsiklHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === MOTOTSIKL_HUB_PATH;
}

export function isMototsiklClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === MOTOTSIKL_HUB_PATH ||
    normalized.startsWith(`${MOTOTSIKL_HUB_PATH}/`) ||
    normalized === MOTOTSIKL_LEGACY_PATH ||
    normalized.startsWith(`${MOTOTSIKL_LEGACY_PATH}/`)
  );
}

/** Legacy /mototsikl and any child slice 301 to the hub. */
export function mototsiklChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === MOTOTSIKL_HUB_PATH) return null;
  if (
    normalized === MOTOTSIKL_LEGACY_PATH ||
    normalized.startsWith(`${MOTOTSIKL_LEGACY_PATH}/`) ||
    normalized.startsWith(`${MOTOTSIKL_HUB_PATH}/`)
  ) {
    return MOTOTSIKL_HUB_PATH;
  }
  return null;
}
