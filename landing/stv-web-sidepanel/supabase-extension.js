import { createClient } from "./vendor/supabase.js";

function chromeLocalStorageAdapter() {
  return {
    getItem: (key) =>
      new Promise((resolve) => {
        chrome.storage.local.get(key, (r) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(r[key] ?? null);
        });
      }),
    setItem: (key, value) =>
      new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      }),
    removeItem: (key) =>
      new Promise((resolve) => {
        chrome.storage.local.remove(key, () => resolve());
      }),
  };
}

export function getStoredApiOrigin() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["stv_api_origin"], (r) => {
      resolve(typeof r.stv_api_origin === "string" && r.stv_api_origin ? r.stv_api_origin : "https://promptshot.ru");
    });
  });
}

/**
 * @param {string} apiOrigin
 */
export async function createSupabaseForExtension(apiOrigin) {
  const origin = String(apiOrigin || "").replace(/\/+$/, "") || "https://promptshot.ru";
  const cfgRes = await fetch(`${origin}/api/public-config`);
  if (!cfgRes.ok) {
    throw new Error(`public-config failed: ${cfgRes.status}`);
  }
  const cfg = await cfgRes.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("public-config missing fields");
  }
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      storage: chromeLocalStorageAdapter(),
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/** OAuth redirect page: exchange ?code= for session (PKCE verifier in chrome.storage). */
export async function exchangeOAuthInThisTab() {
  const apiOrigin = await getStoredApiOrigin();
  const supabase = await createSupabaseForExtension(apiOrigin);
  const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
  if (error) throw error;
}
