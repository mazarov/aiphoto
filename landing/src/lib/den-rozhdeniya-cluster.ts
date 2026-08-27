import {
  DIMENSION_PRIORITY,
  type Dimension,
  type TagEntry,
  findTagByLastSegment,
  findTagBySlug,
} from "./tag-registry";

export type BirthdayListingSearchFilters = {
  audience_tag?: string | null;
  style_tag?: string | null;
  occasion_tag?: string | null;
  object_tag?: string | null;
};

export const DEN_ROZHDENIYA_HUB_PATH = "/sobytiya/den-rozhdeniya";
export const DEN_ROZHDENIYA_TAG_SLUG = "den_rozhdeniya";
export const DEN_ROZHDENIYA_GENERATE_HREF = "/generaciya-foto/na-den-rozhdeniya";
export const DEN_ROZHDENIYA_GENERATE_LABEL = "Сделать фото с ИИ";
/** Shared birthday phrase for search-backed L2 that still need it. */
export const DEN_ROZHDENIYA_SEARCH_QUERY = "день рождения";

export type BirthdayClusterChild = {
  alias: string;
  dimension: Dimension;
  tagSlug: string;
  label: string;
  featured: boolean;
  /** When set, this L2 uses hybrid search instead of category tags. */
  listingQuery?: string;
};

/** Featured children first — Wordstat order. Object aliases match TAG_REGISTRY last segments. */
export const DEN_ROZHDENIYA_CHILDREN: BirthdayClusterChild[] = [
  {
    alias: "devushki",
    dimension: "audience_tag",
    tagSlug: "devushka",
    label: "Девушке",
    featured: true,
  },
  {
    alias: "deti",
    dimension: "audience_tag",
    tagSlug: "detskie",
    label: "Детям",
    featured: true,
  },
  {
    alias: "muzhchiny",
    dimension: "audience_tag",
    tagSlug: "muzhchina",
    label: "Мужчине",
    featured: true,
    listingQuery: "мужской день рождения",
  },
  {
    alias: "s-tortom",
    dimension: "object_tag",
    tagSlug: "s_tortom",
    label: "С тортом",
    featured: true,
  },
  {
    alias: "s-detskim-foto",
    dimension: "object_tag",
    tagSlug: "s_detskim_foto",
    label: "С детским фото",
    featured: true,
    listingQuery: `${DEN_ROZHDENIYA_SEARCH_QUERY} с детским фото`,
  },
  {
    alias: "s-shampanskim",
    dimension: "object_tag",
    tagSlug: "s_shampanskim",
    label: "С шампанским",
    featured: true,
    listingQuery: "с шампанским",
  },
  {
    alias: "so-lvom",
    dimension: "object_tag",
    tagSlug: "so_lvom",
    label: "Со львом",
    featured: true,
    listingQuery: "со львом",
  },
];

const AUDIENCE_SLUG_TO_ALIAS: Record<string, string> = {
  devushka: "devushki",
  muzhchina: "muzhchiny",
  detskie: "deti",
  malchik: "deti",
  devochka: "deti",
  malysh: "deti",
};

const ALIAS_TO_CHILD = new Map(
  DEN_ROZHDENIYA_CHILDREN.map((child) => [child.alias, child]),
);

const AUDIENCE_CHILDREN = DEN_ROZHDENIYA_CHILDREN.filter(
  (child) => child.dimension === "audience_tag",
);
const OBJECT_CHILDREN = DEN_ROZHDENIYA_CHILDREN.filter(
  (child) => child.dimension === "object_tag",
);

export type BirthdayPermanentRedirect = {
  source: string;
  destination: string;
};

/** Audience-first L2 → hub children. Hub itself is never redirected. */
export const DEN_ROZHDENIYA_AUDIENCE_FIRST_L2_REDIRECTS: BirthdayPermanentRedirect[] =
  [
    {
      source: "/promty-dlya-foto-devushki/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/devushki`,
    },
    {
      source: "/promty-dlya-detskih-foto/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/deti`,
    },
    {
      source: "/promty-dlya-foto-muzhchiny/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/muzhchiny`,
    },
    {
      source: "/promty-dlya-foto-malchika/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/deti`,
    },
    {
      source: "/promty-dlya-foto-devochka/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/deti`,
    },
    {
      source: "/promty-dlya-foto-malysh/den-rozhdeniya",
      destination: `${DEN_ROZHDENIYA_HUB_PATH}/deti`,
    },
  ];

/** Old audience-first L3 → audience L2 (no object segment). */
export function denRozhdeniyaAudienceFirstL3Redirects(): BirthdayPermanentRedirect[] {
  return DEN_ROZHDENIYA_AUDIENCE_FIRST_L2_REDIRECTS.flatMap((item) => {
    const audiencePath = item.source.replace(/\/den-rozhdeniya$/, "");
    return [
      {
        source: `${item.source}/:object`,
        destination: item.destination,
      },
      {
        source: `${audiencePath}/:object/den-rozhdeniya`,
        destination: item.destination,
      },
    ];
  });
}

function birthdayL2PathFromClusterTail(
  firstAlias: string,
  secondAlias: string,
): string {
  const first = findBirthdayChildByAlias(firstAlias);
  const second = findBirthdayChildByAlias(secondAlias);
  if (first?.dimension === "audience_tag") {
    return birthdayChildPath(first.alias);
  }
  if (second?.dimension === "audience_tag") {
    return birthdayChildPath(second.alias);
  }
  if (first) return birthdayChildPath(first.alias);
  return DEN_ROZHDENIYA_HUB_PATH;
}

/** Cluster L3 (and leftover 4-segment paths) → live L2. */
export function denRozhdeniyaL3ToL2Redirects(): BirthdayPermanentRedirect[] {
  const redirects: BirthdayPermanentRedirect[] = [];

  for (const audience of AUDIENCE_CHILDREN) {
    redirects.push({
      source: `${birthdayChildPath(audience.alias)}/:object`,
      destination: birthdayChildPath(audience.alias),
    });
  }

  for (const object of OBJECT_CHILDREN) {
    for (const audience of AUDIENCE_CHILDREN) {
      redirects.push({
        source: `${birthdayChildPath(object.alias)}/${audience.alias}`,
        destination: birthdayChildPath(audience.alias),
      });
    }
  }

  for (const object of OBJECT_CHILDREN) {
    redirects.push({
      source: `${birthdayChildPath(object.alias)}/:object`,
      destination: birthdayChildPath(object.alias),
    });
  }

  return redirects;
}

export function birthdayRetiredL3RedirectPath(
  slugSegments: string[],
): string | null {
  if (slugSegments.length < 4) return null;
  if (slugSegments[0] !== "sobytiya" || slugSegments[1] !== "den-rozhdeniya") {
    return null;
  }
  return birthdayL2PathFromClusterTail(slugSegments[2], slugSegments[3]);
}

export const DEN_ROZHDENIYA_PERMANENT_REDIRECTS: BirthdayPermanentRedirect[] = [
  ...DEN_ROZHDENIYA_AUDIENCE_FIRST_L2_REDIRECTS,
  ...denRozhdeniyaAudienceFirstL3Redirects(),
  ...denRozhdeniyaL3ToL2Redirects(),
];

export type BirthdaySitemapPage = {
  path: string;
  query: string;
  filters: BirthdayListingSearchFilters;
  level: 1 | 2;
};

/** Search-backed L2 only. Hub and tag L2 come from the catalog sitemap. L3 is retired. */
export function birthdayClusterSitemapPages(): BirthdaySitemapPage[] {
  return DEN_ROZHDENIYA_CHILDREN.filter((child) => child.listingQuery).map(
    (child) => ({
      path: birthdayChildPath(child.alias),
      query: child.listingQuery as string,
      filters: {},
      level: 2 as const,
    }),
  );
}

export function isDenRozhdeniyaHubPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return normalized === DEN_ROZHDENIYA_HUB_PATH;
}

export function isDenRozhdeniyaClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return (
    normalized === DEN_ROZHDENIYA_HUB_PATH ||
    normalized.startsWith(`${DEN_ROZHDENIYA_HUB_PATH}/`)
  );
}

export function findBirthdayChildByAlias(
  alias: string,
): BirthdayClusterChild | null {
  return ALIAS_TO_CHILD.get(alias) ?? null;
}

export function birthdayAliasForAudienceSlug(slug: string): string | null {
  return AUDIENCE_SLUG_TO_ALIAS[slug] ?? null;
}

export function birthdayChildPath(alias: string): string {
  return `${DEN_ROZHDENIYA_HUB_PATH}/${alias}`;
}

export function isFeaturedBirthdayChildAlias(alias: string): boolean {
  return DEN_ROZHDENIYA_CHILDREN.some(
    (child) => child.featured && child.alias === alias
  );
}

export function getFeaturedBirthdayNavItems(activeAlias?: string | null): {
  label: string;
  href: string;
  active?: boolean;
}[] {
  const items = DEN_ROZHDENIYA_CHILDREN.filter((child) => child.featured).map(
    (child) => ({
      label: child.label,
      href: birthdayChildPath(child.alias),
      active: child.alias === activeAlias,
    }),
  );
  items.unshift({
    label: "Все",
    href: DEN_ROZHDENIYA_HUB_PATH,
    active: !activeAlias,
  });
  return items;
}

function lastSegment(tag: TagEntry): string {
  return tag.urlPath.split("/").filter(Boolean).pop() ?? tag.slug;
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function seoComboKey(tags: TagEntry[]): string {
  return [...tags]
    .sort(
      (a, b) =>
        DIMENSION_PRIORITY.indexOf(a.dimension) -
        DIMENSION_PRIORITY.indexOf(b.dimension),
    )
    .map((tag) => tag.slug)
    .join("+");
}

function occasionTag(tags: TagEntry[]): TagEntry | null {
  return (
    tags.find(
      (tag) =>
        tag.dimension === "occasion_tag" && tag.slug === DEN_ROZHDENIYA_TAG_SLUG,
    ) ?? null
  );
}

/**
 * Occasion-first canonical. Audience + object (old L3) collapses to audience L2.
 * Object × object collapses to the first object L2.
 */
export function buildBirthdayClusterCanonical(
  tags: TagEntry[],
): string | null {
  const occasion = occasionTag(tags);
  if (!occasion) return null;

  const others = tags.filter((tag) => tag !== occasion);
  if (others.length === 0) return DEN_ROZHDENIYA_HUB_PATH;

  const audience = others.find((tag) => tag.dimension === "audience_tag");
  const audienceAlias = audience
    ? birthdayAliasForAudienceSlug(audience.slug)
    : null;
  if (audienceAlias) return birthdayChildPath(audienceAlias);

  const first = others[0];
  const featured = DEN_ROZHDENIYA_CHILDREN.find(
    (child) => child.tagSlug === first.slug,
  );
  return birthdayChildPath(featured?.alias ?? lastSegment(first));
}

export type BirthdayResolvedCluster = {
  tags: TagEntry[];
  level: 2;
  canonicalPath: string;
  parentPath: string;
  primaryTag: TagEntry;
};

function tagForBirthdaySegment(
  segment: string,
  excludeDimensions: Dimension[],
): TagEntry | null {
  const child = findBirthdayChildByAlias(segment);
  if (child) {
    return findTagBySlug(child.dimension, child.tagSlug);
  }
  return findTagByLastSegment(segment, excludeDimensions);
}

/**
 * Resolve /sobytiya/den-rozhdeniya/{alias}.
 * 4+ segments are retired L3 — callers 301 via birthdayRetiredL3RedirectPath.
 */
export function resolveDenRozhdeniyaClusterSegments(
  slugSegments: string[],
): BirthdayResolvedCluster | null {
  if (slugSegments.length !== 3) return null;
  if (slugSegments[0] !== "sobytiya" || slugSegments[1] !== "den-rozhdeniya") {
    return null;
  }

  const hub = findTagBySlug("occasion_tag", DEN_ROZHDENIYA_TAG_SLUG);
  if (!hub) return null;

  const childTag = tagForBirthdaySegment(slugSegments[2], [hub.dimension]);
  if (!childTag) return null;

  const tags = [hub, childTag];
  return {
    tags,
    level: 2,
    canonicalPath:
      buildBirthdayClusterCanonical(tags) ?? birthdayChildPath(slugSegments[2]),
    parentPath: DEN_ROZHDENIYA_HUB_PATH,
    primaryTag: hub,
  };
}

export function normalizeListingSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function birthdayChildForListingTags(
  tags: TagEntry[],
): BirthdayClusterChild | null {
  const occasion = occasionTag(tags);
  if (!occasion) return null;
  const others = tags.filter((tag) => tag !== occasion);
  if (others.length !== 1) return null;
  const only = others[0];
  return (
    DEN_ROZHDENIYA_CHILDREN.find((child) => child.tagSlug === only.slug) ??
    (only.dimension === "audience_tag"
      ? findBirthdayChildByAlias(birthdayAliasForAudienceSlug(only.slug) ?? "")
      : null)
  );
}

export function birthdayListingSearchFilters(
  tags: TagEntry[],
): BirthdayListingSearchFilters {
  if (birthdayListingSearchQuery(tags)) return {};
  if (!occasionTag(tags)) return {};

  const others = tags.filter(
    (tag) =>
      !(
        tag.dimension === "occasion_tag" &&
        tag.slug === DEN_ROZHDENIYA_TAG_SLUG
      ),
  );
  const filters: BirthdayListingSearchFilters = {};
  const audience = others.find((tag) => tag.dimension === "audience_tag");
  const object = others.find((tag) => tag.dimension === "object_tag");
  if (audience) filters.audience_tag = audience.slug;
  else if (object) filters.object_tag = object.slug;
  return filters;
}

export function birthdayListingSearchFilterKey(
  filters: BirthdayListingSearchFilters,
): string {
  return [
    filters.audience_tag ?? "",
    filters.style_tag ?? "",
    filters.occasion_tag ?? "",
    filters.object_tag ?? "",
  ].join("|");
}

/** All SSOT listing queries that may use hybrid search / result cache. */
export function birthdayListingSearchQueries(): string[] {
  return DEN_ROZHDENIYA_CHILDREN.flatMap((child) =>
    child.listingQuery ? [child.listingQuery] : [],
  );
}

let listingSearchAllowlist: Set<string> | null = null;

export function isBirthdayListingSearchQuery(query: string): boolean {
  const normalized = normalizeListingSearchQuery(query);
  if (!normalized) return false;
  if (!listingSearchAllowlist) {
    listingSearchAllowlist = new Set(
      birthdayListingSearchQueries().map(normalizeListingSearchQuery),
    );
  }
  return listingSearchAllowlist.has(normalized);
}

/**
 * Hub and girl/kids/cake L2 use category tags.
 * Weak L2 (man / then-now / champagne / lion) stay search-backed.
 */
export function birthdayListingSearchQuery(tags: TagEntry[]): string | null {
  return birthdayChildForListingTags(tags)?.listingQuery ?? null;
}

export function birthdayActiveAliasFromTags(tags: TagEntry[]): string | null {
  const audience = tags.find((tag) => tag.dimension === "audience_tag");
  if (audience) {
    return birthdayAliasForAudienceSlug(audience.slug);
  }
  const object = tags.find((tag) => tag.dimension === "object_tag");
  if (!object) return null;
  return (
    DEN_ROZHDENIYA_CHILDREN.find((child) => child.tagSlug === object.slug)
      ?.alias ?? lastSegment(object)
  );
}
