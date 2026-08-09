import type { NextRequest } from "next/server";
import { recordAnalyzeEvent, type AnalyzeEventInput } from "@/lib/analyze-events";
import { resolveClientSource } from "@/lib/client-source";
import {
  beginExtensionRateLimitSession,
  confirmExtensionRateLimitForSession,
  extensionRateLimitEffectiveUsage,
  releaseExtensionRateLimitForSession,
  reserveExtensionRateLimitForSession,
  type ExtensionRateLimitCheckResult,
  type ExtensionRateLimitSession,
} from "@/lib/extension-rate-limit";
import type { createSupabaseServer } from "@/lib/supabase";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;
type Outcome = Pick<
  AnalyzeEventInput,
  | "outcome"
  | "errorCode"
  | "finishReason"
  | "truncated"
  | "httpStatus"
  | "latencyMs"
  | "locale"
  | "style"
  | "model"
  | "missingSections"
  | "correlationId"
>;

export function extensionRateLimit429Body(
  result: ExtensionRateLimitCheckResult,
) {
  return {
    error: "rate_limited" as const,
    message: "Daily limit reached. Try again in 24 hours.",
    limit_count: extensionRateLimitEffectiveUsage(result),
    limit_max: result.max,
    authenticated: result.authenticated,
    auth_required: !result.authenticated,
  };
}

export function extensionRateLimitQuotaFields(
  result: ExtensionRateLimitCheckResult | null,
) {
  if (!result) return {};
  return {
    remaining: Math.max(
      0,
      result.max - extensionRateLimitEffectiveUsage(result),
    ),
    count: result.count,
    pending: result.pending,
    max: result.max,
  };
}

export function recordExtensionRateLimitEvent(
  supabase: SupabaseServer,
  req: NextRequest,
  endpoint: "analyze" | "remix",
  rateLimit: ExtensionRateLimitCheckResult | null,
  allowed: boolean,
  outcome?: Outcome,
): void {
  if (!rateLimit) return;
  recordAnalyzeEvent(supabase, {
    endpoint,
    clientSource: resolveClientSource(req, {
      authenticated: rateLimit.authenticated,
    }),
    ipHash: rateLimit.ipHash,
    userId: rateLimit.userId,
    allowed,
    requestOrigin: req.headers.get("origin"),
    correlationId: req.headers.get("x-correlation-id"),
    ...outcome,
  });
}

export function beginExtensionRateLimit(
  req: NextRequest,
  supabase: SupabaseServer,
  _endpoint: "analyze" | "remix",
) {
  return beginExtensionRateLimitSession(req, supabase);
}

export function reserveExtensionRateLimit(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return reserveExtensionRateLimitForSession(supabase, session);
}

export function confirmExtensionRateLimitOnSuccess(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return confirmExtensionRateLimitForSession(supabase, session);
}

export function releaseExtensionRateLimitOnFailure(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return releaseExtensionRateLimitForSession(supabase, session);
}

export function extensionRateLimitCheckFromSession(
  session: ExtensionRateLimitSession | null,
  override?: ExtensionRateLimitCheckResult | null,
): ExtensionRateLimitCheckResult | null {
  return override ?? session?.check ?? null;
}
