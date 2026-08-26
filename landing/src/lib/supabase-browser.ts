import { createBrowserClient } from "@supabase/ssr";

/**
 * Cookie-backed PKCE + session (same store as `createServerClient`).
 * `@supabase/ssr` 0.9 forces `detectSessionInUrl` in the browser — do not try
 * to turn it off via `auth` options (it is overwritten). `/auth/callback`
 * therefore treats a replay (`PKCE code verifier not found`) + live session
 * as a successful finish. See `finishOAuthCodeExchange`.
 */
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
      "Add them as build args in Dockerfile / Dockhost."
    );
  }

  return createBrowserClient(url, key);
}
