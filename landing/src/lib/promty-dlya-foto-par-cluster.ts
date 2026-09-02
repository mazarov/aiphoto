import type { Dimension } from "./tag-registry";

export const PROMTY_DLYA_FOTO_PAR_HUB_PATH = "/promty-dlya-foto-par";
export const GENERACIYA_FOTO_PARY_PATH = "/generaciya-foto/pary";

export const PAIRS_PROMPT_SITELINK_PATHS = [
  "/promty-dlya-foto-s-parnem",
  "/promty-dlya-foto-s-muzhem",
  "/promty-dlya-foto-vlyublennykh",
] as const;

export type PairsClusterChild = {
  alias: string;
  dimension: Dimension;
  tagSlug: string;
  label: string;
};

/** Featured children under H1 — live 200 pages, no wedding / 14 февраля. */
export const PROMTY_DLYA_FOTO_PAR_FEATURED_CHILDREN: PairsClusterChild[] = [
  {
    alias: "portret",
    dimension: "style_tag",
    tagSlug: "portret",
    label: "Портрет",
  },
  {
    alias: "realistichnoe",
    dimension: "style_tag",
    tagSlug: "realistichnoe",
    label: "Реалистичное",
  },
  {
    alias: "cherno-beloe",
    dimension: "style_tag",
    tagSlug: "cherno_beloe",
    label: "Чёрно-белое",
  },
  {
    alias: "na-more",
    dimension: "object_tag",
    tagSlug: "na_more",
    label: "На море",
  },
  {
    alias: "v-mashine",
    dimension: "object_tag",
    tagSlug: "v_mashine",
    label: "В машине",
  },
  {
    alias: "studiynoe",
    dimension: "style_tag",
    tagSlug: "studiynoe",
    label: "Студийное",
  },
  {
    alias: "romanticheskiy",
    dimension: "style_tag",
    tagSlug: "romanticheskiy",
    label: "Романтический",
  },
  {
    alias: "s-cvetami",
    dimension: "object_tag",
    tagSlug: "s_cvetami",
    label: "С цветами",
  },
  {
    alias: "na-ulice",
    dimension: "object_tag",
    tagSlug: "na_ulice",
    label: "На улице",
  },
  {
    alias: "v-interere",
    dimension: "object_tag",
    tagSlug: "v_interere",
    label: "В интерьере",
  },
];

const FEATURED_ALIASES = new Set(
  PROMTY_DLYA_FOTO_PAR_FEATURED_CHILDREN.map((child) => child.alias),
);

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

export function isPairsPromptAdLandingPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  if (isPromtyDlyaFotoParClusterPath(normalized)) return true;
  return (PAIRS_PROMPT_SITELINK_PATHS as readonly string[]).includes(normalized);
}

export function isGeneraciyaFotoParyPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === GENERACIYA_FOTO_PARY_PATH;
}

export function pairsChildPath(alias: string): string {
  return `${PROMTY_DLYA_FOTO_PAR_HUB_PATH}/${alias}`;
}

export function pairsActiveAliasFromPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (!normalized.startsWith(`${PROMTY_DLYA_FOTO_PAR_HUB_PATH}/`)) return null;
  const rest = normalized.slice(PROMTY_DLYA_FOTO_PAR_HUB_PATH.length + 1);
  const alias = rest.split("/")[0] ?? "";
  return FEATURED_ALIASES.has(alias) ? alias : alias || null;
}

export function isFeaturedPairsChildAlias(alias: string): boolean {
  return FEATURED_ALIASES.has(alias);
}

export function getFeaturedPairsNavItems(activeAlias?: string | null): {
  label: string;
  href: string;
  active?: boolean;
}[] {
  const items = PROMTY_DLYA_FOTO_PAR_FEATURED_CHILDREN.map((child) => ({
    label: child.label,
    href: pairsChildPath(child.alias),
    active: child.alias === activeAlias,
  }));
  items.unshift({
    label: "Все",
    href: PROMTY_DLYA_FOTO_PAR_HUB_PATH,
    active: !activeAlias,
  });
  return items;
}
