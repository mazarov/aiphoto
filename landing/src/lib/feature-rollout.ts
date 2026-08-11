import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase";
import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import {
  bucketFeatureSubject,
  isBucketEnabled,
  isValidFeatureVisitorId,
  PROMPT_CARD_GENERATION_FEATURE,
} from "@/lib/feature-rollout-core";
export {
  createFeatureVisitorId,
  FEATURE_VISITOR_COOKIE,
  FEATURE_VISITOR_COOKIE_MAX_AGE,
  isValidFeatureVisitorId,
  PROMPT_CARD_GENERATION_FEATURE,
} from "@/lib/feature-rollout-core";
const CONFIG_CACHE_MS = 30_000;

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

type RolloutConfig = {
  enabled: boolean;
  rolloutBps: number;
};

export type FeatureRolloutDecision = {
  enabled: boolean;
  variant: "treatment" | "control";
  bucket: number | null;
  bucketBand: number | null;
  reason: "internal_override" | "rollout" | "disabled" | "config_error";
};

let cachedConfig:
  | { value: RolloutConfig; expiresAt: number }
  | undefined;

async function getRolloutConfig(
  supabase: SupabaseServer
): Promise<{ config: RolloutConfig; failed: boolean }> {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return { config: cachedConfig.value, failed: false };
  }

  const { data, error } = await supabase
    .from("landing_feature_rollouts")
    .select("enabled,rollout_bps")
    .eq("feature_key", PROMPT_CARD_GENERATION_FEATURE)
    .maybeSingle();

  if (error || !data) {
    console.error("[feature.rollout] config lookup failed", {
      featureKey: PROMPT_CARD_GENERATION_FEATURE,
      error: error?.message ?? "missing_config",
    });
    return {
      config: { enabled: false, rolloutBps: 0 },
      failed: true,
    };
  }

  const rolloutBps = Number(data.rollout_bps);
  const value = {
    enabled: data.enabled === true,
    rolloutBps: Number.isFinite(rolloutBps)
      ? Math.max(0, Math.min(10_000, Math.trunc(rolloutBps)))
      : 0,
  };
  cachedConfig = { value, expiresAt: now + CONFIG_CACHE_MS };
  return { config: value, failed: false };
}

async function resolveAuthenticatedBucket(params: {
  supabase: SupabaseServer;
  authUserId: string;
  visitorId?: string | null;
}): Promise<number | null> {
  const { supabase, authUserId, visitorId } = params;
  const { data: existing, error: lookupError } = await supabase
    .from("landing_user_feature_assignments")
    .select("bucket")
    .eq("auth_user_id", authUserId)
    .eq("feature_key", PROMPT_CARD_GENERATION_FEATURE)
    .maybeSingle();

  if (lookupError) {
    console.error("[feature.rollout] assignment lookup failed", {
      featureKey: PROMPT_CARD_GENERATION_FEATURE,
      authUserId,
      error: lookupError.message,
    });
    return null;
  }
  if (existing && Number.isInteger(existing.bucket)) {
    return Number(existing.bucket);
  }

  const copiedVisitorBucket = isValidFeatureVisitorId(visitorId)
    ? bucketFeatureSubject(PROMPT_CARD_GENERATION_FEATURE, visitorId)
    : null;
  const proposedBucket =
    copiedVisitorBucket ??
    bucketFeatureSubject(PROMPT_CARD_GENERATION_FEATURE, authUserId);
  const source = copiedVisitorBucket === null ? "auth" : "visitor";

  const { error: insertError } = await supabase
    .from("landing_user_feature_assignments")
    .upsert(
      {
        auth_user_id: authUserId,
        feature_key: PROMPT_CARD_GENERATION_FEATURE,
        bucket: proposedBucket,
        source,
      },
      {
        onConflict: "auth_user_id,feature_key",
        ignoreDuplicates: true,
      }
    );
  if (insertError) {
    console.error("[feature.rollout] assignment insert failed", {
      featureKey: PROMPT_CARD_GENERATION_FEATURE,
      authUserId,
      error: insertError.message,
    });
    return null;
  }

  // A concurrent request may have won with a different visitor bucket.
  const { data: assigned, error: assignedError } = await supabase
    .from("landing_user_feature_assignments")
    .select("bucket")
    .eq("auth_user_id", authUserId)
    .eq("feature_key", PROMPT_CARD_GENERATION_FEATURE)
    .single();
  if (assignedError || !Number.isInteger(assigned?.bucket)) {
    console.error("[feature.rollout] assignment confirmation failed", {
      featureKey: PROMPT_CARD_GENERATION_FEATURE,
      authUserId,
      error: assignedError?.message ?? "missing_assignment",
    });
    return null;
  }
  return Number(assigned.bucket);
}

export async function resolvePromptCardGenerationAccess(params: {
  user?: User | null;
  visitorId?: string | null;
  supabase?: SupabaseServer;
}): Promise<FeatureRolloutDecision> {
  const { user = null, visitorId = null } = params;
  if (isInternalGenerateAllowlistedEmail(user?.email)) {
    return {
      enabled: true,
      variant: "treatment",
      bucket: null,
      bucketBand: null,
      reason: "internal_override",
    };
  }

  const supabase = params.supabase ?? createSupabaseServer();
  const { config, failed } = await getRolloutConfig(supabase);
  if (failed) {
    return {
      enabled: false,
      variant: "control",
      bucket: null,
      bucketBand: null,
      reason: "config_error",
    };
  }

  const bucket = user
    ? await resolveAuthenticatedBucket({
        supabase,
        authUserId: user.id,
        visitorId,
      })
    : isValidFeatureVisitorId(visitorId)
      ? bucketFeatureSubject(PROMPT_CARD_GENERATION_FEATURE, visitorId)
      : null;

  if (bucket === null) {
    return {
      enabled: false,
      variant: "control",
      bucket: null,
      bucketBand: null,
      reason: "config_error",
    };
  }

  const enabled = config.enabled && isBucketEnabled(bucket, config.rolloutBps);
  return {
    enabled,
    variant: enabled ? "treatment" : "control",
    bucket,
    bucketBand: Math.floor(bucket / 100),
    reason: config.enabled ? "rollout" : "disabled",
  };
}

/**
 * `/pricing` funnel access: allow if account treatment OR visitor cookie treatment.
 * Does not rewrite sticky `landing_user_feature_assignments` (generation cohort stays).
 */
export async function resolvePricingPageAccess(params: {
  user?: User | null;
  visitorId?: string | null;
  supabase?: SupabaseServer;
}): Promise<{ allowed: boolean; rollout: FeatureRolloutDecision }> {
  const supabase = params.supabase ?? createSupabaseServer();
  const rollout = await resolvePromptCardGenerationAccess({
    user: params.user,
    visitorId: params.visitorId,
    supabase,
  });
  if (rollout.enabled) {
    return { allowed: true, rollout };
  }

  // Auth control + anonymous treatment cookie: keep checkout page open mid-funnel.
  if (params.user && isValidFeatureVisitorId(params.visitorId)) {
    const visitorRollout = await resolvePromptCardGenerationAccess({
      user: null,
      visitorId: params.visitorId,
      supabase,
    });
    if (visitorRollout.enabled) {
      return { allowed: true, rollout };
    }
  }

  return { allowed: false, rollout };
}

export function clearFeatureRolloutConfigCacheForTests(): void {
  cachedConfig = undefined;
}
