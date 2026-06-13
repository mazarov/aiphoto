import { NextResponse } from "next/server";
import { getPublishedCardImagesForSitemap } from "@/lib/supabase";

export const revalidate = 3600;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

/**
 * Max URL entries per image-sitemap page (Google limit: 50,000 URLs / ~50 MB per file).
 * We chunk conservatively at 5,000 cards per page.
 */
const PAGE_SIZE = 5_000;

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildImageSitemap(
  cards: Awaited<ReturnType<typeof getPublishedCardImagesForSitemap>>
): string {
  const urlEntries = cards
    .map((card) => {
      const images = card.images
        .map(
          (img) =>
            `    <image:image>\n      <image:loc>${xmlEscape(img.url)}</image:loc>\n      <image:title>${xmlEscape(card.title)}</image:title>\n      <image:caption>${xmlEscape(img.caption)}</image:caption>\n    </image:image>`
        )
        .join("\n");
      return `  <url>\n    <loc>${xmlEscape(`${BASE_URL}/p/${card.slug}`)}</loc>\n    <lastmod>${card.updated_at.slice(0, 10)}</lastmod>\n${images}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`;
}

function buildSitemapIndex(totalPages: number): string {
  const items = Array.from({ length: totalPages }, (_, i) => {
    const page = i + 1;
    return `  <sitemap>\n    <loc>${xmlEscape(`${BASE_URL}/image-sitemap.xml?page=${page}`)}</loc>\n  </sitemap>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");

  const allCards = await getPublishedCardImagesForSitemap();
  const totalPages = Math.ceil(allCards.length / PAGE_SIZE);

  if (allCards.length === 0) {
    return new NextResponse(buildImageSitemap([]), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  if (pageParam === null) {
    if (totalPages <= 1) {
      return new NextResponse(buildImageSitemap(allCards), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }
    return new NextResponse(buildSitemapIndex(totalPages), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const page = Math.max(1, Math.min(parseInt(pageParam, 10) || 1, totalPages));
  const slice = allCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return new NextResponse(buildImageSitemap(slice), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
