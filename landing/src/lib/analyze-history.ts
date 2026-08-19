import type { NextRequest } from "next/server";
import sharp from "sharp";
import { resolveClientSource } from "@/lib/client-source";
import type { createSupabaseServer } from "@/lib/supabase";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;
export const ANALYZE_HISTORY_BUCKET = "analyze-history";
const RETENTION_DAYS = 30;
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
    client_source: resolveClientSource(req, {
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

/** Fire-and-forget successful analyze / remix history. */
export function recordAnalyzeHistory(
  supabase: SupabaseServer,
  req: NextRequest,
  input: AnalyzeHistoryInput,
): void {
  void persist(supabase, req, input).catch((error) => {
    console.warn("[analyze.history] persist failed", {
      kind: input.kind === "remix" ? "remix" : "analyze",
      message: error instanceof Error ? error.message : String(error),
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

/** Opportunistic retention cleanup; failures never block an admin read. */
export async function maybeCleanupAnalyzeHistory(supabase: SupabaseServer): Promise<void> {
  if (Math.random() > 0.05) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("analyze_history")
    .select("id,image_path")
    .lt("created_at", cutoff)
    .limit(500);
  if (error || !data?.length) return;
  const paths = data.map((row) => row.image_path).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from(ANALYZE_HISTORY_BUCKET).remove(paths);
  await supabase.from("analyze_history").delete().in("id", data.map((row) => row.id));
}
