import { cache, Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdLandingHeading } from "@/components/AdLandingHeading";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import { GeneraciyaHubHero } from "@/components/generate/GeneraciyaHubHero";
import { GF_HERO_H1, GF_PAGE_MAIN, GF_PAGE_STACK } from "@/components/generate/generaciya-foto-ui";
import {
  fetchRouteCards,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import { prepareGeneraciyaSeoCards } from "@/lib/generaciya-hub-data";
import { readGeneraciyaSeoImageFlags } from "@/lib/generaciya-seo-image-config";
import { generaciyaPopularPageParams } from "@/lib/generaciya-seo-fetch";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  GENERACIYA_PO_FOTO_PATH,
  MIN_GENERACIYA_FOTO_SCENARIO_CARDS,
  findGeneraciyaFotoScenarioRoute,
  getGeneraciyaFotoScenarioPath,
} from "@/lib/generaciya-foto-routes";
import { getGeneraciyaFotoChipNavigation } from "@/lib/generaciya-foto-chip-nav";
import {
  buildGeneraciyaFotoScenarioDescription,
  findGeneraciyaFotoScenarioCopy,
  getGeneraciyaFotoScenarioStarterPrompt,
  type GeneraciyaFotoScenarioCopy,
} from "@/lib/generaciya-foto-scenario-copy";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";
import {
  GENERACIYA_FOTO_SEO,
  GENERACIYA_PO_FOTO_SEO,
} from "@/lib/generaciya-foto-seo-copy";

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

const getScenarioPage = cache(async (slug: string) => {
  const route = findGeneraciyaFotoScenarioRoute(slug);
  const copy = findGeneraciyaFotoScenarioCopy(slug);
  const flags = await readGeneraciyaSeoImageFlags();
  let result = EMPTY_RESULT;
  if (route) {
    try {
      result = await fetchRouteCards(generaciyaPopularPageParams(route));
    } catch (error) {
      console.error(
        `[GeneraciyaFotoScenarioPage] fetch examples failed: ${slug}`,
        error,
      );
    }
  }
  const prepared = await prepareGeneraciyaSeoCards({
    result,
    label: slug,
    flags: { ...flags, firstScreenRank: false },
    headings: copy ? [copy.h1, copy.examplesTitle] : [],
    fallbackTitle: (index) =>
      `Пример: ${(copy?.label || slug).toLowerCase()} — ${index + 1}`,
  });
  return { result, flags, ...prepared };
});

export function generateStaticParams() {
  return GENERACIYA_FOTO_SCENARIO_ROUTES.map(({ slug }) => ({ scenario: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scenario: slug } = await params;
  const { copy } = resolveScenario(slug);
  const { result, ogImage } = await getScenarioPage(slug);
  const pageUrl = `${SITE_URL}${getGeneraciyaFotoScenarioPath(copy.slug)}`;
  const totalCount = result.total_count ?? result.cards_count;
  const shouldIndex =
    result.tier_used !== "error" &&
    totalCount >= MIN_GENERACIYA_FOTO_SCENARIO_CARDS;
  const description = buildGeneraciyaFotoScenarioDescription(copy, totalCount);

  return {
    title: copy.metaTitle,
    description,
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
      description,
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
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function buildJsonLd(
  copy: GeneraciyaFotoScenarioCopy,
  ogImage: string | null,
  imageCaption: string | null,
  cards: PromptCardFull[],
  names?: readonly (string | null | undefined)[],
) {
  const image = ogImage
    ? imageCaption
      ? { "@type": "ImageObject", url: ogImage, caption: imageCaption }
      : ogImage
    : undefined;
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
      ...(image ? { image } : {}),
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
          name: GENERACIYA_PO_FOTO_SEO.breadcrumb,
          item: `${SITE_URL}${GENERACIYA_PO_FOTO_PATH}`,
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
              name:
                names?.[index]?.trim() ||
                card.title_ru ||
                card.title_en ||
                "Промт для фото",
              ...(card.slug
                ? { url: `${SITE_URL}/p/${card.slug}` }
                : {}),
            })),
          },
        ]
      : []),
  ];
}

export default async function GeneraciyaFotoScenarioPage({ params }: Props) {
  const { scenario: slug } = await params;
  const { route, copy } = resolveScenario(slug);
  const { result, cards, exampleCards, ogImage, imageCaption, flags } =
    await getScenarioPage(slug);
  const schemas = buildJsonLd(
    copy,
    ogImage,
    imageCaption,
    cards,
    flags.descriptiveAlt
      ? exampleCards.map((card) => card.seoFrame?.alts?.[0])
      : undefined,
  );
  const galleryCards = exampleCards;
  const carouselCards = takeHeroMarqueeCards(
    exampleCards.filter((card) => card.photoUrl)
  );
  const starterPrompt = getGeneraciyaFotoScenarioStarterPrompt(copy);

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

      <main className={GF_PAGE_MAIN}>
        <GeneraciyaHubHero
          breadcrumbs={[
            { label: "Главная", href: "/" },
            { label: GENERACIYA_PO_FOTO_SEO.breadcrumb, href: GENERACIYA_PO_FOTO_PATH },
            { label: copy.label },
          ]}
          h1={copy.h1}
          heading={
            <Suspense fallback={<h1 className={GF_HERO_H1}>{copy.h1}</h1>}>
              <AdLandingHeading
                path={getGeneraciyaFotoScenarioPath(copy.slug)}
                fallback={copy.h1}
                className={GF_HERO_H1}
              />
            </Suspense>
          }
          intro={copy.intro}
          carouselCards={carouselCards}
          carouselAriaLabel={`Примеры: ${copy.h1}`}
          socialProof={null}
          generatorNote={GENERACIYA_FOTO_SEO.generatorNote}
          starterModes={["text", "photo"]}
          starterInitialPrompt={starterPrompt}
          starterSectionId="scenario-generator"
          starterCopy={{
            byTextTitle: "Создать по описанию",
            byTextLead: `Промт для темы «${copy.label}» уже подготовлен`,
            byPhotoTitle: "Создать по своему фото",
            byPhotoLead: "Загрузите снимок — промт соберём автоматически",
          }}
        />

        <div className={GF_PAGE_STACK}>
          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {cards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                title={copy.examplesTitle}
                intro={copy.examplesIntro}
                allPromptsLabel={GENERACIYA_FOTO_SEO.examplesCta}
                scenarioNavigation={getGeneraciyaFotoChipNavigation(slug)}
                lockCardsToScenario
                loadMoreListing={{
                  rpcParams: {
                    ...BASE_RPC_PARAMS,
                    [route.dimension]: route.tagValue,
                  },
                  totalCount: result.total_count ?? result.cards_count,
                  initialRankedBatchSize: result.cards_count,
                  sort: "popular",
                }}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает
                работать.
              </div>
            )}
          </section>

          <section aria-labelledby="scenario-prompt">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Готовый старт
            </p>
            <h2
              id="scenario-prompt"
              className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              Промт для первого результата
            </h2>
            <div className="mt-4 max-w-3xl rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              <p className="text-sm leading-relaxed text-zinc-700 sm:text-base">
                {starterPrompt}
              </p>
              <Link
                href="#scenario-generator"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Перейти к генератору
              </Link>
            </div>
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

          <section
            aria-labelledby="scenario-related"
            className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 sm:p-6"
          >
            <h2
              id="scenario-related"
              className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl"
            >
              Больше идей по этой теме
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Здесь создаётся один кадр. Для серии снимков или просмотра
              готовых промтов откройте тематическую подборку.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={copy.promptCatalogHref}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                {copy.promptCatalogLabel}
              </Link>
              <Link
                href={GENERACIYA_PO_FOTO_PATH}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                Все сценарии генерации
              </Link>
            </div>
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
