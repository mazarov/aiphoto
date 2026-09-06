import { NextResponse } from "next/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

const DISALLOWED = [
  "/api/",
  "/admin/",
  "/embed/",
  "/auth/",
  "/search",
  "/favorites",
  "/generations",
  "/analyses",
  "/generate",
  "/pricing",
];

/** Listing filters, then app-side params Yandex indexed as separate URLs. */
const CLEAN_PARAMS = [
  "audience",
  "style",
  "occasion",
  "object",
  "sort",
  "ps_auth",
  "ps_sy",
  "ps_ov",
  "payment",
  "auth_error",
];

export function GET() {
  const disallowLines = DISALLOWED.map((p) => `Disallow: ${p}`).join("\n");

  const body = `User-agent: *
Allow: /
${disallowLines}

User-agent: Yandex
Allow: /
${disallowLines}
Clean-param: ${CLEAN_PARAMS.join("&")}

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/image-sitemap.xml
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
