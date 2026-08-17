export const GENERACIYA_FOTO_SCENARIO_ROUTES = [
  {
    slug: "pary",
    label: "Для пар",
    dimension: "audience_tag",
    tagValue: "para",
  },
  {
    slug: "na-den-rozhdeniya",
    label: "На день рождения",
    dimension: "occasion_tag",
    tagValue: "den_rozhdeniya",
  },
  {
    slug: "semya",
    label: "Для семьи",
    dimension: "audience_tag",
    tagValue: "semya",
  },
  {
    slug: "devushki",
    label: "Для девушек",
    dimension: "audience_tag",
    tagValue: "devushka",
  },
  {
    slug: "s-mashinoy",
    label: "С машиной",
    dimension: "object_tag",
    tagValue: "s_mashinoy",
  },
  {
    slug: "muzhchiny",
    label: "Для мужчин",
    dimension: "audience_tag",
    tagValue: "muzhchina",
  },
  {
    slug: "malysh",
    label: "Малыш",
    dimension: "audience_tag",
    tagValue: "malysh",
  },
  {
    slug: "v-forme",
    label: "В форме",
    dimension: "object_tag",
    tagValue: "v_forme",
  },
  {
    slug: "deti",
    label: "Для детей",
    dimension: "audience_tag",
    tagValue: "detskie",
  },
  {
    slug: "s-dochkoy",
    label: "С дочкой",
    dimension: "audience_tag",
    tagValue: "s_dochkoy",
  },
  {
    slug: "na-more",
    label: "На море",
    dimension: "object_tag",
    tagValue: "na_more",
  },
  {
    slug: "s-mamoy",
    label: "С мамой",
    dimension: "audience_tag",
    tagValue: "s_mamoy",
  },
  {
    slug: "cherno-beloe",
    label: "Чёрно-белое",
    dimension: "style_tag",
    tagValue: "cherno_beloe",
  },
  {
    slug: "s-podrugoy",
    label: "С подругой",
    dimension: "audience_tag",
    tagValue: "s_podrugoy",
  },
  {
    slug: "s-shampanskim",
    label: "С шампанским",
    dimension: "object_tag",
    tagValue: "s_shampanskim",
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
    slug: "studiynoe",
    label: "Студийное",
    dimension: "style_tag",
    tagValue: "studiynoe",
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
    slug: "portret",
    label: "Портрет",
    dimension: "style_tag",
    tagValue: "portret",
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

export function getGeneraciyaFotoScenarioPath(
  slug: GeneraciyaFotoScenarioSlug
): string {
  return `/generaciya-foto/${slug}`;
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
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return GENERACIYA_FOTO_SCENARIO_ROUTES.some(
    (route) => normalized === getGeneraciyaFotoScenarioPath(route.slug)
  );
}
