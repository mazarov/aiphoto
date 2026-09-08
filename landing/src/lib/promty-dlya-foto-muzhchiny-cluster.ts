import { takeHeroMarqueeCards } from "./hero-marquee";

export const PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH = "/promty-dlya-foto-muzhchiny";
export const GENERACIYA_FOTO_MUZHCHINY_PATH = "/generaciya-foto/muzhchiny";

export const MEN_HUB_AUDIENCE_TAG = "muzhchina";
export const MEN_HUB_LOAD_MORE_LABEL = "Больше промтов для мужчины";
export const MEN_HUB_GENERATE_CTA = "Создать фото мужчины";
export const MEN_HUB_HERO_ARIA_LABEL = "Примеры фото мужчины";

/** Newest men stills for the homepage-style hero marquee. Listing SSR is only 10. */
export const MEN_HUB_HERO_CARD_LIMIT = 16;

/** Catalog example chip «Мужчины» — same listing tag as `/generaciya-foto` quick filters. */
export const MEN_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "Мужчины",
  dimension: "audience_tag",
  value: MEN_HUB_AUDIENCE_TAG,
} as const;

export type MenHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type MenHubFilterChip = {
  label: string;
  queryKey: MenHubFilterQueryKey;
  value: string;
};

export type MenHubFilterState = Partial<
  Record<MenHubFilterQueryKey, string | null | undefined>
>;

/** In-page filters only: stay on the hub via query params, never L2 URLs. */
export const MEN_HUB_FILTER_CHIPS: readonly MenHubFilterChip[] = [
  { label: "С машиной", queryKey: "object", value: "s_mashinoy" },
  { label: "Деловое", queryKey: "style", value: "delovoe" },
  { label: "Портрет", queryKey: "style", value: "portret" },
  { label: "Студия", queryKey: "style", value: "studiynoe" },
  { label: "В форме", queryKey: "object", value: "v_forme" },
  { label: "Чёрно-белое", queryKey: "style", value: "cherno_beloe" },
  { label: "В костюме", queryKey: "object", value: "v_kostyume" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Birthday cluster owns these tails — do not 301 them onto the men hub. */
export function isMenHubBirthdayOwnedPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  const prefix = `${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}/`;
  if (!normalized.startsWith(prefix)) return false;
  const rest = normalized.slice(prefix.length);
  return (
    rest === "den-rozhdeniya" ||
    rest.startsWith("den-rozhdeniya/") ||
    rest.endsWith("/den-rozhdeniya")
  );
}

/** Hub-wide men feed — pin the audience tag, ignore in-page query filters. */
export function menHubHeroFetchParams(routeParams: {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
}) {
  void routeParams;
  return {
    audience_tag: MEN_HUB_AUDIENCE_TAG,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
    limit: MEN_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toMenHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function menHubFilterHref(chip?: MenHubFilterChip | null): string {
  if (!chip) return PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH;
  return `${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isMenHubFilterActive(
  chip: MenHubFilterChip,
  state: MenHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getMenHubFilterNavItems(state: MenHubFilterState = {}) {
  const hasActiveChip = MEN_HUB_FILTER_CHIPS.some((chip) =>
    isMenHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: menHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...MEN_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: menHubFilterHref(chip),
      active: isMenHubFilterActive(chip, state),
    })),
  ];
}

export function isPromtyDlyaFotoMuzhchinyHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH;
}

export function isPromtyDlyaFotoMuzhchinyClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH ||
    normalized.startsWith(`${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}/`)
  );
}

/** Former L2 slices consolidate into the single men hub. Birthday tails stay out. */
export function menChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (!normalized.startsWith(`${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}/`)) {
    return null;
  }
  if (isMenHubBirthdayOwnedPath(normalized)) return null;
  return PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH;
}

export function isGeneraciyaFotoMuzhchinyPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === GENERACIYA_FOTO_MUZHCHINY_PATH;
}
