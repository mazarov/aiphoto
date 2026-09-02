import { NextResponse } from "next/server";
import { buildLlmsTxt } from "@/lib/llms-txt";

export const revalidate = 86400;

export function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
