import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCameraOrbitChangeRequest,
  rewriteScenePromptForCameraOrbit,
  type CameraPose,
} from "@/lib/camera-orbit";
import {
  buildRemixGenerationConfig,
  buildRemixUserText,
  hasStructuredRemixSections,
  listRemixHeadings,
  parseRemixModelJson,
  remixPromptsEqual,
  resolveRemixPrompt,
} from "@/lib/prompt-remix";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const REWRITE_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 12_000;

export const CAMERA_ORBIT_REWRITE_SYSTEM = [
  "You rewrite image-generation prompts for a camera orbit.",
  "SOURCE_PROMPT describes the original photograph.",
  "CHANGE_REQUEST is the new camera. It has priority over every camera, framing, crop, selfie, mirror, phone, eyeline, and facing-the-camera sentence.",
  "Return JSON: { \"changeApplied\": true, \"prompt\": \"<complete rewritten prompt>\" }",
  "Return the FULL prompt, same language and section structure as the source.",
  "Rewrite Camera, Composition, Pose, Scene, Visual Hook, and Avoid so they describe the new viewpoint.",
  "Keep identity, wardrobe, set, lighting, expression, and the subject's original world-facing direction. Do not turn them toward the new lens.",
  "Do not append a leftover camera note. Integrate the change into the sections.",
  "The rewritten prompt must not still describe a front-on or same-crop shot.",
].join("\n");

function parseBooleanConfig(value: string | null | undefined, fallback: boolean): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  return fallback;
}

async function resolveGeminiBaseUrl(
  supabase: SupabaseClient,
): Promise<{ url: string; proxy: boolean }> {
  let useProxy = true;
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", "gemini_use_proxy")
    .maybeSingle();
  if (!error) useProxy = parseBooleanConfig(data?.value, true);
  const proxyBase = String(process.env.GEMINI_PROXY_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (useProxy && proxyBase) return { url: proxyBase, proxy: true };
  return { url: DIRECT_GEMINI_BASE_URL, proxy: false };
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  return (
    candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

export async function rewriteCameraOrbitScenePrompt(input: {
  rootPrompt: string;
  pose: CameraPose;
  supabase: SupabaseClient;
}): Promise<{ prompt: string; mode: "llm" | "deterministic" }> {
  const fallback = rewriteScenePromptForCameraOrbit(input.rootPrompt, input.pose);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { prompt: fallback, mode: "deterministic" };

  try {
    const base = await resolveGeminiBaseUrl(input.supabase);
    const changeRequest = buildCameraOrbitChangeRequest(input.pose);
    const structured = hasStructuredRemixSections(input.rootPrompt);
    const headings = listRemixHeadings(input.rootPrompt);
    const userGeminiText = buildRemixUserText({
      originalPrompt: input.rootPrompt,
      changeRequest,
      headings: structured ? headings : undefined,
    });
    const generationConfig = buildRemixGenerationConfig(
      structured ? "section_edits" : "full_rewrite",
    );
    const response = await fetch(
      `${base.url}/v1beta/models/${REWRITE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: CAMERA_ORBIT_REWRITE_SYSTEM }],
          },
          contents: [{ role: "user", parts: [{ text: userGeminiText }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      console.warn("[camera.orbit.rewrite] gemini_http", {
        status: response.status,
        proxy: base.proxy,
      });
      return { prompt: fallback, mode: "deterministic" };
    }
    const plan = parseRemixModelJson(extractGeminiText(payload));
    const resolved = resolveRemixPrompt(input.rootPrompt, plan, extractGeminiText(payload));
    if (
      resolved.prompt.length >= 8 &&
      !remixPromptsEqual(resolved.prompt, input.rootPrompt)
    ) {
      return { prompt: resolved.prompt, mode: "llm" };
    }
  } catch (error) {
    console.warn("[camera.orbit.rewrite] fallback", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return { prompt: fallback, mode: "deterministic" };
}
