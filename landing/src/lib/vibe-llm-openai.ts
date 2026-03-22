/**
 * OpenAI Chat Completions for vibe extract (vision+JSON) / expand (text+JSON).
 * No SDK — fetch only; secrets from env.
 */

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";

export type OpenAiUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function normalizeOpenAiBaseUrl(): string {
  const raw = String(process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE).trim().replace(/\/+$/, "");
  return raw || DEFAULT_OPENAI_BASE.replace(/\/+$/, "");
}

/**
 * POST /v1/chat/completions with optional `response_format: json_object`.
 */
export async function openAiChatCompletionJson(params: {
  apiKey: string;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | OpenAiUserContentPart[];
  }>;
  timeoutMs?: number;
  /** If set, passed to the API (e.g. vibe extract). */
  temperature?: number;
}): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string }> {
  const base = normalizeOpenAiBaseUrl();
  const url = `${base}/chat/completions`;
  const timeoutMs = params.timeoutMs ?? 120_000;

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    response_format: { type: "json_object" as const },
  };
  if (params.temperature !== undefined && Number.isFinite(params.temperature)) {
    body.temperature = params.temperature;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: "",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      status: res.status,
      text: "",
      errorMessage: "response body not json",
    };
  }

  const obj = data as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text: "",
      errorMessage: obj?.error?.message ?? `http_${res.status}`,
    };
  }

  const content = obj?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : "";
  return { ok: true, status: res.status, text };
}

/** Chat completions without `response_format` — for plain text (e.g. legacy merge) or free-form JSON in body. */
export async function openAiChatCompletionText(params: {
  apiKey: string;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string }> {
  const base = normalizeOpenAiBaseUrl();
  const url = `${base}/chat/completions`;
  const timeoutMs = params.timeoutMs ?? 120_000;

  const body = {
    model: params.model,
    messages: params.messages,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: "",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      status: res.status,
      text: "",
      errorMessage: "response body not json",
    };
  }

  const obj = data as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text: "",
      errorMessage: obj?.error?.message ?? `http_${res.status}`,
    };
  }

  const content = obj?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : "";
  return { ok: true, status: res.status, text };
}

export async function openAiExpandStyleToPromptJson(params: {
  apiKey: string;
  model: string;
  userText: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string }> {
  return openAiChatCompletionJson({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "user",
        content: params.userText,
      },
    ],
    timeoutMs: params.timeoutMs,
  });
}

/** Vision + JSON: instruction text + one inline image as data URL. */
export async function openAiExtractImageJson(params: {
  apiKey: string;
  model: string;
  instructionText: string;
  imageMimeType: string;
  imageBase64: string;
  timeoutMs?: number;
  temperature?: number;
}): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string }> {
  const mime = params.imageMimeType || "image/jpeg";
  const dataUrl = `data:${mime};base64,${params.imageBase64}`;
  return openAiChatCompletionJson({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.instructionText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    timeoutMs: params.timeoutMs ?? 120_000,
    temperature: params.temperature,
  });
}
