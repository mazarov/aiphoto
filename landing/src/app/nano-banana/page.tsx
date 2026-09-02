import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoHowTo,
  GeneraciyaFotoPricing,
  GeneraciyaFotoTools,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import { GeneraciyaFotoStarter } from "@/components/generate/GeneraciyaFotoStarter";
import { GenerationModelsShowcase } from "@/components/generate/GenerationModelsShowcase";
import { NanoBananaAccess } from "@/components/generate/NanoBananaAccess";
import { NanoBananaFaq } from "@/components/generate/NanoBananaFaq";
import { NanoBananaPreferModel } from "@/components/generate/NanoBananaPreferModel";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import { getGeneraciyaFotoChipNavigation } from "@/lib/generaciya-foto-chip-nav";
import {
  FALLBACK_GENERATION_MODELS,
  filterNanoBananaFamilyModels,
  parseEnabledGenerationModels,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import {
  flattenGeneraciyaFotoFaqAnswer,
  formatNanoBananaSocialProof,
  NANO_BANANA_FAQ,
  NANO_BANANA_HOW_TO_STEPS,
  NANO_BANANA_PATH,
  NANO_BANANA_PRICING,
  NANO_BANANA_SEO,
  NANO_BANANA_TOOLS,
} from "@/lib/nano-banana-seo-copy";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}${NANO_BANANA_PATH}`;

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
      limit: 50,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
  } catch (error) {
    console.error("[NanoBananaPage] fetch examples failed", error);
    return EMPTY_RESULT;
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
      "[NanoBananaPage] fetch completed image generation count failed",
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
      const filtered = filterNanoBananaFamilyModels(
        parseEnabledGenerationModels(data?.value)
      );
      return filtered.length
        ? filtered
        : filterNanoBananaFamilyModels(FALLBACK_GENERATION_MODELS);
    } catch (error) {
      console.error("[NanoBananaPage] fetch models failed", error);
      return filterNanoBananaFamilyModels(FALLBACK_GENERATION_MODELS);
    }
  }
);

const getExampleOgImage = cache(async (): Promise<string | null> => {
  const result = await getGenerationExamples();
  if (!result.cards.length) return null;
  try {
    return await getFirstCardPhotoUrl(result.cards.map((card) => card.id));
  } catch (error) {
    console.error("[NanoBananaPage] fetch OG image failed", error);
    return null;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await getExampleOgImage();

  return {
    title: NANO_BANANA_SEO.metaTitle,
    description: NANO_BANANA_SEO.metaDescription,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: NANO_BANANA_SEO.metaTitle,
      description: NANO_BANANA_SEO.metaDescription,
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
      title: NANO_BANANA_SEO.metaTitle,
      description: NANO_BANANA_SEO.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(ogImage: string | null, cards: PromptCardFull[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Nano Banana — PromptShot",
      description: NANO_BANANA_SEO.metaDescription,
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
          name: NANO_BANANA_SEO.breadcrumb,
          item: PAGE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: NANO_BANANA_SEO.howToTitle,
      step: NANO_BANANA_HOW_TO_STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: NANO_BANANA_FAQ.map((item) => ({
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
            name: NANO_BANANA_SEO.examplesTitle,
            numberOfItems: cards.length,
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: card.title_ru || card.title_en || "Пример фото Nano Banana",
              ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
            })),
          },
        ]
      : []),
  ];
}

export default async function NanoBananaPage() {
  const [result, models, completedImageCount] = await Promise.all([
    getGenerationExamples(),
    getGenerationModels(),
    getCompletedImageGenerationCount(),
  ]);
  const socialProof = formatNanoBananaSocialProof(completedImageCount);
  const routeCards = result.cards;
  const [enrichedCards, fallbackOgImage] = await Promise.all([
    enrichCardsWithDetails(routeCards).catch((error) => {
      console.error("[NanoBananaPage] enrich examples failed", error);
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
  const exampleCards = cards.map(toGenerationExampleCard);
  const carouselCards = exampleCards.filter((card) => card.photoUrl).slice(0, 50);
  const galleryCards = exampleCards.slice(0, 16);

  return (
    <PageLayout showFooterWithGenerateDock>
      <NanoBananaPreferModel />
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
                {NANO_BANANA_SEO.breadcrumb}
              </span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {NANO_BANANA_SEO.h1}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {NANO_BANANA_SEO.intro}
            </p>
            <GeneraciyaFotoHeroCarousel
              cards={carouselCards}
              ctaLabel={NANO_BANANA_SEO.secondaryCta}
            />
            {socialProof ? (
              <p className="mx-auto mt-3 text-sm font-medium text-indigo-700 sm:text-base">
                {socialProof}
              </p>
            ) : null}
            <GeneraciyaFotoStarter
              copy={{
                byTextTitle: NANO_BANANA_SEO.starterByTextTitle,
                byTextLead: NANO_BANANA_SEO.starterByTextLead,
                byPhotoTitle: NANO_BANANA_SEO.starterByPhotoTitle,
                byPhotoLead: NANO_BANANA_SEO.starterByPhotoLead,
              }}
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <section aria-labelledby="generation-models-heading">
            <GenerationModelsShowcase
              models={models}
              eyebrow={NANO_BANANA_SEO.modelsEyebrow}
              title={NANO_BANANA_SEO.modelsTitle}
              lead={NANO_BANANA_SEO.modelsLead}
              layout="chips"
              googleBranded
            />
          </section>

          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                eyebrow=""
                title={NANO_BANANA_SEO.examplesTitle}
                intro={NANO_BANANA_SEO.examplesIntro}
                allPromptsLabel={NANO_BANANA_SEO.examplesCta}
                defaultAllPromptsHref={NANO_BANANA_SEO.examplesMoreHref}
                scenarioNavigation={getGeneraciyaFotoChipNavigation()}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает работать.
              </div>
            )}
          </section>

          <GeneraciyaFotoTools
            title={NANO_BANANA_TOOLS.title}
            lead={NANO_BANANA_TOOLS.lead}
          />
          <GeneraciyaFotoHowTo
            title={NANO_BANANA_SEO.howToTitle}
            lead={NANO_BANANA_SEO.howToLead}
            cta={NANO_BANANA_SEO.howToCta}
            steps={NANO_BANANA_HOW_TO_STEPS}
          />
          <NanoBananaAccess />

          <GeneraciyaFotoPricing returnPath={NANO_BANANA_PRICING.returnPath} />

          <NanoBananaFaq />
        </div>
      </main>
    </PageLayout>
  );
}
