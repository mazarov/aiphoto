import { cache } from "react";
import type { Metadata } from "next";
import {
  enrichCardsWithDetails,
  fetchHomepageSections,
  fetchRouteCards,
  type PromptCardFull,
} from "@/lib/supabase";
import { TAG_REGISTRY } from "@/lib/tag-registry";
import { HOMEPAGE_SEO, HOMEPAGE_FAQ } from "@/lib/homepage-seo-copy";
import { getHomepageCatalogThemeItems } from "@/lib/homepage-explorer-chips";
import { fetchNewestThemeCollagePhotos } from "@/lib/homepage-sections";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import { takeHeroMarqueeCards } from "@/lib/hero-marquee";
import { PageLayout } from "@/components/PageLayout";
import { HomeHeroDestinations } from "@/components/HomeHeroDestinations";
import { HomeFaq, HomeIntroAndHowTo } from "@/components/HomeSeoBlocks";
import { HomepageExamplesExplorer } from "@/components/home/HomepageExamplesExplorer";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import { GeneraciyaFotoThemes } from "@/components/generate/GeneraciyaFotoLandingSections";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const getCachedSections = cache(async () => {
  try {
    return await fetchHomepageSections();
  } catch (err) {
    console.error("[HomePage] fetchHomepageSections failed:", err);
    return [];
  }
});

const getCachedNewCards = cache(async (): Promise<PromptCardFull[]> => {
  try {
    const result = await fetchRouteCards({
      audience_tag: null,
      style_tag: null,
      occasion_tag: null,
      object_tag: null,
      doc_task_tag: null,
      limit: 50,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
    const enriched = await enrichCardsWithDetails(result.cards);
    const cardsById = new Map(enriched.map((card) => [card.id, card]));
    return result.cards
      .map((card) => cardsById.get(card.id))
      .filter((card): card is PromptCardFull => Boolean(card));
  } catch (err) {
    console.error("[HomePage] fetch new cards failed:", err);
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const sections = await getCachedSections();
  const firstPhoto = sections.find((s) => s.cards.length > 0)?.cards[0]?.photoUrl ?? null;

  return {
    title: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    alternates: { canonical: SITE_URL + "/" },
    openGraph: {
      title: HOMEPAGE_SEO.title,
      description: HOMEPAGE_SEO.description,
      url: SITE_URL + "/",
      type: "website",
      siteName: "PromptShot",
      ...(firstPhoto ? { images: [{ url: firstPhoto, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: HOMEPAGE_SEO.title,
      description: HOMEPAGE_SEO.description,
      ...(firstPhoto ? { images: [firstPhoto] } : {}),
    },
  };
}

export default async function HomePage() {
  const catalogThemes = getHomepageCatalogThemeItems();
  const [sections, newCards, catalogCollage] = await Promise.all([
    getCachedSections(),
    getCachedNewCards(),
    fetchNewestThemeCollagePhotos(catalogThemes),
  ]);

  const totalPrompts = sections.reduce((sum, s) => sum + s.total_count, 0);
  const totalCategories = sections.filter((s) => s.total_count > 0).length;
  const homeOgImage =
    newCards[0]?.photoUrls[0] ??
    sections.find((s) => s.cards.length > 0)?.cards[0]?.photoUrl ??
    null;
  const exampleCards = newCards.map(toGenerationExampleCard);
  const carouselCards = takeHeroMarqueeCards(
    exampleCards.filter((card) => card.photoUrl)
  );
  const galleryCards = exampleCards.slice(0, 16);
  const collectionPageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    url: SITE_URL + "/",
    ...(homeOgImage ? { image: homeOgImage } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "PromptShot",
      url: SITE_URL,
    },
    hasPart: sections
      .filter((s) => s.total_count > 0)
      .slice(0, 50)
      .map((s) => {
        const tag = TAG_REGISTRY.find(
          (t) => t.dimension === s.dimension && t.slug === s.slug
        );
        return tag
          ? {
              "@type": "CollectionPage",
              name: `Промты для фото ${tag.labelRu}`,
              url: `${SITE_URL}${tag.urlPath}`,
            }
          : null;
      })
      .filter(Boolean),
  };

  const faqPageLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOMEPAGE_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.aPlain,
      },
    })),
  };

  const itemListLd = galleryCards.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: HOMEPAGE_SEO.examplesTitle,
        numberOfItems: galleryCards.length,
        itemListElement: galleryCards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.title,
          ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
        })),
      }
    : null;

  const jsonLd = [collectionPageLd, faqPageLd, ...(itemListLd ? [itemListLd] : [])];

  return (
    <PageLayout showFooterWithGenerateDock>
      <main className="listing-main-bottom-pad w-full flex-1 pb-16 sm:pb-24">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_-20%,rgba(99,102,241,0.14),transparent_62%)]"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-7xl px-3 pb-0 pt-8 text-center sm:px-5 sm:pt-12 xl:px-6">
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {HOMEPAGE_SEO.h1.main}{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-gradient">
                {HOMEPAGE_SEO.h1.accent}
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {HOMEPAGE_SEO.heroSubtitle}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                {totalPrompts}+ промтов
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                {totalCategories} категорий
              </span>
            </div>
            <GeneraciyaFotoHeroCarousel
              cards={carouselCards}
              ctaLabel={null}
              ariaLabel={HOMEPAGE_SEO.examplesTitle}
            />
            <HomeHeroDestinations />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <GeneraciyaFotoThemes
            sectionId="katalog"
            headingId="catalog-heading"
            eyebrow={HOMEPAGE_SEO.examplesEyebrow}
            title={HOMEPAGE_SEO.examplesTitle}
            lead={HOMEPAGE_SEO.examplesIntro}
            leadSecondary={HOMEPAGE_SEO.examplesIntroSecondary}
            items={catalogThemes}
            photosByHref={catalogCollage.photosByHref}
            countByHref={catalogCollage.countByHref}
            countKind="prompts"
            ctaHref={HOMEPAGE_SEO.catalogHref}
            ctaLabel={HOMEPAGE_SEO.catalogCta}
          />

          <HomepageExamplesExplorer initialCards={galleryCards} />

          <HomeIntroAndHowTo />
          <HomeFaq />
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </PageLayout>
  );
}
