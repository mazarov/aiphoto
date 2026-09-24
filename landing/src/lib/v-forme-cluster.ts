import { takeHeroMarqueeCards } from "./hero-marquee";
import { COMPOSE_EXAMPLE_SVO_FILTER } from "./generaciya-foto-compose-example";

export const V_FORME_HUB_PATH = "/v-forme";
export const V_FORME_HUB_OBJECT_TAG = "v_forme";
export const V_FORME_HUB_LOAD_MORE_LABEL = "Больше промтов в форме";
export const V_FORME_HUB_GENERATE_CTA = "Создать фото в форме";
export const V_FORME_HUB_HERO_ARIA_LABEL = "Примеры фото в военной форме";
export const V_FORME_HUB_HERO_CARD_LIMIT = 16;

/** Same picker chip as compose «СВО»: listing `object_tag=v_forme`. */
export const V_FORME_HUB_COMPOSE_EXAMPLE_FILTER = COMPOSE_EXAMPLE_SVO_FILTER;

export type VFormeHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type VFormeHubFilterChip = {
  label: string;
  queryKey: VFormeHubFilterQueryKey;
  value: string;
};

export type VFormeHubFilterState = Partial<
  Record<VFormeHubFilterQueryKey, string | null | undefined>
>;

/**
 * Stay on /v-forme. Audience and style AND with object_tag=v_forme.
 * Another object chip would replace the uniform tag.
 */
export const V_FORME_HUB_FILTER_CHIPS: readonly VFormeHubFilterChip[] = [
  { label: "Муж", queryKey: "audience", value: "s_muzhem" },
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Пара", queryKey: "audience", value: "para" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Hub feed stays uniform. In-page filters do not leak into the hero. */
export function vFormeHubHeroFetchParams(routeParams: {
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
    object_tag: V_FORME_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: V_FORME_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toVFormeHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function vFormeHubFilterHref(chip?: VFormeHubFilterChip | null): string {
  if (!chip) return V_FORME_HUB_PATH;
  return `${V_FORME_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isVFormeHubFilterActive(
  chip: VFormeHubFilterChip,
  state: VFormeHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getVFormeHubFilterNavItems(state: VFormeHubFilterState = {}) {
  const hasActiveChip = V_FORME_HUB_FILTER_CHIPS.some((chip) =>
    isVFormeHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: vFormeHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...V_FORME_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: vFormeHubFilterHref(chip),
      active: isVFormeHubFilterActive(chip, state),
    })),
  ];
}

export function isVFormeHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === V_FORME_HUB_PATH;
}

export function isVFormeClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === V_FORME_HUB_PATH ||
    normalized.startsWith(`${V_FORME_HUB_PATH}/`)
  );
}

/** Former L2 slices under /v-forme consolidate into the hub. */
export function vFormeChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (!normalized.startsWith(`${V_FORME_HUB_PATH}/`)) return null;
  return V_FORME_HUB_PATH;
}
