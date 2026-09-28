import { cache } from "react";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { GeneraciyaFotoExamplesExplorer } from "@/components/generate/GeneraciyaFotoExamplesExplorer";
import {
  GeneraciyaFotoHowTo,
  GeneraciyaFotoMore,
  GeneraciyaFotoPricing,
  GeneraciyaFotoThemes,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoFaq } from "@/components/generate/GeneraciyaFotoFaq";
import { GeneraciyaHubHero } from "@/components/generate/GeneraciyaHubHero";
import { GF_PAGE_MAIN, GF_PAGE_STACK } from "@/components/generate/generaciya-foto-ui";
import { fetchNewestThemeCollagePhotos } from "@/lib/homepage-sections";
import {
  formatGeneraciyaFotoSocialProof,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_PO_FOTO_FAQ,
  GENERACIYA_PO_FOTO_HOW_TO_STEPS,
  GENERACIYA_PO_FOTO_SEO,
  generaciyaModeLinksExcept,
} from "@/lib/generaciya-foto-seo-copy";
import { GENERACIYA_PO_FOTO_PATH } from "@/lib/generaciya-foto-routes";
import { getGeneraciyaFotoChipNavigation } from "@/lib/generaciya-foto-chip-nav";
import {
  buildGeneraciyaHubJsonLd,
  GENERACIYA_BASE_RPC_PARAMS,
  getGeneraciyaCompletedImageCount,
  getGeneraciyaPopularPage,
  prepareGeneraciyaSeoCards,
  SITE_URL,
} from "@/lib/generaciya-hub-data";
import { readGeneraciyaSeoImageFlags } from "@/lib/generaciya-seo-image-config";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";

export const revalidate = 3600;

const PAGE_URL = `${SITE_URL}${GENERACIYA_PO_FOTO_PATH}`;
const MODE_LINKS = generaciyaModeLinksExcept("po-foto").map((item) => ({
  title: item.label,
  text: item.text,
  href: item.href,
}));

const getThemeCollagePhotos = cache(async () => {
  try {
    return await fetchNewestThemeCollagePhotos(GENERACIYA_FOTO_THEMES.items);
  } catch (error) {
    console.error("[PoFotoPage] fetch theme photos failed", error);
    return { photosByHref: {}, countByHref: {} };
  }
});

const PAGE_HEADINGS = [GENERACIYA_PO_FOTO_SEO.h1, GENERACIYA_PO_FOTO_SEO.examplesTitle];

const getPageCards = cache(async () => {
  const flags = await readGeneraciyaSeoImageFlags();
  const result = await getGeneraciyaPopularPage(null);
  const prepared = await prepareGeneraciyaSeoCards({
    result,
    label: "po-foto",
    flags: { ...flags, firstScreenRank: false },
    headings: PAGE_HEADINGS,
    fallbackTitle: (index) => `Фото ИИ по референсу — пример ${index + 1}`,
  });
  return { result, flags, ...prepared };
});

export async function generateMetadata(): Promise<Metadata> {
  const { ogImage } = await getPageCards();
  const title = GENERACIYA_PO_FOTO_SEO.metaTitle;

  return {
    title,
    description: GENERACIYA_PO_FOTO_SEO.metaDescription,
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
      description: GENERACIYA_PO_FOTO_SEO.metaDescription,
      url: PAGE_URL,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: GENERACIYA_PO_FOTO_SEO.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function PoFotoPage() {
  const [{ result, cards, exampleCards, ogImage, imageCaption, flags }, themeCollage, completedImageCount] =
    await Promise.all([
      getPageCards(),
      getThemeCollagePhotos(),
      getGeneraciyaCompletedImageCount(),
    ]);
  const socialProof = formatGeneraciyaFotoSocialProof(completedImageCount);
  const carouselCards = takeHeroMarqueeCards(exampleCards.filter((card) => card.photoUrl));
  const galleryCards = exampleCards;
  const schemas = buildGeneraciyaHubJsonLd({
    pageUrl: PAGE_URL,
    name: `${GENERACIYA_PO_FOTO_SEO.h1} — PromptShot`,
    description: GENERACIYA_PO_FOTO_SEO.metaDescription,
    ogImage,
    imageCaption,
    breadcrumbs: [
      { name: "Главная", item: SITE_URL },
      { name: GENERACIYA_PO_FOTO_SEO.breadcrumb, item: PAGE_URL },
    ],
    howTo: {
      name: GENERACIYA_PO_FOTO_SEO.howToTitle,
      steps: GENERACIYA_PO_FOTO_HOW_TO_STEPS,
    },
    faq: GENERACIYA_PO_FOTO_FAQ,
    itemList: {
      name: GENERACIYA_PO_FOTO_SEO.examplesTitle,
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
            { label: GENERACIYA_PO_FOTO_SEO.breadcrumb },
          ]}
          h1={GENERACIYA_PO_FOTO_SEO.h1}
          intro={GENERACIYA_PO_FOTO_SEO.intro}
          carouselCards={carouselCards}
          carouselAriaLabel="Популярные фото ИИ по своему фото"
          socialProof={socialProof}
          generatorTitle={GENERACIYA_PO_FOTO_SEO.generatorTitle}
          generatorLead={GENERACIYA_PO_FOTO_SEO.generatorLead}
          generatorNote={GENERACIYA_FOTO_SEO.generatorNote}
          starterModes={["photo"]}
          starterCopy={{
            byPhotoTitle: GENERACIYA_PO_FOTO_SEO.starterByPhotoTitle,
            byPhotoLead: GENERACIYA_PO_FOTO_SEO.starterByPhotoLead,
          }}
        />

        <div className={GF_PAGE_STACK}>
          <GeneraciyaFotoThemes
            photosByHref={themeCollage.photosByHref}
            countByHref={themeCollage.countByHref}
          />

          <section id="primery" className="scroll-mt-20" aria-labelledby="examples-heading">
            {galleryCards.length ? (
              <GeneraciyaFotoExamplesExplorer
                initialCards={galleryCards}
                eyebrow=""
                title={GENERACIYA_PO_FOTO_SEO.examplesTitle}
                intro={GENERACIYA_PO_FOTO_SEO.examplesIntro}
                allPromptsLabel={GENERACIYA_FOTO_SEO.examplesCta}
                defaultAllPromptsHref="#primery"
                scenarioNavigation={getGeneraciyaFotoChipNavigation()}
                loadMoreListing={{
                  rpcParams: GENERACIYA_BASE_RPC_PARAMS,
                  totalCount: result.total_count ?? result.cards_count,
                  initialRankedBatchSize: result.cards_count,
                  sort: "popular",
                }}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
                Примеры временно загружаются. Панель генерации продолжает работать.
              </div>
            )}
          </section>

          <GeneraciyaFotoHowTo
            title={GENERACIYA_PO_FOTO_SEO.howToTitle}
            lead={GENERACIYA_PO_FOTO_SEO.howToLead}
            cta={GENERACIYA_PO_FOTO_SEO.howToCta}
            steps={GENERACIYA_PO_FOTO_HOW_TO_STEPS}
          />

          <GeneraciyaFotoMore items={MODE_LINKS} />

          <GeneraciyaFotoPricing returnPath={GENERACIYA_PO_FOTO_PATH} />

          <GeneraciyaFotoFaq
            title={GENERACIYA_PO_FOTO_SEO.faqTitle}
            items={GENERACIYA_PO_FOTO_FAQ}
          />
        </div>
      </main>
    </PageLayout>
  );
}
