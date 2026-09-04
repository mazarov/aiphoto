import type { createSupabaseServer } from "@/lib/supabase";
import { extensionRateLimitDayWindowStartIso } from "@/lib/extension-rate-limit-ip";
import {
  COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_DEFAULT,
  COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_DEFAULT,
  COMPOSE_EXAMPLE_MATCH_USER_DAILY_LIMIT_DEFAULT,
  parseComposeExampleMatchDailyLimit,
} from "@/lib/compose-example-audience";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export async function reserveComposeAudienceClassifyBudget(input: {
  supabase: SupabaseServer;
  ipHash: string;
  userKey?: string | null;
  ipMax?: string;
  globalMax?: string;
}): Promise<boolean> {
  const { data, error } = await input.supabase.rpc(
    "compose_audience_classify_rate_limit_increment",
    {
      p_ip_hash: input.ipHash,
      p_window_start: extensionRateLimitDayWindowStartIso(),
      p_ip_max: parseComposeExampleMatchDailyLimit(
        input.ipMax,
        COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_DEFAULT,
      ),
      p_global_max: parseComposeExampleMatchDailyLimit(
        input.globalMax,
        COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_DEFAULT,
      ),
      p_user_key: input.userKey?.trim() || "",
      p_user_max: COMPOSE_EXAMPLE_MATCH_USER_DAILY_LIMIT_DEFAULT,
    },
  );
  if (error) {
    console.error(
      "[compose-audience-classify] rate_limit_failed",
      error.message,
    );
    return false;
  }
  const payload = data as { allowed?: unknown } | null;
  return payload?.allowed === true;
}
