import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { fetchHomepageSections } from "@/lib/supabase";
import { TAG_REGISTRY } from "@/lib/tag-registry";
import { HOMEPAGE_SEO, HOMEPAGE_FAQ } from "@/lib/homepage-seo-copy";
import { PageLayout } from "@/components/PageLayout";
import { CategorySection } from "@/components/CategorySection";
import { HomeSearch } from "@/components/HomeSearch";
import { HomeSeoBlocks } from "@/components/HomeSeoBlocks";
import { buildCategorySectionBlocks } from "@/lib/homepage-sections";

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
  const sections = await getCachedSections();

  const totalPrompts = sections.reduce((sum, s) => sum + s.total_count, 0);
  const totalCategories = sections.filter((s) => s.total_count > 0).length;

  const sectionBlocks = buildCategorySectionBlocks(sections);

  const homeOgImage = sections.find((s) => s.cards.length > 0)?.cards[0]?.photoUrl ?? null;

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
              url: `${SITE_URL}${tag.urlPath}/`,
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

  const jsonLd = [collectionPageLd, faqPageLd];

  return (
    <PageLayout>
      {/* Hero */}
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
          <div className="mx-auto mt-8 w-full max-w-2xl px-1 sm:px-0">
            <HomeSearch />
          </div>
          <p className="mx-auto mt-5 max-w-lg text-sm text-zinc-500">
            Нужен промт из фото?{" "}
            <Link href="/foto-v-promt" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
              Фото в промт
            </Link>
            {" "}— загрузите картинку и получите текст онлайн.
          </p>
        </div>
      </section>

      <main className="w-full flex-1 px-2 sm:px-5 pb-16">
        {sectionBlocks.length > 0 ? (
          sectionBlocks.map((block, i) => (
            <CategorySection
              key={block.dimension}
              title={block.title}
              items={block.items}
              isFirstSection={i === 0}
              sectionId={block.dimension}
            />
          ))
        ) : (
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

      <HomeSeoBlocks />

      <Script
        id="homepage-json-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </PageLayout>
  );
}
