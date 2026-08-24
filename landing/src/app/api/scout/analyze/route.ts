import { NextRequest, NextResponse } from "next/server";
import { recordAnalyzeEvent } from "@/lib/analyze-events";
import { recordAnalyzeHistory } from "@/lib/analyze-history";
import {
  ANALYZE_QUOTA_MESSAGES,
  analyzeQuotaPublicFields,
  confirmAnalyzeQuota,
  releaseAnalyzeQuota,
  reserveAnalyzeQuota,
  resolveScoutAnalyzeQuotaSnapshot,
  SCOUT_ANALYZE_FREE_PER_DAY,
  type AnalyzeQuotaSession,
  type AnalyzeQuotaSnapshot,
} from "@/lib/analyze-quota";
import { extensionLog } from "@/lib/extension-pipeline-log";
import {
  ANALYZE_GEMINI_MODEL,
  generatePhotorealPromptFromImage,
  normalizeAnalyzeLocale,
  PhotorealAnalyzeError,
} from "@/lib/image-prompt-analyze-gemini";
import {
  analyzeImageSettings,
  resolveAnalyzeImageFromBody,
} from "@/lib/image-prompt-analyze-image";
import { createSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOUT_CLIENT_SOURCE = "scout" as const;
const SCOUT_RATE_LIMITED_MESSAGE =
  `Daily scout analyze limit reached (${SCOUT_ANALYZE_FREE_PER_DAY} successful analyses per UTC day).`;

function noStore(init?: ResponseInit): ResponseInit {
  return {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  };
}

function scoutQuotaFields(snapshot: AnalyzeQuotaSnapshot, extras?: {
  mode?: "free";
  creditsCharged?: number;
}) {
  return {
    ...analyzeQuotaPublicFields(snapshot, extras),
    daily_limit: snapshot.freeMax,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const snapshot = await resolveScoutAnalyzeQuotaSnapshot(createSupabaseServer());
    return NextResponse.json(
      { quota: scoutQuotaFields(snapshot) },
      noStore({ status: 200 }),
    );
  } catch (error) {
    extensionLog("scout.analyze.quota_unavailable", {
      phase: "get",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      noStore({ status: 503 }),
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json(
        { error: "invalid_image", message: "Request body must be a JSON object." },
        noStore({ status: 400 }),
      );
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_image", message: "Request body must be valid JSON." },
      noStore({ status: 400 }),
    );
  }

  const resolvedImage = await resolveAnalyzeImageFromBody(body);
  if (!resolvedImage.ok) {
    if (resolvedImage.code && resolvedImage.code !== "too_large") {
      extensionLog("scout.analyze.image_fetch_failed", { code: resolvedImage.code });
    }
    return NextResponse.json(
      { error: "invalid_image", message: resolvedImage.message },
      noStore({ status: 400 }),
    );
  }
  const image = resolvedImage.image;

  const style = "photoreal" as const;
  const locale = normalizeAnalyzeLocale(body.locale ?? "ru");
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || requestId;
  const supabase = createSupabaseServer();
  const eventBase = {
    locale,
    style,
    model: ANALYZE_GEMINI_MODEL,
    correlationId,
  } as const;

  const recordQuotaEvent = (
    snapshot: AnalyzeQuotaSnapshot | AnalyzeQuotaSession | null,
    allowed: boolean,
    extra: {
      outcome: Parameters<typeof recordAnalyzeEvent>[1]["outcome"];
      errorCode?: string;
      httpStatus: number;
      latencyMs?: number;
      truncated?: boolean;
      finishReason?: string;
      missingSections?: number;
    },
  ) => {
    recordAnalyzeEvent(supabase, {
      endpoint: "analyze",
      clientSource: SCOUT_CLIENT_SOURCE,
      ipHash: snapshot?.ipHash || "",
      userId: null,
      allowed,
      requestOrigin: req.headers.get("origin"),
      quotaMode:
        snapshot && "mode" in snapshot ? snapshot.mode : snapshot?.nextMode ?? null,
      ...eventBase,
      ...extra,
    });
  };

  extensionLog("scout.analyze.start", {
    requestId,
    correlationId,
    locale,
    mimeType: image.mimeType,
    imageBase64Chars: image.data.length,
  });

  let snapshot: AnalyzeQuotaSnapshot;
  try {
    snapshot = await resolveScoutAnalyzeQuotaSnapshot(supabase);
  } catch (error) {
    extensionLog("scout.analyze.quota_unavailable", {
      requestId,
      phase: "snapshot",
      message: error instanceof Error ? error.message : String(error),
    });
    recordQuotaEvent(null, false, {
      outcome: "quota_unavailable",
      errorCode: "quota_unavailable",
      httpStatus: 503,
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      noStore({ status: 503 }),
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordQuotaEvent(snapshot, false, {
      outcome: "config_error",
      errorCode: "config",
      httpStatus: 500,
    });
    return NextResponse.json(
      { error: "upstream_failed", message: "Service configuration error." },
      noStore({ status: 500 }),
    );
  }

  let reservedSession: AnalyzeQuotaSession | null = null;
  try {
    const reservation = await reserveAnalyzeQuota(supabase, snapshot);
    if (!reservation.ok) {
      recordQuotaEvent(reservation.snapshot, false, {
        outcome: "rate_limited",
        errorCode: "rate_limited",
        httpStatus: 429,
      });
      return NextResponse.json(
        {
          error: "rate_limited",
          message: SCOUT_RATE_LIMITED_MESSAGE,
          quota: scoutQuotaFields(reservation.snapshot),
        },
        noStore({ status: 429 }),
      );
    }
    if (!reservation.session.holdId) {
      throw new Error("analyze_quota_missing_hold");
    }
    reservedSession = reservation.session;
  } catch (error) {
    extensionLog("scout.analyze.quota_unavailable", {
      requestId,
      phase: "reserve",
      message: error instanceof Error ? error.message : String(error),
    });
    recordQuotaEvent(snapshot, false, {
      outcome: "quota_unavailable",
      errorCode: "quota_unavailable",
      httpStatus: 503,
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      noStore({ status: 503 }),
    );
  }

  const startedAt = Date.now();
  const fail = async (
    errorCode: string,
    httpStatus: number,
    upstreamStatus?: number,
  ) => {
    if (reservedSession) {
      await releaseAnalyzeQuota(supabase, reservedSession);
    }
    recordQuotaEvent(reservedSession ?? snapshot, false, {
      outcome: "upstream_error",
      errorCode,
      httpStatus: upstreamStatus ?? httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "upstream_failed",
        message: "Something went wrong. Please try another image.",
      },
      noStore({ status: httpStatus }),
    );
  };

  let generated: Awaited<ReturnType<typeof generatePhotorealPromptFromImage>>;
  try {
    generated = await generatePhotorealPromptFromImage({
      image,
      locale,
      supabase,
      apiKey,
      logPrefix: "scout.analyze",
      requestId,
      correlationId,
    });
  } catch (error) {
    if (error instanceof PhotorealAnalyzeError) {
      return fail(error.code, error.httpStatus, error.upstreamStatus);
    }
    return fail("fetch_failed", 503);
  }

  const settingsPromise = analyzeImageSettings(image.data);
  let finalSession = reservedSession;
  try {
    finalSession = await confirmAnalyzeQuota(supabase, reservedSession);
  } catch (error) {
    extensionLog("scout.analyze.quota_confirm_failed", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  recordQuotaEvent(finalSession, true, {
    outcome: generated.truncated ? "truncated" : "success",
    errorCode: "free",
    truncated: generated.truncated,
    finishReason: String(generated.summary.finishReason ?? ""),
    missingSections: generated.missing.length,
    httpStatus: 200,
    latencyMs: Date.now() - startedAt,
  });
  recordAnalyzeHistory(supabase, req, {
    imageBase64: image.data,
    prompt: generated.promptText,
    style,
    locale,
    model: ANALYZE_GEMINI_MODEL,
    userId: null,
    ipHash: finalSession.ipHash,
    correlationId,
    authenticated: false,
    creditsSpent: 0,
    quotaMode: "free",
    clientSource: SCOUT_CLIENT_SOURCE,
  });

  extensionLog("scout.analyze.gemini_response", {
    requestId,
    correlationId,
    latencyMs: Date.now() - startedAt,
    promptChars: generated.promptText.length,
    remainingFree: finalSession.remainingFree,
    missingSections: generated.missing,
    ...generated.summary,
  });

  const settings = await settingsPromise;
  return NextResponse.json(
    {
      prompt: generated.promptText,
      ...(settings ? { imageSettings: settings } : {}),
      quota: scoutQuotaFields(finalSession, { mode: "free", creditsCharged: 0 }),
    },
    noStore({ status: 200 }),
  );
}
