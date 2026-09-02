import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  GENERATION_LIST_COLUMNS,
  GENERATIONS_PAGE_SIZE,
  buildGenerationResultMedia,
  isUnknownGenerationsListRpc,
  takeGenerationPage,
  type GenerationHistoryItem,
  type GenerationListPage,
  type GenerationListRow,
} from "@/lib/generations-list";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  chunkForPostgrestIn,
  createSupabaseServer,
  getStorageCardMediaUrl,
  getStoragePublicUrl,
} from "@/lib/supabase";

type CardMeta = { id: string; slug: string | null; isPublished: boolean };

function toListingUrl(bucket: string, path: string): string {
  return getStorageCardMediaUrl(bucket, path, "listing");
}

export function mapGenerationListRow(
  row: GenerationListRow,
  card: CardMeta | null | undefined,
): GenerationHistoryItem {
  const media = buildGenerationResultMedia({
    bucket: row.result_storage_bucket,
    editKind: row.edit_kind,
    sheetPath: row.result_storage_path,
    tilePaths: row.photoshoot_tile_paths,
    modality: row.modality,
    resultMimeType: row.result_mime_type,
    toPublicUrl: getStoragePublicUrl,
    toListingUrl,
  });
  return {
    id: row.id,
    status: row.status as GenerationHistoryItem["status"],
    prompt: row.prompt_text || "",
    model: row.model || "",
    aspectRatio: row.aspect_ratio || "",
    modality: row.modality || "image",
    resultMimeType: row.result_mime_type || null,
    durationSeconds: row.duration_seconds ?? null,
    editKind: row.edit_kind || null,
    creditsSpent: row.credits_spent ?? 0,
    createdAt: row.created_at,
    completedAt: row.generation_completed_at,
    errorMessage: row.status === "failed" ? row.error_message : null,
    ...media,
    cardId: card?.id ?? null,
    cardSlug: card?.slug ?? null,
    isPublished: card?.isPublished ?? false,
  };
}

async function fetchGenerationListRows(input: {
  supabase: SupabaseClient;
  authUserId: string;
  dbUserId: string;
  limit: number;
  offset: number;
}): Promise<GenerationListRow[]> {
  const { data, error } = await input.supabase.rpc("landing_list_my_generations", {
    p_requester: input.authUserId,
    p_billing: input.dbUserId,
    p_limit: input.limit + 1,
    p_offset: input.offset,
  });
  if (!error) return (data ?? []) as GenerationListRow[];
  if (!isUnknownGenerationsListRpc(error)) {
    throw new Error(error.message);
  }

  const ownerFilter = landingGenerationsOwnerOrFilter(
    input.authUserId,
    input.dbUserId,
  );
  const fallback = await input.supabase
    .from("landing_generations")
    .select(GENERATION_LIST_COLUMNS)
    .or(ownerFilter)
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit);
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as GenerationListRow[];
}

async function loadCardMetadata(
  supabase: SupabaseClient,
  rows: readonly GenerationListRow[],
): Promise<Map<string, CardMeta>> {
  const cardIds = [
    ...new Set(
      rows
        .map((row) => row.ugc_card_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cardsById = new Map<string, CardMeta>();
  if (cardIds.length === 0) return cardsById;

  for (const part of chunkForPostgrestIn(cardIds)) {
    const { data: cards, error } = await supabase
      .from("prompt_cards")
      .select("id, slug, is_published")
      .in("id", part);
    if (error) {
      console.error("generations card metadata error:", error.message);
      continue;
    }
    for (const card of cards || []) {
      cardsById.set(card.id as string, {
        id: card.id as string,
        slug: (card.slug as string | null) ?? null,
        isPublished: Boolean(card.is_published),
      });
    }
  }
  return cardsById;
}

export async function listUserGenerations(input: {
  supabase: SupabaseClient;
  authUserId: string;
  dbUserId: string;
  limit: number;
  offset: number;
}): Promise<GenerationListPage> {
  const rows = await fetchGenerationListRows(input);
  const { page, hasMore } = takeGenerationPage(rows, input.limit);
  const cardsById = await loadCardMetadata(input.supabase, page);
  return {
    generations: page.map((row) =>
      mapGenerationListRow(
        row,
        row.ugc_card_id ? cardsById.get(row.ugc_card_id) : null,
      ),
    ),
    hasMore,
    nextOffset: hasMore ? input.offset + page.length : null,
  };
}

/** First cabinet page for `/generations` RSC. Null = caller should let the client fetch. */
export async function loadGenerationsFirstPageForUser(
  user: User,
): Promise<GenerationListPage | null> {
  try {
    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    return await listUserGenerations({
      supabase,
      authUserId: user.id,
      dbUserId: resolved?.dbUserId ?? user.id,
      limit: GENERATIONS_PAGE_SIZE,
      offset: 0,
    });
  } catch (err) {
    console.error("generations SSR list error:", err);
    return null;
  }
}
