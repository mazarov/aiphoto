import { NextResponse } from "next/server";

/**
 * Public values for Chrome extension (anon key is already public in the browser on the site).
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const yandexOAuthClientId = process.env.NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID?.trim() || "";
  const yandexOAuthRedirectUri =
    process.env.NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI?.trim() ||
    `${supabaseUrl.replace(/\/$/, "")}/auth/v1/callback`;

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
    yandexOAuthClientId: yandexOAuthClientId || undefined,
    yandexOAuthRedirectUri: yandexOAuthClientId ? yandexOAuthRedirectUri : undefined,
  });
}
