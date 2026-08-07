import type { SupabaseClient } from "@supabase/supabase-js";

const CONFIG_KEY_ATTACH_REFERENCE = "vibe_attach_reference_image_to_generation";

function bool(value: string | null | undefined, fallback: boolean): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(raw)) return true;
  if (["false", "0", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

export async function getVibeAttachReferenceImage(
  supabase: SupabaseClient
): Promise<boolean> {
  const fallback = bool(process.env.VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION, true);
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", CONFIG_KEY_ATTACH_REFERENCE)
    .maybeSingle();
  if (error || data?.value == null || String(data.value).trim() === "") return fallback;
  return bool(String(data.value), fallback);
}
