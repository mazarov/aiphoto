import { type NextRequest, NextResponse } from "next/server";
import { resolveClientSource } from "@/lib/client-source";
import {
  parseAttributionCookie,
  sanitizeAttributionBag,
  UTM_COOKIE_NAME,
} from "@/lib/traffic-source-attribution";
import { createSupabaseServer } from "@/lib/supabase";
import { sanitizeYclid, YCLID_COOKIE_NAME } from "@/lib/yandex-attribution";

const MAX_BODY_BYTES = 4_096;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["landing_view", "prompt_copy"]);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned ? cleaned.slice(0, max) : null;
}

function readCookie(request: NextRequest, name: string): string | null {
  const raw = request.cookies.get(name)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as {
    event?: unknown;
    visitorId?: unknown;
    sessionId?: unknown;
    path?: unknown;
    cardSlug?: unknown;
  } | null;
  const event = cleanText(body?.event, 40);
  const visitorId = cleanText(body?.visitorId, 36);
  const sessionId = cleanText(body?.sessionId, 36);
  const path = cleanText(body?.path, 200);
  const cardSlug = cleanText(body?.cardSlug, 280);

  if (
    !event ||
    !EVENTS.has(event) ||
    !visitorId ||
    !sessionId ||
    !UUID_PATTERN.test(visitorId) ||
    !UUID_PATTERN.test(sessionId) ||
    (path && !path.startsWith("/"))
  ) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const attribution =
    parseAttributionCookie(readCookie(request, UTM_COOKIE_NAME)) ??
    sanitizeAttributionBag({ utm_landing_path: path });
  const yclid = sanitizeYclid(readCookie(request, YCLID_COOKIE_NAME));
  const { error: visitorError } = await supabase.rpc(
    "upsert_landing_acquisition_visitor",
    {
      p_visitor_id: visitorId,
      p_utm_source: attribution.utm_source,
      p_utm_medium: attribution.utm_medium,
      p_utm_campaign: attribution.utm_campaign,
      p_utm_content: attribution.utm_content,
      p_utm_term: attribution.utm_term,
      p_utm_landing_path: attribution.utm_landing_path ?? path,
      p_yclid: yclid,
    },
  );
  if (visitorError) {
    console.warn("[client-events] visitor upsert failed", {
      event,
      message: visitorError.message,
    });
  }
  const { error } = await supabase.from("extension_client_events").insert({
    event,
    session_id: sessionId,
    visitor_id: visitorId,
    client_source: resolveClientSource(request),
    surface: path,
    detail: cardSlug ? { card_slug: cardSlug } : {},
  });
  if (error) {
    console.warn("[client-events] insert failed", { event, message: error.message });
    return NextResponse.json({ error: "event_store_failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
