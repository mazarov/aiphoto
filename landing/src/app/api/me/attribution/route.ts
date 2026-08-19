import { type NextRequest, NextResponse } from "next/server";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import {
  hasFirstKnownSource,
  parseAttributionCookie,
  sanitizeAttributionBag,
  shouldPersistAttributionOnServer,
  UTM_COOKIE_NAME,
  type TrafficSourceAttribution,
} from "@/lib/traffic-source-attribution";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { sanitizeVisitorId, VISITOR_COOKIE_NAME } from "@/lib/visitor-id";
import { sanitizeYclid, YCLID_COOKIE_NAME } from "@/lib/yandex-attribution";

const MAX_BODY_BYTES = 4_096;

type AttributionBody = {
  visitorId?: unknown;
  visitor_id?: unknown;
  sessionId?: unknown;
  session_id?: unknown;
  yclid?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  utm_landing_path?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  utmLandingPath?: unknown;
};

function noWrite() {
  return NextResponse.json({ persisted: false, linked: false });
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

function resolveVisitorId(body: AttributionBody | null, request: NextRequest): string | null {
  return (
    sanitizeVisitorId(body?.visitorId ?? body?.visitor_id) ??
    sanitizeVisitorId(readCookie(request, VISITOR_COOKIE_NAME))
  );
}

function resolveAttribution(
  body: AttributionBody | null,
  request: NextRequest,
): TrafficSourceAttribution {
  const fromBody = sanitizeAttributionBag(body);
  if (hasFirstKnownSource(fromBody)) return fromBody;
  return (
    parseAttributionCookie(readCookie(request, UTM_COOKIE_NAME)) ?? fromBody
  );
}

function resolveYclid(body: AttributionBody | null, request: NextRequest): string | null {
  return sanitizeYclid(body?.yclid) ?? sanitizeYclid(readCookie(request, YCLID_COOKIE_NAME));
}

async function upsertAcquisitionVisitor(
  supabase: ReturnType<typeof createSupabaseServer>,
  visitorId: string,
  attribution: TrafficSourceAttribution,
  yclid: string | null,
): Promise<boolean> {
  const { error } = await supabase.rpc("upsert_landing_acquisition_visitor", {
    p_visitor_id: visitorId,
    p_utm_source: attribution.utm_source,
    p_utm_medium: attribution.utm_medium,
    p_utm_campaign: attribution.utm_campaign,
    p_utm_content: attribution.utm_content,
    p_utm_term: attribution.utm_term,
    p_utm_landing_path: attribution.utm_landing_path,
    p_yclid: yclid,
  });
  if (error) {
    console.warn("[attribution] visitor upsert failed", {
      visitorId,
      message: error.message,
    });
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return NextResponse.json({ persisted: false, linked: false }, { status: 413 });
    }

    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user) {
      return NextResponse.json({ persisted: false, linked: false }, { status: 401 });
    }
    if (user.is_anonymous === true) {
      return noWrite();
    }

    const body = (await request.json().catch(() => null)) as AttributionBody | null;
    const visitorId = resolveVisitorId(body, request);
    const attribution = resolveAttribution(body, request);
    const yclid = resolveYclid(body, request);

    const supabase = createSupabaseServer();
    const ensured = await ensureLandingUserForGeneration(supabase, user);
    if (
      !visitorId ||
      !ensured.ok ||
      !shouldPersistAttributionOnServer({
        isAnonymous: user.is_anonymous,
        usedGuestOwner: ensured.usedGuestOwner,
        visitorId,
      })
    ) {
      return noWrite();
    }

    const persisted = await upsertAcquisitionVisitor(
      supabase,
      visitorId,
      attribution,
      yclid,
    );
    if (!persisted) {
      return noWrite();
    }

    const { error: attachError } = await supabase.rpc("attach_landing_visitor_to_user", {
      p_visitor_id: visitorId,
      p_landing_user_id: ensured.dbUserId,
      p_auth_user_id: user.id,
    });
    if (attachError) {
      console.warn("[attribution] attach failed", {
        visitorId,
        landingUserId: ensured.dbUserId,
        authUserId: user.id,
        message: attachError.message,
      });
      return NextResponse.json({ persisted: true, linked: false });
    }

    return NextResponse.json({ persisted: true, linked: true });
  } catch (err) {
    console.warn("[attribution] persist failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return noWrite();
  }
}
