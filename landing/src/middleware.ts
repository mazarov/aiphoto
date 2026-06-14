import { NextResponse, type NextRequest } from "next/server";

const OLD_SLUG_RE = /^\/p\/([^/]+)\/?$/;
const DEFAULT_ALLOWED_METHODS = "GET, POST, OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";

function parseAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const extensionId = (process.env.CHROME_EXTENSION_ID || "").trim();
  const extensionOrigin = extensionId ? `chrome-extension://${extensionId}` : "";

  return [...fromEnv, extensionOrigin].filter(Boolean);
}

function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  const allowedOrigins = parseAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : null;

  response.headers.set("Vary", "Origin");
  if (allowOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
    response.headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS);
  }

  return response;
}

async function resolveSlugRedirect(slug: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/slug_redirects?old_slug=eq.${encodeURIComponent(slug)}&select=new_slug&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.new_slug ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  if (isApiRequest(request)) {
    if (request.method === "OPTIONS") {
      return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
    }
    return applyCorsHeaders(request, NextResponse.next({ request }));
  }

  // 301 redirect for any legacy card slug present in redirect map.
  // Needed for mass title/slug regeneration where old slugs can also contain short-id.
  const slugMatch = OLD_SLUG_RE.exec(request.nextUrl.pathname);
  if (slugMatch) {
    const slug = slugMatch[1];
    const newSlug = await resolveSlugRedirect(slug);
    if (newSlug) {
      return NextResponse.redirect(new URL(`/p/${newSlug}`, request.url), 301);
    }
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
