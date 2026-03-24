import { cache } from "react";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getCardPageData } from "@/lib/supabase";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import {
  getFirstTagFromSeoTags,
  findTagBySlug,
  type Dimension,
} from "@/lib/tag-registry";
import { PageLayout } from "@/components/PageLayout";

const CardPageClient = nextDynamic(
  () =>
    import("@/components/CardPageClient").then((m) => m.CardPageClient),
  {
    ssr: true,
    loading: () => (
      <div
        className="mx-auto max-w-2xl space-y-6 px-5 py-10"
        aria-busy="true"
        aria-label="Загрузка карточки"
      >
        <div className="h-64 animate-pulse rounded-3xl bg-zinc-100" />
        <div className="mx-auto h-8 w-2/3 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-36 animate-pulse rounded-2xl bg-zinc-50" />
      </div>
    ),
  }
);

const getCachedCardPageData = cache((slug: string, viewerUserId: string | null) =>
  getCardPageData(slug, { viewerUserId }),
);

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

const DIMENSIONS: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
];

function getSeoSlugsWithTags(
  seoTags: Record<string, unknown> | null
): { slug: string; label: string; href: string | null }[] {
  if (!seoTags) return [];
  const result: { slug: string; label: string; href: string | null }[] = [];
  for (const dim of DIMENSIONS) {
    const arr = (seoTags[dim] || []) as string[];
    for (const slug of arr) {
      const entry = findTagBySlug(dim, slug);
      result.push({
        slug,
        label: entry?.labelRu ?? slug,
        href: entry ? entry.urlPath : null,
      });
    }
  }
  return result;
}

function buildDescription(
  data: Awaited<ReturnType<typeof getCardPageData>>
): string {
  if (!data)
    return "Готовый промт для генерации фото ИИ. Посмотри результат и скопируй.";
  const title = data.title_ru || data.title_en || "Промт";
  const tags = getSeoSlugsWithTags(data.seo_tags).map((t) => t.label);
  if (data.promptTexts.length > 0) {
    const excerpt = data.promptTexts[0].slice(0, 100).trim();
    const suffix = data.promptTexts[0].length > 100 ? "…" : "";
    return `Промт для фото: «${excerpt}${suffix}». Скопируй и создай фото в нейросети.`;
  }
  if (tags.length > 0) {
    return `Готовый промт «${title}» — ${tags.join(", ")}. Копируй и используй в ИИ.`;
  }
  return "Готовый промт для генерации фото ИИ. Посмотри результат и скопируй.";
}

function buildTitle(titleRu: string): string {
  const suffix = " — промт для фото ИИ | PromptShot";
  const maxLen = 60;
  if (titleRu.length + suffix.length <= maxLen) return `${titleRu}${suffix}`;
  return titleRu.slice(0, maxLen - suffix.length - 1).trim() + suffix;
}

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getSupabaseUserFromServerCookies();
  const data = await getCachedCardPageData(slug, viewer?.id ?? null);
  if (!data) return {};

  const title = data.title_ru || data.title_en || "Промт";
  const isThin =
    data.promptTexts.length === 0 && data.photoUrls.length === 0;

  const isGroupSecondary = data.card_split_index > 0 && !!data.groupFirstSlug;
  const canonical = isGroupSecondary
    ? `${BASE_URL}/p/${data.groupFirstSlug}`
    : `${BASE_URL}/p/${data.slug}`;

  return {
    title: buildTitle(title),
    description: buildDescription(data),
    alternates: { canonical },
    openGraph: {
      title: buildTitle(title),
      description: buildDescription(data),
      url: canonical,
      type: "article",
      images: data.mainPhotoUrl ? [{ url: data.mainPhotoUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: buildTitle(title),
      description: buildDescription(data),
      images: data.mainPhotoUrl ? [data.mainPhotoUrl] : undefined,
    },
    robots:
      !data.isPublished
        ? { index: false, follow: false }
        : isThin || isGroupSecondary
          ? "noindex, follow"
          : "index, follow",
  };
}

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getSupabaseUserFromServerCookies();
  const data = await getCachedCardPageData(slug, viewer?.id ?? null);

  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Без названия";
  const tagEntries = getSeoSlugsWithTags(data.seo_tags);
  const breadcrumbTag = getFirstTagFromSeoTags(data.seo_tags);

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description:
      data.promptTexts[0]?.slice(0, 150) ??
      data.title_ru ??
      "Промт для фото ИИ",
    image: data.mainPhotoUrl ?? undefined,
    url: `${BASE_URL}/p/${data.slug}`,
    datePublished: data.source_date ?? undefined,
    keywords: tagEntries.map((t) => t.label).join(", "),
    isPartOf: {
      "@type": "CollectionPage",
      name: "PromptShot — промты для фото ИИ",
      url: BASE_URL,
    },
  };

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Главная", item: BASE_URL },
    ...(breadcrumbTag
      ? [
          {
            "@type": "ListItem",
            position: 2,
            name: breadcrumbTag.labelRu,
            item: `${BASE_URL}${breadcrumbTag.urlPath}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: `${BASE_URL}/p/${data.slug}`,
          },
        ]
      : [
          {
            "@type": "ListItem",
            position: 2,
            name: title,
            item: `${BASE_URL}/p/${data.slug}`,
          },
        ]),
  ];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  const safeJson = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "\\u003c");

  return (
    <PageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(creativeWorkLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbLd) }}
      />

      <main className="flex-1 pb-20 lg:pb-0">
        <CardPageClient
          data={data}
          tagEntries={tagEntries}
          breadcrumbTag={
            breadcrumbTag
              ? { labelRu: breadcrumbTag.labelRu, urlPath: breadcrumbTag.urlPath }
              : null
          }
        />
      </main>
    </PageLayout>
  );
}
