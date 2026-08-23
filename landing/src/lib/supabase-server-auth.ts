import { cookies } from "next/headers";
import { createSupabaseCookieClient } from "./supabase-cookie-client";

export async function createSupabaseServerAuth() {
  const cookieStore = await cookies();
  return createSupabaseCookieClient(cookieStore);
}
