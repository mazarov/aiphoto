import type { MetadataRoute } from "next";
import { getAllTagPaths, findTagBySlug, type Dimension } from "@/lib/tag-registry";
import { getPublishedCardsForSitemap, getIndexableTagCombos } from "@/lib/supabase";

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
  const tagPaths = getAllTagPaths();
  const tagUrls: MetadataRoute.Sitemap = tagPaths.map((path) => ({
    url: `${BASE_URL}/${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

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
    ...tagUrls,
    ...l2Urls,
    ...cardUrls,
  ];
}
