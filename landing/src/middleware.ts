import { NextResponse, type NextRequest } from "next/server";

const OLD_SLUG_RE = /^\/p\/([^/]+)\/?$/;
const HAS_SHORT_ID_RE = /-[0-9a-f]{5}$/;

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
  // 301 redirect for old card slugs without short-id suffix
  const slugMatch = OLD_SLUG_RE.exec(request.nextUrl.pathname);
  if (slugMatch) {
    const slug = slugMatch[1];
    if (!HAS_SHORT_ID_RE.test(slug)) {
      const newSlug = await resolveSlugRedirect(slug);
      if (newSlug) {
        return NextResponse.redirect(new URL(`/p/${newSlug}`, request.url), 301);
      }
    }
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
