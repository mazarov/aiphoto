import { takeHeroMarqueeCards } from "./hero-marquee";

export const S_TORTOM_HUB_PATH = "/promty-dlya-foto/s-tortom";
export const S_TORTOM_LEGACY_PATH = "/s-tortom";
export const S_TORTOM_HUB_OBJECT_TAG = "s_tortom";
export const S_TORTOM_HUB_LOAD_MORE_LABEL = "Больше промтов с тортом";
export const S_TORTOM_HUB_GENERATE_CTA = "Создать фото с тортом";
export const S_TORTOM_HUB_HERO_ARIA_LABEL = "Примеры фото с тортом";
export const S_TORTOM_HUB_HERO_CARD_LIMIT = 16;

export const S_TORTOM_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "С тортом",
  href: S_TORTOM_HUB_PATH,
  dimension: "object_tag",
  value: S_TORTOM_HUB_OBJECT_TAG,
} as const;

export type STortomHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type STortomHubFilterChip = {
  label: string;
  queryKey: STortomHubFilterQueryKey;
  value: string;
};

export type STortomHubFilterState = Partial<
  Record<STortomHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace s_tortom. */
export const S_TORTOM_HUB_FILTER_CHIPS: readonly STortomHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Мужчина", queryKey: "audience", value: "muzhchina" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function sTortomHubHeroFetchParams(routeParams: {
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
    object_tag: S_TORTOM_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: S_TORTOM_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toSTortomHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function sTortomHubFilterHref(chip?: STortomHubFilterChip | null): string {
  if (!chip) return S_TORTOM_HUB_PATH;
  return `${S_TORTOM_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isSTortomHubFilterActive(
  chip: STortomHubFilterChip,
  state: STortomHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getSTortomHubFilterNavItems(state: STortomHubFilterState = {}) {
  const hasActiveChip = S_TORTOM_HUB_FILTER_CHIPS.some((chip) =>
    isSTortomHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: sTortomHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...S_TORTOM_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: sTortomHubFilterHref(chip),
      active: isSTortomHubFilterActive(chip, state),
    })),
  ];
}

export function isSTortomHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === S_TORTOM_HUB_PATH;
}

export function isSTortomClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === S_TORTOM_HUB_PATH ||
    normalized.startsWith(`${S_TORTOM_HUB_PATH}/`) ||
    normalized === S_TORTOM_LEGACY_PATH ||
    normalized.startsWith(`${S_TORTOM_LEGACY_PATH}/`)
  );
}

/** Legacy /s-tortom and any child slice 301 to the hub. */
export function sTortomChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === S_TORTOM_HUB_PATH) return null;
  if (
    normalized === S_TORTOM_LEGACY_PATH ||
    normalized.startsWith(`${S_TORTOM_LEGACY_PATH}/`) ||
    normalized.startsWith(`${S_TORTOM_HUB_PATH}/`)
  ) {
    return S_TORTOM_HUB_PATH;
  }
  return null;
}
