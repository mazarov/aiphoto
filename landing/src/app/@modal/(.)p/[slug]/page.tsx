import { cache } from "react";
import { notFound } from "next/navigation";
import { getCardPageData } from "@/lib/supabase";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import {
  getFirstTagFromSeoTags,
  getSeoSlugsWithTags,
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

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function CardModalPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getSupabaseUserFromServerCookies();
  const viewerUserId = viewer?.id ?? null;
  const data = await getCachedCardPageData(slug, viewerUserId);

  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Без названия";
  const tagEntries = getSeoSlugsWithTags(data.seo_tags);
  const breadcrumbTag = getFirstTagFromSeoTags(data.seo_tags);

  // Full immersive on mobile for photo cards — parity with direct /p/[slug] + client modal flow.
  const immersiveMobile = data.photoUrls.length > 0;

  return (
    <CardInteractionsProvider cardIds={[data.id]}>
      <CardModal immersiveMobile={immersiveMobile}>
        <div
          className={
            immersiveMobile
              ? "h-full min-h-0 overflow-hidden md:h-auto md:max-h-none md:overflow-visible"
              : "max-h-[85vh] overflow-y-auto md:max-h-none md:overflow-visible"
          }
        >
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
