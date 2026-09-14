import { NextRequest, NextResponse } from "next/server";
import { parseNpsComment, parseNpsScore, verifyNpsToken } from "@/lib/nps-token";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asSubmitResult(value: unknown): { ok: boolean; error?: string } {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return { ok: false, error: "submit_failed" };
  const data = row as Record<string, unknown>;
  return {
    ok: data.ok === true,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    score?: unknown;
    comment?: unknown;
  } | null;
  const surveyId = verifyNpsToken(typeof body?.token === "string" ? body.token : null);
  if (!surveyId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const score = parseNpsScore(body?.score);
  if (score == null) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  const comment = parseNpsComment(body?.comment);
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase.rpc("landing_nps_submit", {
      p_survey_id: surveyId,
      p_score: score,
      p_comment: comment,
    });
    if (error) {
      console.error("[nps] submit_failed", { message: error.message });
      return NextResponse.json({ error: "submit_failed" }, { status: 502 });
    }
    const result = asSubmitResult(data);
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error || "submit_failed" }, { status });
    }
    return NextResponse.json({ ok: true, score });
  } catch (error) {
    console.error("[nps] submit_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }
}
