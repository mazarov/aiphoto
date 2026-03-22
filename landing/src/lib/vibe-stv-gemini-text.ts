/**
 * Plain-text Gemini generateContent for STV steps 2–3 (no vision).
 */

import { summarizeGeminiApiResponse } from "@/lib/gemini-vibe-debug-log";

const DIRECT_GEMINI_BASE = "https://generativelanguage.googleapis.com";

export async function geminiGeneratePlainText(params: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  userText: string;
  temperature: number;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string; responseSummary?: ReturnType<typeof summarizeGeminiApiResponse> }> {
  const base = String(params.apiBaseUrl || DIRECT_GEMINI_BASE).replace(/\/+$/, "");
  const url = `${base}/v1beta/models/${params.model}:generateContent`;
  const timeoutMs = params.timeoutMs ?? 60_000;

  const body = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: params.userText }] }],
    generationConfig: {
      temperature: params.temperature,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
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

  let data: {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, status: res.status, text: "", errorMessage: "response body not json" };
  }

  const text = data?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
  const responseSummary = summarizeGeminiApiResponse(data);
  const llmError = data?.error?.message ?? null;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text,
      errorMessage: llmError ?? `http_${res.status}`,
      responseSummary,
    };
  }

  return { ok: true, status: res.status, text, errorMessage: llmError ?? undefined, responseSummary };
}

export function stripLeadingMarkdownFence(text: string): string {
  let t = String(text ?? "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```\s*$/u, "").trim();
  }
  return t;
}
