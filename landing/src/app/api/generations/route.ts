import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);

    const supabase = createSupabaseServer();

    const { data: rows, error } = await supabase
      .from("landing_generations")
      .select("id, status, prompt_text, model, aspect_ratio, created_at, result_storage_bucket, result_storage_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const generations = (rows || []).map((g) => ({
      id: g.id,
      status: g.status,
      prompt: g.prompt_text,
      model: g.model,
      aspectRatio: g.aspect_ratio,
      createdAt: g.created_at,
      resultUrl:
        g.result_storage_bucket && g.result_storage_path
          ? getStoragePublicUrl(g.result_storage_bucket, g.result_storage_path)
          : null,
    }));

    return NextResponse.json({ generations, total: count ?? 0 });
  } catch (err) {
    console.error("generations list error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
