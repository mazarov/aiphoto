import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

// Supabase initializes its Realtime client even though this worker only uses
// PostgREST/Storage. Node 20 has no native WebSocket constructor, so provide
// the supported ws transport explicitly.
const WebSocketTransport = require("ws") as typeof WebSocket;

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocketTransport },
});

export async function checkSupabase(): Promise<boolean> {
  const { error } = await supabase.from("landing_generations").select("id").limit(1);
  return !error;
}

export async function readQueueMetrics() {
  const now = new Date().toISOString();
  const [pending, processing, stale, refundGap, oldest] = await Promise.all([
    supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("lease_expires_at", now),
    supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gt("credits_spent", 0)
      .eq("credits_refunded", false),
    supabase
      .from("landing_generations")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const errors = [pending.error, processing.error, stale.error, refundGap.error, oldest.error]
    .filter(Boolean)
    .map((error) => error?.message);
  if (errors.length) throw new Error(`queue_metrics_failed:${errors.join("|")}`);
  const oldestCreatedAt = oldest.data?.created_at
    ? new Date(String(oldest.data.created_at)).getTime()
    : null;
  return {
    pending: pending.count || 0,
    processing: processing.count || 0,
    stale: stale.count || 0,
    failedWithoutRefund: refundGap.count || 0,
    oldestPendingAgeSeconds:
      oldestCreatedAt == null ? 0 : Math.max(0, Math.round((Date.now() - oldestCreatedAt) / 1000)),
  };
}
