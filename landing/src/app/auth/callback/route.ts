import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSiteOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = request.headers.get("host");
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteOrigin(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const successRedirectUrl = `${origin}${next}`;
  const noCodeRedirectUrl = `${origin}/?auth_error=no_code`;

  if (code) {
    // Keep response mutable so Supabase can attach Set-Cookie headers directly.
    let response = NextResponse.redirect(successRedirectUrl);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.redirect(successRedirectUrl);
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    // GoTrue flow state is one-time. If callback is replayed, second exchange
    // returns flow_state_not_found even though the first attempt may already
    // have succeeded and set session cookies.
    if (error.message.includes("invalid flow state")) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        console.warn("Auth callback: replayed flow state with active session");
        return response;
      }
      console.error("Auth callback: invalid flow state and no active session");
    }
    console.error("Auth callback exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(noCodeRedirectUrl);
}
