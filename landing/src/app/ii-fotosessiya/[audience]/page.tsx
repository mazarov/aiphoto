import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoPricing,
  GeneraciyaFotoThemes,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import {
  FotosessiiHeroStart,
  PromtyDlyaIiFotosessiiHowTo,
  PromtyDlyaIiFotosessiiPlainFaq,
} from "@/components/fotosessii/PromtyDlyaIiFotosessiiLandingSections";
import { FotosessiiPromptsSection } from "@/components/fotosessii/FotosessiiPromptsSection";
import type { PromptCardFull } from "@/lib/supabase";
import {
  MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS,
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  findPromtyDlyaIiFotosessiiChild,
  getPromtyDlyaIiFotosessiiChildPath,
  getPromtyDlyaIiFotosessiiChipNavigation,
} from "@/lib/promty-dlya-ii-fotosessii-cluster";
import {
  PROMTY_DLYA_II_FOTOSESSII_SEO,
  PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS,
  findPromtyDlyaIiFotosessiiChildCopy,
  type FotosessiiChildCopy,
} from "@/lib/promty-dlya-ii-fotosessii-seo-copy";
import {
  getFotosessiiChildCards,
  getFotosessiiThemeCollagePhotos,
} from "@/lib/promty-dlya-ii-fotosessii-page-data";
import { toGenerationExampleCard } from "@/lib/generation/example-card";

export const revalidate = 3600;
export const dynamicParams = true;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

type Props = {
  params: Promise<{ audience: string }>;
};

function resolveChild(slug: string) {
  const route = findPromtyDlyaIiFotosessiiChild(slug);
  const copy = findPromtyDlyaIiFotosessiiChildCopy(slug);
  if (!route || !copy) notFound();
  return { route, copy };
}

const getChildOgImage = cache(async (slug: string): Promise<string | null> => {
  const cards = await getFotosessiiChildCards(slug);
  return cards[0]?.photoUrls[0] || null;
});

export function generateStaticParams() {
  return PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map(({ slug }) => ({
    audience: slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { audience: slug } = await params;
  const { copy } = resolveChild(slug);
  const cards = await getFotosessiiChildCards(slug);
  const ogImage = await getChildOgImage(slug);
  const pageUrl = `${SITE_URL}${getPromtyDlyaIiFotosessiiChildPath(copy.slug)}`;
  const shouldIndex = cards.length >= MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS;

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
  copy: FotosessiiChildCopy,
  ogImage: string | null,
  cards: PromptCardFull[]
) {
  const pageUrl = `${SITE_URL}${getPromtyDlyaIiFotosessiiChildPath(copy.slug)}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: copy.h1,
      description: copy.metaDescription,
      url: pageUrl,
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
          name: PROMTY_DLYA_II_FOTOSESSII_SEO.breadcrumb,
          item: `${SITE_URL}${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: copy.h1,
          item: pageUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: copy.howToTitle,
      step: copy.howToSteps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
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
              ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
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

export default async function PromtyDlyaIiFotosessiiChildPage({
  params,
}: Props) {
  const { audience: slug } = await params;
  const { copy } = resolveChild(slug);
  const [cards, themeCollage] = await Promise.all([
    getFotosessiiChildCards(slug),
    getFotosessiiThemeCollagePhotos(),
  ]);

  const ogImage = cards[0]?.photoUrls[0] || (await getChildOgImage(slug));
  const galleryCards = cards.map(toGenerationExampleCard).slice(0, 16);
  const carouselCards = cards
    .map(toGenerationExampleCard)
    .filter((card) => card.photoUrl)
    .slice(0, 50);
  const schemas = buildJsonLd(copy, ogImage, cards.slice(0, 16));

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
              <BreadcrumbSeparator />
              <Link
                href={PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}
                className="transition-colors hover:text-zinc-700"
              >
                {PROMTY_DLYA_II_FOTOSESSII_SEO.breadcrumb}
              </Link>
              <BreadcrumbSeparator />
              <span className="font-medium text-zinc-700">{copy.h1}</span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {copy.h1}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {copy.intro}
            </p>
            <FotosessiiHeroStart
              label={PROMTY_DLYA_II_FOTOSESSII_SEO.heroCta}
            />
            <GeneraciyaFotoHeroCarousel
              cards={carouselCards}
              ctaLabel={PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta}
              ctaHref={copy.carouselCtaHref}
              ariaLabel={`Примеры: ${copy.h1}`}
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <GeneraciyaFotoThemes
            photosByHref={themeCollage.photosByHref}
            countByHref={themeCollage.countByHref}
            title={copy.themesTitle}
            lead={copy.themesLead}
            items={PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS}
            countKind="prompts"
          />

          <FotosessiiPromptsSection
            cards={cards}
            title={copy.promptsTitle}
            lead={copy.promptsLead}
          />

          <PromtyDlyaIiFotosessiiHowTo copy={copy} />

          <section
            id="primery"
            className="scroll-mt-20"
            aria-labelledby="examples-heading"
          >
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                title={copy.examplesTitle}
                intro={copy.examplesIntro}
                eyebrow=""
                allPromptsLabel={copy.examplesCta}
                scenarioNavigation={getPromtyDlyaIiFotosessiiChipNavigation(
                  copy.slug
                )}
                lockCardsToScenario
                restrictToInitialCards
                navigationAriaLabel={copy.themesTitle}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются.
              </div>
            )}
          </section>

          <GeneraciyaFotoPricing
            returnPath={getPromtyDlyaIiFotosessiiChildPath(copy.slug)}
            lead={copy.pricingLead}
          />
          <PromtyDlyaIiFotosessiiPlainFaq title={copy.faqTitle} items={copy.faq} />
        </div>
      </main>
    </PageLayout>
  );
}
