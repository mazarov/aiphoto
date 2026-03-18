import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { fetchRouteCards, enrichCardsWithDetails, getIndexableTagCombos } from "@/lib/supabase";
import { PageLayout } from "@/components/PageLayout";
import { CatalogWithFilters } from "@/components/CatalogWithFilters";
import {
  getSiblingTags,
  getAllTagPaths,
  DIMENSION_LABELS,
  findTagBySlug,
  type Dimension,
  type TagEntry,
  DIMENSION_PRIORITY,
} from "@/lib/tag-registry";
import { resolveUrlToTags, getMinCardsForLevel, type ResolvedRoute } from "@/lib/route-resolver";
import { getSeoForRoute } from "@/lib/seo-templates";
import type { SeoContent } from "@/lib/seo-content";

export const revalidate = 3600;

const PAGE_SIZE = 48;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{ audience?: string; style?: string; occasion?: string; object?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const route = resolveUrlToTags(slug);
  if (!route) return {};

  const seo = getSeoForRoute(route);

  const canonicalUrl = `${SITE_URL}${route.canonicalPath}`;
  const title = seo.metaTitle;

  const result = await fetchRouteCards({
    ...route.rpcParams,
    limit: 1,
    offset: 0,
  });
  const totalCount = result.total_count ?? result.cards_count;
  const minCards = getMinCardsForLevel(route.level);
  const shouldIndex = totalCount >= minCards;

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
  };
}

function buildJsonLd(route: ResolvedRoute, seo: SeoContent, siteUrl: string) {
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
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 3,
        name: route.tags[1].labelRu,
        item: canonicalUrl,
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

  return schemas;
}

type L2Chip = {
  tag: TagEntry;
  href: string;
  count: number;
};

type L2ChipGroup = {
  dimension: Dimension;
  label: string;
  chips: L2Chip[];
};

async function getL2ChipsForTag(
  tag: TagEntry,
  limit = 12,
): Promise<L2ChipGroup[]> {
  const combos = await getIndexableTagCombos(6, "ru");

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
    const basePath = tag.urlPath.endsWith("/") ? tag.urlPath : tag.urlPath + "/";
    const chip: L2Chip = {
      tag: other,
      href: basePath + lastSeg + "/",
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
      chips: chips.slice(0, limit),
    });
  }
  return groups;
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
  searchParams: { audience?: string; style?: string; occasion?: string; object?: string } | null
): Record<string, string | null> {
  const out = { ...routeParams };
  if (searchParams?.audience) out.audience_tag = searchParams.audience;
  if (searchParams?.style) out.style_tag = searchParams.style;
  if (searchParams?.occasion) out.occasion_tag = searchParams.occasion;
  if (searchParams?.object) out.object_tag = searchParams.object;
  return out;
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = await searchParams;
  const route = resolveUrlToTags(slug);

  if (!route) notFound();

  const offset = 0;
  const mergedParams = mergeFilterParams(route.rpcParams, qs ?? null);

  const result = await fetchRouteCards({
    ...mergedParams,
    limit: PAGE_SIZE,
    offset,
  });
  const totalCount = result.total_count ?? result.cards_count;
  const cards = await enrichCardsWithDetails(result.cards);

  const seo = getSeoForRoute(route);

  const primaryTag = route.primaryTag;
  const siblings = getSiblingTags(primaryTag, 6);
  const sectionLabel = DIMENSION_LABELS[primaryTag.dimension];
  const l2ChipGroups = route.level === 1 ? await getL2ChipsForTag(primaryTag) : [];

  const baseRpcParams: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(route.rpcParams)) {
    baseRpcParams[k] = v ?? null;
  }

  const lockedDimensions = route.tags.map((t) => t.dimension);

  return (
    <PageLayout>
      {/* Hero */}
      <section className="border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white">
        <div className="px-5 pt-10 pb-8">
          {/* Breadcrumbs */}
          <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400">
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

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {seo.h1}
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600 leading-relaxed">
            {seo.intro}
          </p>
        </div>
      </section>

      <main className="w-full flex-1 px-2 sm:px-5 py-10 pb-24 lg:pb-10">
        <CatalogWithFilters
          initialCards={cards}
          totalCount={totalCount}
          baseRpcParams={baseRpcParams}
          lockedDimensions={lockedDimensions}
        />

        {/* Parent link for L2/L3 */}
        {route.parentPath && (
          <div className="mt-10">
            <Link
              href={route.parentPath}
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Все промты: {primaryTag.labelRu}
            </Link>
          </div>
        )}

        {/* L2 chips — only on L1 pages */}
        {l2ChipGroups.length > 0 && (
          <section className="mt-12 space-y-4">
            {l2ChipGroups.map((group) => (
              <div key={group.dimension}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.chips.map((chip) => (
                    <Link
                      key={chip.tag.slug}
                      href={chip.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {chip.tag.labelRu}
                      <span className="text-[11px] tabular-nums text-zinc-400">
                        {chip.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* How to use */}
        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">Как использовать промт</h2>
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

        {/* Internal links — siblings of primary tag */}
        {siblings.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-zinc-900">Ещё разделы</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={s.urlPath + "/"}
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
                  href={s.urlPath + "/"}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  {s.labelRu}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* JSON-LD: BreadcrumbList + FAQPage */}
      <Script
        id="tag-page-json-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(route, seo, SITE_URL)).replace(/</g, "\\u003c"),
        }}
      />
    </PageLayout>
  );
}
