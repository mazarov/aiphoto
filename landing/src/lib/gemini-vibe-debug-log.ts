/**
 * Sanitized logging for Gemini generateContent in vibe extract/expand.
 * Set GEMINI_VIBE_DEBUG=1 for full request/response previews on every call.
 * Without it: compact logs; failures still get parse stages + diagnostics.
 */

export type GeminiParseStage = { stage: string; ok: boolean; message?: string };

export function isGeminiVibeDebug(): boolean {
  const v = String(process.env.GEMINI_VIBE_DEBUG || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Node `TypeError: fetch failed` often hides `cause` (e.g. ETIMEDOUT).
 * Use in catch blocks around fetch() for actionable logs.
 */
export function fetchErrorDetails(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { shape: typeof err, message: String(err) };
  }
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  };
  const c = err.cause;
  if (c instanceof Error) {
    out.causeName = c.name;
    out.causeMessage = c.message;
  } else if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    if (o.code !== undefined) out.causeCode = o.code;
    if (o.errno !== undefined) out.causeErrno = o.errno;
    try {
      out.causeJson = JSON.stringify(c);
    } catch {
      out.causeString = String(c);
    }
  } else if (c != null) {
    out.causeString = String(c);
  }
  return out;
}

function parseErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Redact base64 and long instruction text from logged request body. */
export function redactGenerateContentBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  try {
    const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    const contents = clone.contents;
    if (!Array.isArray(contents)) return clone;
    clone.contents = contents.map((c) => {
      if (!c || typeof c !== "object") return c;
      const row = c as Record<string, unknown>;
      const parts = row.parts;
      if (!Array.isArray(parts)) return c;
      return {
        ...row,
        parts: parts.map((p) => {
          if (!p || typeof p !== "object") return p;
          const part = p as Record<string, unknown>;
          const inline = part.inlineData as { mimeType?: string; data?: string } | undefined;
          if (inline && typeof inline.data === "string") {
            return {
              ...part,
              inlineData: {
                mimeType: inline.mimeType ?? null,
                dataBase64Chars: inline.data.length,
              },
            };
          }
          const text = part.text;
          if (typeof text === "string") {
            return {
              textChars: text.length,
              textPreview: text.slice(0, 160),
            };
          }
          return part;
        }),
      };
    });
    return clone;
  } catch {
    return { _redactError: "serialize_failed" };
  }
}

export function summarizeGeminiApiResponse(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return { shape: typeof data };
  }
  const d = data as Record<string, unknown>;
  const err = d.error as { message?: string; code?: number; status?: string } | undefined;
  const candidates = d.candidates as unknown[] | undefined;
  const first =
    Array.isArray(candidates) && candidates[0] && typeof candidates[0] === "object"
      ? (candidates[0] as Record<string, unknown>)
      : null;

  let textLen = 0;
  let partsCount = 0;
  const content = first?.content;
  if (content && typeof content === "object") {
    const parts = (content as { parts?: unknown[] }).parts;
    if (Array.isArray(parts)) {
      partsCount = parts.length;
      const textPart = parts.find(
        (p) => p && typeof p === "object" && typeof (p as { text?: string }).text === "string",
      ) as { text?: string } | undefined;
      if (textPart?.text) textLen = textPart.text.length;
    }
  }

  return {
    topLevelKeys: Object.keys(d),
    apiError: err
      ? { message: err.message ?? null, code: err.code ?? null, status: err.status ?? null }
      : null,
    candidatesCount: Array.isArray(candidates) ? candidates.length : 0,
    finishReason: first?.finishReason ?? null,
    safetyRatings: first?.safetyRatings ?? null,
    blockReason: first?.blockReason ?? null,
    promptFeedbackBlockReason:
      (d.promptFeedback as { blockReason?: string } | undefined)?.blockReason ?? null,
    firstCandidatePartsCount: partsCount,
    aggregatedTextLen: textLen,
  };
}

export function parseGeminiJsonObject(text: string): {
  value: Record<string, unknown> | null;
  stages: GeminiParseStage[];
} {
  const stages: GeminiParseStage[] = [];

  const trimmed = text.trim();
  if (!trimmed) {
    stages.push({ stage: "trim", ok: false, message: "empty_after_trim" });
    return { value: null, stages };
  }

  const tryObject = (label: string, raw: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        stages.push({ stage: label, ok: true });
        return v as Record<string, unknown>;
      }
      stages.push({
        stage: label,
        ok: false,
        message: `expected_object_got_${Array.isArray(v) ? "array" : typeof v}`,
      });
    } catch (e) {
      stages.push({ stage: label, ok: false, message: parseErr(e) });
    }
    return null;
  };

  const direct = tryObject("json_parse_direct", trimmed);
  if (direct) return { value: direct, stages };

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inner = tryObject("json_parse_fenced", fenced[1].trim());
    if (inner) return { value: inner, stages };
  } else {
    stages.push({ stage: "json_parse_fenced", ok: false, message: "no_fenced_block" });
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    const sliced = tryObject("json_parse_brace_slice", slice);
    if (sliced) return { value: sliced, stages };
  } else {
    stages.push({ stage: "json_parse_brace_slice", ok: false, message: "no_brace_pair" });
  }

  return { value: null, stages };
}

export function parseGeminiJsonArray(text: string): {
  value: unknown[] | null;
  stages: GeminiParseStage[];
} {
  const stages: GeminiParseStage[] = [];

  const trimmed = text.trim();
  if (!trimmed) {
    stages.push({ stage: "trim", ok: false, message: "empty_after_trim" });
    return { value: null, stages };
  }

  const tryArray = (label: string, raw: string): unknown[] | null => {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) {
        stages.push({ stage: label, ok: true, message: `length=${v.length}` });
        return v;
      }
      stages.push({
        stage: label,
        ok: false,
        message: `expected_array_got_${v && typeof v === "object" ? "object" : typeof v}`,
      });
    } catch (e) {
      stages.push({ stage: label, ok: false, message: parseErr(e) });
    }
    return null;
  };

  const direct = tryArray("json_parse_direct", trimmed);
  if (direct) return { value: direct, stages };

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inner = tryArray("json_parse_fenced", fenced[1].trim());
    if (inner) return { value: inner, stages };
  } else {
    stages.push({ stage: "json_parse_fenced", ok: false, message: "no_fenced_block" });
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const slice = trimmed.slice(firstBracket, lastBracket + 1);
    const sliced = tryArray("json_parse_bracket_slice", slice);
    if (sliced) return { value: sliced, stages };
  } else {
    stages.push({ stage: "json_parse_bracket_slice", ok: false, message: "no_bracket_pair" });
  }

  return { value: null, stages };
}
