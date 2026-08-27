import { NextRequest, NextResponse } from "next/server";
import { ensureBirthdayListingQueryEmbeddings } from "@/lib/listing-query-embedding";
import { createSupabaseServer } from "@/lib/supabase";
import { processVisualEmbeddingJobs } from "@/lib/visual-embedding-jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServer();
    const enqueueLimit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get("enqueue")) || 80),
    );
    const claimLimit = Math.min(
      20,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 8),
    );

    const { data: enqueued, error: enqueueError } = await supabase.rpc(
      "enqueue_missing_visual_embedding_jobs",
      { p_limit: enqueueLimit },
    );
    if (enqueueError) throw new Error(enqueueError.message);

    const processed = await processVisualEmbeddingJobs({
      supabase,
      limit: claimLimit,
    });
    const { data: coverage, error: coverageError } = await supabase.rpc(
      "visual_embedding_coverage",
    );
    if (coverageError) throw new Error(coverageError.message);

    let queryEmbeddings = { present: 0, embedded: 0, failed: 0 };
    try {
      queryEmbeddings = await ensureBirthdayListingQueryEmbeddings({ supabase });
    } catch (error) {
      console.warn("[visual-embeddings] listing query warm failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(
      { enqueued: enqueued ?? 0, ...processed, coverage, queryEmbeddings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[visual-embeddings] cron failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "visual_embeddings_failed" }, { status: 502 });
  }
}
