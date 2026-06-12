import {
  pickDeduplicatedPhotos,
  type HomepageSectionItemWithUrls,
} from "@/lib/supabase";
import { TAG_REGISTRY, DIMENSION_LABELS, type Dimension } from "@/lib/tag-registry";
import { MENU } from "@/lib/menu";

export type SectionBlockItem = {
  label: string;
  href: string;
  data: {
    dimension: Dimension;
    slug: string;
    total_count: number;
    photoUrl: string | null;
    secondPhotoUrl: string | null;
  };
};

export type SectionBlock = {
  title: string;
  dimension: Dimension;
  items: SectionBlockItem[];
};

export const SECTION_ORDER: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
];

export function buildCategorySectionBlocks(
  sections: HomepageSectionItemWithUrls[]
): SectionBlock[] {
  const sectionsByDimSlug = new Map<string, HomepageSectionItemWithUrls>();
  for (const s of sections) {
    sectionsByDimSlug.set(`${s.dimension}:${s.slug}`, s);
  }

  const usedCardIds = new Set<string>();

  return SECTION_ORDER.map((dim) => {
    const menuSection = MENU.find((m) => m.dimension === dim);
    if (!menuSection) return null;

    const tagSlugs = menuSection.groups
      .flatMap((g) =>
        g.items.map((item) => {
          const tag = TAG_REGISTRY.find((t) => t.urlPath + "/" === item.href);
          return tag ?? null;
        })
      )
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const items: SectionBlockItem[] = tagSlugs.map((tag) => {
      const raw = sectionsByDimSlug.get(`${dim}:${tag.slug}`);
      const { photoUrl, secondPhotoUrl, usedIds } = pickDeduplicatedPhotos(
        raw?.cards ?? [],
        usedCardIds
      );
      for (const id of usedIds) usedCardIds.add(id);

      return {
        label: tag.labelRu,
        href: tag.urlPath + "/",
        data: {
          dimension: dim,
          slug: tag.slug,
          total_count: raw?.total_count ?? 0,
          photoUrl,
          secondPhotoUrl,
        },
      };
    });

    return {
      title: DIMENSION_LABELS[dim],
      dimension: dim,
      items,
    };
  }).filter((block): block is SectionBlock => block !== null);
}
