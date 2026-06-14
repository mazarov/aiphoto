import type { MetadataRoute } from "next";
import { TAG_REGISTRY, findTagBySlug, type Dimension } from "@/lib/tag-registry";
import { getPublishedCardsForSitemap, getIndexableTagCombos, getFilterCounts } from "@/lib/supabase";
import { getMinCardsForLevel } from "@/lib/route-resolver";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

const DIMENSION_PRIORITY: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

function comboToPath(
  dim1: string,
  slug1: string,
  dim2: string,
  slug2: string,
): string | null {
  const sorted = [
    { dim: dim1, slug: slug1 },
    { dim: dim2, slug: slug2 },
  ].sort(
    (a, b) =>
      DIMENSION_PRIORITY.indexOf(a.dim as Dimension) -
      DIMENSION_PRIORITY.indexOf(b.dim as Dimension),
  );

  const primary = findTagBySlug(sorted[0].dim as Dimension, sorted[0].slug);
  const secondary = findTagBySlug(sorted[1].dim as Dimension, sorted[1].slug);
  if (!primary || !secondary) return null;

  const base = primary.urlPath.startsWith("/")
    ? primary.urlPath.slice(1)
    : primary.urlPath;
  const secondaryLastSeg = secondary.urlPath.split("/").filter(Boolean).pop();
  if (!secondaryLastSeg) return null;

  return `${base}/${secondaryLastSeg}`;
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Filter L1 tags to only include those with enough cards to be indexed.
  // This keeps sitemap in sync with the noindex threshold (getMinCardsForLevel(1) === 1),
  // preventing "Submitted URL marked noindex" warnings in GSC/Yandex.
  const filterCounts = await getFilterCounts({});
  const countMap = new Map<string, number>();
  for (const row of filterCounts) {
    countMap.set(`${row.dimension}:${row.slug}`, row.cards_count);
  }
  const minL1 = getMinCardsForLevel(1);
  const indexableL1Tags = TAG_REGISTRY.filter((tag) => {
    const count = countMap.get(`${tag.dimension}:${tag.slug}`) ?? 0;
    return count >= minL1;
  });
  const tagUrls: MetadataRoute.Sitemap = indexableL1Tags.map((tag) => {
    const path = tag.urlPath.startsWith("/") ? tag.urlPath.slice(1) : tag.urlPath;
    return {
      url: `${BASE_URL}/${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    };
  });

  const combos = await getIndexableTagCombos(6, "ru");
  const l2Urls: MetadataRoute.Sitemap = [];
  for (const c of combos) {
    const path = comboToPath(c.dim1, c.slug1, c.dim2, c.slug2);
    if (path) {
      l2Urls.push({
        url: `${BASE_URL}/${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }
  }

  const cards = await getPublishedCardsForSitemap();
  const cardUrls: MetadataRoute.Sitemap = cards.map(({ slug, updated_at }) => ({
    url: `${BASE_URL}/p/${slug}`,
    lastModified: new Date(updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/foto-v-promt`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...tagUrls,
    ...l2Urls,
    ...cardUrls,
  ];
}
