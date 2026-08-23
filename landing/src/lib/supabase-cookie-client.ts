import { createServerClient } from "@supabase/ssr";
import { SUPABASE_SERVER_AUTH } from "./supabase-server-client";

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: object) => void;
};

export function supabaseCookieClientOptions(cookieStore: CookieStore) {
  return {
    auth: { ...SUPABASE_SERVER_AUTH },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: object }>,
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component / read-only cookie store
        }
      },
    },
  };
}

export function createSupabaseCookieClient(cookieStore: CookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseCookieClientOptions(cookieStore),
  );
}
