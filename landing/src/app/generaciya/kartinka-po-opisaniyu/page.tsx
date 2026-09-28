import { cache } from "react";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoHowTo,
  GeneraciyaFotoMore,
  GeneraciyaFotoPricing,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoFaq } from "@/components/generate/GeneraciyaFotoFaq";
import { GeneraciyaHowItWorks } from "@/components/generate/GeneraciyaHowItWorks";
import { GeneraciyaHubHero } from "@/components/generate/GeneraciyaHubHero";
import { GF_PAGE_MAIN, GF_PAGE_STACK } from "@/components/generate/generaciya-foto-ui";
import { GENERACIYA_FOTO_SEO } from "@/lib/generaciya-foto-seo-copy";
import { GENERACIYA_KARTINKA_PO_OPISANIYU_PATH } from "@/lib/generaciya-foto-routes";
import type { GeneraciyaFotoChipNavItem } from "@/lib/generaciya-foto-chip-nav";
import {
  buildGeneraciyaHubJsonLd,
  getGeneraciyaCompletedImageCount,
  getGeneraciyaKartinkaExamples,
  prepareGeneraciyaSeoCards,
  SITE_URL,
} from "@/lib/generaciya-hub-data";
import { readGeneraciyaSeoImageFlags } from "@/lib/generaciya-seo-image-config";
import {
  KARTINKA_PO_OPISANIYU_FAQ,
  KARTINKA_PO_OPISANIYU_HOW_IT_WORKS,
  KARTINKA_PO_OPISANIYU_HOW_TO_STEPS,
  KARTINKA_PO_OPISANIYU_MODE_LINKS,
  KARTINKA_PO_OPISANIYU_SEO,
  KARTINKA_PO_OPISANIYU_STYLE_CHIPS,
} from "@/lib/kartinka-po-opisaniyu-seo-copy";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";

export const revalidate = 3600;

const PAGE_URL = `${SITE_URL}${GENERACIYA_KARTINKA_PO_OPISANIYU_PATH}`;

const STYLE_NAVIGATION: GeneraciyaFotoChipNavItem[] =
  KARTINKA_PO_OPISANIYU_STYLE_CHIPS.map((chip) => ({
    label: chip.label,
    href: chip.href,
    kind: "scenario",
    active: false,
    dimension: "style_tag",
    value: chip.value,
  }));

const PAGE_HEADINGS = [
  KARTINKA_PO_OPISANIYU_SEO.h1,
  KARTINKA_PO_OPISANIYU_SEO.examplesTitle,
];

const getPageCards = cache(async () => {
  const flags = await readGeneraciyaSeoImageFlags();
  const result = await getGeneraciyaKartinkaExamples(flags.firstScreenRank);
  const prepared = await prepareGeneraciyaSeoCards({
    result,
    label: "kartinka-po-opisaniyu",
    flags,
    headings: PAGE_HEADINGS,
    fallbackTitle: (index) => `Картинка по описанию — пример ${index + 1}`,
  });
  return { result, flags, ...prepared };
});

function formatSocialProof(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return `Более ${Math.trunc(count).toLocaleString("ru-RU")} ${KARTINKA_PO_OPISANIYU_SEO.socialProofSuffix}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { ogImage } = await getPageCards();
  const title = KARTINKA_PO_OPISANIYU_SEO.metaTitle;

  return {
    title,
    description: KARTINKA_PO_OPISANIYU_SEO.metaDescription,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title,
      description: KARTINKA_PO_OPISANIYU_SEO.metaDescription,
      url: PAGE_URL,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: KARTINKA_PO_OPISANIYU_SEO.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function KartinkaPoOpisaniyuPage() {
  const [{ cards, exampleCards, ogImage, imageCaption, flags }, completedImageCount] =
    await Promise.all([
      getPageCards(),
      getGeneraciyaCompletedImageCount(),
    ]);
  const socialProof = formatSocialProof(completedImageCount);
  const carouselCards = takeHeroMarqueeCards(exampleCards.filter((card) => card.photoUrl));
  const galleryCards = exampleCards.slice(0, 16);
  const schemas = buildGeneraciyaHubJsonLd({
    pageUrl: PAGE_URL,
    name: `${KARTINKA_PO_OPISANIYU_SEO.h1} — PromptShot`,
    description: KARTINKA_PO_OPISANIYU_SEO.metaDescription,
    ogImage,
    imageCaption,
    breadcrumbs: [
      { name: "Главная", item: SITE_URL },
      { name: KARTINKA_PO_OPISANIYU_SEO.breadcrumb, item: PAGE_URL },
    ],
    howTo: {
      name: KARTINKA_PO_OPISANIYU_SEO.howToTitle,
      steps: KARTINKA_PO_OPISANIYU_HOW_TO_STEPS,
    },
    faq: KARTINKA_PO_OPISANIYU_FAQ,
    itemList: {
      name: KARTINKA_PO_OPISANIYU_SEO.examplesTitle,
      cards: cards.slice(0, 16),
      names: flags.descriptiveAlt
        ? exampleCards.slice(0, 16).map((card) => card.seoFrame?.alts?.[0])
        : undefined,
    },
  });

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
            { label: GENERACIYA_FOTO_SEO.sectionBreadcrumb },
            { label: KARTINKA_PO_OPISANIYU_SEO.breadcrumb },
          ]}
          h1={KARTINKA_PO_OPISANIYU_SEO.h1}
          intro={KARTINKA_PO_OPISANIYU_SEO.intro}
          carouselCards={carouselCards}
          carouselAriaLabel={KARTINKA_PO_OPISANIYU_SEO.carouselAriaLabel}
          socialProof={socialProof}
          generatorTitle={KARTINKA_PO_OPISANIYU_SEO.generatorTitle}
          generatorLead={KARTINKA_PO_OPISANIYU_SEO.generatorLead}
          generatorNote={KARTINKA_PO_OPISANIYU_SEO.generatorNote}
          starterModes={["text"]}
          starterCopy={{
            byTextTitle: KARTINKA_PO_OPISANIYU_SEO.starterByTextTitle,
            byTextLead: KARTINKA_PO_OPISANIYU_SEO.starterByTextLead,
          }}
          starterCtaLabel={KARTINKA_PO_OPISANIYU_SEO.starterCta}
        />

        <div className={GF_PAGE_STACK}>
          <section id="primery" className="scroll-mt-20" aria-labelledby="examples-heading">
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                eyebrow={KARTINKA_PO_OPISANIYU_SEO.examplesEyebrow}
                title={KARTINKA_PO_OPISANIYU_SEO.examplesTitle}
                intro={KARTINKA_PO_OPISANIYU_SEO.examplesIntro}
                allPromptsLabel={KARTINKA_PO_OPISANIYU_SEO.examplesCta}
                defaultAllPromptsHref="#primery"
                scenarioNavigation={STYLE_NAVIGATION}
                navigationAriaLabel="Стили картинок"
                filterChipsInPlace
                restrictToInitialCards
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает работать.
              </div>
            )}
          </section>

          <GeneraciyaHowItWorks
            title={KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.title}
            paragraphs={KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.paragraphs}
            tipsTitle={KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.tipsTitle}
            tips={KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.tips}
          />

          <GeneraciyaFotoHowTo
            title={KARTINKA_PO_OPISANIYU_SEO.howToTitle}
            lead={KARTINKA_PO_OPISANIYU_SEO.howToLead}
            cta={KARTINKA_PO_OPISANIYU_SEO.howToCta}
            steps={KARTINKA_PO_OPISANIYU_HOW_TO_STEPS}
          />

          <GeneraciyaFotoMore
            items={KARTINKA_PO_OPISANIYU_MODE_LINKS}
            title={KARTINKA_PO_OPISANIYU_SEO.moreTitle}
            lead={KARTINKA_PO_OPISANIYU_SEO.moreLead}
          />

          <GeneraciyaFotoPricing returnPath={GENERACIYA_KARTINKA_PO_OPISANIYU_PATH} />

          <GeneraciyaFotoFaq
            title={KARTINKA_PO_OPISANIYU_SEO.faqTitle}
            items={KARTINKA_PO_OPISANIYU_FAQ}
          />
        </div>
      </main>
    </PageLayout>
  );
}
