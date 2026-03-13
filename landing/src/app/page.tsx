import type { Metadata } from "next";
import Script from "next/script";
import {
  fetchHomepageSections,
  buildMenuCountsFromSections,
  pickDeduplicatedPhotos,
} from "@/lib/supabase";
import { getMenuRouteMap } from "@/lib/menu";
import { TAG_REGISTRY, DIMENSION_LABELS, type Dimension } from "@/lib/tag-registry";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CategorySection } from "@/components/CategorySection";
import { HomeSearch } from "@/components/HomeSearch";
import { MENU } from "@/lib/menu";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Промты для фото с нейросетями — готовая библиотека промптов",
  description:
    "Готовые промты для генерации и обработки фотографий с нейросетями. Копируй, вставляй, получай результат.",
  alternates: { canonical: SITE_URL + "/" },
};

const SECTION_ORDER: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
];

export default async function HomePage() {
  let sections: Awaited<ReturnType<typeof fetchHomepageSections>>;
  try {
    sections = await fetchHomepageSections();
  } catch (err) {
    console.error("[HomePage] fetchHomepageSections failed:", err);
    sections = [];
  }

  const routeMap = getMenuRouteMap();
  const menuCounts = buildMenuCountsFromSections(sections, routeMap);

  const sectionsByDimSlug = new Map<string, (typeof sections)[number]>();
  for (const s of sections) {
    sectionsByDimSlug.set(`${s.dimension}:${s.slug}`, s);
  }

  const totalPrompts = sections.reduce((sum, s) => sum + s.total_count, 0);
  const totalCategories = sections.filter((s) => s.total_count > 0).length;

  const usedCardIds = new Set<string>();

  const sectionBlocks = SECTION_ORDER.map((dim) => {
    const menuSection = MENU.find((m) => m.dimension === dim);
    if (!menuSection) return null;

    const tagSlugs = menuSection.groups.flatMap((g) =>
      g.items.map((item) => {
        const tag = TAG_REGISTRY.find((t) => t.urlPath + "/" === item.href);
        return tag ?? null;
      })
    ).filter(Boolean);

    const items = tagSlugs.map((tag) => {
      const raw = sectionsByDimSlug.get(`${dim}:${tag!.slug}`);
      const { photoUrl, secondPhotoUrl, usedIds } = pickDeduplicatedPhotos(
        raw?.cards ?? [],
        usedCardIds
      );
      for (const id of usedIds) usedCardIds.add(id);

      return {
        label: tag!.labelRu,
        href: tag!.urlPath + "/",
        data: {
          dimension: dim,
          slug: tag!.slug,
          total_count: raw?.total_count ?? 0,
          photoUrl,
          secondPhotoUrl,
        },
      };
    });

    return {
      title: DIMENSION_LABELS[dim],
      dimension: dim,
      items,
    };
  }).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Промты для фото с нейросетями",
    description: metadata.description,
    url: SITE_URL + "/",
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
              name: tag.labelRu,
              url: `${SITE_URL}${tag.urlPath}/`,
            }
          : null;
      })
      .filter(Boolean),
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-50/40 via-white to-zinc-50/50">
      <Header counts={menuCounts} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-14 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Промты для фото{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-gradient">
              с нейросетями
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-zinc-500 sm:text-lg">
            Готовые промпты для генерации фотографий.
            Копируй, вставляй, получай результат.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              {totalPrompts}+ промптов
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              {totalCategories} категорий
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-2 sm:px-5 pb-16">
        <div className="mt-2 mb-10 px-2 sm:px-0">
          <HomeSearch />
        </div>

        {sectionBlocks.length > 0 ? (
          sectionBlocks.map((block, i) => (
            <CategorySection
              key={block!.dimension}
              title={block!.title}
              items={block!.items}
              isFirstSection={i === 0}
            />
          ))
        ) : (
          /* Fallback: text links if RPC failed */
          <div className="mt-12 flex flex-wrap gap-2">
            {TAG_REGISTRY.map((tag) => (
              <a
                key={tag.slug}
                href={tag.urlPath + "/"}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              >
                {tag.labelRu}
              </a>
            ))}
          </div>
        )}
      </main>

      <Footer />

      <Script
        id="homepage-json-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
