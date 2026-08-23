import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side GoTrue must not start a refresh timer. Default `autoRefreshToken`
 * pins every `createClient` / `createServerClient` via `setInterval` until OOM.
 * Service-role is also a process-wide singleton (same key, no user session).
 * @see https://github.com/supabase/supabase-js/issues/926
 */
export const SUPABASE_SERVER_AUTH = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export function rememberOnce<T>(slot: { current: T | null }, create: () => T): T {
  if (slot.current === null) {
    slot.current = create();
  }
  return slot.current;
}

const serverClientSlot: { current: SupabaseClient | null } = { current: null };

function resolveServerEnv(): { url: string; serviceRoleKey: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE env vars for server");
  }
  return { url, serviceRoleKey };
}

export function createSupabaseServer(): SupabaseClient {
  return rememberOnce(serverClientSlot, () => {
    const { url, serviceRoleKey } = resolveServerEnv();
    return createClient(url, serviceRoleKey, {
      auth: { ...SUPABASE_SERVER_AUTH },
    });
  });
}

export function resetSupabaseServerClientForTests(): void {
  serverClientSlot.current = null;
}
