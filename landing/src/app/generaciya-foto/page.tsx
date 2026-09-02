import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoHowTo,
  GeneraciyaFotoMore,
  GeneraciyaFotoPricing,
  GeneraciyaFotoThemes,
  GeneraciyaFotoTools,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoFaq } from "@/components/generate/GeneraciyaFotoFaq";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import { GeneraciyaFotoStarter } from "@/components/generate/GeneraciyaFotoStarter";
import { GenerationModelsShowcase } from "@/components/generate/GenerationModelsShowcase";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getCardPhotosBySlugs,
  getFirstCardPhotoUrl,
  getStoragePublicUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import {
  flattenGeneraciyaFotoFaqAnswer,
  formatGeneraciyaFotoSocialProof,
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
} from "@/lib/generaciya-foto-seo-copy";
import { getGeneraciyaFotoChipNavigation } from "@/lib/generaciya-foto-chip-nav";
import {
  FALLBACK_GENERATION_MODELS,
  parseEnabledGenerationModels,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import {
  toGenerationExampleCard,
  withGenerationExampleFallbackTitle,
} from "@/lib/generation/example-card";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}/generaciya-foto`;

const BASE_RPC_PARAMS: Record<string, string | null> = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
};

const EMPTY_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

const getGenerationExamples = cache(async (): Promise<RouteCardsResult> => {
  try {
    return await fetchRouteCards({
      ...BASE_RPC_PARAMS,
      limit: 24,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
  } catch (error) {
    console.error("[GeneraciyaFotoPage] fetch examples failed", error);
    return EMPTY_RESULT;
  }
});

type ThemeCollagePayload = {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
};

const getThemeCollagePhotos = cache(async (): Promise<ThemeCollagePayload> => {
  const empty: ThemeCollagePayload = { photosByHref: {}, countByHref: {} };
  try {
    const results = await Promise.all(
      GENERACIYA_FOTO_THEMES.items.map((item) =>
        fetchRouteCards({
          ...BASE_RPC_PARAMS,
          [item.dimension]: item.tagValue,
          limit: 6,
          offset: 0,
          min_cards: 1,
          sort: "new",
        }).catch((error) => {
          console.error(
            `[GeneraciyaFotoPage] fetch theme ${item.tagValue} failed`,
            error
          );
          return EMPTY_RESULT;
        })
      )
    );
    const photos = await getCardPhotosBySlugs(
      results.flatMap((result) => result.cards.map((card) => card.slug))
    );
    const photosByHref: Record<string, string[]> = {};
    const countByHref: Record<string, number> = {};

    for (const [index, item] of GENERACIYA_FOTO_THEMES.items.entries()) {
      const urls: string[] = [];
      for (const card of results[index].cards) {
        const url = photos.get(card.slug)?.photoUrl;
        if (!url || urls.includes(url)) continue;
        urls.push(url);
        if (urls.length >= 4) break;
      }
      photosByHref[item.href] = urls;
      countByHref[item.href] =
        results[index].total_count || results[index].cards_count || 0;
    }

    return { photosByHref, countByHref };
  } catch (error) {
    console.error("[GeneraciyaFotoPage] fetch theme photos failed", error);
    return empty;
  }
});

const getCompletedImageGenerationCount = cache(async (): Promise<number> => {
  try {
    const supabase = createSupabaseServer();
    const { count, error } = await supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .eq("modality", "image");
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error(
      "[GeneraciyaFotoPage] fetch completed image generation count failed",
      error
    );
    return 0;
  }
});

const getGenerationModels = cache(
  async (): Promise<GenerationModelOption[]> => {
    try {
      const supabase = createSupabaseServer();
      const { data, error } = await supabase
        .from("landing_generation_config")
        .select("value")
        .eq("key", "models")
        .maybeSingle();
      if (error) throw error;
      return parseEnabledGenerationModels(data?.value);
    } catch (error) {
      console.error("[GeneraciyaFotoPage] fetch models failed", error);
      return FALLBACK_GENERATION_MODELS;
    }
  }
);

const getExampleOgImage = cache(async (): Promise<string | null> => {
  const result = await getGenerationExamples();
  if (!result.cards.length) return null;
  try {
    return await getFirstCardPhotoUrl(result.cards.map((card) => card.id));
  } catch (error) {
    console.error("[GeneraciyaFotoPage] fetch OG image failed", error);
    return null;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await getExampleOgImage();

  return {
    title: GENERACIYA_FOTO_SEO.metaTitle,
    description: GENERACIYA_FOTO_SEO.metaDescription,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: GENERACIYA_FOTO_SEO.metaTitle,
      description: GENERACIYA_FOTO_SEO.metaDescription,
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
      title: GENERACIYA_FOTO_SEO.metaTitle,
      description: GENERACIYA_FOTO_SEO.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(ogImage: string | null, cards: PromptCardFull[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Сделать фото ИИ — PromptShot",
      description: GENERACIYA_FOTO_SEO.metaDescription,
      url: PAGE_URL,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: "ru",
      ...(ogImage ? { image: ogImage } : {}),
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
          name: GENERACIYA_FOTO_SEO.breadcrumb,
          item: PAGE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: GENERACIYA_FOTO_SEO.howToTitle,
      step: GENERACIYA_FOTO_HOW_TO_STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: GENERACIYA_FOTO_FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: flattenGeneraciyaFotoFaqAnswer(item.a),
        },
      })),
    },
    ...(cards.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: GENERACIYA_FOTO_SEO.examplesTitle,
            numberOfItems: cards.length,
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: card.title_ru || card.title_en || "Промт для фото",
              ...(card.slug
                ? { url: `${SITE_URL}/p/${card.slug}` }
                : {}),
            })),
          },
        ]
      : []),
  ];
}

export default async function GeneraciyaFotoPage() {
  const [result, models, themeCollage, completedImageCount] = await Promise.all([
    getGenerationExamples(),
    getGenerationModels(),
    getThemeCollagePhotos(),
    getCompletedImageGenerationCount(),
  ]);
  const socialProof = formatGeneraciyaFotoSocialProof(completedImageCount);
  const routeCards = result.cards;
  const [enrichedCards, fallbackOgImage] = await Promise.all([
      enrichCardsWithDetails(routeCards).catch((error) => {
        console.error("[GeneraciyaFotoPage] enrich examples failed", error);
        return [] as PromptCardFull[];
      }),
      getExampleOgImage(),
    ]);
  const cardsById = new Map(enrichedCards.map((card) => [card.id, card]));
  const cards = result.cards
    .map((card) => cardsById.get(card.id))
    .filter((card): card is PromptCardFull => Boolean(card));
  const ogImage = cards[0]?.photoUrls[0] || fallbackOgImage;
  const schemas = buildJsonLd(ogImage, cards.slice(0, 16));
  const exampleCards = cards
    .map(toGenerationExampleCard)
    .map((card, index) =>
      withGenerationExampleFallbackTitle(card, `Пример фото ИИ — ${index + 1}`)
    );
  const carouselCards = takeHeroMarqueeCards(
    exampleCards.filter((card) => card.photoUrl)
  );
  const galleryCards = exampleCards.slice(0, 16);

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
        <section
          id="generator"
          className="relative scroll-mt-20 overflow-hidden"
        >
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
                {GENERACIYA_FOTO_SEO.breadcrumb}
              </span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {GENERACIYA_FOTO_SEO.h1}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {GENERACIYA_FOTO_SEO.intro}
            </p>
            <GeneraciyaFotoHeroCarousel cards={carouselCards} />
            {socialProof ? (
              <p className="mx-auto mt-3 text-sm font-medium text-indigo-700 sm:text-base">
                {socialProof}
              </p>
            ) : null}
            <GeneraciyaFotoStarter />
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              {GENERACIYA_FOTO_SEO.generatorNote}
            </p>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <GeneraciyaFotoThemes
            photosByHref={themeCollage.photosByHref}
            countByHref={themeCollage.countByHref}
          />

          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                eyebrow=""
                allPromptsLabel={GENERACIYA_FOTO_SEO.examplesCta}
                defaultAllPromptsHref="#primery"
                scenarioNavigation={getGeneraciyaFotoChipNavigation()}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает работать.
              </div>
            )}
          </section>

          <GeneraciyaFotoTools />
          <GeneraciyaFotoHowTo />
          <GeneraciyaFotoMore />

          <section aria-labelledby="generation-models-heading">
            <GenerationModelsShowcase
              models={models}
              layout="chips"
              nanoBananaHref="/nano-banana"
            />
          </section>

          <GeneraciyaFotoPricing />

          <GeneraciyaFotoFaq />
        </div>
      </main>
    </PageLayout>
  );
}
