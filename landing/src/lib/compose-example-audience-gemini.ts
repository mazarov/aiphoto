import {
  ANALYZE_GEMINI_MAX_BYTES,
  ANALYZE_GEMINI_MAX_EDGE,
  prepareAnalyzeImageForGemini,
  type ParsedAnalyzeImage,
} from "@/lib/image-prompt-analyze-image";
import { resolveAnalyzeGeminiBaseUrl } from "@/lib/image-prompt-analyze-gemini";
import { isSharpBusyError } from "@/lib/sharp-runtime";
import type { createSupabaseServer } from "@/lib/supabase";
import {
  mapComposeAudienceClassification,
  type ComposeExampleAudienceTag,
} from "@/lib/compose-example-audience";
import {
  AUDIENCE_VISION_MODEL,
  AUDIENCE_VISION_RESPONSE_SCHEMA,
  AudienceVisionError,
  classifyAudienceFromImageBytes,
} from "@/lib/audience-vision-core";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export const COMPOSE_AUDIENCE_CLASSIFY_MODEL = AUDIENCE_VISION_MODEL;
/** UI never waits; proxy Flash still needs seconds, not the 800ms listing SLO. */
export const COMPOSE_AUDIENCE_CLASSIFY_TIMEOUT_MS = 8_000;
export const COMPOSE_AUDIENCE_RESPONSE_SCHEMA = AUDIENCE_VISION_RESPONSE_SCHEMA;
export { AudienceVisionError as ComposeAudienceClassifyError };

export async function classifyComposeAudienceFromImage(params: {
  image: ParsedAnalyzeImage;
  supabase: SupabaseServer;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  tag: ComposeExampleAudienceTag | null;
  confidence: number | null;
}> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    throw new AudienceVisionError("provider_error", 500);
  }
  let image: ParsedAnalyzeImage;
  try {
    image = await prepareAnalyzeImageForGemini(params.image, {
      maxEdge: ANALYZE_GEMINI_MAX_EDGE,
      maxBytes: ANALYZE_GEMINI_MAX_BYTES,
    });
  } catch (error) {
    if (isSharpBusyError(error)) throw error;
    return { tag: null, confidence: null };
  }

  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? params.timeoutMs
      : COMPOSE_AUDIENCE_CLASSIFY_TIMEOUT_MS;
  const baseUrl = await resolveAnalyzeGeminiBaseUrl(params.supabase);
  const raw = await classifyAudienceFromImageBytes({
    bytes: Buffer.from(image.data, "base64"),
    mimeType: image.mimeType,
    baseUrl,
    apiKey,
    timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  return {
    tag: mapComposeAudienceClassification({
      audience: raw.audience,
      peopleCount: raw.peopleCount,
      hasVisibleFace: raw.hasVisibleFace,
      hasChild: raw.hasChild,
      confidence: raw.confidence,
    }),
    confidence: raw.confidence,
  };
}
