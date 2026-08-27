import {
  DIMENSION_LABELS,
  TAG_REGISTRY,
  type Dimension,
  type TagEntry,
} from "@/lib/tag-registry";

export type HomepageExplorerChip = {
  slug: string;
  dimension: Dimension;
  label: string;
  href: string;
  score: number;
};

export const PINNED_COUNT = 15;

/** How many catalog themes stay in the chip row before extras. */
const CHIP_CATALOG_OVERLAP = 9;

/** Catalog collages: top Wordstat minus skipped keys. */
export const HOMEPAGE_CATALOG_THEME_COUNT = 15;

const CATALOG_THEME_SKIP_KEYS = new Set([
  "doc_task_tag:na_pasport",
  "doc_task_tag:na_dokumenty",
  "audience_tag:s_muzhem",
  "style_tag:realistichnoe",
]);

const CHIP_SKIP_KEYS = new Set([
  "doc_task_tag:na_pasport",
  "doc_task_tag:na_dokumenty",
  "style_tag:realistichnoe",
]);

const CHIP_FORCE_KEYS = ["object_tag:v_forme"] as const;

export type HomepageCatalogThemeItem = {
  title: string;
  href: string;
  dimension: Dimension;
  tagValue: string;
};

const MORE_DIMENSION_ORDER: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

/**
 * Wordstat «промты для фото», 15.07–15.08.2026 — max по близким запросам.
 * Теги без спроса в выгрузке получают 0 и уходят в хвост «Ещё».
 */
const WORDSTAT_SCORE: Record<string, number> = {
  "audience_tag:devushka": 3643,
  "occasion_tag:den_rozhdeniya": 2592,
  "doc_task_tag:na_pasport": 1898,
  "audience_tag:para": 1556,
  "audience_tag:muzhchina": 1551,
  "audience_tag:semya": 1305,
  "audience_tag:detskie": 884,
  "audience_tag:s_parnem": 640,
  "object_tag:s_tortom": 571,
  "doc_task_tag:na_dokumenty": 533,
  "style_tag:realistichnoe": 503,
  "style_tag:portret": 497,
  "style_tag:cherno_beloe": 492,
  "style_tag:multyashnoe": 434,
  "object_tag:s_mashinoy": 431,
  "style_tag:delovoe": 429,
  "audience_tag:s_muzhem": 400,
  "audience_tag:s_mamoy": 394,
  "style_tag:studiynoe": 379,
  "object_tag:s_sobakoy": 355,
  "object_tag:na_chernom_fone": 298,
  "audience_tag:devochka": 297,
  "occasion_tag:svadba": 285,
  "audience_tag:malchik": 280,
  "object_tag:s_cvetami": 264,
  "object_tag:leto": 263,
  "audience_tag:s_podrugoy": 260,
  "audience_tag:s_synom": 256,
  "audience_tag:s_pitomcem": 252,
  "audience_tag:s_drugom": 251,
  "object_tag:v_forme": 249,
  "audience_tag:pokoleniy": 235,
  "doc_task_tag:na_zagranpasport": 224,
  "style_tag:otkrytka": 211,
  "audience_tag:s_dochkoy": 196,
  "object_tag:na_avatarku": 190,
  "audience_tag:s_papoy": 184,
  "object_tag:so_znamenitostyu": 180,
  "style_tag:selfi": 176,
  "object_tag:v_kostyume": 168,
  "object_tag:v_pole": 165,
  "style_tag:anime": 162,
  "object_tag:na_more": 159,
  "audience_tag:s_babushkoy": 150,
  "style_tag:kollazh": 135,
  "audience_tag:vlyublennykh": 122,
  "object_tag:s_kotom": 109,
  "audience_tag:malysh": 101,
  "audience_tag:beremennaya": 100,
  "object_tag:s_bokalom": 99,
  "object_tag:s_shampanskim": 99,
  "object_tag:v_zerkale": 94,
  "style_tag:gta": 93,
  "style_tag:polaroid": 81,
  "style_tag:disney": 80,
  "doc_task_tag:na_rezume": 69,
  "audience_tag:podrostok": 60,
  "audience_tag:s_bratom": 59,
  "style_tag:piksar": 55,
  "object_tag:v_profil": 53,
  "object_tag:v_mashine": 51,
  "style_tag:retro": 47,
  "object_tag:v_lesu": 46,
  "audience_tag:s_sestroy": 45,
  "object_tag:v_polnyy_rost": 42,
  "style_tag:sovetskoe": 35,
  "object_tag:s_koronoy": 30,
  "style_tag:love_is": 30,
  "style_tag:3d": 29,
  "object_tag:v_restorane": 27,
  "object_tag:v_gorah": 22,
};

function tagKey(tag: Pick<TagEntry, "dimension" | "slug">): string {
  return `${tag.dimension}:${tag.slug}`;
}

function toChip(tag: TagEntry): HomepageExplorerChip {
  return {
    slug: tag.slug,
    dimension: tag.dimension,
    label: tag.labelRu,
    href: tag.urlPath,
    score: WORDSTAT_SCORE[tagKey(tag)] ?? 0,
  };
}

function compareChips(a: HomepageExplorerChip, b: HomepageExplorerChip): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.label.localeCompare(b.label, "ru");
}

export function getAllExplorerChips(): HomepageExplorerChip[] {
  return TAG_REGISTRY.map(toChip);
}

/** Wordstat §7.1: higher score first. Used by chips and catalog collages. */
export function getWordstatRankedChips(): HomepageExplorerChip[] {
  return [...getAllExplorerChips()].sort(compareChips);
}

export function getPinnedChips(): HomepageExplorerChip[] {
  const ranked = getWordstatRankedChips();
  const byKey = new Map(ranked.map((chip) => [tagKey(chip), chip]));
  const catalogItems = getHomepageCatalogThemeItems();
  const catalogKeys = new Set(
    catalogItems.map((item) => `${item.dimension}:${item.tagValue}`)
  );

  const fromCatalog = catalogItems.slice(0, CHIP_CATALOG_OVERLAP).map((item) => {
    const chip = byKey.get(`${item.dimension}:${item.tagValue}`);
    if (!chip) {
      throw new Error(`Catalog chip missing from TAG_REGISTRY: ${item.tagValue}`);
    }
    return chip;
  });

  const extrasNeeded = PINNED_COUNT - fromCatalog.length;
  const extrasPool = ranked.filter((chip) => {
    const key = tagKey(chip);
    return (
      !catalogKeys.has(key) &&
      !CHIP_SKIP_KEYS.has(key) &&
      !CATALOG_THEME_SKIP_KEYS.has(key)
    );
  });

  const forced = CHIP_FORCE_KEYS.flatMap((key) => {
    const chip = byKey.get(key);
    return chip && extrasPool.some((item) => tagKey(item) === key) ? [chip] : [];
  });
  const forcedKeys = new Set(forced.map((chip) => tagKey(chip)));
  const rest = extrasPool.filter((chip) => !forcedKeys.has(tagKey(chip)));
  const extras = [...rest.slice(0, Math.max(0, extrasNeeded - forced.length)), ...forced].sort(
    compareChips
  );

  return [...fromCatalog, ...extras];
}

export function getMoreChips(): HomepageExplorerChip[] {
  const pinned = new Set(getPinnedChips().map((chip) => tagKey(chip)));
  return getWordstatRankedChips().filter((chip) => !pinned.has(tagKey(chip)));
}

export function getMoreChipsByDimension(): {
  dimension: Dimension;
  title: string;
  chips: HomepageExplorerChip[];
}[] {
  const groups = new Map<Dimension, HomepageExplorerChip[]>();
  for (const chip of getMoreChips()) {
    const list = groups.get(chip.dimension) ?? [];
    list.push(chip);
    groups.set(chip.dimension, list);
  }

  return MORE_DIMENSION_ORDER.flatMap((dimension) => {
    const chips = groups.get(dimension);
    if (!chips?.length) return [];
    return [
      {
        dimension,
        title: DIMENSION_LABELS[dimension],
        chips,
      },
    ];
  });
}

export function findExplorerChip(
  dimension: string,
  slug: string
): HomepageExplorerChip | null {
  return (
    getAllExplorerChips().find(
      (chip) => chip.dimension === dimension && chip.slug === slug
    ) ?? null
  );
}

/** Catalog collections for the homepage themes carousel. */
export function getHomepageCatalogThemeItems(
  limit = HOMEPAGE_CATALOG_THEME_COUNT
): HomepageCatalogThemeItem[] {
  return getWordstatRankedChips()
    .filter((chip) => !CATALOG_THEME_SKIP_KEYS.has(tagKey(chip)))
    .slice(0, limit)
    .map((chip) => ({
      title: chip.label,
      href: chip.href,
      dimension: chip.dimension,
      tagValue: chip.slug,
    }));
}
