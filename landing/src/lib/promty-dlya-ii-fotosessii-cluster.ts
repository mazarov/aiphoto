import { composeGenerateCtaLabel } from "./generate-compose-mode";
import { isFotoVPromtDockPath } from "./generate-dock-path";
import type { Dimension } from "./tag-registry";

export const PROMTY_DLYA_II_FOTOSESSII_HUB_PATH = "/ii-fotosessiya";

export const PROMTY_DLYA_FOTOSESSII_LEGACY_PATH = "/promty-dlya-fotosessii";

export const PROMTY_DLYA_II_FOTOSESSII_LEGACY_HUB_PATH =
  "/promty-dlya-ii-fotosessii";

export const MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS = 8;

export const PROMTY_DLYA_II_FOTOSESSII_PERMANENT_REDIRECTS = [
  {
    source: PROMTY_DLYA_FOTOSESSII_LEGACY_PATH,
    destination: PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  },
  {
    source: PROMTY_DLYA_II_FOTOSESSII_LEGACY_HUB_PATH,
    destination: PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  },
  {
    source: `${PROMTY_DLYA_II_FOTOSESSII_LEGACY_HUB_PATH}/:slug`,
    destination: `${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}/:slug`,
  },
] as const;

export type FotosessiiClusterChild = {
  slug: string;
  label: string;
  dimension: Dimension;
  tagValue: string;
  catalogHref: string;
  generateHref: string;
};

export const PROMTY_DLYA_II_FOTOSESSII_CHILDREN = [
  {
    slug: "muzhskie",
    label: "Мужские",
    dimension: "audience_tag",
    tagValue: "muzhchina",
    catalogHref: "/promty-dlya-foto-muzhchiny",
    generateHref: "/generaciya-foto/muzhchiny",
  },
  {
    slug: "zhenskie",
    label: "Женские",
    dimension: "audience_tag",
    tagValue: "devushka",
    catalogHref: "/promty-dlya-foto-devushki",
    generateHref: "/generaciya-foto/devushki",
  },
  {
    slug: "pary",
    label: "Пары",
    dimension: "audience_tag",
    tagValue: "para",
    catalogHref: "/promty-dlya-foto-par",
    generateHref: "/generaciya-foto/pary",
  },
  {
    slug: "den-rozhdeniya",
    label: "На день рождения",
    dimension: "occasion_tag",
    tagValue: "den_rozhdeniya",
    catalogHref: "/sobytiya/den-rozhdeniya",
    generateHref: "/generaciya-foto/na-den-rozhdeniya",
  },
  {
    slug: "detskie",
    label: "Детские",
    dimension: "audience_tag",
    tagValue: "detskie",
    catalogHref: "/promty-dlya-detskih-foto",
    generateHref: "/generaciya-foto/deti",
  },
  {
    slug: "semeynye",
    label: "Семейная",
    dimension: "audience_tag",
    tagValue: "semya",
    catalogHref: "/promty-dlya-semejnogo-foto",
    generateHref: "/generaciya-foto/semya",
  },
  {
    slug: "studiynye",
    label: "Студийные",
    dimension: "style_tag",
    tagValue: "studiynoe",
    catalogHref: "/stil/studiynoe",
    generateHref: "/generaciya-foto/studiynoe",
  },
  {
    slug: "zimnyaya",
    label: "Зимняя",
    dimension: "object_tag",
    tagValue: "zima",
    catalogHref: "/zima",
    generateHref: "/generaciya-foto",
  },
  {
    slug: "beremennye",
    label: "Беременных",
    dimension: "audience_tag",
    tagValue: "beremennaya",
    catalogHref: "/promty-dlya-foto-beremennaya",
    generateHref: "/generaciya-foto/beremennaya",
  },
  {
    slug: "s-voennymi",
    label: "С военными",
    dimension: "object_tag",
    tagValue: "v_forme",
    catalogHref: "/v-forme",
    generateHref: "/generaciya-foto/v-forme",
  },
  {
    slug: "dlya-dvoih",
    label: "Для двоих",
    dimension: "audience_tag",
    tagValue: "vlyublennykh",
    catalogHref: "/promty-dlya-foto-vlyublennykh",
    generateHref: "/generaciya-foto/pary",
  },
  {
    slug: "novogodnyaya",
    label: "Новогодняя",
    dimension: "occasion_tag",
    tagValue: "novyy_god",
    catalogHref: "/sobytiya/novyj-god",
    generateHref: "/generaciya-foto",
  },
  {
    slug: "vesennie",
    label: "Весенние",
    dimension: "object_tag",
    tagValue: "vesna",
    catalogHref: "/vesna",
    generateHref: "/generaciya-foto",
  },
  {
    slug: "delovoy-stil",
    label: "Деловой стиль",
    dimension: "style_tag",
    tagValue: "delovoe",
    catalogHref: "/stil/delovoe",
    generateHref: "/generaciya-foto",
  },
  {
    slug: "nyuborn",
    label: "Ньюборн",
    dimension: "audience_tag",
    tagValue: "malysh",
    catalogHref: "/promty-dlya-foto-malysh",
    generateHref: "/generaciya-foto/malysh",
  },
  {
    slug: "s-mashinoy",
    label: "С машиной",
    dimension: "object_tag",
    tagValue: "s_mashinoy",
    catalogHref: "/s-mashinoy",
    generateHref: "/generaciya-foto/s-mashinoy",
  },
  {
    slug: "cherno-belye",
    label: "Чёрно-белые",
    dimension: "style_tag",
    tagValue: "cherno_beloe",
    catalogHref: "/stil/cherno-beloe",
    generateHref: "/generaciya-foto/cherno-beloe",
  },
] as const satisfies readonly FotosessiiClusterChild[];

export type FotosessiiClusterChildSlug =
  (typeof PROMTY_DLYA_II_FOTOSESSII_CHILDREN)[number]["slug"];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function getPromtyDlyaIiFotosessiiChildPath(
  slug: FotosessiiClusterChildSlug
): string {
  return `${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}/${slug}`;
}

export function findPromtyDlyaIiFotosessiiChild(
  slug: string
): FotosessiiClusterChild | null {
  return (
    PROMTY_DLYA_II_FOTOSESSII_CHILDREN.find((child) => child.slug === slug) ??
    null
  );
}

export function isPromtyDlyaIiFotosessiiHubPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === PROMTY_DLYA_II_FOTOSESSII_HUB_PATH;
}

export function isPromtyDlyaIiFotosessiiPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === PROMTY_DLYA_II_FOTOSESSII_HUB_PATH) return true;
  return PROMTY_DLYA_II_FOTOSESSII_CHILDREN.some(
    (child) => normalized === getPromtyDlyaIiFotosessiiChildPath(child.slug)
  );
}

export const PROMTY_DLYA_II_FOTOSESSII_GENERATE_CTA =
  "Создать ИИ фотосессию";

/** Idle generate FAB / guest CTA on the hub and every L2 child. */
export function listingGenerateIdleCta(input: {
  pathname: string;
  isAuthed: boolean;
}): string {
  void input.isAuthed;
  if (isFotoVPromtDockPath(input.pathname)) {
    return composeGenerateCtaLabel("photo_prompt");
  }
  if (isPromtyDlyaIiFotosessiiPath(input.pathname)) {
    return PROMTY_DLYA_II_FOTOSESSII_GENERATE_CTA;
  }
  return "Создать фото";
}

export type FotosessiiChipNavItem = {
  label: string;
  href: string;
  kind: "hub" | "scenario";
  active: boolean;
};

export function getPromtyDlyaIiFotosessiiChipNavigation(
  activeSlug: string | null = null
): FotosessiiChipNavItem[] {
  const children = PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map((child) => ({
    label: child.label,
    href: getPromtyDlyaIiFotosessiiChildPath(child.slug),
    kind: "scenario" as const,
    active: child.slug === activeSlug,
  }));
  if (activeSlug == null) return children;
  return [
    {
      label: "ИИ фотосессия",
      href: PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
      kind: "hub",
      active: false,
    },
    ...children,
  ];
}

export function fotosessiiClusterSitemapPages(): {
  path: string;
  dimension: Dimension;
  tagValue: string;
}[] {
  return PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map((child) => ({
    path: getPromtyDlyaIiFotosessiiChildPath(child.slug),
    dimension: child.dimension,
    tagValue: child.tagValue,
  }));
}
