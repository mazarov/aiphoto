import { takeHeroMarqueeCards } from "./hero-marquee";

export const S_LOSHADYU_HUB_PATH = "/promty-dlya-foto/s-loshadyu";
export const S_LOSHADYU_LEGACY_PATH = "/s-loshadyu";
export const S_LOSHADYU_HUB_OBJECT_TAG = "s_loshadyu";
export const S_LOSHADYU_HUB_LOAD_MORE_LABEL = "Больше промтов с лошадью";
export const S_LOSHADYU_HUB_GENERATE_CTA = "Создать фото с лошадью";
export const S_LOSHADYU_HUB_HERO_ARIA_LABEL = "Примеры фото с лошадью";
export const S_LOSHADYU_HUB_HERO_CARD_LIMIT = 16;

export const S_LOSHADYU_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "С лошадью",
  href: S_LOSHADYU_HUB_PATH,
  dimension: "object_tag",
  value: S_LOSHADYU_HUB_OBJECT_TAG,
} as const;

export type SLoshadyuHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type SLoshadyuHubFilterChip = {
  label: string;
  queryKey: SLoshadyuHubFilterQueryKey;
  value: string;
};

export type SLoshadyuHubFilterState = Partial<
  Record<SLoshadyuHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace s_loshadyu. */
export const S_LOSHADYU_HUB_FILTER_CHIPS: readonly SLoshadyuHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Пара", queryKey: "audience", value: "para" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function sLoshadyuHubHeroFetchParams(routeParams: {
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
    object_tag: S_LOSHADYU_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: S_LOSHADYU_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toSLoshadyuHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function sLoshadyuHubFilterHref(chip?: SLoshadyuHubFilterChip | null): string {
  if (!chip) return S_LOSHADYU_HUB_PATH;
  return `${S_LOSHADYU_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isSLoshadyuHubFilterActive(
  chip: SLoshadyuHubFilterChip,
  state: SLoshadyuHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getSLoshadyuHubFilterNavItems(state: SLoshadyuHubFilterState = {}) {
  const hasActiveChip = S_LOSHADYU_HUB_FILTER_CHIPS.some((chip) =>
    isSLoshadyuHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: sLoshadyuHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...S_LOSHADYU_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: sLoshadyuHubFilterHref(chip),
      active: isSLoshadyuHubFilterActive(chip, state),
    })),
  ];
}

export function isSLoshadyuHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === S_LOSHADYU_HUB_PATH;
}

export function isSLoshadyuClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === S_LOSHADYU_HUB_PATH ||
    normalized.startsWith(`${S_LOSHADYU_HUB_PATH}/`) ||
    normalized === S_LOSHADYU_LEGACY_PATH ||
    normalized.startsWith(`${S_LOSHADYU_LEGACY_PATH}/`)
  );
}

/** Legacy /s-loshadyu and any child slice 301 to the hub. */
export function sLoshadyuChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === S_LOSHADYU_HUB_PATH) return null;
  if (
    normalized === S_LOSHADYU_LEGACY_PATH ||
    normalized.startsWith(`${S_LOSHADYU_LEGACY_PATH}/`) ||
    normalized.startsWith(`${S_LOSHADYU_HUB_PATH}/`)
  ) {
    return S_LOSHADYU_HUB_PATH;
  }
  return null;
}
