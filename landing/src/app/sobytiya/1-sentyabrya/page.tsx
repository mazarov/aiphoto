import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { ListingClusterChipGroup } from "@/components/ListingClusterChipGroup";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";
import {
  enrichCardsWithDetails,
  getFirstCardPhotoUrl,
  searchCardsByText,
  type PromptCardFull,
} from "@/lib/supabase";
import { getMinCardsForLevel } from "@/lib/route-resolver";
import { requireSeoContent } from "@/lib/seo-content";
import { DIMENSION_LABELS } from "@/lib/tag-registry";
import {
  getSobytiyaChipNavigation,
  getStilChipNavigation,
} from "@/lib/menu";
import {
  SOBYTIYA_1_SENTYABRYA_PATH,
  SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY,
  SOBYTIYA_1_SENTYABRYA_TAG,
} from "@/lib/sobytiya-1-sentyabrya";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}${SOBYTIYA_1_SENTYABRYA_PATH}`;
const seo = requireSeoContent(SOBYTIYA_1_SENTYABRYA_TAG);

type SearchParams = {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
  sort?: string;
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

const getPageCards = cache(async (): Promise<PromptCardFull[]> => {
  try {
    const hits = await searchCardsByText(
      SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY,
      16,
      0
    );
    return await enrichCardsWithDetails(hits);
  } catch (error) {
    console.error("[Sobytiya1SentyabryaPage] fetch examples failed", error);
    return [];
  }
});

const getPageOgImage = cache(async (): Promise<string | null> => {
  const cards = await getPageCards();
  if (!cards.length) return null;

  try {
    return await getFirstCardPhotoUrl(cards.map((card) => card.id));
  } catch (error) {
    console.error("[Sobytiya1SentyabryaPage] fetch OG image failed", error);
    return null;
  }
});

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const qs = await searchParams;
  const cards = await getPageCards();
  const ogImage = await getPageOgImage();
  const shouldIndex =
    !hasQueryFilters(qs) && cards.length >= getMinCardsForLevel(1);

  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: seo.metaTitle,
      description: seo.metaDescription,
      url: PAGE_URL,
      type: "website",
      siteName: "PromptShot",
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle,
      description: seo.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(ogImage: string | null) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seo.metaTitle,
      description: seo.metaDescription,
      url: PAGE_URL,
      ...(ogImage ? { image: ogImage } : {}),
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
          name: "События",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "1 сентября",
          item: PAGE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: seo.howToTitle ?? "Как использовать промт",
      step: seo.howToSteps.map((text, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seo.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
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

export default async function Sobytiya1SentyabryaPage({
  searchParams,
}: Props) {
  await searchParams;
  const cards = await getPageCards();
  const ogImage = cards[0]?.photoUrls[0] || (await getPageOgImage());
  const schemas = buildJsonLd(ogImage);
  const eventChips = getSobytiyaChipNavigation(SOBYTIYA_1_SENTYABRYA_PATH);
  const styleChips = getStilChipNavigation();

  return (
    <PageLayout showFooterWithGenerateDock>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <ListingFotoVPromtBanner attach="hero" />
      <section className="w-full px-2 pt-5 sm:px-5">
        <nav
          aria-label="Хлебные крошки"
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400"
        >
          <Link href="/" className="transition-colors hover:text-zinc-700">
            Главная
          </Link>
          <BreadcrumbSeparator />
          <span>{DIMENSION_LABELS.occasion_tag}</span>
          <BreadcrumbSeparator />
          <span className="font-medium text-zinc-700">1 сентября</span>
        </nav>
      </section>

      <main className="listing-main-bottom-pad w-full flex-1 px-2 pb-8 sm:px-5">
        <section aria-labelledby="listing-explorer-heading">
          <CatalogExplorer
            initialCards={cards}
            totalCount={cards.length}
            initialRankedBatchSize={cards.length}
            baseRpcParams={{ occasion_tag: SOBYTIYA_1_SENTYABRYA_TAG }}
            lockedDimensions={["occasion_tag"]}
            heading={seo.h1}
            headingId="listing-explorer-heading"
            eyebrow={DIMENSION_LABELS.occasion_tag}
            intro={seo.intro}
            preGrid={
              <ListingClusterChipGroup
                label={DIMENSION_LABELS.occasion_tag}
                items={eventChips}
              />
            }
          />
          {seo.popularLinks?.length ? (
            <nav className="sr-only" aria-label="Популярные подборки">
              {seo.popularLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </section>

        <section className="mt-12 space-y-4">
          <ListingClusterChipGroup label="Стили" items={styleChips} />
        </section>

        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">
            {seo.howToTitle ?? "Как использовать промт"}
          </h2>
          <ol className="mt-4 space-y-3 text-zinc-600">
            {seo.howToSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900">Частые вопросы</h2>
          <dl className="mt-4 space-y-6">
            {seo.faqItems.map((item) => (
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
      </main>
    </PageLayout>
  );
}
