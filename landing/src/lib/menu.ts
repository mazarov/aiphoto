import { TAG_REGISTRY, DIMENSION_LABELS, findTagByUrlPath, type TagEntry, type Dimension } from "./tag-registry";

export type MenuItem = {
  label: string;
  href: string;
};

export type MenuItemWithCount = MenuItem & {
  count?: number;
};

export type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export type MenuGroupWithCounts = {
  title: string;
  items: MenuItemWithCount[];
};

export type MenuSection = {
  label: string;
  href?: string;
  dimension: Dimension;
  groups: MenuGroup[];
};

export type MenuSectionWithCounts = {
  label: string;
  href?: string;
  groups: MenuGroupWithCounts[];
};

export type RouteParams = {
  audience_tag?: string;
  style_tag?: string;
  occasion_tag?: string;
  object_tag?: string;
};

function tagItem(slug: string): MenuItem {
  const entry = TAG_REGISTRY.find((t) => t.slug === slug);
  if (!entry) throw new Error(`Tag "${slug}" not found in TAG_REGISTRY`);
  return { label: entry.labelRu, href: entry.urlPath + "/" };
}

/**
 * Collect all slugs explicitly placed in curated groups,
 * then append any TAG_REGISTRY tags for that dimension
 * not yet placed into an "Ещё" group.
 */
function withAutoGroup(section: MenuSection): MenuSection {
  const placedSlugs = new Set<string>();
  for (const g of section.groups) {
    for (const item of g.items) {
      const tag = TAG_REGISTRY.find((t) => t.urlPath + "/" === item.href);
      if (tag) placedSlugs.add(tag.slug);
    }
  }

  const unplaced = TAG_REGISTRY
    .filter((t) => t.dimension === section.dimension && !placedSlugs.has(t.slug))
    .map((t) => tagItem(t.slug));

  if (unplaced.length === 0) return section;

  return {
    ...section,
    groups: [...section.groups, { title: "Ещё", items: unplaced }],
  };
}

export function getRouteParamsForHref(href: string): RouteParams | null {
  const tag = findTagByUrlPath(href);
  if (!tag) return null;
  return { [tag.dimension]: tag.slug } as RouteParams;
}

export function getAllMenuHrefs(): string[] {
  return MENU.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.href)));
}

export function getMenuRouteMap(): { href: string; params: RouteParams }[] {
  const hrefs = getAllMenuHrefs();
  const result: { href: string; params: RouteParams }[] = [];
  for (const href of hrefs) {
    const params = getRouteParamsForHref(href);
    if (params) result.push({ href, params });
  }
  return result;
}

export function applyCountsToMenu(
  counts: Record<string, number>
): MenuSectionWithCounts[] {
  return MENU.map((section) => ({
    label: section.label,
    href: section.href,
    groups: section.groups.map((group) => ({
      ...group,
      items: group.items
        .map((item) => ({ ...item, count: counts[item.href] ?? 0 }))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0)),
    })),
  }));
}

const CURATED_SECTIONS: MenuSection[] = [
  {
    label: "Люди и отношения",
    dimension: "audience_tag",
    groups: [
      {
        title: "Базовые",
        items: [
          tagItem("devushka"),
          tagItem("muzhchina"),
          tagItem("para"),
          tagItem("vlyublennykh"),
          tagItem("semya"),
          tagItem("detskie"),
        ],
      },
      {
        title: "Дети",
        items: [
          tagItem("malchik"),
          tagItem("devochka"),
          tagItem("podrostok"),
          tagItem("malysh"),
        ],
      },
      {
        title: "Отношения",
        items: [
          tagItem("s_mamoy"),
          tagItem("s_parnem"),
          tagItem("pokoleniy"),
          tagItem("s_papoy"),
          tagItem("s_muzhem"),
          tagItem("s_dochkoy"),
          tagItem("s_synom"),
          tagItem("s_sestroy"),
          tagItem("s_bratom"),
        ],
      },
      {
        title: "Расширение",
        items: [
          tagItem("s_podrugoy"),
          tagItem("s_drugom"),
          tagItem("s_babushkoy"),
          tagItem("beremennaya"),
          tagItem("s_pitomcem"),
        ],
      },
    ],
  },
  {
    label: "Стили",
    dimension: "style_tag",
    groups: [
      {
        title: "Core",
        items: [
          tagItem("cherno_beloe"),
          tagItem("realistichnoe"),
          tagItem("portret"),
          tagItem("studiynoe"),
          tagItem("selfi"),
          tagItem("3d"),
          tagItem("kollazh"),
        ],
      },
      {
        title: "Visual",
        items: [
          tagItem("love_is"),
          tagItem("gta"),
          tagItem("delovoe"),
          tagItem("retro"),
          tagItem("sovetskoe"),
          tagItem("fashion"),
          tagItem("neonovoe"),
          tagItem("street_style"),
          tagItem("glyanec"),
          tagItem("victorias_secret"),
        ],
      },
      {
        title: "Illustrative",
        items: [
          tagItem("anime"),
          tagItem("disney"),
          tagItem("polaroid"),
          tagItem("otkrytka"),
          tagItem("piksar"),
          tagItem("barbie"),
          tagItem("multyashnoe"),
        ],
      },
    ],
  },
  {
    label: "События",
    dimension: "occasion_tag",
    groups: [
      {
        title: "Праздники",
        items: [
          tagItem("den_rozhdeniya"),
          tagItem("23_fevralya"),
          tagItem("14_fevralya"),
          tagItem("8_marta"),
          tagItem("maslenica"),
          tagItem("svadba"),
          tagItem("novyy_god"),
          tagItem("rozhdestvo"),
        ],
      },
    ],
  },
  {
    label: "Сцены и объекты",
    dimension: "object_tag",
    groups: [
      {
        title: "Объекты",
        items: [
          tagItem("s_mashinoy"),
          tagItem("s_cvetami"),
          tagItem("so_znamenitostyu"),
          tagItem("s_kotom"),
          tagItem("s_sobakoy"),
          tagItem("s_tortom"),
          tagItem("s_koronoy"),
          tagItem("s_bokalom"),
          tagItem("s_kofe"),
          tagItem("so_svechami"),
          tagItem("s_shuboj"),
        ],
      },
      {
        title: "Образ / поза",
        items: [
          tagItem("v_forme"),
          tagItem("v_kostyume"),
          tagItem("v_profil"),
          tagItem("v_zerkale"),
          tagItem("na_chernom_fone"),
          tagItem("v_platye"),
          tagItem("v_polnyy_rost"),
          tagItem("na_avatarku"),
        ],
      },
      {
        title: "Место / среда",
        items: [
          tagItem("na_more"),
          tagItem("v_lesu"),
          tagItem("v_gorah"),
          tagItem("zima"),
          tagItem("vesna"),
          tagItem("na_ulice"),
          tagItem("v_mashine"),
          tagItem("na_yahte"),
          tagItem("v_restorane"),
          tagItem("na_kryshe"),
          tagItem("v_gorode"),
          tagItem("v_pustyne"),
          tagItem("pod_vodoy"),
        ],
      },
    ],
  },
];

function buildMenu(): MenuSection[] {
  const sections = CURATED_SECTIONS.map(withAutoGroup);
  const coveredDims = new Set(CURATED_SECTIONS.map((s) => s.dimension));

  const ALL_DIMS: Dimension[] = ["audience_tag", "style_tag", "occasion_tag", "object_tag"];
  for (const dim of ALL_DIMS) {
    if (coveredDims.has(dim)) continue;
    const tags = TAG_REGISTRY.filter((t) => t.dimension === dim);
    if (tags.length === 0) continue;
    sections.push({
      label: DIMENSION_LABELS[dim] || dim,
      dimension: dim,
      groups: [{ title: "Все", items: tags.map((t) => tagItem(t.slug)) }],
    });
  }

  return sections;
}

export const MENU: MenuSection[] = buildMenu();
