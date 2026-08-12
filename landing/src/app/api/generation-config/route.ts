import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { parseEnabledGenerationModels } from "@/lib/generation-model-labels";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_GENERATION_MODALITY,
  IMAGE_SIZE_OPTIONS,
} from "@/lib/generation/image-options";

export async function GET(req: NextRequest) {
  try {
    const modality =
      req.nextUrl.searchParams.get("modality") || IMAGE_GENERATION_MODALITY;
    if (modality !== IMAGE_GENERATION_MODALITY) {
      return NextResponse.json(
        { error: "unsupported_modality" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    const { data: rows } = await supabase
      .from("landing_generation_config")
      .select("key, value")
      .in("key", [
        "models",
        "default_model",
        "default_aspect_ratio",
        "default_image_size",
        "max_photos",
        "max_file_size_mb",
        "min_prompt_length",
      ]);

    const config: Record<string, string> = {};
    for (const row of rows || []) {
      config[row.key] = row.value;
    }

    const models = parseEnabledGenerationModels(config.models);

    return NextResponse.json({
      modality: IMAGE_GENERATION_MODALITY,
      models,
      aspectRatios: IMAGE_ASPECT_RATIO_OPTIONS,
      imageSizes: IMAGE_SIZE_OPTIONS,
      defaults: {
        model: config.default_model || "gemini-2.5-flash-image",
        aspectRatio:
          config.default_aspect_ratio || DEFAULT_IMAGE_ASPECT_RATIO,
        imageSize: config.default_image_size || DEFAULT_IMAGE_SIZE,
      },
      limits: {
        maxPhotos: parseInt(config.max_photos || "4", 10),
        maxFileSizeMb: parseInt(config.max_file_size_mb || "10", 10),
        minPromptLength: parseInt(config.min_prompt_length || "8", 10),
      },
    });
  } catch (err) {
    console.error("generation-config error:", err);
    return NextResponse.json({ error: "config failed" }, { status: 500 });
  }
}
