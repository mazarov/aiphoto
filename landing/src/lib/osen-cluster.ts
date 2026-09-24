import { takeHeroMarqueeCards } from "./hero-marquee";
import { COMPOSE_EXAMPLE_AUTUMN_FILTER } from "./generaciya-foto-compose-example";

export const OSEN_HUB_PATH = "/osen";
export const OSEN_HUB_OBJECT_TAG = "osen";
export const OSEN_HUB_LOAD_MORE_LABEL = "Больше осенних промтов";
export const OSEN_HUB_GENERATE_CTA = "Создать осеннее фото";
export const OSEN_HUB_HERO_ARIA_LABEL = "Примеры осенних фото";
export const OSEN_HUB_HERO_CARD_LIMIT = 16;

/** Same picker chip as compose «Осень»: listing `object_tag=osen`. */
export const OSEN_HUB_COMPOSE_EXAMPLE_FILTER = COMPOSE_EXAMPLE_AUTUMN_FILTER;

export type OsenHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type OsenHubFilterChip = {
  label: string;
  queryKey: OsenHubFilterQueryKey;
  value: string;
};

export type OsenHubFilterState = Partial<
  Record<OsenHubFilterQueryKey, string | null | undefined>
>;

/**
 * Stay on /osen. Audience and style AND with object_tag=osen.
 * Another object chip would replace autumn in mergeFilterParams, so
 * машина / дождь / лес / аватарка are not chips.
 */
export const OSEN_HUB_FILTER_CHIPS: readonly OsenHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Пара", queryKey: "audience", value: "para" },
  { label: "Подруги", queryKey: "audience", value: "s_podrugoy" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Hub feed stays autumn. In-page ?audience= / ?style= do not leak into the hero. */
export function osenHubHeroFetchParams(routeParams: {
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
    object_tag: OSEN_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: OSEN_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toOsenHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function osenHubFilterHref(chip?: OsenHubFilterChip | null): string {
  if (!chip) return OSEN_HUB_PATH;
  return `${OSEN_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isOsenHubFilterActive(
  chip: OsenHubFilterChip,
  state: OsenHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getOsenHubFilterNavItems(state: OsenHubFilterState = {}) {
  const hasActiveChip = OSEN_HUB_FILTER_CHIPS.some((chip) =>
    isOsenHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: osenHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...OSEN_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: osenHubFilterHref(chip),
      active: isOsenHubFilterActive(chip, state),
    })),
  ];
}

export function isOsenHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === OSEN_HUB_PATH;
}

export function isOsenClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return normalized === OSEN_HUB_PATH || normalized.startsWith(`${OSEN_HUB_PATH}/`);
}

/** Former L2 slices under /osen consolidate into the hub. */
export function osenChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (!normalized.startsWith(`${OSEN_HUB_PATH}/`)) return null;
  return OSEN_HUB_PATH;
}
