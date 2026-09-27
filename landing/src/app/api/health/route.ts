import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let timer: NodeJS.Timeout | undefined;
  try {
    const supabase = createSupabaseServer();
    const query = supabase.from("landing_generations").select("id").limit(1);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), 2000);
    });
    const result = await Promise.race([query, timeout]);
    if (result.error) throw new Error(result.error.message || "database");
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unhealthy";
    console.error(
      JSON.stringify({
        event: "health_check_failed",
        message: message.slice(0, 200),
      }),
    );
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
