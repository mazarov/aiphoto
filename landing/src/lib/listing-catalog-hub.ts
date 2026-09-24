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
  S_MASHINOY_HUB_COMPOSE_EXAMPLE_FILTER,
  S_MASHINOY_HUB_GENERATE_CTA,
  S_MASHINOY_HUB_HERO_ARIA_LABEL,
  S_MASHINOY_HUB_LOAD_MORE_LABEL,
  S_MASHINOY_HUB_PATH,
  getSMashinoyHubFilterNavItems,
  isSMashinoyClusterPath,
  isSMashinoyHubPath,
  sMashinoyChildRedirectPath,
  sMashinoyHubHeroFetchParams,
  toSMashinoyHubHeroCarouselCards,
  type SMashinoyHubFilterState,
} from "./s-mashinoy-cluster";
import {
  AVATAR_HUB_COMPOSE_EXAMPLE_FILTER,
  AVATAR_HUB_GENERATE_CTA,
  AVATAR_HUB_HERO_ARIA_LABEL,
  AVATAR_HUB_LOAD_MORE_LABEL,
  AVATAR_HUB_PATH,
  avatarChildRedirectPath,
  avatarHubHeroFetchParams,
  getAvatarHubFilterNavItems,
  isAvatarClusterPath,
  isAvatarHubPath,
  toAvatarHubHeroCarouselCards,
  type AvatarHubFilterState,
} from "./foto-na-avatarku-cluster";
import {
  NA_MORE_HUB_COMPOSE_EXAMPLE_FILTER,
  NA_MORE_HUB_GENERATE_CTA,
  NA_MORE_HUB_HERO_ARIA_LABEL,
  NA_MORE_HUB_LOAD_MORE_LABEL,
  NA_MORE_HUB_PATH,
  getNaMoreHubFilterNavItems,
  isNaMoreClusterPath,
  isNaMoreHubPath,
  naMoreChildRedirectPath,
  naMoreHubHeroFetchParams,
  toNaMoreHubHeroCarouselCards,
  type NaMoreHubFilterState,
} from "./na-more-cluster";
import {
  V_MASHINE_HUB_COMPOSE_EXAMPLE_FILTER,
  V_MASHINE_HUB_GENERATE_CTA,
  V_MASHINE_HUB_HERO_ARIA_LABEL,
  V_MASHINE_HUB_LOAD_MORE_LABEL,
  V_MASHINE_HUB_PATH,
  getVMashineHubFilterNavItems,
  isVMashineClusterPath,
  isVMashineHubPath,
  vMashineChildRedirectPath,
  vMashineHubHeroFetchParams,
  toVMashineHubHeroCarouselCards,
  type VMashineHubFilterState,
} from "./v-mashine-cluster";
import {
  S_SHAMPANSKIM_HUB_COMPOSE_EXAMPLE_FILTER,
  S_SHAMPANSKIM_HUB_GENERATE_CTA,
  S_SHAMPANSKIM_HUB_HERO_ARIA_LABEL,
  S_SHAMPANSKIM_HUB_LOAD_MORE_LABEL,
  S_SHAMPANSKIM_HUB_PATH,
  getSShampanskimHubFilterNavItems,
  isSShampanskimClusterPath,
  isSShampanskimHubPath,
  sShampanskimChildRedirectPath,
  sShampanskimHubHeroFetchParams,
  toSShampanskimHubHeroCarouselCards,
  type SShampanskimHubFilterState,
} from "./s-shampanskim-cluster";
import {
  V_ZERKALE_HUB_COMPOSE_EXAMPLE_FILTER,
  V_ZERKALE_HUB_GENERATE_CTA,
  V_ZERKALE_HUB_HERO_ARIA_LABEL,
  V_ZERKALE_HUB_LOAD_MORE_LABEL,
  V_ZERKALE_HUB_PATH,
  getVZerkaleHubFilterNavItems,
  isVZerkaleClusterPath,
  isVZerkaleHubPath,
  vZerkaleChildRedirectPath,
  vZerkaleHubHeroFetchParams,
  toVZerkaleHubHeroCarouselCards,
  type VZerkaleHubFilterState,
} from "./v-zerkale-cluster";
import {
  V_SPORTALE_HUB_COMPOSE_EXAMPLE_FILTER,
  V_SPORTALE_HUB_GENERATE_CTA,
  V_SPORTALE_HUB_HERO_ARIA_LABEL,
  V_SPORTALE_HUB_LOAD_MORE_LABEL,
  V_SPORTALE_HUB_PATH,
  getVSportaleHubFilterNavItems,
  isVSportaleClusterPath,
  isVSportaleHubPath,
  vSportaleChildRedirectPath,
  vSportaleHubHeroFetchParams,
  toVSportaleHubHeroCarouselCards,
  type VSportaleHubFilterState,
} from "./v-sportale-cluster";
import {
  MOTOTSIKL_HUB_COMPOSE_EXAMPLE_FILTER,
  MOTOTSIKL_HUB_GENERATE_CTA,
  MOTOTSIKL_HUB_HERO_ARIA_LABEL,
  MOTOTSIKL_HUB_LOAD_MORE_LABEL,
  MOTOTSIKL_HUB_PATH,
  getMototsiklHubFilterNavItems,
  isMototsiklClusterPath,
  isMototsiklHubPath,
  mototsiklChildRedirectPath,
  mototsiklHubHeroFetchParams,
  toMototsiklHubHeroCarouselCards,
  type MototsiklHubFilterState,
} from "./mototsikl-cluster";
import {
  S_TORTOM_HUB_COMPOSE_EXAMPLE_FILTER,
  S_TORTOM_HUB_GENERATE_CTA,
  S_TORTOM_HUB_HERO_ARIA_LABEL,
  S_TORTOM_HUB_LOAD_MORE_LABEL,
  S_TORTOM_HUB_PATH,
  getSTortomHubFilterNavItems,
  isSTortomClusterPath,
  isSTortomHubPath,
  sTortomChildRedirectPath,
  sTortomHubHeroFetchParams,
  toSTortomHubHeroCarouselCards,
  type STortomHubFilterState,
} from "./s-tortom-cluster";
import {
  S_LOSHADYU_HUB_COMPOSE_EXAMPLE_FILTER,
  S_LOSHADYU_HUB_GENERATE_CTA,
  S_LOSHADYU_HUB_HERO_ARIA_LABEL,
  S_LOSHADYU_HUB_LOAD_MORE_LABEL,
  S_LOSHADYU_HUB_PATH,
  getSLoshadyuHubFilterNavItems,
  isSLoshadyuClusterPath,
  isSLoshadyuHubPath,
  sLoshadyuChildRedirectPath,
  sLoshadyuHubHeroFetchParams,
  toSLoshadyuHubHeroCarouselCards,
  type SLoshadyuHubFilterState,
} from "./s-loshadyu-cluster";
import {
  V_LESU_HUB_COMPOSE_EXAMPLE_FILTER,
  V_LESU_HUB_GENERATE_CTA,
  V_LESU_HUB_HERO_ARIA_LABEL,
  V_LESU_HUB_LOAD_MORE_LABEL,
  V_LESU_HUB_PATH,
  getVLesuHubFilterNavItems,
  isVLesuClusterPath,
  isVLesuHubPath,
  vLesuChildRedirectPath,
  vLesuHubHeroFetchParams,
  toVLesuHubHeroCarouselCards,
  type VLesuHubFilterState,
} from "./v-lesu-cluster";
import {
  OBJECT_SCENE_HUB_SPECS,
  isObjectSceneClusterPath,
  objectSceneChildRedirectPath,
  objectSceneFilterNav,
  objectSceneHeroFetchParams,
  objectSceneHubSpec,
  toObjectSceneHeroCarouselCards,
} from "./object-scene-hubs";
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
  VFormeHubFilterState &
  SMashinoyHubFilterState &
  AvatarHubFilterState &
  NaMoreHubFilterState &
  VMashineHubFilterState &
  SShampanskimHubFilterState &
  VZerkaleHubFilterState &
  VSportaleHubFilterState &
  MototsiklHubFilterState &
  STortomHubFilterState &
  SLoshadyuHubFilterState &
  VLesuHubFilterState;

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

const S_MASHINOY_HUB: ListingCatalogHub = {
  path: S_MASHINOY_HUB_PATH,
  loadMoreLabel: S_MASHINOY_HUB_LOAD_MORE_LABEL,
  generateCta: S_MASHINOY_HUB_GENERATE_CTA,
  heroAriaLabel: S_MASHINOY_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: S_MASHINOY_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: sMashinoyHubHeroFetchParams,
  toHeroCarouselCards: toSMashinoyHubHeroCarouselCards,
  getFilterNavItems: getSMashinoyHubFilterNavItems,
};

const AVATAR_HUB: ListingCatalogHub = {
  path: AVATAR_HUB_PATH,
  loadMoreLabel: AVATAR_HUB_LOAD_MORE_LABEL,
  generateCta: AVATAR_HUB_GENERATE_CTA,
  heroAriaLabel: AVATAR_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: AVATAR_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: avatarHubHeroFetchParams,
  toHeroCarouselCards: toAvatarHubHeroCarouselCards,
  getFilterNavItems: getAvatarHubFilterNavItems,
};

const NA_MORE_HUB: ListingCatalogHub = {
  path: NA_MORE_HUB_PATH,
  loadMoreLabel: NA_MORE_HUB_LOAD_MORE_LABEL,
  generateCta: NA_MORE_HUB_GENERATE_CTA,
  heroAriaLabel: NA_MORE_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: NA_MORE_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: naMoreHubHeroFetchParams,
  toHeroCarouselCards: toNaMoreHubHeroCarouselCards,
  getFilterNavItems: getNaMoreHubFilterNavItems,
};

const V_MASHINE_HUB: ListingCatalogHub = {
  path: V_MASHINE_HUB_PATH,
  loadMoreLabel: V_MASHINE_HUB_LOAD_MORE_LABEL,
  generateCta: V_MASHINE_HUB_GENERATE_CTA,
  heroAriaLabel: V_MASHINE_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: V_MASHINE_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: vMashineHubHeroFetchParams,
  toHeroCarouselCards: toVMashineHubHeroCarouselCards,
  getFilterNavItems: getVMashineHubFilterNavItems,
};

const S_SHAMPANSKIM_HUB: ListingCatalogHub = {
  path: S_SHAMPANSKIM_HUB_PATH,
  loadMoreLabel: S_SHAMPANSKIM_HUB_LOAD_MORE_LABEL,
  generateCta: S_SHAMPANSKIM_HUB_GENERATE_CTA,
  heroAriaLabel: S_SHAMPANSKIM_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: S_SHAMPANSKIM_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: sShampanskimHubHeroFetchParams,
  toHeroCarouselCards: toSShampanskimHubHeroCarouselCards,
  getFilterNavItems: getSShampanskimHubFilterNavItems,
};

const V_ZERKALE_HUB: ListingCatalogHub = {
  path: V_ZERKALE_HUB_PATH,
  loadMoreLabel: V_ZERKALE_HUB_LOAD_MORE_LABEL,
  generateCta: V_ZERKALE_HUB_GENERATE_CTA,
  heroAriaLabel: V_ZERKALE_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: V_ZERKALE_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: vZerkaleHubHeroFetchParams,
  toHeroCarouselCards: toVZerkaleHubHeroCarouselCards,
  getFilterNavItems: getVZerkaleHubFilterNavItems,
};

const V_SPORTALE_HUB: ListingCatalogHub = {
  path: V_SPORTALE_HUB_PATH,
  loadMoreLabel: V_SPORTALE_HUB_LOAD_MORE_LABEL,
  generateCta: V_SPORTALE_HUB_GENERATE_CTA,
  heroAriaLabel: V_SPORTALE_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: V_SPORTALE_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: vSportaleHubHeroFetchParams,
  toHeroCarouselCards: toVSportaleHubHeroCarouselCards,
  getFilterNavItems: getVSportaleHubFilterNavItems,
};

const MOTOTSIKL_HUB: ListingCatalogHub = {
  path: MOTOTSIKL_HUB_PATH,
  loadMoreLabel: MOTOTSIKL_HUB_LOAD_MORE_LABEL,
  generateCta: MOTOTSIKL_HUB_GENERATE_CTA,
  heroAriaLabel: MOTOTSIKL_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: MOTOTSIKL_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: mototsiklHubHeroFetchParams,
  toHeroCarouselCards: toMototsiklHubHeroCarouselCards,
  getFilterNavItems: getMototsiklHubFilterNavItems,
};

const S_TORTOM_HUB: ListingCatalogHub = {
  path: S_TORTOM_HUB_PATH,
  loadMoreLabel: S_TORTOM_HUB_LOAD_MORE_LABEL,
  generateCta: S_TORTOM_HUB_GENERATE_CTA,
  heroAriaLabel: S_TORTOM_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: S_TORTOM_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: sTortomHubHeroFetchParams,
  toHeroCarouselCards: toSTortomHubHeroCarouselCards,
  getFilterNavItems: getSTortomHubFilterNavItems,
};

const S_LOSHADYU_HUB: ListingCatalogHub = {
  path: S_LOSHADYU_HUB_PATH,
  loadMoreLabel: S_LOSHADYU_HUB_LOAD_MORE_LABEL,
  generateCta: S_LOSHADYU_HUB_GENERATE_CTA,
  heroAriaLabel: S_LOSHADYU_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: S_LOSHADYU_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: sLoshadyuHubHeroFetchParams,
  toHeroCarouselCards: toSLoshadyuHubHeroCarouselCards,
  getFilterNavItems: getSLoshadyuHubFilterNavItems,
};

const V_LESU_HUB: ListingCatalogHub = {
  path: V_LESU_HUB_PATH,
  loadMoreLabel: V_LESU_HUB_LOAD_MORE_LABEL,
  generateCta: V_LESU_HUB_GENERATE_CTA,
  heroAriaLabel: V_LESU_HUB_HERO_ARIA_LABEL,
  composeExampleFilter: V_LESU_HUB_COMPOSE_EXAMPLE_FILTER,
  heroFetchParams: vLesuHubHeroFetchParams,
  toHeroCarouselCards: toVLesuHubHeroCarouselCards,
  getFilterNavItems: getVLesuHubFilterNavItems,
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

const OBJECT_SCENE_HUB_LIST: readonly ListingCatalogHub[] = OBJECT_SCENE_HUB_SPECS.map((spec) => ({
  path: spec.hubPath,
  loadMoreLabel: `Больше промтов ${spec.frame}`,
  generateCta: `Создать фото ${spec.frame}`,
  heroAriaLabel: `Примеры фото ${spec.frame}`,
  composeExampleFilter: {
    label: spec.label,
    dimension: "object_tag",
    value: spec.slug,
  },
  heroFetchParams: objectSceneHeroFetchParams(spec.slug),
  toHeroCarouselCards: toObjectSceneHeroCarouselCards,
  getFilterNavItems: (state) => objectSceneFilterNav(spec, state),
}));

const LISTING_CATALOG_HUBS: readonly ListingCatalogHub[] = [
  PAIRS_HUB,
  GIRLS_HUB,
  MEN_HUB,
  OSEN_HUB,
  V_FORME_HUB,
  S_MASHINOY_HUB,
  AVATAR_HUB,
  NA_MORE_HUB,
  V_MASHINE_HUB,
  S_SHAMPANSKIM_HUB,
  V_ZERKALE_HUB,
  V_SPORTALE_HUB,
  MOTOTSIKL_HUB,
  S_TORTOM_HUB,
  S_LOSHADYU_HUB,
  V_LESU_HUB,
  ...OBJECT_SCENE_HUB_LIST,
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
  if (isSMashinoyHubPath(pathname)) return S_MASHINOY_HUB;
  if (isAvatarHubPath(pathname)) return AVATAR_HUB;
  if (isNaMoreHubPath(pathname)) return NA_MORE_HUB;
  if (isVMashineHubPath(pathname)) return V_MASHINE_HUB;
  if (isSShampanskimHubPath(pathname)) return S_SHAMPANSKIM_HUB;
  if (isVZerkaleHubPath(pathname)) return V_ZERKALE_HUB;
  if (isVSportaleHubPath(pathname)) return V_SPORTALE_HUB;
  if (isMototsiklHubPath(pathname)) return MOTOTSIKL_HUB;
  if (isSTortomHubPath(pathname)) return S_TORTOM_HUB;
  if (isSLoshadyuHubPath(pathname)) return S_LOSHADYU_HUB;
  if (isVLesuHubPath(pathname)) return V_LESU_HUB;
  const scene = objectSceneHubSpec(pathname);
  if (scene) return OBJECT_SCENE_HUB_LIST.find((hub) => hub.path === scene.hubPath) ?? null;
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
    isVFormeClusterPath(pathname) ||
    isSMashinoyClusterPath(pathname) ||
    isAvatarClusterPath(pathname) ||
    isNaMoreClusterPath(pathname) ||
    isVMashineClusterPath(pathname) ||
    isSShampanskimClusterPath(pathname) ||
    isVZerkaleClusterPath(pathname) ||
    isVSportaleClusterPath(pathname) ||
    isMototsiklClusterPath(pathname) ||
    isSTortomClusterPath(pathname) ||
    isSLoshadyuClusterPath(pathname) ||
    isVLesuClusterPath(pathname) ||
    isObjectSceneClusterPath(pathname)
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
    vFormeChildRedirectPath(pathname) ??
    sMashinoyChildRedirectPath(pathname) ??
    avatarChildRedirectPath(pathname) ??
    naMoreChildRedirectPath(pathname) ??
    vMashineChildRedirectPath(pathname) ??
    sShampanskimChildRedirectPath(pathname) ??
    vZerkaleChildRedirectPath(pathname) ??
    vSportaleChildRedirectPath(pathname) ??
    mototsiklChildRedirectPath(pathname) ??
    sTortomChildRedirectPath(pathname) ??
    sLoshadyuChildRedirectPath(pathname) ??
    vLesuChildRedirectPath(pathname) ??
    objectSceneChildRedirectPath(pathname)
  );
}

export function listingCatalogHubGenerateCta(pathname: string): string | null {
  return resolveListingCatalogHub(pathname)?.generateCta ?? null;
}

export function isListingCatalogHubGenerateCta(label: string): boolean {
  return LISTING_CATALOG_HUBS.some((hub) => hub.generateCta === label);
}
