/**
 * Unified LLM helper — OpenAI Chat Completions API via fetch.
 * Works with OpenAI, Azure OpenAI, and any OpenAI-compatible endpoint.
 *
 * Env vars:
 *   OPENAI_API_KEY   — required
 *   OPENAI_BASE_URL  — optional (default: https://api.openai.com/v1)
 *   LLM_MODEL        — optional (default: gpt-4.1-mini)
 */

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

export function getLlmConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY env var");
  }
  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  messages: LlmMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  finishReason: string | null;
}

export async function llmChat(options: LlmOptions): Promise<LlmResult> {
  const { apiKey, baseUrl, model } = getLlmConfig();

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.1,
  };

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });

  if (res.status === 429) {
    throw new RateLimitError("Rate limited (429)");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
  };

  const choice = json.choices?.[0];
  const text = choice?.message?.content ?? "";

  return {
    text,
    finishReason: choice?.finish_reason ?? null,
  };
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
  }
}
