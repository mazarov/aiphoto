import { cache } from "react";
import { notFound } from "next/navigation";
import { getCardPageData } from "@/lib/supabase";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import {
  getFirstTagFromSeoTags,
  findTagBySlug,
  type Dimension,
} from "@/lib/tag-registry";
import { CardModal } from "@/components/CardModal";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import nextDynamic from "next/dynamic";

const CardPageClient = nextDynamic(
  () =>
    import("@/components/CardPageClient").then((m) => m.CardPageClient),
  {
    ssr: true,
  }
);

const getCachedCardPageData = cache((slug: string, viewerUserId: string | null) =>
  getCardPageData(slug, { viewerUserId }),
);

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

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function CardModalPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getSupabaseUserFromServerCookies();
  const data = await getCachedCardPageData(slug, viewer?.id ?? null);

  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Без названия";
  const tagEntries = getSeoSlugsWithTags(data.seo_tags);
  const breadcrumbTag = getFirstTagFromSeoTags(data.seo_tags);

  return (
    <CardInteractionsProvider cardIds={[data.id]}>
      <CardModal>
        <div className="max-h-[85vh] overflow-y-auto">
          <CardPageClient
            data={data}
            tagEntries={tagEntries}
            breadcrumbTag={
              breadcrumbTag
                ? { labelRu: breadcrumbTag.labelRu, urlPath: breadcrumbTag.urlPath }
                : null
            }
            isModal
          />
        </div>
      </CardModal>
    </CardInteractionsProvider>
  );
}
