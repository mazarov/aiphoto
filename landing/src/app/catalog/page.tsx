import { cache } from "react";
import type { Metadata } from "next";
import {
  enrichCardsWithDetails,
  fetchHomepageSections,
  fetchRouteCards,
  type PromptCardFull,
} from "@/lib/supabase";
import { toGenerationExampleCard } from "@/lib/generation/example-card";
import { PageLayout } from "@/components/PageLayout";
import { CategorySection } from "@/components/CategorySection";
import { HomepageExamplesExplorer } from "@/components/home/HomepageExamplesExplorer";
import { buildCategorySectionBlocks } from "@/lib/homepage-sections";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Каталог промтов для фото",
  robots: { index: false, follow: true },
};

const getCachedSections = cache(async () => {
  try {
    return await fetchHomepageSections();
  } catch {
    return [];
  }
});

const getCachedPopularCards = cache(async (): Promise<PromptCardFull[]> => {
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
      sort: "popular",
    });
    const enriched = await enrichCardsWithDetails(result.cards);
    const cardsById = new Map(enriched.map((card) => [card.id, card]));
    return result.cards
      .map((card) => cardsById.get(card.id))
      .filter((card): card is PromptCardFull => Boolean(card));
  } catch {
    return [];
  }
});

export default async function CatalogPage() {
  const [sections, popularCards] = await Promise.all([
    getCachedSections(),
    getCachedPopularCards(),
  ]);
  const sectionBlocks = buildCategorySectionBlocks(sections);
  const exampleCards = popularCards.map(toGenerationExampleCard);

  return (
    <PageLayout>
      <main className="w-full flex-1 px-2 sm:px-5 pb-16">
        <div className="lg:hidden">
          <HomepageExamplesExplorer variant="catalog" initialCards={exampleCards} />
        </div>
        <div className="hidden lg:block">
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Каталог и поиск
          </h1>
          {sectionBlocks.map((block, i) => (
            <CategorySection
              key={block.dimension}
              title={block.title}
              items={block.items}
              isFirstSection={i === 0}
              sectionId={block.dimension}
            />
          ))}
        </div>
      </main>
    </PageLayout>
  );
}
