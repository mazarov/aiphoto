/**
 * Chip / theme order = Webmaster demand on the catalog listing for the same tag.
 * `/generaciya-foto/*` has no query-analytics yet; source is the 2026-08-14…20
 * window in `seo-watchlist-snapshot.json` (`current.impressions`).
 * Anime has no listing in the snapshot → last.
 */
export const GENERACIYA_FOTO_SCENARIO_ROUTES = [
  {
    slug: "pary",
    label: "Для пар",
    dimension: "audience_tag",
    tagValue: "para",
  },
  {
    slug: "devushki",
    label: "Для девушек",
    dimension: "audience_tag",
    tagValue: "devushka",
  },
  {
    slug: "na-den-rozhdeniya",
    label: "На день рождения",
    dimension: "occasion_tag",
    tagValue: "den_rozhdeniya",
  },
  {
    slug: "muzhchiny",
    label: "Для мужчин",
    dimension: "audience_tag",
    tagValue: "muzhchina",
  },
  {
    slug: "semya",
    label: "Для семьи",
    dimension: "audience_tag",
    tagValue: "semya",
  },
  {
    slug: "deti",
    label: "Для детей",
    dimension: "audience_tag",
    tagValue: "detskie",
  },
  {
    slug: "v-forme",
    label: "В форме",
    dimension: "object_tag",
    tagValue: "v_forme",
  },
  {
    slug: "s-mashinoy",
    label: "С машиной",
    dimension: "object_tag",
    tagValue: "s_mashinoy",
  },
  {
    slug: "malysh",
    label: "Малыш",
    dimension: "audience_tag",
    tagValue: "malysh",
  },
  {
    slug: "studiynoe",
    label: "Студийное",
    dimension: "style_tag",
    tagValue: "studiynoe",
  },
  {
    slug: "na-more",
    label: "На море",
    dimension: "object_tag",
    tagValue: "na_more",
  },
  {
    slug: "s-podrugoy",
    label: "С подругой",
    dimension: "audience_tag",
    tagValue: "s_podrugoy",
  },
  {
    slug: "s-dochkoy",
    label: "С дочкой",
    dimension: "audience_tag",
    tagValue: "s_dochkoy",
  },
  {
    slug: "selfi",
    label: "Селфи",
    dimension: "style_tag",
    tagValue: "selfi",
  },
  {
    slug: "beremennaya",
    label: "Беременная",
    dimension: "audience_tag",
    tagValue: "beremennaya",
  },
  {
    slug: "cherno-beloe",
    label: "Чёрно-белое",
    dimension: "style_tag",
    tagValue: "cherno_beloe",
  },
  {
    slug: "portret",
    label: "Портрет",
    dimension: "style_tag",
    tagValue: "portret",
  },
  {
    slug: "s-mamoy",
    label: "С мамой",
    dimension: "audience_tag",
    tagValue: "s_mamoy",
  },
  {
    slug: "s-shampanskim",
    label: "С шампанским",
    dimension: "object_tag",
    tagValue: "s_shampanskim",
  },
  {
    slug: "v-zerkale",
    label: "В зеркале",
    dimension: "object_tag",
    tagValue: "v_zerkale",
  },
  {
    slug: "kollazh",
    label: "Коллаж",
    dimension: "style_tag",
    tagValue: "kollazh",
  },
  {
    slug: "anime",
    label: "Аниме",
    dimension: "style_tag",
    tagValue: "anime",
  },
] as const;

export type GeneraciyaFotoScenarioRoute =
  (typeof GENERACIYA_FOTO_SCENARIO_ROUTES)[number];
export type GeneraciyaFotoScenarioSlug = GeneraciyaFotoScenarioRoute["slug"];

export const MIN_GENERACIYA_FOTO_SCENARIO_CARDS = 8;

/**
 * Section `/generaciya/*` (2026-09-28). One URL per generation mode:
 * - `foto-po-opisaniyu` — text-only, owns «фото по описанию / по промту»;
 * - `kartinka-po-opisaniyu` — text-only, owns «картинка / изображение по описанию»;
 * - `po-foto` — with the user's photo, hub of the 22 scenarios.
 * Legacy `/generaciya-foto` and `/generaciya-foto/<slug>` are 301 (see
 * `generaciyaLegacyRedirectPath`).
 */
export const GENERACIYA_SECTION_PATH = "/generaciya";
export const GENERACIYA_FOTO_PO_OPISANIYU_PATH = `${GENERACIYA_SECTION_PATH}/foto-po-opisaniyu`;
export const GENERACIYA_KARTINKA_PO_OPISANIYU_PATH = `${GENERACIYA_SECTION_PATH}/kartinka-po-opisaniyu`;
export const GENERACIYA_PO_FOTO_PATH = `${GENERACIYA_SECTION_PATH}/po-foto`;
export const LEGACY_GENERACIYA_FOTO_PATH = "/generaciya-foto";

export function getGeneraciyaFotoScenarioPath(
  slug: GeneraciyaFotoScenarioSlug
): string {
  return `${GENERACIYA_PO_FOTO_PATH}/${slug}`;
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/** Exact 301 target for pre-section URLs; `null` when the path is not legacy. */
export function generaciyaLegacyRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  if (normalized === LEGACY_GENERACIYA_FOTO_PATH) {
    return GENERACIYA_FOTO_PO_OPISANIYU_PATH;
  }
  if (normalized === GENERACIYA_SECTION_PATH) {
    return GENERACIYA_FOTO_PO_OPISANIYU_PATH;
  }
  const prefix = `${LEGACY_GENERACIYA_FOTO_PATH}/`;
  if (normalized.startsWith(prefix)) {
    const slug = normalized.slice(prefix.length);
    if (slug && !slug.includes("/") && findGeneraciyaFotoScenarioRoute(slug)) {
      return getGeneraciyaFotoScenarioPath(slug as GeneraciyaFotoScenarioSlug);
    }
    return GENERACIYA_PO_FOTO_PATH;
  }
  return null;
}

/** Text-only and photo hubs of the section (not the scenario children). */
export function isGeneraciyaHubPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === GENERACIYA_FOTO_PO_OPISANIYU_PATH ||
    normalized === GENERACIYA_KARTINKA_PO_OPISANIYU_PATH ||
    normalized === GENERACIYA_PO_FOTO_PATH
  );
}

export function findGeneraciyaFotoScenarioRoute(
  slug: string
): GeneraciyaFotoScenarioRoute | null {
  return (
    GENERACIYA_FOTO_SCENARIO_ROUTES.find((route) => route.slug === slug) ??
    null
  );
}

export function findGeneraciyaFotoScenarioByTag(
  dimension: string,
  tagValue: string
): GeneraciyaFotoScenarioRoute | null {
  return (
    GENERACIYA_FOTO_SCENARIO_ROUTES.find(
      (route) => route.dimension === dimension && route.tagValue === tagValue
    ) ?? null
  );
}

export function isGeneraciyaFotoScenarioPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);

  return GENERACIYA_FOTO_SCENARIO_ROUTES.some(
    (route) => normalized === getGeneraciyaFotoScenarioPath(route.slug)
  );
}
