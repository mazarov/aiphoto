import { supabase } from "./supabase";

/**
 * In-memory cache for app_config values.
 * TTL = 60 seconds — one DB query per key per minute.
 */
const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 60_000;

/**
 * Get a config value from the app_config table (with in-memory cache).
 * Falls back to defaultValue if key not found or DB error.
 */
export async function getAppConfig(key: string, defaultValue: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  try {
    const { data } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const value = data?.value ?? defaultValue;
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch (err: any) {
    console.error(`[app-config] Failed to fetch "${key}":`, err.message);
    // On error, use cached value if available (even if expired), otherwise default
    return cached?.value ?? defaultValue;
  }
}
