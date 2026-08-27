import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  fetchRouteCards,
  enrichCardsWithDetails,
  getIndexableTagCombos,
  getFirstCardPhotoUrl,
  type RouteCardsResult,
  type PromptCardFull,
} from "@/lib/supabase";
import { parseListingSort } from "@/lib/listing-sort";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { ListingClusterChipGroup } from "@/components/ListingClusterChipGroup";
import { ListingHomeBackLink } from "@/components/ListingHomeBackLink";
import { PageLayout } from "@/components/PageLayout";
import {
  getSiblingTags,
  DIMENSION_LABELS,
  findTagBySlug,
  type Dimension,
  type TagEntry,
  DIMENSION_PRIORITY,
} from "@/lib/tag-registry";
import { buildCanonicalPath, resolveUrlToTags, getMinCardsForLevel, type ResolvedRoute } from "@/lib/route-resolver";
import { getClusterChipNavigation } from "@/lib/menu";
import { getSeoForRoute } from "@/lib/seo-templates";
import type { SeoContent } from "@/lib/seo-content";
import {
  birthdayActiveAliasFromTags,
  birthdayListingSearchFilterKey,
  birthdayListingSearchFilters,
  birthdayListingSearchQuery,
  birthdayRetiredL3RedirectPath,
  getFeaturedBirthdayNavItems,
  isDenRozhdeniyaClusterPath,
  isDenRozhdeniyaHubPath,
  isFeaturedBirthdayChildAlias,
  type BirthdayListingSearchFilters,
} from "@/lib/den-rozhdeniya-cluster";
import { uniqueListingChipsByHref } from "@/lib/listing-cluster-chips";
import {
  getFeaturedPairsNavItems,
  isFeaturedPairsChildAlias,
  isPromtyDlyaFotoParClusterPath,
  pairsActiveAliasFromPath,
} from "@/lib/promty-dlya-foto-par-cluster";
import {
  resolveSeoIllustrations,
  type ResolvedSeoIllustration,
} from "@/lib/seo-illustrations";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";
import {
  LISTING_SEARCH_PAGE_SIZE,
  LISTING_SSR_INITIAL_LIMIT,
} from "@/lib/listing-pagination";
import {
  logListingHybridSearch,
  searchListingCardsHybrid,
} from "@/lib/listing-hybrid-search";
import {
  findGeneraciyaFotoScenarioByTag,
  getGeneraciyaFotoScenarioPath,
} from "@/lib/generaciya-foto-routes";
import {
  SOBYTIYA_1_SENTYABRYA_PATH,
  SOBYTIYA_1_SENTYABRYA_TAG,
} from "@/lib/sobytiya-1-sentyabrya";

export const revalidate = 3600;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const EMPTY_ROUTE_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

const getCachedRouteCards = cache(
  async (params: Parameters<typeof fetchRouteCards>[0]): Promise<RouteCardsResult> => {
    try {
      return await fetchRouteCards(params);
    } catch (err) {
      console.error("[TagPage] fetchRouteCards failed:", err);
      return EMPTY_ROUTE_RESULT;
    }
  },
);

function filtersFromListingKey(filterKey: string): BirthdayListingSearchFilters {
  const [audience_tag, style_tag, occasion_tag, object_tag] = filterKey.split("|");
  return {
    audience_tag: audience_tag || undefined,
    style_tag: style_tag || undefined,
    occasion_tag: occasion_tag || undefined,
    object_tag: object_tag || undefined,
  };
}

const getCachedSearchCards = cache(
  async (query: string, filterKey: string): Promise<RouteCardsResult> => {
    try {
      const startedAt = performance.now();
      const page = await searchListingCardsHybrid({
        query,
        filters: filtersFromListingKey(filterKey),
        limit: LISTING_SEARCH_PAGE_SIZE,
        offset: 0,
        headers: new Headers(),
      });
      logListingHybridSearch({
        source: "ssr",
        queryLength: query.length,
        limit: LISTING_SEARCH_PAGE_SIZE,
        offset: 0,
        resultCount: page.cards.length,
        hasMore: page.hasMore,
        outcome: page.outcome,
        fallbackReason: page.fallbackReason,
        allowlisted: page.allowlisted,
        resultCacheHit: page.resultCacheHit,
        vectorCacheHit: page.vectorCacheHit,
        textCount: page.textCount,
        visualCount: page.visualCount,
        timings: page.timings,
        totalMs: performance.now() - startedAt,
      });
      return {
        cards: page.cards,
        tier_used: "search",
        cards_count: page.cards.length,
        total_count: page.hasMore
          ? page.cards.length + 1
          : page.cards.length,
        has_minimum: page.cards.length >= 1,
        dimension_count: 0,
      };
    } catch (err) {
      console.error("[TagPage] searchListingCardsHybrid failed:", err);
      return { ...EMPTY_ROUTE_RESULT, tier_used: "error" };
    }
  },
);

function getListingCards(
  route: ResolvedRoute,
  searchParams: {
    audience?: string;
    style?: string;
    occasion?: string;
    object?: string;
    sort?: string;
  } | null | undefined,
): Promise<RouteCardsResult> {
  const query = birthdayListingSearchQuery(route.tags);
  if (query) {
    return getCachedSearchCards(
      query,
      birthdayListingSearchFilterKey(birthdayListingSearchFilters(route.tags)),
    );
  }
  return getCachedRouteCards(buildListingFetchParams(route.rpcParams, searchParams ?? null));
}

function buildListingFetchParams(
  routeParams: Record<string, string | null>,
  searchParams: {
    audience?: string;
    style?: string;
    occasion?: string;
    object?: string;
    sort?: string;
  } | null | undefined,
): Parameters<typeof fetchRouteCards>[0] {
  const mergedParams = mergeFilterParams(routeParams, searchParams ?? null);
  const hasQueryFiltersActive = hasQueryFilters(searchParams ?? null);
  const listingSort = parseListingSort(searchParams?.sort);
  return {
    ...mergedParams,
    limit: LISTING_SSR_INITIAL_LIMIT,
    offset: 0,
    min_cards: hasQueryFiltersActive ? 0 : 2,
    sort: listingSort,
  };
}

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{
    audience?: string;
    style?: string;
    occasion?: string;
    object?: string;
    sort?: string;
  }>;
};

function listingPathname(slug: string[]): string {
  return `/${slug.join("/")}`;
}

function redirectIfNotCanonical(slug: string[], route: ResolvedRoute) {
  const current = listingPathname(slug);
  if (current !== route.canonicalPath) {
    permanentRedirect(route.canonicalPath);
  }
}

function redirectRetiredBirthdayL3(slug: string[]) {
  const destination = birthdayRetiredL3RedirectPath(slug);
  if (destination) permanentRedirect(destination);
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = await searchParams;
  redirectRetiredBirthdayL3(slug);
  const route = resolveUrlToTags(slug);
  if (!route) notFound();
  redirectIfNotCanonical(slug, route);

  const seo = getSeoForRoute(route);

  const canonicalUrl = `${SITE_URL}${route.canonicalPath}`;
  const title = seo.metaTitle;

  const result = await getListingCards(route, qs ?? null);
  const totalCount = result.total_count ?? result.cards_count;
  const minCards = getMinCardsForLevel(route.level);
  const dbUnavailable = result.tier_used === "error";
  const shouldIndex = !dbUnavailable && totalCount >= minCards;

  let ogImageUrl: string | null = null;
  try {
    ogImageUrl = await getFirstCardPhotoUrl(result.cards.map((c) => c.id));
  } catch (err) {
    console.error("[TagPage] getFirstCardPhotoUrl failed in metadata:", err);
  }

  return {
    title,
    description: seo.metaDescription,
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: {
      canonical: shouldIndex
        ? canonicalUrl
        : route.parentPath
          ? `${SITE_URL}${route.parentPath}`
          : canonicalUrl,
    },
    openGraph: {
      title,
      description: seo.metaDescription,
      url: canonicalUrl,
      type: "website",
      siteName: "PromptShot",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: seo.metaDescription,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

function buildJsonLd(
  route: ResolvedRoute,
  seo: SeoContent,
  siteUrl: string,
  ogImageUrl: string | null,
  seoIllustrations: ResolvedSeoIllustration[] = [],
) {
  const canonicalUrl = `${siteUrl}${route.canonicalPath}`;

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
  ];

  if (route.level === 1) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: route.primaryTag.labelRu,
      item: canonicalUrl,
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: route.primaryTag.labelRu,
      item: `${siteUrl}${route.parentPath}`,
    });
    if (route.level === 2) {
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 3,
        name: route.tags[1].labelRu,
        item: canonicalUrl,
      });
    } else if (route.level === 3) {
      // Build the L2 intermediate URL: parentPath + last segment of tags[1]
      const l2Path = buildCanonicalPath(route.tags.slice(0, 2));
      const l2Url = `${siteUrl}${l2Path}`;
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 3,
        name: route.tags[1].labelRu,
        item: l2Url,
      });
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 4,
        name: route.tags[2].labelRu,
        item: canonicalUrl,
      });
    }
  }

  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seo.metaTitle,
      description: seo.metaDescription,
      url: canonicalUrl,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      isPartOf: {
        "@type": "WebSite",
        name: "PromptShot",
        url: siteUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    },
  ];

  if (seo.faqItems.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seo.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  for (const ill of seoIllustrations) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      contentUrl: ill.photoUrl,
      description: ill.alt,
      caption: ill.caption,
      url: `${siteUrl}/p/${ill.cardSlug}`,
    });
  }

  return schemas;
}

type L2Chip = {
  tag: TagEntry;
  href: string;
  count?: number;
};

type L2ChipGroup = {
  dimension: Dimension;
  label: string;
  chips: L2Chip[];
};

function sortChipsByFeatured(chips: L2Chip[], featuredSlugs?: string[]): L2Chip[] {
  if (!featuredSlugs?.length) return chips;
  const order = new Map(featuredSlugs.map((slug, index) => [slug, index]));
  return [...chips].sort((a, b) => {
    const ai = order.get(a.tag.slug) ?? 999;
    const bi = order.get(b.tag.slug) ?? 999;
    if (ai !== bi) return ai - bi;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

function preferL2Chip(
  kept: L2Chip,
  next: L2Chip,
  featuredSlugs?: string[]
): L2Chip {
  const order = new Map((featuredSlugs ?? []).map((slug, index) => [slug, index]));
  const keptFeatured = order.get(kept.tag.slug);
  const nextFeatured = order.get(next.tag.slug);
  if (keptFeatured != null && nextFeatured == null) return kept;
  if (nextFeatured != null && keptFeatured == null) return next;
  if (
    keptFeatured != null &&
    nextFeatured != null &&
    keptFeatured !== nextFeatured
  ) {
    return keptFeatured < nextFeatured ? kept : next;
  }
  return (next.count ?? 0) > (kept.count ?? 0) ? next : kept;
}

function SeoPopularLinks({ links }: { links: NonNullable<SeoContent["popularLinks"]> }) {
  return (
    <nav className="mt-4" aria-label="Популярные подборки">
      <p className="mb-2 text-sm font-medium text-zinc-700">Популярные сценарии</p>
      <div className="flex flex-wrap gap-1.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            scroll={false}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

async function getL2ChipsForTag(
  tag: TagEntry,
  limit = 12,
  featuredL2Slugs?: string[],
): Promise<L2ChipGroup[]> {
  let combos: Awaited<ReturnType<typeof getIndexableTagCombos>> = [];
  try {
    combos = await getIndexableTagCombos(6, "ru");
  } catch (err) {
    console.error("[TagPage] getIndexableTagCombos failed:", err);
    return [];
  }

  const matching: { other: TagEntry; count: number }[] = [];
  for (const c of combos) {
    let otherDim: string | null = null;
    let otherSlug: string | null = null;

    if (c.dim1 === tag.dimension && c.slug1 === tag.slug) {
      otherDim = c.dim2;
      otherSlug = c.slug2;
    } else if (c.dim2 === tag.dimension && c.slug2 === tag.slug) {
      otherDim = c.dim1;
      otherSlug = c.slug1;
    }
    if (!otherDim || !otherSlug) continue;

    const otherTag = findTagBySlug(otherDim as Dimension, otherSlug);
    if (otherTag) {
      const count = Number(c.cards_count) || 0;
      if (count > 0) {
        matching.push({ other: otherTag, count });
      }
    }
  }

  matching.sort((a, b) => b.count - a.count);

  const grouped = new Map<Dimension, L2Chip[]>();
  for (const { other, count } of matching) {
    const lastSeg = other.urlPath.split("/").filter(Boolean).pop()!;
    const basePath = tag.urlPath.replace(/\/$/, "");
    const birthdayHref =
      tag.slug === "den_rozhdeniya"
        ? buildCanonicalPath([tag, other])
        : `${basePath}/${lastSeg}`;
    const chip: L2Chip = {
      tag: other,
      href: birthdayHref,
      count,
    };
    const arr = grouped.get(other.dimension) ?? [];
    arr.push(chip);
    grouped.set(other.dimension, arr);
  }

  const groups: L2ChipGroup[] = [];
  for (const dim of DIMENSION_PRIORITY) {
    if (dim === tag.dimension) continue;
    const chips = grouped.get(dim);
    if (!chips || chips.length === 0) continue;
    groups.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      chips: sortChipsByFeatured(
        uniqueListingChipsByHref(chips, (kept, next) =>
          preferL2Chip(kept, next, featuredL2Slugs)
        ),
        featuredL2Slugs
      ).slice(0, limit),
    });
  }
  return groups;
}

/** Visible cluster link on style L1 pages. Does not change copy or URLs. */
function withSobytiya1SentyabryaStyleCrosslink(
  groups: L2ChipGroup[],
  tag: TagEntry
): L2ChipGroup[] {
  if (tag.dimension !== "style_tag") return groups;

  const eventTag = findTagBySlug("occasion_tag", SOBYTIYA_1_SENTYABRYA_TAG);
  if (!eventTag) return groups;

  const chip: L2Chip = {
    tag: eventTag,
    href: SOBYTIYA_1_SENTYABRYA_PATH,
  };

  const occasion = groups.find((group) => group.dimension === "occasion_tag");
  if (!occasion) {
    return [
      {
        dimension: "occasion_tag",
        label: DIMENSION_LABELS.occasion_tag,
        chips: [chip],
      },
      ...groups,
    ];
  }

  return groups.map((group) => {
    if (group.dimension !== "occasion_tag") return group;
    if (group.chips.some((item) => item.tag.slug === SOBYTIYA_1_SENTYABRYA_TAG)) {
      return {
        ...group,
        chips: group.chips.map((item) =>
          item.tag.slug === SOBYTIYA_1_SENTYABRYA_TAG
            ? { ...item, href: SOBYTIYA_1_SENTYABRYA_PATH }
            : item
        ),
      };
    }
    return { ...group, chips: [chip, ...group.chips] };
  });
}

function BreadcrumbSeparator() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-zinc-300"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function mergeFilterParams(
  routeParams: Record<string, string | null>,
  searchParams: {
    audience?: string;
    style?: string;
    occasion?: string;
    object?: string;
  } | null
): Record<string, string | null> {
  const out = { ...routeParams };
  if (searchParams?.audience) out.audience_tag = searchParams.audience;
  if (searchParams?.style) out.style_tag = searchParams.style;
  if (searchParams?.occasion) out.occasion_tag = searchParams.occasion;
  if (searchParams?.object) out.object_tag = searchParams.object;
  return out;
}

function hasQueryFilters(searchParams: {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
} | null | undefined): boolean {
  if (!searchParams) return false;
  return Boolean(
    searchParams.audience || searchParams.style || searchParams.occasion || searchParams.object
  );
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = await searchParams;
  redirectRetiredBirthdayL3(slug);
  const route = resolveUrlToTags(slug);

  if (!route) notFound();
  redirectIfNotCanonical(slug, route);

  const mergedParams = mergeFilterParams(route.rpcParams, qs ?? null);
  const listingSearchQuery = birthdayListingSearchQuery(route.tags);
  const listingSearchFilters = listingSearchQuery
    ? birthdayListingSearchFilters(route.tags)
    : {};
  const result = await getListingCards(route, qs ?? null);
  const totalCount = result.total_count ?? result.cards_count;

  let cards: PromptCardFull[];
  try {
    cards = await enrichCardsWithDetails(result.cards);
  } catch (err) {
    console.error("[TagPage] enrichCardsWithDetails failed:", err);
    cards = [];
  }

  const seo = getSeoForRoute(route);

  let resolvedIllustrations: ResolvedSeoIllustration[] = [];
  if (seo.illustrations?.length) {
    try {
      resolvedIllustrations = await resolveSeoIllustrations(seo.illustrations, mergedParams);
    } catch (err) {
      console.error("[TagPage] resolveSeoIllustrations failed:", err);
    }
  }

  let pageOgImage: string | null = null;
  try {
    pageOgImage = await getFirstCardPhotoUrl(result.cards.map((c) => c.id));
  } catch (err) {
    console.error("[TagPage] getFirstCardPhotoUrl failed:", err);
  }

  const primaryTag = route.primaryTag;
  const generationScenario = findGeneraciyaFotoScenarioByTag(
    primaryTag.dimension,
    primaryTag.slug
  );
  const siblings = getSiblingTags(primaryTag, 6);
  const sectionLabel = DIMENSION_LABELS[primaryTag.dimension];
  let l2ChipGroups: L2ChipGroup[] = [];
  if (route.level === 1) {
    try {
      l2ChipGroups = withSobytiya1SentyabryaStyleCrosslink(
        await getL2ChipsForTag(primaryTag, 12, seo.featuredL2Slugs),
        primaryTag
      );
    } catch (err) {
      console.error("[TagPage] getL2ChipsForTag failed:", err);
    }
  }

  const baseRpcParams: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(route.rpcParams)) {
    baseRpcParams[k] = v ?? null;
  }

  const lockedDimensions = route.tags.map((t) => t.dimension);
  const isSobytiyaL1 =
    route.level === 1 &&
    primaryTag.dimension === "occasion_tag" &&
    primaryTag.urlPath.startsWith("/sobytiya/");
  const isSiblingClusterL1 =
    route.level === 1 &&
    (primaryTag.dimension === "audience_tag" ||
      primaryTag.dimension === "style_tag" ||
      primaryTag.dimension === "object_tag");
  const currentPath = listingPathname(slug);
  const isBirthdayCluster = isDenRozhdeniyaClusterPath(currentPath);
  const isPairsCluster = isPromtyDlyaFotoParClusterPath(currentPath);
  const birthdayNav = isBirthdayCluster
    ? getFeaturedBirthdayNavItems(
        isDenRozhdeniyaHubPath(currentPath)
          ? null
          : birthdayActiveAliasFromTags(route.tags),
      )
    : [];
  const pairsNav = isPairsCluster
    ? getFeaturedPairsNavItems(pairsActiveAliasFromPath(currentPath))
    : [];
  const clusterChipsAboveGrid =
    !isBirthdayCluster &&
    !isPairsCluster &&
    (isSobytiyaL1 || isSiblingClusterL1)
      ? getClusterChipNavigation(primaryTag.dimension, primaryTag.urlPath)
      : [];
  const l2ChipGroupsBelow = (
    isSobytiyaL1
      ? l2ChipGroups.filter((group) => group.dimension !== "occasion_tag")
      : l2ChipGroups
  )
    .map((group) => ({
      ...group,
      chips: group.chips.filter((chip) => {
        const alias = chip.href.split("/").filter(Boolean).pop() ?? "";
        if (isPairsCluster) return !isFeaturedPairsChildAlias(alias);
        if (isBirthdayCluster) return !isFeaturedBirthdayChildAlias(alias);
        return true;
      }),
    }))
    .filter((group) => group.chips.length > 0);

  return (
    <PageLayout showFooterWithGenerateDock>
      <ListingFotoVPromtBanner attach="hero" />
      <section className="w-full px-2 pt-5 sm:px-5">
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400">
          <Link href="/" className="transition-colors hover:text-zinc-700">
            Главная
          </Link>
          <BreadcrumbSeparator />
          {route.level === 1 ? (
            <>
              <span>{sectionLabel}</span>
              <BreadcrumbSeparator />
              <span className="text-zinc-700 font-medium">{primaryTag.labelRu}</span>
            </>
          ) : (
            <>
              <Link
                href={route.parentPath!}
                scroll={false}
                className="transition-colors hover:text-zinc-700"
              >
                {primaryTag.labelRu}
              </Link>
              <BreadcrumbSeparator />
              {route.level === 2 ? (
                <span className="text-zinc-700 font-medium">{route.tags[1].labelRu}</span>
              ) : (
                <>
                  <span className="text-zinc-500">{route.tags[1].labelRu}</span>
                  <BreadcrumbSeparator />
                  <span className="text-zinc-700 font-medium">{route.tags[2].labelRu}</span>
                </>
              )}
            </>
          )}
        </nav>
      </section>

      <main className="listing-main-bottom-pad w-full flex-1 px-2 pb-8 sm:px-5">
        <section aria-labelledby="listing-explorer-heading">
          <CatalogExplorer
            initialCards={cards}
            totalCount={totalCount}
            initialRankedBatchSize={result.cards_count}
            baseRpcParams={baseRpcParams}
            lockedDimensions={lockedDimensions}
            heading={seo.h1}
            headingId="listing-explorer-heading"
            eyebrow={sectionLabel}
            intro={seo.intro}
            chipNav={
              route.level === 1 ? (
                <nav aria-label="Категории промтов">
                  <ListingClusterChipGroup
                    label=""
                    showLabel={false}
                    variant="nav"
                    leading={<ListingHomeBackLink />}
                    items={
                      clusterChipsAboveGrid.length > 0
                        ? clusterChipsAboveGrid
                        : birthdayNav.length > 0
                          ? birthdayNav
                          : pairsNav
                    }
                  />
                </nav>
              ) : undefined
            }
            afterIntro={
              route.level === 1
                ? undefined
                : birthdayNav.length > 0 ? (
                    <ListingClusterChipGroup
                      label="Сценарии на день рождения"
                      items={birthdayNav}
                    />
                  ) : pairsNav.length > 0 ? (
                    <ListingClusterChipGroup
                      label="Сценарии для фото пары"
                      items={pairsNav}
                    />
                  ) : undefined
            }
            listingSearchQuery={listingSearchQuery}
            listingSearchFilters={listingSearchFilters}
            listingSearchHasMore={
              Boolean(listingSearchQuery && totalCount > result.cards_count)
            }
          />
          {seo.popularLinks?.length && !isBirthdayCluster && !isPairsCluster ? (
            <div className="sr-only">
              <SeoPopularLinks links={seo.popularLinks} />
            </div>
          ) : null}
        </section>

        {generationScenario ? (
          <section className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-zinc-900">
              Хотите создать своё изображение?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
              Откройте тематический генератор, выберите пример и измените промт
              под свою внешность, сюжет и формат.
            </p>
            <Link
              href={getGeneraciyaFotoScenarioPath(generationScenario.slug)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {`${generationScenario.label}: сгенерировать фото`}
            </Link>
          </section>
        ) : null}

        {route.parentPath ? (
          <div className="mt-10">
            <Link
              href={route.parentPath}
              scroll={false}
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Все промты: {primaryTag.labelRu}
            </Link>
          </div>
        ) : null}

        {/* L2 chips — only on L1 pages */}
        {l2ChipGroupsBelow.length > 0 && (
          <section className="mt-12 space-y-4">
            {l2ChipGroupsBelow.map((group) => (
              <ListingClusterChipGroup
                key={group.dimension}
                label={group.label}
                items={group.chips.map((chip) => ({
                  label: chip.tag.labelRu,
                  href: chip.href,
                  count: chip.count,
                }))}
              />
            ))}
          </section>
        )}

        {/* How to use */}
        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">
            {seo.howToTitle ?? "Как использовать промт"}
          </h2>
          <ol className="mt-4 space-y-3 text-zinc-600">
            {seo.howToSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900">Частые вопросы</h2>
          <dl className="mt-4 space-y-6">
            {seo.faqItems.map((item, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                <dt className="font-semibold text-zinc-900">{item.q}</dt>
                <dd className="mt-2 text-zinc-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* SEO text blocks (текстовая релевантность L1) */}
        {seo.seoTextBlocks?.map((block) => (
          <section key={block.h2} className="mt-12">
            <h2 className="text-xl font-bold text-zinc-900">{block.h2}</h2>
            <div className="mt-4 max-w-3xl space-y-4">
              {block.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-zinc-600 sm:text-base">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Internal links — siblings of primary tag */}
        {siblings.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-zinc-900">Ещё разделы</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={s.urlPath}
                  scroll={false}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  {s.labelRu}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Cross-dimension links for L2: show siblings with same second tag */}
        {route.level >= 2 && route.tags.length >= 2 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-zinc-900">
              Ещё «{route.tags[1].labelRu}»
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {getSiblingTags(route.tags[1], 8).map((s) => (
                <Link
                  key={s.slug}
                  href={s.urlPath}
                  scroll={false}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  {s.labelRu}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* JSON-LD: BreadcrumbList + FAQPage — inline for SSR visibility */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildJsonLd(route, seo, SITE_URL, pageOgImage, resolvedIllustrations),
          ).replace(/</g, "\\u003c"),
        }}
      />
    </PageLayout>
  );
}
