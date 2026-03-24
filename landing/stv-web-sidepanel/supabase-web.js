import { createBrowserClient } from "@supabase/ssr";

/**
 * Cookie-based Supabase session (same as main landing). Used only in web embed bundle.
 * @param {string} apiOrigin
 */
export async function createSupabaseForWeb(apiOrigin) {
  const origin = String(apiOrigin || "").replace(/\/+$/, "") || window.location.origin;
  const cfgRes = await fetch(`${origin}/api/public-config`);
  if (!cfgRes.ok) {
    throw new Error(`public-config failed: ${cfgRes.status}`);
  }
  const cfg = await cfgRes.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("public-config missing fields");
  }
  return createBrowserClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}
