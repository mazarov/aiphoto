import { NextResponse, type NextRequest } from "next/server";
import { isGeneraciyaSeoImagePath } from "@/lib/generaciya-foto-routes";
import {
  buildGeneraciyaSeoRenderPath,
  classifyGeneraciyaImageBot,
  generaciyaBotImageLog,
  generaciyaSeoRefererPath,
  parseGeneraciyaSeoImagePathname,
} from "@/lib/generaciya-seo-image-url";

const LOGS_TTL_MS = 60_000;
const LOGS_TIMEOUT_MS = 1_500;

let logsCache: { at: number; value: boolean } | null = null;

function supabaseOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
}

/** Missing key, empty value, or a failed read leaves logging off. Never throws. */
async function seoImageLogsEnabled(): Promise<boolean> {
  const now = Date.now();
  if (logsCache && now - logsCache.at < LOGS_TTL_MS) return logsCache.value;
  const base = supabaseOrigin();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) {
    logsCache = { at: now, value: false };
    return false;
  }
  try {
    const res = await fetch(
      `${base}/rest/v1/landing_generation_config?key=eq.generaciya_seo_image_logs_enabled&select=value&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(LOGS_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      logsCache = { at: now, value: false };
      return false;
    }
    const rows = (await res.json()) as { value?: string }[];
    const value = String(rows[0]?.value ?? "")
      .trim()
      .toLowerCase();
    const enabled = value === "true" || value === "1" || value === "yes" || value === "on";
    logsCache = { at: now, value: enabled };
    return enabled;
  } catch {
    logsCache = { at: now, value: false };
    return false;
  }
}

function logBot(
  request: NextRequest,
  bot: "googlebot" | "yandex",
  fields: {
    outcome: "rewrite" | "reject";
    variant?: "w1080" | "w512";
    width?: number;
    quality?: number;
  },
) {
  const refererPath = generaciyaSeoRefererPath(
    request.headers.get("referer"),
    isGeneraciyaSeoImagePath,
  );
  console.info(
    JSON.stringify(
      generaciyaBotImageLog({
        bot,
        outcome: fields.outcome,
        variant: fields.variant,
        width: fields.width,
        quality: fields.quality,
        refererPath,
      }),
    ),
  );
}

/**
 * Same-origin alias for the generaciya SEO stack.
 * Next 15 throws if an App Route calls NextResponse.rewrite(), so this lives
 * in middleware. Bytes stay on storage; the platform proxies the render URL.
 * A log failure must not change the image response.
 */
export async function rewriteGeneraciyaSeoImage(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith("/img/seo/")) return null;

  const parsed = parseGeneraciyaSeoImagePathname(request.nextUrl.pathname);
  const bot = classifyGeneraciyaImageBot(request.headers.get("user-agent"));
  const origin = supabaseOrigin();
  const renderPath = parsed
    ? buildGeneraciyaSeoRenderPath(parsed.bucket, parsed.objectPath, parsed.variant)
    : null;

  if (!parsed || !origin || !renderPath) {
    if (bot && (await seoImageLogsEnabled())) {
      logBot(request, bot, { outcome: "reject" });
    }
    return new NextResponse(null, { status: 404 });
  }

  if (bot && (await seoImageLogsEnabled())) {
    logBot(request, bot, {
      outcome: "rewrite",
      variant: parsed.variant,
      width: parsed.width,
      quality: parsed.quality,
    });
  }

  return NextResponse.rewrite(new URL(`${origin}${renderPath}`));
}
