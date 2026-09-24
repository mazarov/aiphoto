import {
  PAIRS_HUB_COMPOSE_EXAMPLE_FILTER,
  PAIRS_HUB_GENERATE_CTA,
  PAIRS_HUB_HERO_ARIA_LABEL,
  PAIRS_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  getPairsHubFilterNavItems,
  isPromtyDlyaFotoParClusterPath,
  isPromtyDlyaFotoParHubPath,
  pairsChildRedirectPath,
  pairsHubHeroFetchParams,
  toPairsHubHeroCarouselCards,
  type PairsHubFilterState,
} from "./promty-dlya-foto-par-cluster";
import {
  GIRLS_HUB_COMPOSE_EXAMPLE_FILTER,
  GIRLS_HUB_GENERATE_CTA,
  GIRLS_HUB_HERO_ARIA_LABEL,
  GIRLS_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  getGirlsHubFilterNavItems,
  girlsChildRedirectPath,
  girlsHubHeroFetchParams,
  isPromtyDlyaFotoDevushkiClusterPath,
  isPromtyDlyaFotoDevushkiHubPath,
  toGirlsHubHeroCarouselCards,
  type GirlsHubFilterState,
} from "./promty-dlya-foto-devushki-cluster";
import {
  OSEN_HUB_COMPOSE_EXAMPLE_FILTER,
  OSEN_HUB_GENERATE_CTA,
  OSEN_HUB_HERO_ARIA_LABEL,
  OSEN_HUB_LOAD_MORE_LABEL,
  OSEN_HUB_PATH,
  getOsenHubFilterNavItems,
  isOsenClusterPath,
  isOsenHubPath,
  osenChildRedirectPath,
  osenHubHeroFetchParams,
  toOsenHubHeroCarouselCards,
  type OsenHubFilterState,
} from "./osen-cluster";
import {
  V_FORME_HUB_COMPOSE_EXAMPLE_FILTER,
  V_FORME_HUB_GENERATE_CTA,
  V_FORME_HUB_HERO_ARIA_LABEL,
  V_FORME_HUB_LOAD_MORE_LABEL,
  V_FORME_HUB_PATH,
  getVFormeHubFilterNavItems,
  isVFormeClusterPath,
  isVFormeHubPath,
  vFormeChildRedirectPath,
  vFormeHubHeroFetchParams,
  toVFormeHubHeroCarouselCards,
  type VFormeHubFilterState,
} from "./v-forme-cluster";
import {
  MEN_HUB_COMPOSE_EXAMPLE_FILTER,
  MEN_HUB_GENERATE_CTA,
  MEN_HUB_HERO_ARIA_LABEL,
  MEN_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  getMenHubFilterNavItems,
  isPromtyDlyaFotoMuzhchinyClusterPath,
  isPromtyDlyaFotoMuzhchinyHubPath,
  menChildRedirectPath,
  menHubHeroFetchParams,
  toMenHubHeroCarouselCards,
  type MenHubFilterState,
} from "./promty-dlya-foto-muzhchiny-cluster";

export type ListingCatalogHubFilterState = PairsHubFilterState &
  GirlsHubFilterState &
  MenHubFilterState &
  OsenHubFilterState &
  VFormeHubFilterState;

export type ListingCatalogHubHeroParams = {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
};

export type ListingCatalogHubNavItem = {
  label: string;
  href: string;
  active: boolean;
};

export type ListingCatalogHub = {
  path: string;
  loadMoreLabel: string;
  generateCta: string;
  heroAriaLabel: string;
  composeExampleFilter: {
    label: string;
    dimension: string;
    value: string;
  };
  heroFetchParams: (
    routeParams: ListingCatalogHubHeroParams,
  ) => ListingCatalogHubHeroParams & {
    limit: number;
    offset: number;
    min_cards: number;
    sort: "new";
  };
  toHeroCarouselCards: <T extends { photoUrl: string | null }>(
    cards: readonly T[],
  ) => T[];
  getFilterNavItems: (
    state: ListingCatalogHubFilterState,
  ) => ListingCatalogHubNavItem[];
};

const PAIRS_HUB: ListingCatalogHub = {
  path: PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  loadMoreLabel: PAIRS_HUB_LOAD_MORE_LABEL,
  generateCta: PAIRS_HUB_GENERATE_CTA,
  heroAriaLabel: PAIRS_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: PAIRS_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: pairsHubHeroFetchParams,
  toHeroCarouselCards: toPairsHubHeroCarouselCards,
  getFilterNavItems: getPairsHubFilterNavItems,
};

const GIRLS_HUB: ListingCatalogHub = {
  path: PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  loadMoreLabel: GIRLS_HUB_LOAD_MORE_LABEL,
  generateCta: GIRLS_HUB_GENERATE_CTA,
  heroAriaLabel: GIRLS_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: GIRLS_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: girlsHubHeroFetchParams,
  toHeroCarouselCards: toGirlsHubHeroCarouselCards,
  getFilterNavItems: getGirlsHubFilterNavItems,
};

const OSEN_HUB: ListingCatalogHub = {
  path: OSEN_HUB_PATH,
  loadMoreLabel: OSEN_HUB_LOAD_MORE_LABEL,
  generateCta: OSEN_HUB_GENERATE_CTA,
  heroAriaLabel: OSEN_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: OSEN_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: osenHubHeroFetchParams,
  toHeroCarouselCards: toOsenHubHeroCarouselCards,
  getFilterNavItems: getOsenHubFilterNavItems,
};

const V_FORME_HUB: ListingCatalogHub = {
  path: V_FORME_HUB_PATH,
  loadMoreLabel: V_FORME_HUB_LOAD_MORE_LABEL,
  generateCta: V_FORME_HUB_GENERATE_CTA,
  heroAriaLabel: V_FORME_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: V_FORME_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: vFormeHubHeroFetchParams,
  toHeroCarouselCards: toVFormeHubHeroCarouselCards,
  getFilterNavItems: getVFormeHubFilterNavItems,
};

const MEN_HUB: ListingCatalogHub = {
  path: PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  loadMoreLabel: MEN_HUB_LOAD_MORE_LABEL,
  generateCta: MEN_HUB_GENERATE_CTA,
  heroAriaLabel: MEN_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: MEN_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: menHubHeroFetchParams,
  toHeroCarouselCards: toMenHubHeroCarouselCards,
  getFilterNavItems: getMenHubFilterNavItems,
};

const LISTING_CATALOG_HUBS: readonly ListingCatalogHub[] = [
  PAIRS_HUB,
  GIRLS_HUB,
  MEN_HUB,
  OSEN_HUB,
  V_FORME_HUB,
];

/** Exact hub path only. Children 301 before render. */
export function resolveListingCatalogHub(
  pathname: string,
): ListingCatalogHub | null {
  if (isPromtyDlyaFotoParHubPath(pathname)) return PAIRS_HUB;
  if (isPromtyDlyaFotoDevushkiHubPath(pathname)) return GIRLS_HUB;
  if (isPromtyDlyaFotoMuzhchinyHubPath(pathname)) return MEN_HUB;
  if (isOsenHubPath(pathname)) return OSEN_HUB;
  if (isVFormeHubPath(pathname)) return V_FORME_HUB;
  return null;
}

export function resolveListingCatalogHubL1(
  pathname: string,
  level: number,
): ListingCatalogHub | null {
  if (level !== 1) return null;
  return resolveListingCatalogHub(pathname);
}

export function isListingCatalogHubClusterPath(pathname: string): boolean {
  return (
    isPromtyDlyaFotoParClusterPath(pathname) ||
    isPromtyDlyaFotoDevushkiClusterPath(pathname) ||
    isPromtyDlyaFotoMuzhchinyClusterPath(pathname) ||
    isOsenClusterPath(pathname) ||
    isVFormeClusterPath(pathname)
  );
}

/** Middleware + sitemap: former L2 slices → owning hub. */
export function listingCatalogHubChildRedirectPath(
  pathname: string,
): string | null {
  return (
    pairsChildRedirectPath(pathname) ??
    girlsChildRedirectPath(pathname) ??
    menChildRedirectPath(pathname) ??
    osenChildRedirectPath(pathname) ??
    vFormeChildRedirectPath(pathname)
  );
}

export function listingCatalogHubGenerateCta(pathname: string): string | null {
  return resolveListingCatalogHub(pathname)?.generateCta ?? null;
}

export function isListingCatalogHubGenerateCta(label: string): boolean {
  return LISTING_CATALOG_HUBS.some((hub) => hub.generateCta === label);
}
