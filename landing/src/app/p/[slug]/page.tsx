import { cache } from "react";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getCardPageData, getIndexableImageUrl } from "@/lib/supabase";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";
import {
  getFirstTagFromSeoTags,
  getSeoSlugsWithTags,
} from "@/lib/tag-registry";
import { CardPageLayout } from "@/components/CardPageLayout";
import { buildCardMetaTitle } from "@/lib/card-meta-title";

const CardPageClient = nextDynamic(
  () =>
    import("@/components/CardPageClient").then((m) => m.CardPageClient),
  {
    ssr: true,
  }
);

const getCachedCardPageData = cache(
  (slug: string, viewerUserId: string | null, allowDebugUnpublished: boolean) =>
    getCardPageData(slug, { viewerUserId, allowDebugUnpublished }),
);

async function resolveViewerFromCookies(): Promise<{
  viewerUserId: string | null;
  allowDebugUnpublished: boolean;
}> {
  const viewer = await getSupabaseUserFromServerCookies();
  return {
    viewerUserId: viewer?.id ?? null,
    allowDebugUnpublished: isCatalogAdminEmail(viewer?.email),
  };
}

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

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

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { viewerUserId, allowDebugUnpublished } = await resolveViewerFromCookies();
  const data = await getCachedCardPageData(slug, viewerUserId, allowDebugUnpublished);
  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Промт";
  const isThin =
    data.promptTexts.length === 0 && data.photoUrls.length === 0;

  const isGroupSecondary = data.card_split_index > 0 && !!data.groupFirstSlug;
  const canonical = isGroupSecondary
    ? `${BASE_URL}/p/${data.groupFirstSlug}`
    : `${BASE_URL}/p/${data.slug}`;

  return {
    title: buildCardMetaTitle(title, data.slug),
    description: buildDescription(data),
    alternates: { canonical },
    openGraph: {
      title: buildCardMetaTitle(title, data.slug),
      description: buildDescription(data),
      url: canonical,
      type: "article",
      images: data.photoMeta[0]
        ? [{ url: getIndexableImageUrl(data.photoMeta[0].bucket, data.photoMeta[0].path) }]
        : data.mainPhotoUrl
          ? [{ url: data.mainPhotoUrl }]
          : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: buildCardMetaTitle(title, data.slug),
      description: buildDescription(data),
      images: data.photoMeta[0]
        ? [getIndexableImageUrl(data.photoMeta[0].bucket, data.photoMeta[0].path)]
        : data.mainPhotoUrl
          ? [data.mainPhotoUrl]
          : undefined,
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
  const { viewerUserId, allowDebugUnpublished } = await resolveViewerFromCookies();
  const data = await getCachedCardPageData(slug, viewerUserId, allowDebugUnpublished);

  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Без названия";
  const tagEntries = getSeoSlugsWithTags(data.seo_tags);
  const breadcrumbTag = getFirstTagFromSeoTags(data.seo_tags);

  const imageObjects = data.photoMeta
    .map((m, i) => ({
      "@type": "ImageObject",
      contentUrl: getIndexableImageUrl(m.bucket, m.path),
      name: title,
      caption: `${title} — промпт для фото в нейросети`,
      representativeOfPage: i === 0,
      ...(m.width && m.height ? { width: m.width, height: m.height } : {}),
    }));

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description:
      data.promptTexts[0]?.slice(0, 150) ??
      data.title_ru ??
      "Промт для фото ИИ",
    image: imageObjects.length > 0 ? imageObjects : (data.mainPhotoUrl ?? undefined),
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

  const immersiveMobileChrome = data.photoUrls.length > 0;

  return (
    <CardPageLayout hideMobileChrome={immersiveMobileChrome}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(creativeWorkLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbLd) }}
      />

      <main className="flex min-h-0 flex-1 flex-col pb-20 max-md:min-h-0 lg:pb-0">
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
    </CardPageLayout>
  );
}
