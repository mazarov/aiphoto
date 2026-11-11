import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import {
  isSearchClickEntry,
  normalizeSearchQuery,
  parseSearchFilters,
  sanitizeCardSlug,
  sanitizeClickPosition,
  sanitizeEmbedSource,
  sanitizeFallbackReason,
  sanitizeLimitSize,
  sanitizeMatchType,
  sanitizeResultCount,
  sanitizeSearchOutcome,
  sanitizeSearchPagePath,
} from "@/lib/search-analytics";
import { sanitizeUuid } from "@/lib/visitor-id";

const MAX_BODY_BYTES = 4_096;

type SearchBody = {
  event?: unknown;
  searchId?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  query?: unknown;
  resultCount?: unknown;
  hasMore?: unknown;
  matchType?: unknown;
  searchOutcome?: unknown;
  embedSource?: unknown;
  fallbackReason?: unknown;
  limitSize?: unknown;
  filters?: unknown;
  pagePath?: unknown;
  cardSlug?: unknown;
  position?: unknown;
  entry?: unknown;
};

function isMissingEventColumn(message: string): boolean {
  return /column .* does not exist|PGRST204/i.test(message);
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as SearchBody | null;
  const event = typeof body?.event === "string" ? body.event.trim() : "";
  const searchId = sanitizeUuid(body?.searchId);
  const visitorId = sanitizeUuid(body?.visitorId);
  const sessionId = sanitizeUuid(body?.sessionId);

  if (!searchId || !visitorId || !sessionId) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  if (event === "search") {
    const query = normalizeSearchQuery(body?.query);
    const resultCount = sanitizeResultCount(body?.resultCount);
    const limitSize = sanitizeLimitSize(body?.limitSize);
    if (!query || resultCount == null || limitSize == null) {
      return NextResponse.json({ error: "invalid_event" }, { status: 400 });
    }
    const baseRow = {
      id: searchId,
      visitor_id: visitorId,
      session_id: sessionId,
      query_raw: query.raw,
      query_norm: query.norm,
      result_count: resultCount,
      has_more: body?.hasMore === true,
      match_type: sanitizeMatchType(body?.matchType),
      limit_size: limitSize,
      filters: parseSearchFilters(body?.filters),
      page_path: sanitizeSearchPagePath(body?.pagePath),
    };
    let { error } = await supabase.from("landing_search_events").insert({
      ...baseRow,
      search_outcome: sanitizeSearchOutcome(body?.searchOutcome),
      embed_source: sanitizeEmbedSource(body?.embedSource),
      fallback_reason: sanitizeFallbackReason(body?.fallbackReason),
    });
    if (error && isMissingEventColumn(error.message)) {
      ({ error } = await supabase.from("landing_search_events").insert(baseRow));
    }
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.warn("[search-events] search insert failed", { message: error.message });
      return NextResponse.json({ error: "event_store_failed" }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "search_click") {
    const cardSlug = sanitizeCardSlug(body?.cardSlug);
    const position = sanitizeClickPosition(body?.position);
    const entry = body?.entry;
    if (!cardSlug || position == null || !isSearchClickEntry(entry)) {
      return NextResponse.json({ error: "invalid_event" }, { status: 400 });
    }
    const { error } = await supabase.from("landing_search_clicks").insert({
      search_id: searchId,
      visitor_id: visitorId,
      session_id: sessionId,
      card_slug: cardSlug,
      position,
      entry,
    });
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ ok: true, skipped: "unknown_search" });
      }
      console.warn("[search-events] click insert failed", { message: error.message });
      return NextResponse.json({ error: "event_store_failed" }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_event" }, { status: 400 });
}
