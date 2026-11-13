import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  buildImageGenerationConfigPayload,
  buildVideoGenerationConfigPayload,
  readGenerationConfigMap,
} from "@/lib/generation-config-cache";
import {
  IMAGE_GENERATION_MODALITY,
  VIDEO_GENERATION_MODALITY,
  isGenerationModality,
} from "@/lib/generation/image-options";

export async function GET(req: NextRequest) {
  try {
    const modality =
      req.nextUrl.searchParams.get("modality") || IMAGE_GENERATION_MODALITY;
    if (!isGenerationModality(modality)) {
      return NextResponse.json(
        { error: "unsupported_modality" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServer();
    const [{ user }, config] = await Promise.all([
      getSupabaseUserForApiRoute(req),
      readGenerationConfigMap(supabase),
    ]);

    if (modality === VIDEO_GENERATION_MODALITY) {
      return NextResponse.json(
        buildVideoGenerationConfigPayload(config, user?.email),
      );
    }

    return NextResponse.json(
      buildImageGenerationConfigPayload(config, user?.email),
    );
  } catch (err) {
    console.error("generation-config error:", err);
    return NextResponse.json({ error: "config failed" }, { status: 500 });
  }
}
