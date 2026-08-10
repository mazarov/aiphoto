import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
  resolveAdminPublicationStatus,
  type AdminPublicationStatus,
} from "@/lib/admin-generation-queue";

export type AdminUserGenerationStatus = "all" | "pending" | "processing" | "completed" | "failed";
export type AdminUserGenerationPublicationFilter = "all" | "unpublished" | "published";

export type AdminUserGenerationRow = {
  id: string;
  created_at: string;
  generation_completed_at: string | null;
  status: Exclude<AdminUserGenerationStatus, "all">;
  prompt_text: string;
  model: string | null;
  aspect_ratio: string | null;
  image_size: string | null;
  credits_spent: number;
  credits_refunded: boolean;
  error_type: string | null;
  error_message: string | null;
  client_source: string;
  requester_auth_user_id: string | null;
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  user_provider: string | null;
  input_photo_paths: string[] | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  ugc_card_id: string | null;
  card_exists: boolean;
  is_published: boolean;
  card_slug: string | null;
};

export const encodeAdminUserGenerationCursor = encodeAdminGenerationCursor;
export const parseAdminUserGenerationCursor = parseAdminGenerationCursor;
export const parseAdminUserGenerationLimit = parseAdminGenerationLimit;

export function parseAdminUserGenerationStatus(raw: string | null): AdminUserGenerationStatus | null {
  const value = (raw || "all").toLowerCase();
  return value === "all" || value === "pending" || value === "processing"
    || value === "completed" || value === "failed"
    ? value
    : null;
}

export function parseAdminUserGenerationPublicationFilter(
  raw: string | null
): AdminUserGenerationPublicationFilter | null {
  const value = (raw || "all").toLowerCase();
  return value === "all" || value === "unpublished" || value === "published" ? value : null;
}

export function parseAdminUserGenerationClientSource(raw: string | null): string | null | undefined {
  if (!raw || raw === "all") return null;
  const value = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

export function resolveUserGenerationPublicationStatus(
  row: Pick<AdminUserGenerationRow, "ugc_card_id" | "card_exists" | "is_published">
): AdminPublicationStatus {
  return resolveAdminPublicationStatus(row);
}

export function sanitizeGenerationError(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim().slice(0, 300) || null;
}
