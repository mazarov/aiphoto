import type { MetadataRoute } from "next";
import { getAllTagPaths } from "@/lib/tag-registry";
import { getPublishedCardsForSitemap } from "@/lib/supabase";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tagPaths = getAllTagPaths();
  const tagUrls: MetadataRoute.Sitemap = tagPaths.map((path) => ({
    url: `${BASE_URL}/${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path.split("/").length === 1 ? 0.9 : 0.8,
  }));

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
    ...cardUrls,
  ];
}
