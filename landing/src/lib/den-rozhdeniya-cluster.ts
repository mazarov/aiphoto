import {
  DIMENSION_PRIORITY,
  type Dimension,
  type TagEntry,
  findTagByLastSegment,
  findTagBySlug,
} from "./tag-registry";

export const DEN_ROZHDENIYA_HUB_PATH = "/sobytiya/den-rozhdeniya";
export const DEN_ROZHDENIYA_TAG_SLUG = "den_rozhdeniya";
export const DEN_ROZHDENIYA_GENERATE_HREF = "/generaciya-foto/na-den-rozhdeniya";
export const DEN_ROZHDENIYA_GENERATE_LABEL = "Сделать фото с ИИ";
/** Hub listing query. Children append `searchPhrase`. */
export const DEN_ROZHDENIYA_SEARCH_QUERY = "день рождения";

export type BirthdayClusterChild = {
  alias: string;
  dimension: Dimension;
  tagSlug: string;
  label: string;
  featured: boolean;
  searchPhrase: string;
  /** L2 listing uses this phrase as-is, without prefix «день рождения». */
  searchStandalone?: boolean;
  /** Full L2 listing query. When set, does not use «день рождения» + searchPhrase. */
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
    searchPhrase: "девушке",
  },
  {
    alias: "deti",
    dimension: "audience_tag",
    tagSlug: "detskie",
    label: "Детям",
    featured: true,
    searchPhrase: "ребенка",
  },
  {
    alias: "muzhchiny",
    dimension: "audience_tag",
    tagSlug: "muzhchina",
    label: "Мужчине",
    featured: true,
    searchPhrase: "мужчине",
    listingQuery: "мужской день рождения",
  },
  {
    alias: "s-tortom",
    dimension: "object_tag",
    tagSlug: "s_tortom",
    label: "С тортом",
    featured: true,
    searchPhrase: "с тортом",
    searchStandalone: true,
  },
  {
    alias: "s-detskim-foto",
    dimension: "object_tag",
    tagSlug: "s_detskim_foto",
    label: "С детским фото",
    featured: true,
    searchPhrase: "с детским фото",
  },
  {
    alias: "s-shampanskim",
    dimension: "object_tag",
    tagSlug: "s_shampanskim",
    label: "С шампанским",
    featured: true,
    searchPhrase: "с шампанским",
    searchStandalone: true,
  },
  {
    alias: "so-lvom",
    dimension: "object_tag",
    tagSlug: "so_lvom",
    label: "Со львом",
    featured: true,
    searchPhrase: "со львом",
    searchStandalone: true,
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

/** L3: occasion in the middle or last → same hub child + object. */
export function denRozhdeniyaAudienceFirstL3Redirects(): BirthdayPermanentRedirect[] {
  return DEN_ROZHDENIYA_AUDIENCE_FIRST_L2_REDIRECTS.flatMap((item) => {
    const audiencePath = item.source.replace(/\/den-rozhdeniya$/, "");
    return [
      {
        source: `${item.source}/:object`,
        destination: `${item.destination}/:object`,
      },
      {
        source: `${audiencePath}/:object/den-rozhdeniya`,
        destination: `${item.destination}/:object`,
      },
    ];
  });
}

export const DEN_ROZHDENIYA_PERMANENT_REDIRECTS: BirthdayPermanentRedirect[] = [
  ...DEN_ROZHDENIYA_AUDIENCE_FIRST_L2_REDIRECTS,
  ...denRozhdeniyaAudienceFirstL3Redirects(),
];

export type BirthdaySitemapPage = {
  path: string;
  query: string;
  level: 1 | 2 | 3;
};

/** Hub + featured children + audience×object L3. Sitemap gates by search hits. */
export function birthdayClusterSitemapPages(): BirthdaySitemapPage[] {
  const occasion = findTagBySlug("occasion_tag", DEN_ROZHDENIYA_TAG_SLUG);
  const pages: BirthdaySitemapPage[] = [
    {
      path: DEN_ROZHDENIYA_HUB_PATH,
      query: DEN_ROZHDENIYA_SEARCH_QUERY,
      level: 1,
    },
  ];
  if (!occasion) return pages;

  const childRows = DEN_ROZHDENIYA_CHILDREN.map((child) => ({
    child,
    tag: findTagBySlug(child.dimension, child.tagSlug),
  })).filter(
    (row): row is { child: BirthdayClusterChild; tag: TagEntry } =>
      Boolean(row.tag),
  );

  for (const { child, tag } of childRows) {
    const query = birthdayListingSearchQuery([occasion, tag]);
    if (!query) continue;
    pages.push({
      path: birthdayChildPath(child.alias),
      query,
      level: 2,
    });
  }

  const audienceRows = childRows.filter(
    (row) => row.child.dimension === "audience_tag",
  );
  const objectRows = childRows.filter(
    (row) => row.child.dimension === "object_tag",
  );
  for (const audience of audienceRows) {
    for (const object of objectRows) {
      const query = birthdayListingSearchQuery([
        occasion,
        audience.tag,
        object.tag,
      ]);
      if (!query) continue;
      pages.push({
        path: `${birthdayChildPath(audience.child.alias)}/${object.child.alias}`,
        query,
        level: 3,
      });
    }
  }

  return pages;
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

/** Occasion-first canonical only when the combo includes день рождения. */
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

  const rest = (audienceAlias
    ? others.filter((tag) => tag !== audience)
    : others
  ).sort((a, b) => a.dimension.localeCompare(b.dimension));

  const segments = [
    DEN_ROZHDENIYA_HUB_PATH,
    ...(audienceAlias ? [audienceAlias] : []),
    ...rest.map((tag) => {
      const featured = DEN_ROZHDENIYA_CHILDREN.find(
        (child) => child.tagSlug === tag.slug,
      );
      return featured?.alias ?? lastSegment(tag);
    }),
  ];

  return segments.join("/").replace(/\/{2,}/g, "/");
}

export type BirthdayResolvedCluster = {
  tags: TagEntry[];
  level: 2 | 3;
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
 * Resolve /sobytiya/den-rozhdeniya/{alias}[/{object}].
 * Hub (2 segments) is left to the generic L1 resolver.
 */
export function resolveDenRozhdeniyaClusterSegments(
  slugSegments: string[],
): BirthdayResolvedCluster | null {
  if (slugSegments.length < 3) return null;
  if (slugSegments[0] !== "sobytiya" || slugSegments[1] !== "den-rozhdeniya") {
    return null;
  }
  if (slugSegments.length > 4) return null;

  const hub = findTagBySlug("occasion_tag", DEN_ROZHDENIYA_TAG_SLUG);
  if (!hub) return null;

  const childTag = tagForBirthdaySegment(slugSegments[2], [hub.dimension]);
  if (!childTag) return null;

  if (slugSegments.length === 3) {
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

  const thirdTag = tagForBirthdaySegment(slugSegments[3], [
    hub.dimension,
    childTag.dimension,
  ]);
  if (!thirdTag) return null;

  const tags = [hub, childTag, thirdTag];
  return {
    tags,
    level: 3,
    canonicalPath:
      buildBirthdayClusterCanonical(tags) ??
      `${birthdayChildPath(slugSegments[2])}/${slugSegments[3]}`,
    parentPath: DEN_ROZHDENIYA_HUB_PATH,
    primaryTag: hub,
  };
}

function searchPhraseForTag(tag: TagEntry): string {
  const bySlug = DEN_ROZHDENIYA_CHILDREN.find((child) => child.tagSlug === tag.slug);
  if (bySlug) return bySlug.searchPhrase;

  if (tag.dimension === "audience_tag") {
    const alias = birthdayAliasForAudienceSlug(tag.slug);
    const byAlias = alias ? findBirthdayChildByAlias(alias) : null;
    if (byAlias) return byAlias.searchPhrase;
  }

  return tag.labelRu.trim().toLowerCase();
}

/**
 * Text query that drives the birthday listing grid.
 * Null outside the occasion combo — callers fall back to tag RPC.
 */
export function normalizeListingSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** All SSOT listing queries that may use hybrid search / result cache. */
export function birthdayListingSearchQueries(): string[] {
  const occasion = findTagBySlug("occasion_tag", DEN_ROZHDENIYA_TAG_SLUG);
  const queries = new Set<string>([DEN_ROZHDENIYA_SEARCH_QUERY]);
  if (!occasion) return [...queries];

  const childTags = DEN_ROZHDENIYA_CHILDREN.map((child) => ({
    child,
    tag: findTagBySlug(child.dimension, child.tagSlug),
  })).filter(
    (row): row is { child: BirthdayClusterChild; tag: TagEntry } =>
      Boolean(row.tag),
  );

  for (const { tag } of childTags) {
    const query = birthdayListingSearchQuery([occasion, tag]);
    if (query) queries.add(query);
  }

  const audienceTags = childTags.filter(
    (row) => row.child.dimension === "audience_tag",
  );
  const objectTags = childTags.filter(
    (row) => row.child.dimension === "object_tag",
  );
  for (const audience of audienceTags) {
    for (const object of objectTags) {
      const query = birthdayListingSearchQuery([
        occasion,
        audience.tag,
        object.tag,
      ]);
      if (query) queries.add(query);
    }
  }

  return [...queries];
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

export function birthdayListingSearchQuery(tags: TagEntry[]): string | null {
  const occasion = occasionTag(tags);
  if (!occasion) return null;

  const others = tags.filter((tag) => tag !== occasion);
  if (others.length === 0) return DEN_ROZHDENIYA_SEARCH_QUERY;

  if (others.length === 1) {
    const only = others[0];
    const child = DEN_ROZHDENIYA_CHILDREN.find(
      (item) => item.tagSlug === only.slug,
    );
    if (child?.listingQuery) return child.listingQuery;
    if (child?.searchStandalone) return child.searchPhrase;
  }

  const phrases = others.map(searchPhraseForTag).filter(Boolean);
  return [DEN_ROZHDENIYA_SEARCH_QUERY, ...phrases].join(" ").replace(/\s+/g, " ").trim();
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
