import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchRouteCards,
  enrichCardsWithDetails,
  getFirstCardPhotoUrl,
  type RouteCardsResult,
  type PromptCardFull,
} from "@/lib/supabase";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { PageLayout } from "@/components/PageLayout";
import { LISTING_SSR_INITIAL_LIMIT } from "@/lib/listing-pagination";
import {
  TRENDS_FAQ,
  TRENDS_POPULAR_LINKS,
  TRENDS_SEO,
  TRENDS_SEO_TEXT_BLOCKS,
} from "@/lib/trends-seo-copy";

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

const BASE_RPC_PARAMS: Record<string, string | null> = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
};

type SearchParams = {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

function hasQueryFilters(searchParams: SearchParams | null | undefined): boolean {
  if (!searchParams) return false;
  return Boolean(
    searchParams.audience ||
      searchParams.style ||
      searchParams.occasion ||
      searchParams.object
  );
}

function mergeFilterParams(
  searchParams: SearchParams | null | undefined
): Record<string, string | null> {
  const out = { ...BASE_RPC_PARAMS };
  if (searchParams?.audience) out.audience_tag = searchParams.audience;
  if (searchParams?.style) out.style_tag = searchParams.style;
  if (searchParams?.occasion) out.occasion_tag = searchParams.occasion;
  if (searchParams?.object) out.object_tag = searchParams.object;
  return out;
}

function buildListingFetchParams(
  searchParams: SearchParams | null | undefined
): Parameters<typeof fetchRouteCards>[0] {
  const hasFilters = hasQueryFilters(searchParams);
  return {
    ...mergeFilterParams(searchParams),
    limit: LISTING_SSR_INITIAL_LIMIT,
    offset: 0,
    min_cards: hasFilters ? 0 : 1,
    sort: "new",
  };
}

const getCachedRouteCards = cache(
  async (params: Parameters<typeof fetchRouteCards>[0]): Promise<RouteCardsResult> => {
    try {
      return await fetchRouteCards(params);
    } catch (err) {
      console.error("[TrendsPage] fetchRouteCards failed:", err);
      return EMPTY_ROUTE_RESULT;
    }
  }
);

/** Dedup OG/JSON-LD photo fetch across generateMetadata + page (stable string key). */
const getCachedFirstCardPhotoUrl = cache(async (cardIdsKey: string): Promise<string | null> => {
  if (!cardIdsKey) return null;
  try {
    return await getFirstCardPhotoUrl(cardIdsKey.split(","));
  } catch (err) {
    console.error("[TrendsPage] getFirstCardPhotoUrl failed:", err);
    return null;
  }
});

function buildJsonLdSchemas(ogImageUrl: string | null) {
  const canonicalUrl = `${SITE_URL}/trends`;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TRENDS_SEO.metaTitle,
      description: TRENDS_SEO.metaDescription,
      url: canonicalUrl,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      isPartOf: {
        "@type": "WebSite",
        name: "PromptShot",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Главная",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: TRENDS_SEO.h1,
          item: canonicalUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: TRENDS_SEO.howToTitle,
      description: TRENDS_SEO.metaDescription,
      step: TRENDS_SEO.howToSteps.map((text, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text,
      })),
    },
  ];

  if (TRENDS_FAQ.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: TRENDS_FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  return schemas;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const qs = await searchParams;
  const filtered = hasQueryFilters(qs);
  const result = await getCachedRouteCards(buildListingFetchParams(qs ?? null));
  const totalCount = result.total_count ?? result.cards_count;
  const dbUnavailable = result.tier_used === "error";
  const shouldIndex = !filtered && !dbUnavailable && totalCount >= 1;

  const ogImageUrl = await getCachedFirstCardPhotoUrl(
    result.cards.map((c) => c.id).join(",")
  );

  const canonicalUrl = `${SITE_URL}/trends`;

  return {
    title: TRENDS_SEO.metaTitle,
    description: TRENDS_SEO.metaDescription,
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: TRENDS_SEO.metaTitle,
      description: TRENDS_SEO.metaDescription,
      url: canonicalUrl,
      type: "website",
      siteName: "PromptShot",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: TRENDS_SEO.metaTitle,
      description: TRENDS_SEO.metaDescription,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default async function TrendsPage({ searchParams }: Props) {
  const qs = await searchParams;
  const fetchParams = buildListingFetchParams(qs ?? null);
  const result = await getCachedRouteCards(fetchParams);
  const totalCount = result.total_count ?? result.cards_count;

  let cards: PromptCardFull[];
  try {
    cards = await enrichCardsWithDetails(result.cards);
  } catch (err) {
    console.error("[TrendsPage] enrichCardsWithDetails failed:", err);
    cards = [];
  }

  const ogImageUrl = await getCachedFirstCardPhotoUrl(
    result.cards.map((c) => c.id).join(",")
  );
  const jsonLdSchemas = buildJsonLdSchemas(ogImageUrl);

  return (
    <PageLayout>
      {jsonLdSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <main className="listing-main-bottom-pad w-full flex-1 px-2 pt-5 pb-8 sm:px-5">
        <section aria-labelledby="listing-explorer-heading">
          <CatalogExplorer
            initialCards={cards}
            totalCount={totalCount}
            initialRankedBatchSize={result.cards_count}
            baseRpcParams={BASE_RPC_PARAMS}
            lockedDimensions={[]}
            fixedSort="new"
            heading={TRENDS_SEO.h1}
            headingId="listing-explorer-heading"
            eyebrow="Тренды"
            intro={TRENDS_SEO.intro}
          />
          <nav className="sr-only" aria-label="Популярные подборки">
            {TRENDS_POPULAR_LINKS.map((link) => (
              <Link key={link.href} href={link.href} scroll={false}>
                {link.label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">{TRENDS_SEO.howToTitle}</h2>
          <ol className="mt-4 space-y-3 text-zinc-600">
            {TRENDS_SEO.howToSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900">{TRENDS_SEO.faqTitle}</h2>
          <dl className="mt-4 space-y-6">
            {TRENDS_FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4"
              >
                <dt className="font-semibold text-zinc-900">{item.q}</dt>
                <dd className="mt-2 text-zinc-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {TRENDS_SEO_TEXT_BLOCKS.map((block) => (
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
      </main>
    </PageLayout>
  );
}
