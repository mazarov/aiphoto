import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import { GenerationModelsShowcase } from "@/components/generate/GenerationModelsShowcase";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  getStoragePublicUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import {
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_SEO,
} from "@/lib/generaciya-foto-seo-copy";
import {
  FALLBACK_GENERATION_MODELS,
  parseEnabledGenerationModels,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { toGenerationExampleCard } from "@/lib/generation/example-card";

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

const HOW_TO_TITLES = [
  "Опишите идею",
  "Выберите настройки",
  "Запустите генерацию",
  "Скачайте результат",
] as const;

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
      limit: 16,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
  } catch (error) {
    console.error("[GeneraciyaFotoPage] fetch examples failed", error);
    return EMPTY_RESULT;
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

async function getLatestPublishedGenerationPreviews(
  models: GenerationModelOption[]
): Promise<Record<string, string>> {
  if (!models.length) return {};

  try {
    const supabase = createSupabaseServer();
    const rows = await Promise.all(
      models.map(async (model) => {
        const { data, error } = await supabase
          .from("landing_generations")
          .select(
            "model,result_storage_bucket,result_storage_path,prompt_cards!landing_generations_ugc_card_id_fkey!inner(is_published)"
          )
          .eq("model", model.id)
          .eq("status", "completed")
          .eq("prompt_cards.is_published", true)
          .not("generation_completed_at", "is", null)
          .not("result_storage_bucket", "is", null)
          .not("result_storage_path", "is", null)
          .order("generation_completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error(
            "[GeneraciyaFotoPage] fetch model preview failed",
            model.id,
            error
          );
          return null;
        }
        return data;
      })
    );
    const previews: Record<string, string> = {};

    for (const row of rows) {
      if (!row) continue;
      const modelId = row.model as string | null;
      const bucket = row.result_storage_bucket as string | null;
      const path = row.result_storage_path as string | null;
      if (!modelId || !bucket || !path) continue;
      previews[modelId] = getStoragePublicUrl(bucket, path);
    }

    return previews;
  } catch (error) {
    console.error(
      "[GeneraciyaFotoPage] fetch model generation previews failed",
      error
    );
    return {};
  }
}

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
      name: "Генерация фото ИИ — PromptShot",
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
          name: "Генерация фото",
          item: PAGE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: GENERACIYA_FOTO_SEO.howToTitle,
      step: GENERACIYA_FOTO_SEO.howToSteps.map((text, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: GENERACIYA_FOTO_FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
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
  const [result, models] = await Promise.all([
    getGenerationExamples(),
    getGenerationModels(),
  ]);
  const routeCards = result.cards;
  const [enrichedCards, fallbackOgImage, modelGenerationPreviews] =
    await Promise.all([
      enrichCardsWithDetails(routeCards).catch((error) => {
        console.error("[GeneraciyaFotoPage] enrich examples failed", error);
        return [] as PromptCardFull[];
      }),
      getExampleOgImage(),
      getLatestPublishedGenerationPreviews(models),
    ]);
  const cardsById = new Map(enrichedCards.map((card) => [card.id, card]));
  const cards = result.cards
    .map((card) => cardsById.get(card.id))
    .filter((card): card is PromptCardFull => Boolean(card));
  const ogImage = cards[0]?.photoUrls[0] || fallbackOgImage;
  const schemas = buildJsonLd(ogImage, cards);
  const exampleCards = cards.map(toGenerationExampleCard);
  const modelPreviewImages = Array.from(
    new Set(cards.flatMap((card) => card.photoUrls))
  ).slice(0, 12);

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
              <span className="font-medium text-zinc-700">Генерация фото</span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {GENERACIYA_FOTO_SEO.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:text-lg">
              {GENERACIYA_FOTO_SEO.intro}
            </p>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-3 pt-12 sm:gap-16 sm:px-5 sm:pt-16 lg:gap-20 lg:pt-20 xl:px-6">
          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {cards.length ? (
              <GeneraciyaFotoExamplesExplorer initialCards={exampleCards} />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает работать.
              </div>
            )}
          </section>

          <section aria-labelledby="generation-models-heading">
            <GenerationModelsShowcase
              models={models}
              previewImages={modelPreviewImages}
              generationPreviewByModel={modelGenerationPreviews}
            />
          </section>

          <section>
            <div className="overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 py-6 shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)] sm:px-5 sm:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Четыре простых шага
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                    {GENERACIYA_FOTO_SEO.howToTitle}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                    От первого описания до готового изображения — без сложных
                    настроек и переключения между сервисами.
                  </p>
                </div>
                <Link
                  href="#generator"
                  className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-white px-5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  Начать с идеи
                </Link>
              </div>

              <div className="relative mt-8">
                <div
                  className="absolute bottom-5 left-5 top-5 w-px bg-gradient-to-b from-indigo-400 via-violet-300 to-indigo-100 lg:bottom-auto lg:left-[12.5%] lg:right-[12.5%] lg:top-5 lg:h-px lg:w-auto lg:bg-gradient-to-r"
                  aria-hidden
                />
                <ol className="grid gap-7 lg:grid-cols-4 lg:gap-5">
                  {GENERACIYA_FOTO_SEO.howToSteps.map((step, index) => (
                    <li
                      key={step}
                      className="relative z-10 flex gap-4 lg:block lg:text-center"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 lg:mx-auto">
                        {index + 1}
                      </span>
                      <div className="min-w-0 pt-1 lg:pt-4">
                        <h3 className="text-base font-semibold text-zinc-900">
                          {HOW_TO_TITLES[index]}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                          {step}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              {GENERACIYA_FOTO_SEO.faqTitle}
            </h2>
            <dl className="mt-6 space-y-3">
              {GENERACIYA_FOTO_FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5"
                >
                  <dt className="font-semibold text-zinc-900">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
