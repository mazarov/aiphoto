import { cache } from "react";
import type { Metadata } from "next";
import { fetchHomepageSections } from "@/lib/supabase";
import { PageLayout } from "@/components/PageLayout";
import { CategorySection } from "@/components/CategorySection";
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

export default async function CatalogPage() {
  const sections = await getCachedSections();
  const sectionBlocks = buildCategorySectionBlocks(sections);

  return (
    <PageLayout>
      <main className="w-full flex-1 px-2 sm:px-5 pb-16">
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Каталог
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
      </main>
    </PageLayout>
  );
}
