import type { NextRequest } from "next/server";

export const STV_PIPELINE_TRACE_HEADER = "x-stv-pipeline-trace";

const MAX_TRACE_LEN = 64;

/**
 * Client sends UUID via header (extension/embed) or `pipelineTraceId` in JSON body (e.g. POST /api/generate).
 */
export function getStvPipelineTrace(req: NextRequest, body?: unknown): string | null {
  const fromHeader = req.headers.get(STV_PIPELINE_TRACE_HEADER)?.trim();
  if (fromHeader) {
    const h = fromHeader.slice(0, MAX_TRACE_LEN);
    return h.length > 0 ? h : null;
  }
  if (body && typeof body === "object" && body !== null) {
    const raw = (body as Record<string, unknown>).pipelineTraceId;
    if (typeof raw === "string") {
      const s = raw.trim().slice(0, MAX_TRACE_LEN);
      return s.length > 0 ? s : null;
    }
  }
  return null;
}

/**
 * Structured STV pipeline logs; grep `[stv.pipeline]` or filter `pipelineTrace` in Vercel.
 */
export function stvLog(step: string, fields: Record<string, unknown>): void {
  console.warn("[stv.pipeline]", { step, ...fields });
}
