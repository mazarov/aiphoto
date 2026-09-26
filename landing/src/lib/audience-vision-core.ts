/**
 * Shared Gemini Flash "who is in the photo" classifier.
 * Compose example picker and catalog card subject both call this.
 * Prompt and response schema stay in lockstep with
 * src/standalone/backfill-card-subject-audience.mjs.
 */

export const AUDIENCE_VISION_MODEL = "gemini-2.5-flash";

export const AUDIENCE_VISION_RESPONSE_SCHEMA = {
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

export const AUDIENCE_VISION_PROMPT = `Classify who is in this photograph for catalog filtering. JSON only.

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

export type AudienceVisionErrorCode =
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "malformed"
  | "missing_proxy";

export class AudienceVisionError extends Error {
  constructor(
    readonly code: AudienceVisionErrorCode,
    readonly httpStatus: number | null = null,
  ) {
    super(code);
    this.name = "AudienceVisionError";
  }
}

export type AudienceVisionRaw = {
  audience: string | null;
  confidence: number | null;
  peopleCount: number | null;
  hasChild: boolean | null;
  hasVisibleFace: boolean | null;
};

export function extractAudienceVisionJson(raw: string): Record<string, unknown> | null {
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

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function emptyAudienceVision(): AudienceVisionRaw {
  return {
    audience: null,
    confidence: null,
    peopleCount: null,
    hasChild: null,
    hasVisibleFace: null,
  };
}

export async function classifyAudienceFromImageBytes(params: {
  bytes: Uint8Array;
  mimeType: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  model?: string;
}): Promise<AudienceVisionRaw> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    throw new AudienceVisionError("provider_error", 500);
  }
  const baseUrl = params.baseUrl.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new AudienceVisionError("missing_proxy", 500);
  }
  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? params.timeoutMs
      : 30_000;
  const model = (params.model || AUDIENCE_VISION_MODEL).trim();
  const fetchImpl = params.fetchImpl ?? fetch;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: AUDIENCE_VISION_PROMPT },
          {
            inlineData: {
              mimeType: params.mimeType || "image/jpeg",
              data: Buffer.from(params.bytes).toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: AUDIENCE_VISION_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AudienceVisionError("timeout", 504);
    }
    throw new AudienceVisionError("provider_error", 502);
  }

  if (response.status === 429) {
    throw new AudienceVisionError("rate_limited", 429);
  }
  if (!response.ok) {
    throw new AudienceVisionError("provider_error", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AudienceVisionError("malformed", 502);
  }
  const candidate = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!rawText) return emptyAudienceVision();
  const parsed = extractAudienceVisionJson(rawText);
  if (!parsed) return emptyAudienceVision();
  const audience = typeof parsed.audience === "string" ? parsed.audience.trim() : null;
  return {
    audience: audience || null,
    confidence: asNullableNumber(parsed.confidence),
    peopleCount: asNullableNumber(parsed.people_count),
    hasChild: asNullableBoolean(parsed.has_child),
    hasVisibleFace: asNullableBoolean(parsed.has_visible_face),
  };
}
