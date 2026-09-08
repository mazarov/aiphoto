import { takeHeroMarqueeCards } from "./hero-marquee";

export const PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH = "/promty-dlya-foto-devushki";
export const GENERACIYA_FOTO_DEVUSHKI_PATH = "/generaciya-foto/devushki";

export const GIRLS_HUB_AUDIENCE_TAG = "devushka";
export const GIRLS_HUB_LOAD_MORE_LABEL = "Больше промтов для девушки";
export const GIRLS_HUB_GENERATE_CTA = "Создать фото девушки";
export const GIRLS_HUB_HERO_ARIA_LABEL = "Примеры фото девушки";

/** Newest girl stills for the homepage-style hero marquee. Listing SSR is only 10. */
export const GIRLS_HUB_HERO_CARD_LIMIT = 16;

/** Catalog example chip «Девушки» — same listing tag as `/generaciya-foto` quick filters. */
export const GIRLS_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "Девушки",
  dimension: "audience_tag",
  value: GIRLS_HUB_AUDIENCE_TAG,
} as const;

export type GirlsHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type GirlsHubFilterChip = {
  label: string;
  queryKey: GirlsHubFilterQueryKey;
  value: string;
};

export type GirlsHubFilterState = Partial<
  Record<GirlsHubFilterQueryKey, string | null | undefined>
>;

/** In-page filters only: stay on the hub via query params, never L2 URLs. */
export const GIRLS_HUB_FILTER_CHIPS: readonly GirlsHubFilterChip[] = [
  { label: "С цветами", queryKey: "object", value: "s_cvetami" },
  { label: "Портрет", queryKey: "style", value: "portret" },
  { label: "Студия", queryKey: "style", value: "studiynoe" },
  { label: "Чёрно-белое", queryKey: "style", value: "cherno_beloe" },
  { label: "С машиной", queryKey: "object", value: "s_mashinoy" },
  { label: "На море", queryKey: "object", value: "na_more" },
  { label: "В платье", queryKey: "object", value: "v_platye" },
  { label: "В полный рост", queryKey: "object", value: "v_polnyy_rost" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Birthday cluster owns these tails — do not 301 them onto the girls hub. */
export function isGirlsHubBirthdayOwnedPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  const prefix = `${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}/`;
  if (!normalized.startsWith(prefix)) return false;
  const rest = normalized.slice(prefix.length);
  return (
    rest === "den-rozhdeniya" ||
    rest.startsWith("den-rozhdeniya/") ||
    rest.endsWith("/den-rozhdeniya")
  );
}

/** Hub-wide girls feed — pin the audience tag, ignore in-page query filters. */
export function girlsHubHeroFetchParams(routeParams: {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
}) {
  void routeParams;
  return {
    audience_tag: GIRLS_HUB_AUDIENCE_TAG,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
    limit: GIRLS_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toGirlsHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function girlsHubFilterHref(chip?: GirlsHubFilterChip | null): string {
  if (!chip) return PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH;
  return `${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isGirlsHubFilterActive(
  chip: GirlsHubFilterChip,
  state: GirlsHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getGirlsHubFilterNavItems(state: GirlsHubFilterState = {}) {
  const hasActiveChip = GIRLS_HUB_FILTER_CHIPS.some((chip) =>
    isGirlsHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: girlsHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...GIRLS_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: girlsHubFilterHref(chip),
      active: isGirlsHubFilterActive(chip, state),
    })),
  ];
}

export function isPromtyDlyaFotoDevushkiHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH;
}

export function isPromtyDlyaFotoDevushkiClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH ||
    normalized.startsWith(`${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}/`)
  );
}

/** Former L2 slices consolidate into the single girls hub. Birthday tails stay out. */
export function girlsChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (!normalized.startsWith(`${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}/`)) {
    return null;
  }
  if (isGirlsHubBirthdayOwnedPath(normalized)) return null;
  return PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH;
}

export function isGeneraciyaFotoDevushkiPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === GENERACIYA_FOTO_DEVUSHKI_PATH;
}
