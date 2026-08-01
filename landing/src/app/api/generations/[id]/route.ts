import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: gen, error } = await supabase
      .from("landing_generations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const status = gen.status as string;
    let progress = 0;
    if (status === "pending") progress = 10;
    else if (status === "processing") progress = 50;
    else if (status === "completed") progress = 100;
    else if (status === "failed") progress = 0;

    const result: Record<string, unknown> = {
      id: gen.id,
      status,
      progress,
      model: gen.model,
      aspectRatio: gen.aspect_ratio,
      createdAt: gen.created_at,
    };

    if (status === "completed" && gen.result_storage_bucket && gen.result_storage_path) {
      result.resultUrl = getStoragePublicUrl(gen.result_storage_bucket, gen.result_storage_path);
      result.completedAt = gen.generation_completed_at;
    }

    if (status === "failed") {
      result.errorType = gen.error_type;
      result.errorMessage = gen.error_message;
      result.creditsRefunded = true;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("generations/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
