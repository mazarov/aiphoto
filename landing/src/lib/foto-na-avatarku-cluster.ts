import { takeHeroMarqueeCards } from "./hero-marquee";

export const AVATAR_HUB_PATH = "/promty-dlya-foto/na-avatarku";
export const AVATAR_LEGACY_PATH = "/foto-na-avatarku";
export const AVATAR_HUB_OBJECT_TAG = "na_avatarku";
export const AVATAR_HUB_LOAD_MORE_LABEL = "Больше промтов на аватарку";
export const AVATAR_HUB_GENERATE_CTA = "Создать фото на аватарку";
export const AVATAR_HUB_HERO_ARIA_LABEL = "Примеры фото на аватарку";
export const AVATAR_HUB_HERO_CARD_LIMIT = 16;

export const AVATAR_HUB_COMPOSE_EXAMPLE_FILTER = {
  label: "На аватарку",
  href: AVATAR_HUB_PATH,
  dimension: "object_tag",
  value: AVATAR_HUB_OBJECT_TAG,
} as const;

export type AvatarHubFilterQueryKey = "audience" | "style" | "object" | "occasion";

export type AvatarHubFilterChip = {
  label: string;
  queryKey: AvatarHubFilterQueryKey;
  value: string;
};

export type AvatarHubFilterState = Partial<
  Record<AvatarHubFilterQueryKey, string | null | undefined>
>;

/** Audience and style only. A second object chip would replace na_avatarku. */
export const AVATAR_HUB_FILTER_CHIPS: readonly AvatarHubFilterChip[] = [
  { label: "Девушка", queryKey: "audience", value: "devushka" },
  { label: "Мужчина", queryKey: "audience", value: "muzhchina" },
  { label: "Портрет", queryKey: "style", value: "portret" },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function avatarHubHeroFetchParams(routeParams: {
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
    object_tag: AVATAR_HUB_OBJECT_TAG,
    doc_task_tag: null,
    limit: AVATAR_HUB_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  };
}

export function toAvatarHubHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function avatarHubFilterHref(chip?: AvatarHubFilterChip | null): string {
  if (!chip) return AVATAR_HUB_PATH;
  return `${AVATAR_HUB_PATH}?${chip.queryKey}=${encodeURIComponent(chip.value)}`;
}

export function isAvatarHubFilterActive(
  chip: AvatarHubFilterChip,
  state: AvatarHubFilterState,
): boolean {
  return state[chip.queryKey] === chip.value;
}

export function getAvatarHubFilterNavItems(state: AvatarHubFilterState = {}) {
  const hasActiveChip = AVATAR_HUB_FILTER_CHIPS.some((chip) =>
    isAvatarHubFilterActive(chip, state),
  );
  return [
    {
      label: "Все",
      href: avatarHubFilterHref(null),
      active: !hasActiveChip,
    },
    ...AVATAR_HUB_FILTER_CHIPS.map((chip) => ({
      label: chip.label,
      href: avatarHubFilterHref(chip),
      active: isAvatarHubFilterActive(chip, state),
    })),
  ];
}

export function isAvatarHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === AVATAR_HUB_PATH;
}

export function isAvatarClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === AVATAR_HUB_PATH ||
    normalized.startsWith(`${AVATAR_HUB_PATH}/`) ||
    normalized === AVATAR_LEGACY_PATH ||
    normalized.startsWith(`${AVATAR_LEGACY_PATH}/`)
  );
}

/** Legacy /foto-na-avatarku and any child slice 301 to the hub. */
export function avatarChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === AVATAR_HUB_PATH) return null;
  if (
    normalized === AVATAR_LEGACY_PATH ||
    normalized.startsWith(`${AVATAR_LEGACY_PATH}/`) ||
    normalized.startsWith(`${AVATAR_HUB_PATH}/`)
  ) {
    return AVATAR_HUB_PATH;
  }
  return null;
}
