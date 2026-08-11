import { cache } from "react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import {
  fetchRouteCards,
  enrichCardsWithDetails,
  getFirstCardPhotoUrl,
  type RouteCardsResult,
  type PromptCardFull,
} from "@/lib/supabase";
import { PageLayout } from "@/components/PageLayout";
import { ListingPromptCountBadge } from "@/components/ListingPromptCountBadge";
import { LISTING_SSR_INITIAL_LIMIT } from "@/lib/listing-pagination";

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

const CatalogWithFilters = dynamic(
  () =>
    import("@/components/CatalogWithFilters").then((mod) => mod.CatalogWithFilters),
  {
    ssr: true,
    loading: () => (
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pb-8"
        aria-busy="true"
        aria-label="Загрузка каталога"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded-2xl bg-zinc-100 animate-pulse"
          />
        ))}
      </div>
    ),
  }
);

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

const PAGE_TITLE = "Тренды — промты для фото";
const PAGE_DESCRIPTION =
  "Актуальные AI-промты для фото — свежие карточки по дате публикации. Фильтруйте по аудитории, стилю, событию и сцене.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const qs = await searchParams;
  const filtered = hasQueryFilters(qs);
  const result = await getCachedRouteCards(buildListingFetchParams(qs ?? null));
  const totalCount = result.total_count ?? result.cards_count;
  const dbUnavailable = result.tier_used === "error";
  const shouldIndex = !filtered && !dbUnavailable && totalCount >= 1;

  let ogImageUrl: string | null = null;
  try {
    ogImageUrl = await getFirstCardPhotoUrl(result.cards.map((c) => c.id));
  } catch (err) {
    console.error("[TrendsPage] getFirstCardPhotoUrl failed in metadata:", err);
  }

  const canonicalUrl = `${SITE_URL}/trends`;

  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: canonicalUrl,
      type: "website",
      siteName: "PromptShot",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
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

  return (
    <PageLayout>
      <section className="w-full px-2 pt-6 sm:px-5 sm:pt-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Тренды
            </h1>
            <ListingPromptCountBadge count={totalCount} />
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
            Свежие промты по дате публикации — от новых к более ранним. Используйте
            фильтры, чтобы сузить подборку.
          </p>
        </div>
      </section>

      <main className="listing-main-bottom-pad w-full flex-1 px-2 pt-3 pb-8 sm:px-5 sm:pt-4 lg:pt-4">
        <section aria-labelledby="trends-catalog-heading">
          <h2 id="trends-catalog-heading" className="sr-only">
            Трендовые промты
          </h2>
          <CatalogWithFilters
            initialCards={cards}
            totalCount={totalCount}
            initialRankedBatchSize={result.cards_count}
            baseRpcParams={BASE_RPC_PARAMS}
            lockedDimensions={[]}
            fixedSort="new"
          />
        </section>
      </main>
    </PageLayout>
  );
}
