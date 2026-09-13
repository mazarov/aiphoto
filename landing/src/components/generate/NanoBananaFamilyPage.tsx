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
import { NanoBananaFeatures } from "@/components/generate/NanoBananaFeatures";
import { NanoBananaPreferModel } from "@/components/generate/NanoBananaPreferModel";
import { getGeneraciyaFotoChipNavigation } from "@/lib/generaciya-foto-chip-nav";
import { headingAltSlotsFromSeo } from "@/lib/hero-carousel-alt";
import type { GeneraciyaFotoFaqPart } from "@/lib/generaciya-foto-seo-copy";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import type { GenerationModelOption } from "@/lib/generation-model-labels";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";
import {
  flattenGeneraciyaFotoFaqAnswer,
  formatNanoBananaSocialProof,
  isNanoBananaProModel,
  type NanoBananaFeaturesCopy,
  type NanoBananaSeoCopy,
} from "@/lib/nano-banana-seo-copy";
import { nanoBananaSiteUrl } from "@/lib/nano-banana-page-data";
import type { PromptCardFull } from "@/lib/supabase";

export type NanoBananaBreadcrumb = {
  name: string;
  href?: string;
};

export type NanoBananaHowToStep = {
  n: string;
  title: string;
  text: string;
};

export type NanoBananaFamilyPageProps = {
  path: string;
  defaultModelId: string;
  seo: NanoBananaSeoCopy;
  applicationName: string;
  breadcrumbs: readonly NanoBananaBreadcrumb[];
  howToSteps: readonly NanoBananaHowToStep[];
  tools: { title: string; lead: string };
  features: NanoBananaFeaturesCopy;
  featuresEyebrow: string;
  pricingReturnPath: string;
  faq: readonly { q: string; a: readonly GeneraciyaFotoFaqPart[] }[];
  access: {
    eyebrow: string;
    title: string;
    lead: string;
    items: readonly { title: string; text: string }[];
  };
  cards: PromptCardFull[];
  models: GenerationModelOption[];
  completedImageCount: number;
  ogImage: string | null;
};

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

function buildJsonLd(
  props: NanoBananaFamilyPageProps,
  siteUrl: string,
  cards: PromptCardFull[]
) {
  const pageUrl = `${siteUrl}${props.path}`;
  const exampleFallback = `Пример фото ${props.seo.h1.replace(/\s*\(.*$/, "")}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: props.applicationName,
      description: props.seo.metaDescription,
      url: pageUrl,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: "ru",
      ...(props.ogImage ? { image: props.ogImage } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: props.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item:
          crumb.href === "/"
            ? siteUrl
            : crumb.href
              ? `${siteUrl}${crumb.href}`
              : pageUrl,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: props.seo.howToTitle,
      step: props.howToSteps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: props.faq.map((item) => ({
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
            name: props.seo.examplesTitle,
            numberOfItems: cards.length,
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: card.title_ru || card.title_en || exampleFallback,
              ...(card.slug ? { url: `${siteUrl}/p/${card.slug}` } : {}),
            })),
          },
        ]
      : []),
  ];
}

export function NanoBananaFamilyPage(props: NanoBananaFamilyPageProps) {
  const siteUrl = nanoBananaSiteUrl();
  const socialProof = formatNanoBananaSocialProof(
    props.completedImageCount,
    props.seo
  );
  const schemas = buildJsonLd(props, siteUrl, props.cards.slice(0, 16));
  const exampleCards = props.cards.map(toGenerationExampleCard);
  const carouselCards = takeHeroMarqueeCards(
    exampleCards.filter((card) => card.photoUrl)
  );
  const galleryCards = exampleCards.slice(0, 16);

  return (
    <PageLayout showFooterWithGenerateDock>
      {isNanoBananaProModel(props.defaultModelId) ? (
        <NanoBananaPreferModel modelId={props.defaultModelId} />
      ) : null}
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
              {props.breadcrumbs.map((crumb, index) => {
                const last = index === props.breadcrumbs.length - 1;
                return (
                  <span key={`${crumb.name}-${index}`} className="contents">
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    {last || !crumb.href ? (
                      <span className="font-medium text-zinc-700">
                        {crumb.name}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="transition-colors hover:text-zinc-700"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {props.seo.h1}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {props.seo.intro}
            </p>
            <GeneraciyaFotoHeroCarousel
              cards={carouselCards}
              ctaLabel={props.seo.secondaryCta}
              headingAltSlots={headingAltSlotsFromSeo({
                h1: props.seo.h1,
                explorerTitle: props.seo.examplesTitle,
              })}
            />
            {socialProof ? (
              <p className="mx-auto mt-3 text-sm font-medium text-indigo-700 sm:text-base">
                {socialProof}
              </p>
            ) : null}
            <GeneraciyaFotoStarter
              copy={{
                byTextTitle: props.seo.starterByTextTitle,
                byTextLead: props.seo.starterByTextLead,
                byPhotoTitle: props.seo.starterByPhotoTitle,
                byPhotoLead: props.seo.starterByPhotoLead,
              }}
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <section aria-labelledby="generation-models-heading">
            <GenerationModelsShowcase
              models={props.models}
              eyebrow={props.seo.modelsEyebrow}
              title={props.seo.modelsTitle}
              lead={props.seo.modelsLead}
              layout="chips"
              googleBranded
              linkNanoBananaFamily
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
                title={props.seo.examplesTitle}
                intro={props.seo.examplesIntro}
                allPromptsLabel={props.seo.examplesCta}
                defaultAllPromptsHref={props.seo.examplesMoreHref}
                scenarioNavigation={getGeneraciyaFotoChipNavigation()}
                filterChipsInPlace
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает
                работать.
              </div>
            )}
          </section>

          <NanoBananaFeatures
            eyebrow={props.featuresEyebrow}
            features={props.features}
          />
          <GeneraciyaFotoTools
            title={props.tools.title}
            lead={props.tools.lead}
          />
          <GeneraciyaFotoHowTo
            title={props.seo.howToTitle}
            lead={props.seo.howToLead}
            cta={props.seo.howToCta}
            steps={props.howToSteps}
          />
          <NanoBananaAccess
            eyebrow={props.access.eyebrow}
            title={props.access.title}
            lead={props.access.lead}
            items={props.access.items}
          />

          <GeneraciyaFotoPricing returnPath={props.pricingReturnPath} />

          <NanoBananaFaq title={props.seo.faqTitle} items={props.faq} />
        </div>
      </main>
    </PageLayout>
  );
}
