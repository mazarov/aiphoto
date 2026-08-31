import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parsePublishRewardConfig,
  parsePublishRewardRpc,
  shouldAttemptPublishReward,
  type PublishRewardResult,
} from "@/lib/publish-reward";

export async function loadPublishRewardConfig(
  supabase: SupabaseClient,
): Promise<ReturnType<typeof parsePublishRewardConfig>> {
  const { data: rows } = await supabase
    .from("landing_generation_config")
    .select("key, value")
    .in("key", [
      "publish_reward_enabled",
      "publish_reward_photo",
      "publish_reward_video",
      "publish_reward_photoshoot",
      "publish_reward_daily_cap",
    ]);
  const config: Record<string, string> = {};
  for (const row of rows || []) {
    config[row.key] = row.value;
  }
  return parsePublishRewardConfig(config);
}

export async function grantPublishRewardAfterPublication(
  supabase: SupabaseClient,
  params: {
    generationId: string;
    authUserId: string;
    alreadyPublished: boolean;
    firstPublishedAt: string | null;
  },
): Promise<PublishRewardResult | null> {
  const rewardConfig = await loadPublishRewardConfig(supabase);
  const shouldGrant = shouldAttemptPublishReward({
    enabled: rewardConfig.enabled,
    alreadyPublished: params.alreadyPublished,
    firstPublishedAt: params.firstPublishedAt,
  });
  if (!shouldGrant) {
    console.info("[publish.reward] skipped", {
      generationId: params.generationId,
      enabled: rewardConfig.enabled,
      alreadyPublished: params.alreadyPublished,
      hasFirstPublishedAt: Boolean(params.firstPublishedAt),
    });
    return null;
  }

  const { data, error } = await supabase.rpc("landing_grant_publish_reward", {
    p_generation_id: params.generationId,
    p_auth_user_id: params.authUserId,
  });
  if (error) {
    console.error("[publish.reward] rpc failed", {
      generationId: params.generationId,
      message: error.message,
    });
    return { status: "error", credits: 0, reason: "error" };
  }
  return parsePublishRewardRpc(data);
}

export async function findOwnedGenerationIdForCard(
  supabase: SupabaseClient,
  params: { cardId: string; authUserId: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("landing_generations")
    .select("id")
    .eq("ugc_card_id", params.cardId)
    .eq("requester_auth_user_id", params.authUserId)
    .maybeSingle();
  if (error) {
    console.error("[publish.reward] generation lookup failed", {
      cardId: params.cardId,
      message: error.message,
    });
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}
