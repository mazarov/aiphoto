import { takeHeroMarqueeCards } from "./hero-marquee";
import type { SeoContent } from "./seo-content";

export const DEN_UCHITELYA_HUB_PATH = "/promty-dlya-foto/den-uchitelya";
export const DEN_VOSPITATELYA_HUB_PATH = "/promty-dlya-foto/den-vospitatelya";

const SCHOOL_DAY_COUNT_TOKEN = "{N}+";
const SCHOOL_DAY_HERO_CARD_LIMIT = 16;

export type SchoolDayHubSpec = {
  slug: "den_uchitelya" | "den_vospitatelya";
  hubPath: string;
  label: string;
  loadMoreLabel: string;
  generateCta: string;
  heroAriaLabel: string;
};

/** New occasion hubs. No legacy path, no subplot chips until the tag has cards. */
export const SCHOOL_DAY_HUB_SPECS: readonly SchoolDayHubSpec[] = [
  {
    slug: "den_uchitelya",
    hubPath: DEN_UCHITELYA_HUB_PATH,
    label: "День учителя",
    loadMoreLabel: "Больше промтов ко дню учителя",
    generateCta: "Создать фото ко дню учителя",
    heroAriaLabel: "Примеры фото ко дню учителя",
  },
  {
    slug: "den_vospitatelya",
    hubPath: DEN_VOSPITATELYA_HUB_PATH,
    label: "День воспитателя",
    loadMoreLabel: "Больше промтов ко дню воспитателя",
    generateCta: "Создать фото ко дню воспитателя",
    heroAriaLabel: "Примеры фото ко дню воспитателя",
  },
];

const SPEC_BY_HUB = new Map(SCHOOL_DAY_HUB_SPECS.map((spec) => [spec.hubPath, spec]));
const SPEC_BY_SLUG = new Map<string, SchoolDayHubSpec>(
  SCHOOL_DAY_HUB_SPECS.map((spec) => [spec.slug, spec]),
);

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function schoolDayHubSpec(pathname: string): SchoolDayHubSpec | null {
  return SPEC_BY_HUB.get(stripTrailingSlash(pathname)) ?? null;
}

/** Carousel stays on the occasion tag. Query filters on the page do not leak in. */
export function schoolDayHubHeroFetchParams(slug: string) {
  return (_routeParams: {
    audience_tag: string | null;
    style_tag: string | null;
    occasion_tag: string | null;
    object_tag: string | null;
    doc_task_tag: string | null;
  }) => ({
    audience_tag: null,
    style_tag: null,
    occasion_tag: slug,
    object_tag: null,
    doc_task_tag: null,
    limit: SCHOOL_DAY_HERO_CARD_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  });
}

export function toSchoolDayHeroCarouselCards<T extends { photoUrl: string | null }>(
  cards: readonly T[],
): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

/** Subplot chips wait until the tagged set has cards. */
export function schoolDayFilterNav(): { label: string; href: string; active: boolean }[] {
  return [];
}

export function isSchoolDayClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return SCHOOL_DAY_HUB_SPECS.some(
    (spec) => normalized === spec.hubPath || normalized.startsWith(`${spec.hubPath}/`),
  );
}

/** Extra segments under the hub 301 back. There is no old URL. */
export function schoolDayChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  for (const spec of SCHOOL_DAY_HUB_SPECS) {
    if (normalized === spec.hubPath) continue;
    if (normalized.startsWith(`${spec.hubPath}/`)) return spec.hubPath;
  }
  return null;
}

/**
 * `{N}+` in Title, description and intro is the live listing count.
 * An empty tag does not publish a made-up volume.
 */
export function applySchoolDayListingCount(
  seo: SeoContent,
  slug: string,
  count: number,
): SeoContent {
  if (!SPEC_BY_SLUG.has(slug)) return seo;
  const volume = Number.isFinite(count) && count >= 1 ? `${Math.floor(count)}+` : null;
  const fill = (value: string) => {
    if (!value.includes(SCHOOL_DAY_COUNT_TOKEN)) return value;
    if (volume) return value.replaceAll(SCHOOL_DAY_COUNT_TOKEN, volume);
    const stripped = value.replaceAll(
      `${SCHOOL_DAY_COUNT_TOKEN} готовых промтов`,
      "готовые промты",
    );
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  };
  return {
    ...seo,
    metaTitle: fill(seo.metaTitle),
    metaDescription: fill(seo.metaDescription),
    intro: fill(seo.intro),
  };
}
