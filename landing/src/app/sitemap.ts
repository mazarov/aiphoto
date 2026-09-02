import type { MetadataRoute } from "next";
import { TAG_REGISTRY, findTagBySlug, type Dimension } from "@/lib/tag-registry";
import {
  getPublishedCardsForSitemap,
  getIndexableTagCombos,
  getFilterCounts,
  searchCardsByText,
  type SearchCardFilters,
} from "@/lib/supabase";
import { buildCanonicalPath, getMinCardsForLevel } from "@/lib/route-resolver";
import { birthdayClusterSitemapPages } from "@/lib/den-rozhdeniya-cluster";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  MIN_GENERACIYA_FOTO_SCENARIO_CARDS,
  getGeneraciyaFotoScenarioPath,
} from "@/lib/generaciya-foto-routes";
import {
  MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  fotosessiiClusterSitemapPages,
} from "@/lib/promty-dlya-ii-fotosessii-cluster";
import {
  SOBYTIYA_1_SENTYABRYA_PATH,
  SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY,
  SOBYTIYA_1_SENTYABRYA_TAG,
} from "@/lib/sobytiya-1-sentyabrya";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

function comboToPath(
  dim1: string,
  slug1: string,
  dim2: string,
  slug2: string,
): string | null {
  const primary = findTagBySlug(dim1 as Dimension, slug1);
  const secondary = findTagBySlug(dim2 as Dimension, slug2);
  if (!primary || !secondary) return null;
  return buildCanonicalPath([primary, secondary]).replace(/^\//, "");
}

function staticHubEntries(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/trends`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/foto-v-promt`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/generaciya-foto`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/nano-banana`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}

type SearchBackedSitemapPage = {
  path: string;
  query: string;
  filters?: SearchCardFilters;
  level: 1 | 2 | 3;
  priority: number;
};

function birthdaySitemapPriority(level: 1 | 2): number {
  return level === 1 ? 0.9 : 0.7;
}

function uniqueSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const unique: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    unique.push(entry);
  }
  return unique;
}

/** FTS-only: sitemap must not spend Gemini budget. Fail-soft per URL. */
async function searchBackedSitemapUrls(
  pages: SearchBackedSitemapPage[],
): Promise<MetadataRoute.Sitemap> {
  const entries = await Promise.all(
    pages.map(async (page) => {
      const min = getMinCardsForLevel(page.level);
      try {
        const hits = await searchCardsByText(page.query, min, 0, page.filters ?? {});
        if (hits.length < min) return null;
        return {
          url: `${BASE_URL}${page.path}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: page.priority,
        };
      } catch (error) {
        console.error("[sitemap] search-backed page failed", page.path, error);
        return null;
      }
    }),
  );
  return entries.filter((entry): entry is NonNullable<typeof entry> =>
    Boolean(entry),
  );
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Filter L1 tags to only include those with enough cards to be indexed.
  // This keeps sitemap in sync with the noindex threshold (getMinCardsForLevel(1) === 1),
  // preventing "Submitted URL marked noindex" warnings in GSC/Yandex.
  const hubs = staticHubEntries();

  try {
    const filterCounts = await getFilterCounts({});
    const countMap = new Map<string, number>();
    for (const row of filterCounts) {
      countMap.set(`${row.dimension}:${row.slug}`, row.cards_count);
    }
    const generationScenarioUrls: MetadataRoute.Sitemap =
      GENERACIYA_FOTO_SCENARIO_ROUTES.filter((scenario) => {
        const count =
          countMap.get(`${scenario.dimension}:${scenario.tagValue}`) ?? 0;
        return count >= MIN_GENERACIYA_FOTO_SCENARIO_CARDS;
      }).map((scenario) => ({
        url: `${BASE_URL}${getGeneraciyaFotoScenarioPath(scenario.slug)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.85,
      }));
    const fotosessiiChildUrls: MetadataRoute.Sitemap =
      fotosessiiClusterSitemapPages()
        .filter((page) => {
          const count = countMap.get(`${page.dimension}:${page.tagValue}`) ?? 0;
          return count >= MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS;
        })
        .map((page) => ({
          url: `${BASE_URL}${page.path}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.85,
        }));
    const minL1 = getMinCardsForLevel(1);
    const indexableL1Tags = TAG_REGISTRY.filter((tag) => {
      if (
        tag.dimension === "occasion_tag" &&
        tag.slug === SOBYTIYA_1_SENTYABRYA_TAG
      ) {
        return false;
      }
      const count = countMap.get(`${tag.dimension}:${tag.slug}`) ?? 0;
      return count >= minL1;
    });
    const searchBackedUrls = await searchBackedSitemapUrls([
      ...birthdayClusterSitemapPages().map((page) => ({
        ...page,
        priority: birthdaySitemapPriority(page.level),
      })),
      {
        path: SOBYTIYA_1_SENTYABRYA_PATH,
        query: SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY,
        level: 1,
        priority: 0.85,
      },
    ]);
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
    const seenL2 = new Set<string>();
    for (const c of combos) {
      const path = comboToPath(c.dim1, c.slug1, c.dim2, c.slug2);
      if (!path || seenL2.has(path)) continue;
      seenL2.add(path);
      l2Urls.push({
        url: `${BASE_URL}/${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }

    const cards = await getPublishedCardsForSitemap();
    const cardUrls: MetadataRoute.Sitemap = cards.map(({ slug, updated_at }) => ({
      url: `${BASE_URL}/p/${slug}`,
      lastModified: new Date(updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    return [
      ...hubs,
      ...generationScenarioUrls,
      ...fotosessiiChildUrls,
      ...uniqueSitemapEntries([
        ...searchBackedUrls,
        ...tagUrls,
        ...l2Urls,
      ]),
      ...cardUrls,
    ];
  } catch (error) {
    console.error("[sitemap] catalog fetch failed; returning static hubs only", error);
    return hubs;
  }
}
