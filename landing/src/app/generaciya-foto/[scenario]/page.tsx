import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  MIN_GENERACIYA_FOTO_SCENARIO_CARDS,
  findGeneraciyaFotoScenarioRoute,
  getGeneraciyaFotoScenarioPath,
} from "@/lib/generaciya-foto-routes";
import {
  findGeneraciyaFotoScenarioCopy,
  type GeneraciyaFotoScenarioCopy,
} from "@/lib/generaciya-foto-scenario-copy";
import { toGenerationExampleCard } from "@/lib/generation/example-card";

export const revalidate = 3600;
export const dynamicParams = false;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

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

const HOW_TO_TITLES = [
  "Выберите идею",
  "Уточните описание",
  "Добавьте референс",
  "Запустите генерацию",
] as const;

type Props = {
  params: Promise<{ scenario: string }>;
};

function resolveScenario(slug: string) {
  const route = findGeneraciyaFotoScenarioRoute(slug);
  const copy = findGeneraciyaFotoScenarioCopy(slug);
  if (!route || !copy) notFound();
  return { route, copy };
}

const getScenarioCards = cache(
  async (slug: string): Promise<RouteCardsResult> => {
    const route = findGeneraciyaFotoScenarioRoute(slug);
    if (!route) return EMPTY_RESULT;

    try {
      return await fetchRouteCards({
        ...BASE_RPC_PARAMS,
        [route.dimension]: route.tagValue,
        limit: 16,
        offset: 0,
        min_cards: 1,
        sort: "new",
      });
    } catch (error) {
      console.error(
        `[GeneraciyaFotoScenarioPage] fetch examples failed: ${slug}`,
        error
      );
      return EMPTY_RESULT;
    }
  }
);

const getScenarioOgImage = cache(async (slug: string): Promise<string | null> => {
  const result = await getScenarioCards(slug);
  if (!result.cards.length) return null;

  try {
    return await getFirstCardPhotoUrl(result.cards.map((card) => card.id));
  } catch (error) {
    console.error(
      `[GeneraciyaFotoScenarioPage] fetch OG image failed: ${slug}`,
      error
    );
    return null;
  }
});

export function generateStaticParams() {
  return GENERACIYA_FOTO_SCENARIO_ROUTES.map(({ slug }) => ({ scenario: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scenario: slug } = await params;
  const { copy } = resolveScenario(slug);
  const result = await getScenarioCards(slug);
  const ogImage = await getScenarioOgImage(slug);
  const pageUrl = `${SITE_URL}${getGeneraciyaFotoScenarioPath(copy.slug)}`;
  const totalCount = result.total_count ?? result.cards_count;
  const shouldIndex =
    result.tier_used !== "error" &&
    totalCount >= MIN_GENERACIYA_FOTO_SCENARIO_CARDS;

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: shouldIndex
      ? {
          index: true,
          follow: true,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
          "max-video-preview": -1,
        }
      : { index: false, follow: true },
    alternates: { canonical: pageUrl },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      url: pageUrl,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metaTitle,
      description: copy.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(
  copy: GeneraciyaFotoScenarioCopy,
  ogImage: string | null,
  cards: PromptCardFull[]
) {
  const pageUrl = `${SITE_URL}${getGeneraciyaFotoScenarioPath(copy.slug)}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: copy.h1,
      description: copy.metaDescription,
      url: pageUrl,
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
          item: `${SITE_URL}/generaciya-foto`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: copy.label,
          item: pageUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: copy.howToTitle,
      step: copy.howToSteps.map((text, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((item) => ({
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
            name: copy.examplesTitle,
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

function BreadcrumbSeparator() {
  return (
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
  );
}

export default async function GeneraciyaFotoScenarioPage({ params }: Props) {
  const { scenario: slug } = await params;
  const { copy } = resolveScenario(slug);
  const result = await getScenarioCards(slug);

  let cards: PromptCardFull[] = [];
  try {
    cards = await enrichCardsWithDetails(result.cards);
  } catch (error) {
    console.error(
      `[GeneraciyaFotoScenarioPage] enrich examples failed: ${slug}`,
      error
    );
  }

  const ogImage = cards[0]?.photoUrls[0] || (await getScenarioOgImage(slug));
  const schemas = buildJsonLd(copy, ogImage, cards);
  const exampleCards = cards.map(toGenerationExampleCard);

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
              <BreadcrumbSeparator />
              <Link
                href="/generaciya-foto"
                className="transition-colors hover:text-zinc-700"
              >
                Генерация фото
              </Link>
              <BreadcrumbSeparator />
              <span className="font-medium text-zinc-700">{copy.label}</span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {copy.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:text-lg">
              {copy.intro}
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
              <GeneraciyaFotoExamplesExplorer
                initialCards={exampleCards}
                title={copy.examplesTitle}
                intro={copy.examplesIntro}
                defaultAllPromptsHref={copy.promptCatalogHref}
                scenarioNavigation={GENERACIYA_FOTO_SCENARIO_ROUTES.map(
                  (scenario) => ({
                    label: scenario.label,
                    href: getGeneraciyaFotoScenarioPath(scenario.slug),
                    active: scenario.slug === slug,
                  })
                )}
                lockCardsToScenario
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает
                работать.
              </div>
            )}
          </section>

          <section aria-labelledby="scenario-how-to">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Четыре шага
            </p>
            <h2
              id="scenario-how-to"
              className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              {copy.howToTitle}
            </h2>
            <ol className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {copy.howToSteps.map((step, index) => (
                <li
                  key={step}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-zinc-900">
                    {HOW_TO_TITLES[index]}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {copy.contentBlocks.map((block) => (
            <section key={block.h2}>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {block.h2}
              </h2>
              <div className="mt-4 max-w-3xl space-y-4">
                {block.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-relaxed text-zinc-600 sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-7">
            <h2 className="text-xl font-bold text-zinc-900">
              Нужны готовые формулировки?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Откройте тематическую подборку, скопируйте подходящий промт и
              измените детали под свою задачу.
            </p>
            <Link
              href={copy.promptCatalogHref}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {copy.promptCatalogLabel}
            </Link>
          </section>

          <section aria-labelledby="scenario-faq">
            <h2
              id="scenario-faq"
              className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              Частые вопросы
            </h2>
            <dl className="mt-6 space-y-3">
              {copy.faq.map((item) => (
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
