import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoPricing,
  GeneraciyaFotoThemes,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import {
  PromtyDlyaIiFotosessiiFaq,
  PromtyDlyaIiFotosessiiHowTo,
} from "@/components/fotosessii/PromtyDlyaIiFotosessiiLandingSections";
import {
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  type PromptCardFull,
} from "@/lib/supabase";
import {
  PHOTOSHOOT_LISTING_LIMIT,
  fetchPublishedPhotoshootListingCards,
} from "@/lib/photoshoot-listing";
import {
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  getPromtyDlyaIiFotosessiiChipNavigation,
} from "@/lib/promty-dlya-ii-fotosessii-cluster";
import {
  PROMTY_DLYA_II_FOTOSESSII_FAQ,
  PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
  PROMTY_DLYA_II_FOTOSESSII_SEO,
  PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS,
  flattenFotosessiiFaqAnswer,
} from "@/lib/promty-dlya-ii-fotosessii-seo-copy";
import {
  FOTOSESSII_BASE_RPC_PARAMS,
  getFotosessiiThemeCollagePhotos,
} from "@/lib/promty-dlya-ii-fotosessii-page-data";
import {
  filterPhotoshootExampleCards,
  toGenerationExampleCard,
} from "@/lib/generation/example-card";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}`;

const getPhotoshootExamples = cache(async (): Promise<PromptCardFull[]> => {
  try {
    return await fetchPublishedPhotoshootListingCards(PHOTOSHOOT_LISTING_LIMIT);
  } catch (error) {
    console.error("[FotosessiiHub] fetch photoshoot carousel failed", error);
    return [];
  }
});

const getLookExamples = cache(async (): Promise<PromptCardFull[]> => {
  try {
    const result = await fetchRouteCards({
      ...FOTOSESSII_BASE_RPC_PARAMS,
      limit: 50,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
    const enriched = await enrichCardsWithDetails(result.cards).catch((error) => {
      console.error("[FotosessiiHub] enrich look examples failed", error);
      return [] as PromptCardFull[];
    });
    const byId = new Map(enriched.map((card) => [card.id, card]));
    return result.cards
      .map((card) => byId.get(card.id))
      .filter((card): card is PromptCardFull => Boolean(card));
  } catch (error) {
    console.error("[FotosessiiHub] fetch look examples failed", error);
    return [];
  }
});

const getExampleOgImage = cache(async (): Promise<string | null> => {
  const cards = await getLookExamples();
  if (!cards.length) return null;
  try {
    return await getFirstCardPhotoUrl(cards.map((card) => card.id));
  } catch (error) {
    console.error("[FotosessiiHub] fetch OG image failed", error);
    return null;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await getExampleOgImage();

  return {
    title: PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle,
    description: PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle,
      description: PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
      url: PAGE_URL,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle,
      description: PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(ogImage: string | null, cards: PromptCardFull[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: PROMTY_DLYA_II_FOTOSESSII_SEO.h1,
      description: PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
      url: PAGE_URL,
      inLanguage: "ru",
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
          name: PROMTY_DLYA_II_FOTOSESSII_SEO.breadcrumb,
          item: PAGE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: PROMTY_DLYA_II_FOTOSESSII_SEO.howToTitle,
      step: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PROMTY_DLYA_II_FOTOSESSII_FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: flattenFotosessiiFaqAnswer(item.a),
        },
      })),
    },
    ...(cards.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: PROMTY_DLYA_II_FOTOSESSII_SEO.examplesTitle,
            numberOfItems: cards.length,
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: card.title_ru || card.title_en || "Промт для фото",
              ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
            })),
          },
        ]
      : []),
  ];
}

export default async function PromtyDlyaIiFotosessiiPage() {
  const [lookCards, photoshootCards, themeCollage, fallbackOgImage] =
    await Promise.all([
      getLookExamples(),
      getPhotoshootExamples(),
      getFotosessiiThemeCollagePhotos(),
      getExampleOgImage(),
    ]);
  const ogImage = lookCards[0]?.photoUrls[0] || fallbackOgImage;
  const schemas = buildJsonLd(ogImage, lookCards.slice(0, 16));
  const carouselCards = filterPhotoshootExampleCards(
    photoshootCards.map(toGenerationExampleCard)
  )
    .filter((card) => card.photoUrl)
    .slice(0, 50);
  const galleryCards = lookCards.map(toGenerationExampleCard).slice(0, 16);

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

      <main className="listing-main-bottom-pad w-full flex-1 pb-16 sm:pb-24">
        <section className="relative scroll-mt-20 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_-20%,rgba(99,102,241,0.14),transparent_62%)]"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-7xl px-3 pb-0 pt-8 text-center sm:px-5 sm:pt-12 xl:px-6">
            <nav
              aria-label="Хлебные крошки"
              className="mb-5 flex items-center justify-center gap-1.5 text-sm text-zinc-400"
            >
              <Link href="/" className="transition-colors hover:text-zinc-700">
                Главная
              </Link>
              <svg
                className="h-3.5 w-3.5 shrink-0 text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="font-medium text-zinc-700">
                {PROMTY_DLYA_II_FOTOSESSII_SEO.breadcrumb}
              </span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {PROMTY_DLYA_II_FOTOSESSII_SEO.h1}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {PROMTY_DLYA_II_FOTOSESSII_SEO.intro}
            </p>
            <GeneraciyaFotoHeroCarousel
              cards={carouselCards}
              ctaLabel={PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta}
              ctaHref={PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCtaHref}
              ariaLabel="Примеры ИИ-фотосессии"
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <GeneraciyaFotoThemes
            photosByHref={themeCollage.photosByHref}
            countByHref={themeCollage.countByHref}
            title={PROMTY_DLYA_II_FOTOSESSII_SEO.themesTitle}
            lead={PROMTY_DLYA_II_FOTOSESSII_SEO.themesLead}
            items={PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS}
            countKind="prompts"
          />

          <PromtyDlyaIiFotosessiiHowTo />

          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                title={PROMTY_DLYA_II_FOTOSESSII_SEO.examplesTitle}
                intro={PROMTY_DLYA_II_FOTOSESSII_SEO.examplesIntro}
                eyebrow=""
                allPromptsLabel={PROMTY_DLYA_II_FOTOSESSII_SEO.examplesCta}
                defaultAllPromptsHref="/"
                scenarioNavigation={getPromtyDlyaIiFotosessiiChipNavigation()}
                navigationAriaLabel="Готовые промты для ИИ фотосессии на русском"
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются.
              </div>
            )}
          </section>

          <GeneraciyaFotoPricing
            returnPath={PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}
            lead={PROMTY_DLYA_II_FOTOSESSII_SEO.pricingLead}
          />
          <PromtyDlyaIiFotosessiiFaq />
        </div>
      </main>
    </PageLayout>
  );
}
