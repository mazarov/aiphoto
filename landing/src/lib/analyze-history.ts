import type { NextRequest } from "next/server";
import sharp from "sharp";
import { resolveClientSource, type ClientSource } from "@/lib/client-source";
import type { createSupabaseServer } from "@/lib/supabase";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;
export const ANALYZE_HISTORY_BUCKET = "analyze-history";
export const ANALYZE_HISTORY_RETENTION_DAYS = 5;
export const ANALYZE_HISTORY_CLEANUP_BATCH = 200;
export const ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT = 1000;
export const ANALYZE_HISTORY_CLEANUP_MAX_LIMIT = 4000;
const ANALYZE_HISTORY_REMOVE_CHUNK = 80;
const MAX_CHANGE_REQUEST_CHARS = 1_000;

export type AnalyzeHistoryKind = "analyze" | "remix";

type AnalyzeHistoryInput = {
  kind?: AnalyzeHistoryKind;
  imageBase64?: string | null;
  prompt: string;
  changeRequest?: string | null;
  style?: string | null;
  locale?: string | null;
  model?: string | null;
  userId?: string | null;
  ipHash?: string | null;
  correlationId?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  authenticated?: boolean;
  creditsSpent?: number;
  quotaMode?: string | null;
  clientSource?: ClientSource;
};

async function persist(
  supabase: SupabaseServer,
  req: NextRequest,
  input: AnalyzeHistoryInput,
): Promise<void> {
  const kind: AnalyzeHistoryKind = input.kind === "remix" ? "remix" : "analyze";
  const prompt = input.prompt.trim();
  if (!prompt) return;

  const changeRequest =
    typeof input.changeRequest === "string" ? input.changeRequest.trim() : "";
  if (kind === "remix") {
    if (!changeRequest || changeRequest.length > MAX_CHANGE_REQUEST_CHARS) return;
  } else if (changeRequest || !input.imageBase64) {
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date();
  let path: string | null = null;

  if (input.imageBase64) {
    path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}/${String(now.getUTCDate()).padStart(2, "0")}/${id}.jpg`;
    const image = await sharp(Buffer.from(input.imageBase64, "base64"))
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from(ANALYZE_HISTORY_BUCKET)
      .upload(path, image, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
  }

  const { error: insertError } = await supabase.from("analyze_history").insert({
    id,
    kind,
    client_source:
      input.clientSource ??
      resolveClientSource(req, {
        authenticated: input.authenticated,
      }),
    image_path: path,
    image_mime: path ? "image/jpeg" : null,
    prompt,
    change_request: kind === "remix" ? changeRequest : null,
    style: input.style ?? null,
    locale: input.locale ?? null,
    model: input.model ?? null,
    user_id: input.userId ?? null,
    visitor_id: input.visitorId ?? null,
    session_id: input.sessionId ?? null,
    ip_hash: input.ipHash ?? null,
    correlation_id: input.correlationId ?? null,
    credits_spent: input.creditsSpent ?? 0,
    quota_mode: input.quotaMode ?? null,
  });
  if (insertError) {
    if (path) void supabase.storage.from(ANALYZE_HISTORY_BUCKET).remove([path]);
    throw insertError;
  }
}

export function serializeUnknownError(error: unknown): {
  message: string;
  code: string | null;
  details: string | null;
} {
  if (error instanceof Error) {
    return { message: error.message, code: error.name || null, details: null };
  }
  if (error && typeof error === "object") {
    const row = error as { message?: unknown; code?: unknown; details?: unknown };
    return {
      message: typeof row.message === "string" ? row.message : JSON.stringify(error),
      code: typeof row.code === "string" ? row.code : null,
      details: typeof row.details === "string" ? row.details : null,
    };
  }
  return { message: String(error), code: null, details: null };
}

/** Fire-and-forget successful analyze / remix history. */
export function recordAnalyzeHistory(
  supabase: SupabaseServer,
  req: NextRequest,
  input: AnalyzeHistoryInput,
): void {
  void persist(supabase, req, input).catch((error) => {
    console.warn("[analyze.history] persist failed", {
      kind: input.kind === "remix" ? "remix" : "analyze",
      ...serializeUnknownError(error),
    });
  });
}

export type AnalyzeHistoryRow = {
  id: string;
  created_at: string;
  kind: AnalyzeHistoryKind;
  client_source: string;
  prompt: string;
  change_request: string | null;
  style: string | null;
  locale: string | null;
  model: string | null;
  image_path: string | null;
  ugc_card_id: string | null;
  user_id?: string | null;
  credits_spent?: number | null;
  quota_mode?: string | null;
};

export type AnalyzeHistoryIdentity = {
  email: string | null;
  displayName: string | null;
};

export async function loadAnalyzeHistoryIdentities(
  supabase: SupabaseServer,
  userIds: string[],
): Promise<Map<string, AnalyzeHistoryIdentity>> {
  const identities = new Map<string, AnalyzeHistoryIdentity>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return identities;

  const { data: shared } = await supabase
    .from("imageprompt_users")
    .select("id,email,display_name")
    .in("id", ids);
  for (const row of shared || []) {
    identities.set(row.id, {
      email: row.email || null,
      displayName: row.display_name || null,
    });
  }

  const missing = ids.filter((id) => !identities.get(id)?.email);
  if (!missing.length) return identities;

  await Promise.all(missing.map(async (id) => {
    const { data } = await supabase.auth.admin.getUserById(id);
    const email = data?.user?.email || null;
    const name =
      (data?.user?.user_metadata?.full_name as string | undefined)
      || (data?.user?.user_metadata?.name as string | undefined)
      || null;
    if (!email && !name) return;
    const current = identities.get(id);
    identities.set(id, {
      email: email || current?.email || null,
      displayName: name || current?.displayName || null,
    });
  }));
  return identities;
}

export function encodeAnalyzeHistoryCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

export function parseAnalyzeHistoryCursor(raw: string | null): { createdAt: string; id: string } | null {
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

export function parseAnalyzeHistoryLimit(raw: string | null): number {
  const value = Number(raw || 30);
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : 30;
}

export function analyzeHistoryRetentionCutoff(now = Date.now()): string {
  return new Date(now - ANALYZE_HISTORY_RETENTION_DAYS * 86_400_000).toISOString();
}

export function parseAnalyzeHistoryCleanupLimit(raw: string | null): number {
  const value = Number(raw || ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT);
  return Number.isFinite(value)
    ? Math.min(ANALYZE_HISTORY_CLEANUP_MAX_LIMIT, Math.max(1, Math.floor(value)))
    : ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT;
}

export type AnalyzeHistoryCleanupResult = {
  cutoff: string;
  scanned: number;
  deletedRows: number;
  removedFiles: number;
  hasMore: boolean;
};

function chunkPaths(paths: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < paths.length; i += size) batches.push(paths.slice(i, i + size));
  return batches;
}

/** Deletes analyze rows and MinIO objects older than 5 days. Storage first, then rows. */
export async function cleanupExpiredAnalyzeHistory(
  supabase: SupabaseServer,
  options: { limit?: number; now?: number } = {},
): Promise<AnalyzeHistoryCleanupResult> {
  const limit = parseAnalyzeHistoryCleanupLimit(
    options.limit == null ? null : String(options.limit),
  );
  const cutoff = analyzeHistoryRetentionCutoff(options.now);
  let scanned = 0;
  let deletedRows = 0;
  let removedFiles = 0;

  while (deletedRows < limit) {
    const take = Math.min(ANALYZE_HISTORY_CLEANUP_BATCH, limit - deletedRows);
    const { data, error } = await supabase
      .from("analyze_history")
      .select("id,image_path")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(take);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) {
      return { cutoff, scanned, deletedRows, removedFiles, hasMore: false };
    }
    scanned += rows.length;

    const paths = [...new Set(rows.map((row) => row.image_path).filter((path): path is string => Boolean(path)))];
    for (const batch of chunkPaths(paths, ANALYZE_HISTORY_REMOVE_CHUNK)) {
      const { error: removeError } = await supabase.storage
        .from(ANALYZE_HISTORY_BUCKET)
        .remove(batch);
      if (removeError) throw new Error(removeError.message);
      removedFiles += batch.length;
    }

    const { error: deleteError } = await supabase
      .from("analyze_history")
      .delete()
      .in("id", rows.map((row) => row.id));
    if (deleteError) throw new Error(deleteError.message);
    deletedRows += rows.length;
    if (rows.length < take) {
      return { cutoff, scanned, deletedRows, removedFiles, hasMore: false };
    }
  }

  return { cutoff, scanned, deletedRows, removedFiles, hasMore: true };
}
