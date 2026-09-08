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

export type ListingCatalogHubFilterState = PairsHubFilterState & GirlsHubFilterState;

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

/** Exact hub path only. Children 301 before render. */
export function resolveListingCatalogHub(
  pathname: string,
): ListingCatalogHub | null {
  if (isPromtyDlyaFotoParHubPath(pathname)) return PAIRS_HUB;
  if (isPromtyDlyaFotoDevushkiHubPath(pathname)) return GIRLS_HUB;
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
    isPromtyDlyaFotoDevushkiClusterPath(pathname)
  );
}

/** Middleware + sitemap: former L2 slices → owning hub. */
export function listingCatalogHubChildRedirectPath(
  pathname: string,
): string | null {
  return pairsChildRedirectPath(pathname) ?? girlsChildRedirectPath(pathname);
}

export function listingCatalogHubGenerateCta(pathname: string): string | null {
  return resolveListingCatalogHub(pathname)?.generateCta ?? null;
}
