import type { SupabaseClient } from "@supabase/supabase-js";
import { GEMINI_DIRECT_BASE_URL } from "@/lib/image-prompt-analyze-gemini";
import {
  AUDIENCE_VISION_MODEL,
  AudienceVisionError,
  classifyAudienceFromImageBytes,
  type AudienceVisionRaw,
} from "@/lib/audience-vision-core";

export const CARD_SUBJECT_AUDIENCE_ENABLED_KEY = "card_subject_audience_enabled";
export const CARD_SUBJECT_AUDIENCE_DAILY_LIMIT_KEY = "card_subject_audience_daily_limit";
export const CARD_SUBJECT_AUDIENCE_MIN_CONFIDENCE_KEY =
  "card_subject_audience_min_confidence";

export const CARD_SUBJECT_AUDIENCE_DAILY_LIMIT_DEFAULT = 3000;
export const CARD_SUBJECT_AUDIENCE_MIN_CONFIDENCE_DEFAULT = 0.6;
export const CARD_SUBJECT_CLASSIFY_TIMEOUT_MS = 30_000;

const CONFIG_KEYS = [
  CARD_SUBJECT_AUDIENCE_ENABLED_KEY,
  CARD_SUBJECT_AUDIENCE_DAILY_LIMIT_KEY,
] as const;

export type SubjectAudienceSupabase = SupabaseClient;

export type ClaimedSubjectCard = {
  card_id: string;
  media_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  current_audience: unknown;
};

export type CardSubjectAudienceResult = {
  status: "disabled" | "skipped" | "classified" | "failed";
  reason?: string;
  audience?: string | null;
  confidence?: number | null;
  processed?: number;
  failed?: number;
  coverage?: unknown;
};

type VisionFn = typeof classifyAudienceFromImageBytes;

function enabledFlag(value: unknown): boolean {
  return ["true", "1", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function configMap(rows: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const key = String((row as { key?: unknown }).key ?? "");
    const value = String((row as { value?: unknown }).value ?? "");
    if (key) out.set(key, value);
  }
  return out;
}

function asClaimedRows(data: unknown): ClaimedSubjectCard[] {
  if (!Array.isArray(data)) return [];
  const rows: ClaimedSubjectCard[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.card_id !== "string" || typeof item.media_id !== "string") continue;
    if (typeof item.storage_bucket !== "string" || typeof item.storage_path !== "string") continue;
    rows.push({
      card_id: item.card_id,
      media_id: item.media_id,
      storage_bucket: item.storage_bucket,
      storage_path: item.storage_path,
      mime_type: typeof item.mime_type === "string" ? item.mime_type : null,
      current_audience: item.current_audience,
    });
  }
  return rows;
}

function storageBaseUrl(): string {
  return (
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
}

function utcDayStart(): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

async function readRuntimeConfig(supabase: SubjectAudienceSupabase): Promise<{
  enabled: boolean;
  dailyLimit: number;
} | null> {
  const { data, error } = await supabase
    .from("landing_generation_config")
    .select("key,value")
    .in("key", CONFIG_KEYS);
  if (error) {
    console.warn("[card-subject-audience] config read failed", { message: error.message });
    return null;
  }
  const map = configMap(data);
  return {
    enabled: enabledFlag(map.get(CARD_SUBJECT_AUDIENCE_ENABLED_KEY)),
    dailyLimit: positiveInt(
      map.get(CARD_SUBJECT_AUDIENCE_DAILY_LIMIT_KEY),
      CARD_SUBJECT_AUDIENCE_DAILY_LIMIT_DEFAULT,
    ),
  };
}

/**
 * Proxy is required unless photo_app_config.gemini_use_proxy is an explicit off.
 * Empty GEMINI_PROXY_BASE_URL must not fall through to generativelanguage.googleapis.com.
 */
export async function resolveCardSubjectGeminiBaseUrl(
  supabase: SubjectAudienceSupabase,
): Promise<string> {
  const proxy = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", "gemini_use_proxy")
    .maybeSingle();
  if (error) {
    if (proxy) return proxy;
    throw new AudienceVisionError("missing_proxy", 500);
  }
  const raw = String((data as { value?: unknown } | null)?.value ?? "")
    .trim()
    .toLowerCase();
  const useProxy = !raw || ["true", "1", "yes", "y", "on"].includes(raw);
  if (useProxy) {
    if (!proxy) throw new AudienceVisionError("missing_proxy", 500);
    return proxy;
  }
  return proxy || GEMINI_DIRECT_BASE_URL;
}

async function takeBudget(
  supabase: SubjectAudienceSupabase,
  dailyLimit: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("card_subject_audience_take_budget", {
    p_window_start: utcDayStart(),
    p_max: dailyLimit,
  });
  if (error) {
    console.warn("[card-subject-audience] budget failed", { message: error.message });
    return false;
  }
  return Boolean(data && typeof data === "object" && (data as { allowed?: unknown }).allowed === true);
}

async function downloadCanonicalPhoto(params: {
  card: ClaimedSubjectCard;
  fetchImpl: typeof fetch;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const base = storageBaseUrl();
  if (!base) throw new AudienceVisionError("provider_error", 500);
  const path = `${params.card.storage_bucket}/${params.card.storage_path}`;
  const urls = [
    `${base}/storage/v1/render/image/public/${path}?width=512&quality=60`,
    `${base}/storage/v1/object/public/${path}`,
  ];
  for (const url of urls) {
    const response = await params.fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 4 * 1024 * 1024) continue;
    return {
      bytes,
      mimeType: params.card.mime_type || "image/jpeg",
    };
  }
  throw new AudienceVisionError("provider_error", 502);
}

async function finishClaimedCard(params: {
  supabase: SubjectAudienceSupabase;
  card: ClaimedSubjectCard;
  baseUrl: string;
  dailyLimit: number;
  fetchImpl: typeof fetch;
  classify: VisionFn;
}): Promise<CardSubjectAudienceResult> {
  const allowed = await takeBudget(params.supabase, params.dailyLimit);
  if (!allowed) {
    await params.supabase.rpc("fail_subject_audience", {
      p_card_id: params.card.card_id,
      p_error: "budget",
    });
    return { status: "failed", reason: "budget", audience: null, confidence: null };
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    await params.supabase.rpc("fail_subject_audience", {
      p_card_id: params.card.card_id,
      p_error: "missing_api_key",
    });
    return { status: "failed", reason: "missing_api_key" };
  }

  let raw: AudienceVisionRaw;
  try {
    const photo = await downloadCanonicalPhoto({
      card: params.card,
      fetchImpl: params.fetchImpl,
    });
    raw = await params.classify({
      bytes: photo.bytes,
      mimeType: photo.mimeType,
      baseUrl: params.baseUrl,
      apiKey,
      timeoutMs: CARD_SUBJECT_CLASSIFY_TIMEOUT_MS,
      fetchImpl: params.fetchImpl,
    });
  } catch (error) {
    const code = error instanceof AudienceVisionError ? error.code : "provider_error";
    await params.supabase.rpc("fail_subject_audience", {
      p_card_id: params.card.card_id,
      p_error: code,
    });
    return { status: "failed", reason: code };
  }

  if (!raw.audience || raw.confidence == null) {
    await params.supabase.rpc("fail_subject_audience", {
      p_card_id: params.card.card_id,
      p_error: "malformed",
    });
    return { status: "failed", reason: "malformed", confidence: raw.confidence };
  }

  const { data, error } = await params.supabase.rpc("complete_subject_audience", {
    p_card_id: params.card.card_id,
    p_media_id: params.card.media_id,
    p_audience: raw.audience,
    p_confidence: raw.confidence,
    p_people_count: raw.peopleCount,
    p_model: AUDIENCE_VISION_MODEL,
  });
  if (error || data !== true) {
    await params.supabase.rpc("fail_subject_audience", {
      p_card_id: params.card.card_id,
      p_error: error?.message || "complete_failed",
    });
    return { status: "failed", reason: "complete_failed", audience: raw.audience, confidence: raw.confidence };
  }
  return {
    status: "classified",
    audience: raw.audience,
    confidence: raw.confidence,
  };
}

export async function classifyCardSubjectAudience(options: {
  supabase: SubjectAudienceSupabase;
  cardId: string;
  fetchImpl?: typeof fetch;
  classify?: VisionFn;
}): Promise<CardSubjectAudienceResult> {
  const config = await readRuntimeConfig(options.supabase);
  if (!config?.enabled) return { status: "disabled" };

  const baseUrl = await resolveCardSubjectGeminiBaseUrl(options.supabase);
  const { data, error } = await options.supabase.rpc("claim_subject_audience_batch", {
    p_limit: 1,
    p_priority: "all",
    p_card_id: options.cardId,
  });
  if (error) {
    return { status: "failed", reason: error.message };
  }
  const [card] = asClaimedRows(data);
  if (!card) return { status: "skipped", reason: "not_claimed" };

  return finishClaimedCard({
    supabase: options.supabase,
    card,
    baseUrl,
    dailyLimit: config.dailyLimit,
    fetchImpl: options.fetchImpl ?? fetch,
    classify: options.classify ?? classifyAudienceFromImageBytes,
  });
}

export async function processSubjectAudienceBacklog(options: {
  supabase: SubjectAudienceSupabase;
  limit: number;
  fetchImpl?: typeof fetch;
  classify?: VisionFn;
}): Promise<CardSubjectAudienceResult> {
  const config = await readRuntimeConfig(options.supabase);
  if (!config?.enabled) {
    return { status: "disabled", processed: 0, failed: 0 };
  }
  const baseUrl = await resolveCardSubjectGeminiBaseUrl(options.supabase);
  const limit = Math.min(20, Math.max(1, options.limit));
  const { data, error } = await options.supabase.rpc("claim_subject_audience_batch", {
    p_limit: limit,
    p_priority: "all",
    p_card_id: null,
  });
  if (error) throw new Error(error.message);
  const cards = asClaimedRows(data);
  let processed = 0;
  let failed = 0;
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    if (!card) continue;
    const result = await finishClaimedCard({
      supabase: options.supabase,
      card,
      baseUrl,
      dailyLimit: config.dailyLimit,
      fetchImpl: options.fetchImpl ?? fetch,
      classify: options.classify ?? classifyAudienceFromImageBytes,
    });
    if (result.status === "classified") processed += 1;
    else failed += 1;
    if (result.reason === "budget") {
      for (const rest of cards.slice(index + 1)) {
        await options.supabase.rpc("fail_subject_audience", {
          p_card_id: rest.card_id,
          p_error: "budget",
        });
        failed += 1;
      }
      break;
    }
  }
  const coverage = await options.supabase.rpc("subject_audience_coverage", {});
  return {
    status: "classified",
    processed,
    failed,
    coverage: coverage.error ? null : coverage.data,
  };
}

export function scheduleCardSubjectAudience(options: {
  supabase: SubjectAudienceSupabase;
  cardId: string;
  afterImpl: (work: () => Promise<void>) => void;
  classify?: typeof classifyCardSubjectAudience;
}): void {
  const classify = options.classify ?? classifyCardSubjectAudience;
  options.afterImpl(async () => {
    try {
      const result = await classify({
        supabase: options.supabase,
        cardId: options.cardId,
      });
      console.info("[card-subject-audience] publish kick", {
        cardId: options.cardId,
        status: result.status,
        reason: result.reason ?? null,
        audience: result.audience ?? null,
      });
    } catch (error) {
      console.warn("[card-subject-audience] publish kick failed", {
        cardId: options.cardId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
