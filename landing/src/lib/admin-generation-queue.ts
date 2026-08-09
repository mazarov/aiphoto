export type AdminPublicationStatus = "unpublished" | "published" | "card_pending" | "card_missing";
export type AdminGenerationQueueStatus = "unpublished" | "published" | "all";
export type AdminGenerationQueueRow = {
  id: string; created_at: string; generation_completed_at: string | null; prompt_text: string;
  model: string | null; aspect_ratio: string | null; image_size: string | null;
  result_storage_bucket: string | null; result_storage_path: string | null; ugc_card_id: string | null;
  card_exists: boolean; is_published: boolean; source_channel: string | null; card_slug: string | null;
};

export const encodeAdminGenerationCursor = (createdAt: string, id: string) => `${createdAt}|${id}`;
export function parseAdminGenerationCursor(raw: string | null) {
  if (!raw) return null;
  const separator = raw.indexOf("|");
  if (separator <= 0 || separator !== raw.lastIndexOf("|")) return null;
  const createdAt = raw.slice(0, separator).trim();
  const id = raw.slice(separator + 1).trim();
  if (!createdAt || !id || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) {
    return null;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return { createdAt, id };
}
export function parseAdminGenerationLimit(raw: string | null): number {
  const value = Number(raw || 30);
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : 30;
}
export function parseAdminGenerationQueueStatus(raw: string | null): AdminGenerationQueueStatus | null {
  const value = (raw || "unpublished").toLowerCase();
  return value === "unpublished" || value === "published" || value === "all" ? value : null;
}
export function resolveAdminPublicationStatus(row: Pick<AdminGenerationQueueRow, "ugc_card_id" | "card_exists" | "is_published">): AdminPublicationStatus {
  if (!row.ugc_card_id) return "card_pending";
  if (!row.card_exists) return "card_missing";
  return row.is_published ? "published" : "unpublished";
}
