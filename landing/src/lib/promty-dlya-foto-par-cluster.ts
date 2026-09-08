import { takeHeroMarqueeCards } from "./hero-marquee";

export const PROMTY_DLYA_FOTO_PAR_HUB_PATH = "/promty-dlya-foto-par";
export const GENERACIYA_FOTO_PARY_PATH = "/generaciya-foto/pary";

export const PAIRS_HUB_LOAD_MORE_LABEL = "Больше промтов для пар";
export const PAIRS_HUB_GENERATE_CTA = "Создать фото пары";
export const PAIRS_HUB_HERO_ARIA_LABEL = "Примеры парных фото";

/** Newest pair stills for the homepage-style hero marquee. Listing SSR is only 10. */
export const PAIRS_HUB_HERO_CARD_LIMIT = 16;

/** Catalog example chip «Пары» — same listing tag as `/generaciya-foto` quick filters. */
export const PAIRS_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "Пары",
  dimension: "audience_tag",
  value: "para",
} as const;

export type PairsHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type PairsHubFilterChip = {
  label: string;
  queryKey: PairsHubFilterQueryKey;
  value: string;
};

export type PairsHubFilterState = Partial<
  Record<PairsHubFilterQueryKey, string | null | undefined>
>;

/** In-page filters only: stay on the hub via query params, never L2 URLs. */
export const PAIRS_HUB_FILTER_CHIPS: readonly PairsHubFilterChip[] = [
  { label: "С парнем", queryKey: "audience", value: "s_parnem" },
  { label: "Влюблённые", queryKey: "audience", value: "vlyublennykh" },
  { label: "Чёрно-белое", queryKey: "style", value: "cherno_beloe" },
  { label: "Студия", queryKey: "style", value: "studiynoe" },
  { label: "Love Is", queryKey: "style", value: "love_is" },
  { label: "В машине", queryKey: "object", value: "v_mashine" },
  { label: "На море", queryKey: "object", value: "na_more" },
  { label: "Осень", queryKey: "object", value: "osen" },
  { label: "Новый год", queryKey: "occasion", value: "novyy_god" },
];

/** Hub-wide pairs feed — ignore in-page query filters so the hero stays a pairs story. */
export function pairsHubHeroFetchParams(routeParams: {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
}) {
  return {
    ...routeParams,
    limit: PAIRS_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toPairsHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function pairsHubFilterHref(chip?: PairsHubFilterChip | null): string {
  if (!chip) return PROMTY_DLYA_FOTO_PAR_HUB_PATH;
  return `${PROMTY_DLYA_FOTO_PAR_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isPairsHubFilterActive(
  chip: PairsHubFilterChip,
  state: PairsHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getPairsHubFilterNavItems(state: PairsHubFilterState = {}) {
  const hasActiveChip = PAIRS_HUB_FILTER_CHIPS.some((chip) =>
    isPairsHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: pairsHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...PAIRS_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: pairsHubFilterHref(chip),
      active: isPairsHubFilterActive(chip, state),
    })),
  ];
}

/** Independent L1 sitelink pages. `s-parnem` 301s to the hub; the other two stay 200. */
export const PAIRS_PROMPT_SITELINK_PATHS = [
  "/promty-dlya-foto-s-parnem",
  "/promty-dlya-foto-s-muzhem",
  "/promty-dlya-foto-vlyublennykh",
] as const;

export const PAIRS_SITELINK_REDIRECT_PATHS = [
  "/promty-dlya-foto-s-parnem",
] as const;

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isPromtyDlyaFotoParHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === PROMTY_DLYA_FOTO_PAR_HUB_PATH;
}

export function isPromtyDlyaFotoParClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === PROMTY_DLYA_FOTO_PAR_HUB_PATH ||
    normalized.startsWith(`${PROMTY_DLYA_FOTO_PAR_HUB_PATH}/`)
  );
}

/** Former L2 slices and retired sitelink L1s consolidate into the single pairs hub. */
export function pairsChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized.startsWith(`${PROMTY_DLYA_FOTO_PAR_HUB_PATH}/`)) {
    return PROMTY_DLYA_FOTO_PAR_HUB_PATH;
  }
  if ((PAIRS_SITELINK_REDIRECT_PATHS as readonly string[]).includes(normalized)) {
    return PROMTY_DLYA_FOTO_PAR_HUB_PATH;
  }
  return null;
}

export function isPairsPromptAdLandingPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  if (isPromtyDlyaFotoParClusterPath(normalized)) return true;
  return (PAIRS_PROMPT_SITELINK_PATHS as readonly string[]).includes(normalized);
}

export function isGeneraciyaFotoParyPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === GENERACIYA_FOTO_PARY_PATH;
}
