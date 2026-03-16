import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1, квадратный" },
  { value: "4:3", label: "4:3, горизонтальный" },
  { value: "3:4", label: "3:4, вертикальный" },
  { value: "16:9", label: "16:9, горизонтальный" },
  { value: "9:16", label: "9:16, вертикальный" },
  { value: "3:2", label: "3:2, горизонтальный" },
  { value: "2:3", label: "2:3, вертикальный" },
];

const IMAGE_SIZES = [
  { value: "1K", label: "1K (1024px)" },
  { value: "2K", label: "2K (2048px)" },
  { value: "4K", label: "4K (4096px)" },
];

export async function GET() {
  try {
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

    let models: { id: string; label: string; cost: number }[] = [];
    try {
      const parsed = JSON.parse(config.models || "[]");
      models = parsed
        .filter((m: { enabled?: boolean }) => m.enabled !== false)
        .map((m: { id: string; label: string; cost: number }) => ({
          id: m.id,
          label: m.label,
          cost: m.cost,
        }));
    } catch {
      models = [
        { id: "gemini-2.5-flash-image", label: "Flash", cost: 1 },
        { id: "gemini-3-pro-image-preview", label: "Pro", cost: 2 },
        { id: "gemini-3.1-flash-image-preview", label: "Ultra", cost: 3 },
      ];
    }

    return NextResponse.json({
      models,
      aspectRatios: ASPECT_RATIOS,
      imageSizes: IMAGE_SIZES,
      defaults: {
        model: config.default_model || "gemini-2.5-flash-image",
        aspectRatio: config.default_aspect_ratio || "1:1",
        imageSize: config.default_image_size || "1K",
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
