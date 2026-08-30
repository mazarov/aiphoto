import { NextRequest, NextResponse } from "next/server";
import { readAcquisitionRequestIds } from "@/lib/acquisition-request";
import { recordAnalyzeEvent } from "@/lib/analyze-events";
import { recordAnalyzeHistory } from "@/lib/analyze-history";
import { scheduleNoCreditsMail } from "@/lib/mail-credit-block";
import {
  ANALYZE_QUOTA_MESSAGES,
  analyzeQuotaPublicFields,
  confirmAnalyzeQuota,
  releaseAnalyzeQuota,
  reserveAnalyzeQuota,
  resolveAnalyzeQuotaSnapshot,
  type AnalyzeQuotaSession,
  type AnalyzeQuotaSnapshot,
} from "@/lib/analyze-quota";
import { resolveClientSource } from "@/lib/client-source";
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
/** Interactive analyze: one Gemini POST after JPEG ≤256px / ≤20KB. No upstream retry. */
export const maxDuration = 60;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: "invalid_image", message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return errorResponse("Request body must be a JSON object.");
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const resolvedImage = await resolveAnalyzeImageFromBody(body);
  if (!resolvedImage.ok) {
    if (resolvedImage.code && resolvedImage.code !== "too_large") {
      extensionLog("analyze.image_fetch_failed", { code: resolvedImage.code });
    }
    return errorResponse(resolvedImage.message);
  }
  const image = resolvedImage.image;

  const style = "photoreal" as const;
  const locale = normalizeAnalyzeLocale(body.locale);
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || requestId;
  const acquisition = readAcquisitionRequestIds(req);
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
      clientSource: resolveClientSource(req, {
        authenticated: snapshot?.authenticated,
      }),
      ipHash: snapshot?.ipHash || "",
      userId: snapshot?.userId ?? null,
      visitorId: acquisition.visitorId,
      sessionId: acquisition.sessionId,
      allowed,
      requestOrigin: req.headers.get("origin"),
      quotaMode:
        snapshot && "mode" in snapshot ? snapshot.mode : snapshot?.nextMode ?? null,
      ...eventBase,
      ...extra,
    });
  };

  extensionLog("analyze.start", {
    requestId,
    correlationId,
    visitorId: acquisition.visitorId,
    sessionId: acquisition.sessionId,
    locale,
    mimeType: image.mimeType,
    imageBase64Chars: image.data.length,
  });

  let snapshot: AnalyzeQuotaSnapshot;
  try {
    snapshot = await resolveAnalyzeQuotaSnapshot(req, supabase);
  } catch (error) {
    extensionLog("analyze.quota_unavailable", {
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
      { status: 503 },
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
      { status: 500 },
    );
  }

  let reservedSession: AnalyzeQuotaSession | null = null;
  try {
    const reservation = await reserveAnalyzeQuota(supabase, snapshot);
    if (!reservation.ok) {
      const denied = reservation.error;
      if (denied === "no_credits" && snapshot.userId) {
        scheduleNoCreditsMail(supabase, snapshot.userId, "analyze");
      }
      const httpStatus = denied === "no_credits" ? 402 : 401;
      recordQuotaEvent(reservation.snapshot, false, {
        outcome: denied,
        errorCode: denied,
        httpStatus,
      });
      return NextResponse.json(
        {
          error: denied,
          auth_required: denied === "auth_required",
          no_credits: denied === "no_credits",
          message: ANALYZE_QUOTA_MESSAGES[denied],
          quota: analyzeQuotaPublicFields(reservation.snapshot),
        },
        { status: httpStatus },
      );
    }
    if (!reservation.session.holdId) {
      throw new Error("analyze_quota_missing_hold");
    }
    reservedSession = reservation.session;
  } catch (error) {
    extensionLog("analyze.quota_unavailable", {
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
      { status: 503 },
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
        message: "Не удалось разобрать фото. Нажмите «Создать промт по фото» ещё раз.",
      },
      { status: httpStatus },
    );
  };

  let generated: Awaited<ReturnType<typeof generatePhotorealPromptFromImage>>;
  try {
    generated = await generatePhotorealPromptFromImage({
      image,
      locale,
      supabase,
      apiKey,
      logPrefix: "analyze",
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
  if (reservedSession) {
    try {
      finalSession = await confirmAnalyzeQuota(supabase, reservedSession);
    } catch (error) {
      extensionLog("analyze.quota_confirm_failed", {
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  recordQuotaEvent(finalSession ?? snapshot, true, {
    outcome: generated.truncated ? "truncated" : "success",
    errorCode: finalSession?.mode === "paid" ? "paid" : "free",
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
    userId: finalSession?.userId ?? snapshot.userId,
    ipHash: finalSession?.ipHash ?? snapshot.ipHash,
    correlationId,
    authenticated: finalSession?.authenticated ?? snapshot.authenticated,
    creditsSpent: finalSession?.creditsCharged ?? 0,
    quotaMode: finalSession?.mode ?? "free",
  });

  extensionLog("analyze.gemini_response", {
    requestId,
    correlationId,
    latencyMs: Date.now() - startedAt,
    promptChars: generated.promptText.length,
    missingSections: generated.missing,
    ...generated.summary,
  });

  const settings = await settingsPromise;
  return NextResponse.json({
    prompt: generated.promptText,
    ...(settings ? { imageSettings: settings } : {}),
    quota: analyzeQuotaPublicFields(finalSession ?? snapshot, {
      mode: finalSession?.mode ?? "free",
      creditsCharged: finalSession?.creditsCharged ?? 0,
    }),
  });
}
