import type { ClientSource } from "@/lib/client-source";
import type { createSupabaseServer } from "@/lib/supabase";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export type AnalyzeEventInput = {
  endpoint: "analyze" | "remix";
  clientSource: ClientSource;
  ipHash: string;
  userId: string | null;
  allowed: boolean;
  requestOrigin?: string | null;
  outcome?:
    | "success"
    | "truncated"
    | "rate_limited"
    | "auth_required"
    | "no_credits"
    | "quota_unavailable"
    | "upstream_error"
    | "empty_response"
    | "invalid_request"
    | "config_error";
  errorCode?: string | null;
  quotaMode?: string | null;
  finishReason?: string | null;
  truncated?: boolean;
  httpStatus?: number | null;
  latencyMs?: number | null;
  locale?: string | null;
  style?: string | null;
  model?: string | null;
  missingSections?: number | null;
  correlationId?: string | null;
};

/** Fire-and-forget analytics; persistence must never fail the request. */
export function recordAnalyzeEvent(
  supabase: SupabaseServer,
  event: AnalyzeEventInput,
): void {
  void supabase
    .from("extension_analyze_events")
    .insert({
      endpoint: event.endpoint,
      client_source: event.clientSource,
      ip_hash: event.ipHash,
      user_id: event.userId,
      allowed: event.allowed,
      request_origin: event.requestOrigin ?? null,
      outcome: event.outcome ?? null,
      error_code: event.errorCode ?? null,
      finish_reason: event.finishReason ?? null,
      truncated: event.truncated ?? false,
      http_status: event.httpStatus ?? null,
      latency_ms: event.latencyMs ?? null,
      locale: event.locale ?? null,
      style: event.style ?? null,
      model: event.model ?? null,
      missing_sections: event.missingSections ?? null,
      correlation_id: event.correlationId ?? null,
      quota_mode: event.quotaMode ?? null,
    })
    .then(({ error }) => {
      if (error) {
        console.warn("[analyze.event] insert failed", { message: error.message });
      }
    });
}
