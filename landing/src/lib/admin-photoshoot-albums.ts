import { EXCLUSIVE_AUDIENCE_SLUGS } from "./audience-exclusive";
import {
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  getPromtyDlyaIiFotosessiiChildPath,
  type FotosessiiClusterChild,
  type FotosessiiClusterChildSlug,
} from "./promty-dlya-ii-fotosessii-cluster";
import type { PinnedSeoTag } from "./seo-tags-classify";

export type AdminPhotoshootPublicationFilter = "unpublished" | "published" | "all";

export type AdminPhotoshootAlbumRow = {
  id: string;
  created_at: string;
  generation_completed_at: string;
  prompt_text: string;
  model: string | null;
  client_source: string;
  requester_auth_user_id: string | null;
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  photoshoot_tile_paths: string[] | null;
  ugc_card_id: string | null;
  card_exists: boolean;
  is_published: boolean;
  card_slug: string | null;
  card_title_ru: string | null;
  card_seo_tags: unknown;
  card_subject_audience: string | null;
  card_subject_source: string | null;
};

export function parseAdminPhotoshootPublicationFilter(
  raw: string | null,
): AdminPhotoshootPublicationFilter | null {
  const value = (raw || "unpublished").toLowerCase();
  return value === "unpublished" || value === "published" || value === "all"
    ? value
    : null;
}

export function isFotosessiiScenarioSlug(
  value: unknown,
): value is FotosessiiClusterChildSlug {
  return (
    typeof value === "string" &&
    PROMTY_DLYA_II_FOTOSESSII_CHILDREN.some((child) => child.slug === value)
  );
}

function childBySlug(slug: FotosessiiClusterChildSlug): FotosessiiClusterChild {
  return PROMTY_DLYA_II_FOTOSESSII_CHILDREN.find((child) => child.slug === slug)!;
}

function isExclusiveScenario(child: FotosessiiClusterChild): boolean {
  return (
    child.dimension === "audience_tag" &&
    (EXCLUSIVE_AUDIENCE_SLUGS as readonly string[]).includes(child.tagValue)
  );
}

export type ScenarioPinValidation =
  | { ok: true; slugs: FotosessiiClusterChildSlug[]; pins: PinnedSeoTag[]; revalidatePaths: string[] }
  | { ok: false; error: "invalid_scenario" | "multiple_exclusive_scenarios" };

/**
 * Admin picks scenarios for the album. Only cluster children are allowed, and
 * at most one of them may own an exclusive audience slug (девушка / мужчина /
 * пара / семья / малыш): `subject_audience` holds exactly one.
 */
export function validateScenarioPins(raw: unknown): ScenarioPinValidation {
  const list = Array.isArray(raw) ? raw : [];
  const slugs: FotosessiiClusterChildSlug[] = [];
  for (const item of list) {
    if (!isFotosessiiScenarioSlug(item)) return { ok: false, error: "invalid_scenario" };
    if (!slugs.includes(item)) slugs.push(item);
  }
  const children = slugs.map(childBySlug);
  if (children.filter(isExclusiveScenario).length > 1) {
    return { ok: false, error: "multiple_exclusive_scenarios" };
  }
  return {
    ok: true,
    slugs,
    pins: children.map((child) => ({
      dimension: child.dimension,
      slug: child.tagValue,
    })),
    revalidatePaths: [
      PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
      ...slugs.map((slug) => getPromtyDlyaIiFotosessiiChildPath(slug)),
    ],
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Which hub scenarios this card's `seo_tags` already satisfy. */
export function scenarioSlugsForSeoTags(seoTags: unknown): FotosessiiClusterChildSlug[] {
  const tags =
    seoTags && typeof seoTags === "object" ? (seoTags as Record<string, unknown>) : {};
  const out: FotosessiiClusterChildSlug[] = [];
  for (const child of PROMTY_DLYA_II_FOTOSESSII_CHILDREN) {
    if (stringList(tags[child.dimension]).includes(child.tagValue)) out.push(child.slug);
  }
  return out;
}

export type AdminPhotoshootScenarioOption = {
  slug: FotosessiiClusterChildSlug;
  label: string;
  exclusive: boolean;
  href: string;
};

export function adminPhotoshootScenarioOptions(): AdminPhotoshootScenarioOption[] {
  return PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map((child) => ({
    slug: child.slug,
    label: child.label,
    exclusive: isExclusiveScenario(child),
    href: getPromtyDlyaIiFotosessiiChildPath(child.slug),
  }));
}

export function resolveAlbumPublicationStatus(
  row: Pick<AdminPhotoshootAlbumRow, "ugc_card_id" | "card_exists" | "is_published">,
): "published" | "unpublished" | "card_pending" | "card_missing" {
  if (!row.ugc_card_id) return "card_pending";
  if (!row.card_exists) return "card_missing";
  return row.is_published ? "published" : "unpublished";
}
