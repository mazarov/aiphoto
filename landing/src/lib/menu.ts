import { TAG_REGISTRY, findTagByUrlPath, type TagEntry } from "./tag-registry";

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
  doc_task_tag?: string;
};

function tagItem(slug: string): MenuItem {
  const entry = TAG_REGISTRY.find((t) => t.slug === slug);
  if (!entry) throw new Error(`Tag "${slug}" not found in TAG_REGISTRY`);
  return { label: entry.labelRu, href: entry.urlPath + "/" };
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
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        count: counts[item.href],
      })),
    })),
  }));
}

export const MENU: MenuSection[] = [
  {
    label: "Люди и отношения",
    groups: [
      {
        title: "Базовые",
        items: [
          tagItem("devushka"),
          tagItem("muzhchina"),
          tagItem("para"),
          tagItem("semya"),
          tagItem("detskie"),
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
    groups: [
      {
        title: "Core",
        items: [
          tagItem("cherno_beloe"),
          tagItem("realistichnoe"),
          tagItem("portret"),
          tagItem("studiynoe"),
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
    label: "Задачи",
    groups: [
      {
        title: "Документы",
        items: [
          tagItem("na_pasport"),
          tagItem("na_dokumenty"),
          tagItem("na_avatarku"),
          tagItem("na_rezume"),
          tagItem("na_zagranpasport"),
        ],
      },
    ],
  },
  {
    label: "Сцены и объекты",
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
        ],
      },
    ],
  },
];
