import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseCookieClient } from "./supabase-cookie-client";
import { SUPABASE_SERVER_AUTH } from "./supabase-server-client";

/**
 * Auth for Route Handlers: Bearer access token (extension) or Supabase session cookies (site).
 */
export async function getSupabaseUserForApiRoute(request: NextRequest): Promise<{
  user: User | null;
  error: Error | null;
  supabaseAuth: SupabaseClient;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (bearer) {
    const supabaseAuth = createClient(url, anon, {
      auth: { ...SUPABASE_SERVER_AUTH },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data, error } = await supabaseAuth.auth.getUser();
    return {
      user: data.user ?? null,
      error: error as Error | null,
      supabaseAuth,
    };
  }

  const cookieStore = await cookies();
  const supabaseAuth = createSupabaseCookieClient(cookieStore);
  const { data, error } = await supabaseAuth.auth.getUser();
  return {
    user: data.user ?? null,
    error: error as Error | null,
    supabaseAuth,
  };
}

/** Server Components / generateMetadata: session from cookies (no Request). */
export async function getSupabaseUserFromServerCookies(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabaseAuth = createSupabaseCookieClient(cookieStore);
  const { data } = await supabaseAuth.auth.getUser();
  return data.user ?? null;
}
