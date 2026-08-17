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
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import { PageLayout } from "@/components/PageLayout";
import { HomeHeroDestinations } from "@/components/HomeHeroDestinations";
import { HomeSeoBlocks } from "@/components/HomeSeoBlocks";
import { HomepageExamplesExplorer } from "@/components/home/HomepageExamplesExplorer";

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
      limit: 16,
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
  const [sections, newCards] = await Promise.all([
    getCachedSections(),
    getCachedNewCards(),
  ]);

  const totalPrompts = sections.reduce((sum, s) => sum + s.total_count, 0);
  const totalCategories = sections.filter((s) => s.total_count > 0).length;
  const homeOgImage =
    newCards[0]?.photoUrls[0] ??
    sections.find((s) => s.cards.length > 0)?.cards[0]?.photoUrl ??
    null;
  const exampleCards = newCards.map(toGenerationExampleCard);

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

  const itemListLd = popularCards.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: HOMEPAGE_SEO.examplesTitle,
        numberOfItems: popularCards.length,
        itemListElement: popularCards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.title_ru || card.title_en || "Промт для фото",
          ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
        })),
      }
    : null;

  const jsonLd = [collectionPageLd, faqPageLd, ...(itemListLd ? [itemListLd] : [])];

  return (
    <PageLayout showFooterWithGenerateDock>
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/40 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-5 pt-16 pb-10 text-center">
          <h1 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            {HOMEPAGE_SEO.h1.main}{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-gradient">
              {HOMEPAGE_SEO.h1.accent}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-zinc-500 sm:text-lg">
            {HOMEPAGE_SEO.heroSubtitle}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              {totalPrompts}+ промтов
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              {totalCategories} категорий
            </span>
          </div>
          <HomeHeroDestinations />
        </div>
      </section>

      <main className="w-full flex-1 px-2 sm:px-5 pb-16">
        <div className="mx-auto w-full max-w-7xl">
          <HomepageExamplesExplorer initialCards={exampleCards} />
        </div>
      </main>

      <HomeSeoBlocks />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </PageLayout>
  );
}
