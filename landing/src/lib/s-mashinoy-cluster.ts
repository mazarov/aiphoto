import { takeHeroMarqueeCards } from "./hero-marquee";

export const S_MASHINOY_HUB_PATH = "/promty-dlya-foto/s-mashinoy";
export const S_MASHINOY_LEGACY_PATH = "/s-mashinoy";
export const S_MASHINOY_HUB_OBJECT_TAG = "s_mashinoy";
export const S_MASHINOY_HUB_LOAD_MORE_LABEL = "Больше промтов с машиной";
export const S_MASHINOY_HUB_GENERATE_CTA = "Создать фото с машиной";
export const S_MASHINOY_HUB_HERO_ARIA_LABEL = "Примеры фото с машиной";
export const S_MASHINOY_HUB_HERO_CARD_LIMIT = 16;

/** Compose chip for the car hub. Listing stays object_tag=s_mashinoy. */
export const S_MASHINOY_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "С машиной",
  href: S_MASHINOY_HUB_PATH,
  dimension: "object_tag",
  value: S_MASHINOY_HUB_OBJECT_TAG,
} as const;

export type SMashinoyHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type SMashinoyHubFilterChip = {
  label: string;
  queryKey: SMashinoyHubFilterQueryKey;
  value: string;
};

export type SMashinoyHubFilterState = Partial<
  Record<SMashinoyHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace s_mashinoy. */
export const S_MASHINOY_HUB_FILTER_CHIPS: readonly SMashinoyHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Мужчина", queryKey: "audience", value: "muzhchina" },
  { label: "Пара", queryKey: "audience", value: "para" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Hub feed stays the car tag. In-page filters do not leak into the hero. */
export function sMashinoyHubHeroFetchParams(routeParams: {
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
    object_tag: S_MASHINOY_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: S_MASHINOY_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toSMashinoyHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function sMashinoyHubFilterHref(chip?: SMashinoyHubFilterChip | null): string {
  if (!chip) return S_MASHINOY_HUB_PATH;
  return `${S_MASHINOY_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isSMashinoyHubFilterActive(
  chip: SMashinoyHubFilterChip,
  state: SMashinoyHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getSMashinoyHubFilterNavItems(state: SMashinoyHubFilterState = {}) {
  const hasActiveChip = S_MASHINOY_HUB_FILTER_CHIPS.some((chip) =>
    isSMashinoyHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: sMashinoyHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...S_MASHINOY_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: sMashinoyHubFilterHref(chip),
      active: isSMashinoyHubFilterActive(chip, state),
    })),
  ];
}

export function isSMashinoyHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === S_MASHINOY_HUB_PATH;
}

export function isSMashinoyClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === S_MASHINOY_HUB_PATH ||
    normalized.startsWith(`${S_MASHINOY_HUB_PATH}/`) ||
    normalized === S_MASHINOY_LEGACY_PATH ||
    normalized.startsWith(`${S_MASHINOY_LEGACY_PATH}/`)
  );
}

/** Legacy /s-mashinoy and any child slice 301 to the hub. */
export function sMashinoyChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === S_MASHINOY_HUB_PATH) return null;
  if (
    normalized === S_MASHINOY_LEGACY_PATH ||
    normalized.startsWith(`${S_MASHINOY_LEGACY_PATH}/`) ||
    normalized.startsWith(`${S_MASHINOY_HUB_PATH}/`)
  ) {
    return S_MASHINOY_HUB_PATH;
  }
  return null;
}
