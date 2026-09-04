import {
  ANALYZE_GEMINI_MAX_BYTES,
  ANALYZE_GEMINI_MAX_EDGE,
  prepareAnalyzeImageForGemini,
  type ParsedAnalyzeImage,
} from "@/lib/image-prompt-analyze-image";
import { resolveAnalyzeGeminiBaseUrl } from "@/lib/image-prompt-analyze-gemini";
import type { createSupabaseServer } from "@/lib/supabase";
import {
  mapComposeAudienceClassification,
  type ComposeExampleAudienceTag,
} from "@/lib/compose-example-audience";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export const COMPOSE_AUDIENCE_CLASSIFY_MODEL = "gemini-2.5-flash";
/** UI never waits; proxy Flash still needs seconds, not the 800ms listing SLO. */
export const COMPOSE_AUDIENCE_CLASSIFY_TIMEOUT_MS = 8_000;

export const COMPOSE_AUDIENCE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    people_count: { type: "INTEGER" },
    has_visible_face: { type: "BOOLEAN" },
    has_child: { type: "BOOLEAN" },
    audience: {
      type: "STRING",
      enum: [
        "devushka",
        "muzhchina",
        "para",
        "semya",
        "malchik",
        "devochka",
        "malysh",
        "none",
      ],
    },
    confidence: { type: "NUMBER" },
  },
  required: [
    "people_count",
    "has_visible_face",
    "has_child",
    "audience",
    "confidence",
  ],
} as const;

const CLASSIFY_PROMPT = `Classify who is in this photograph for catalog filtering. JSON only.

audience:
- devushka: one adult woman (about 18+)
- muzhchina: one adult man (about 18+)
- para: two adults who look like a romantic couple
- semya: at least one adult together with a child, or multiple generations
- malchik: one boy child (about 2–12) as the subject, no adult
- devochka: one girl child (about 2–12) as the subject, no adult
- malysh: one baby or toddler (about 0–2) as the subject, no adult
- none: no person, pet only, group of friends, unclear, or low certainty

Never use devushka or muzhchina for a child. A clear solo child must be malchik, devochka, or malysh — not none.

people_count: visible people.
has_visible_face: at least one clear human face.
has_child: a child is clearly present.
confidence: 0..1.`;

export class ComposeAudienceClassifyError extends Error {
  constructor(
    readonly code: "timeout" | "rate_limited" | "provider_error" | "malformed",
    readonly httpStatus: number | null = null,
  ) {
    super(code);
    this.name = "ComposeAudienceClassifyError";
  }
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(fenced);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed: unknown = JSON.parse(fenced.slice(start, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

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
    throw new ComposeAudienceClassifyError("provider_error", 500);
  }
  let image: ParsedAnalyzeImage;
  try {
    image = await prepareAnalyzeImageForGemini(params.image, {
      maxEdge: ANALYZE_GEMINI_MAX_EDGE,
      maxBytes: ANALYZE_GEMINI_MAX_BYTES,
    });
  } catch {
    return { tag: null, confidence: null };
  }

  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? params.timeoutMs
      : COMPOSE_AUDIENCE_CLASSIFY_TIMEOUT_MS;
  const baseUrl = await resolveAnalyzeGeminiBaseUrl(params.supabase);
  const fetchImpl = params.fetchImpl ?? fetch;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: CLASSIFY_PROMPT },
          { inlineData: { mimeType: image.mimeType, data: image.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: COMPOSE_AUDIENCE_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(
      `${baseUrl}/v1beta/models/${COMPOSE_AUDIENCE_CLASSIFY_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ComposeAudienceClassifyError("timeout", 504);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ComposeAudienceClassifyError("timeout", 504);
    }
    throw new ComposeAudienceClassifyError("provider_error", 502);
  }

  if (response.status === 429) {
    throw new ComposeAudienceClassifyError("rate_limited", 429);
  }
  if (!response.ok) {
    throw new ComposeAudienceClassifyError("provider_error", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ComposeAudienceClassifyError("malformed", 502);
  }
  const candidate = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!rawText) return { tag: null, confidence: null };
  const parsed = extractJsonObject(rawText);
  if (!parsed) return { tag: null, confidence: null };
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? parsed.confidence
      : null;
  return {
    tag: mapComposeAudienceClassification({
      audience: parsed.audience,
      peopleCount: parsed.people_count,
      hasVisibleFace: parsed.has_visible_face,
      hasChild: parsed.has_child,
      confidence: parsed.confidence,
    }),
    confidence,
  };
}
