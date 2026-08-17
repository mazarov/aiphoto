export type VisualRpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export const VISUAL_EMBEDDING_DIMENSIONS = 768;
export const VISUAL_EMBEDDING_MODEL_DEFAULT = "gemini-embedding-2";
export const VISUAL_EMBED_TIMEOUT_MS_DEFAULT = 800;
export const TEXT_SEARCH_MAX_WINDOW = 100;
export const VISUAL_SEARCH_RPC_MAX_WINDOW = 300;
export const VISUAL_SEARCH_MERGED_MAX = 500;
export const VISUAL_SEARCH_WINDOW_RESERVE = 24;
export const RRF_K = 60;
export const RRF_TEXT_WEIGHT = 1;
export const RRF_VISUAL_WEIGHT = 0.85;
export const STRONG_FTS_MIN_SCORE = 200;
export const VISUAL_CACHE_TTL_MS = 10 * 60 * 1000;
export const VISUAL_CACHE_MAX_ENTRIES = 500;
export const VISUAL_GEMINI_CONCURRENCY_DEFAULT = 4;
export const VISUAL_CIRCUIT_FAILURES = 5;
export const VISUAL_CIRCUIT_WINDOW_MS = 60_000;
export const VISUAL_CIRCUIT_OPEN_MS = 30_000;
export const VISUAL_IP_DAILY_LIMIT_DEFAULT = 60;
export const VISUAL_GLOBAL_DAILY_LIMIT_DEFAULT = 4000;
export const VISUAL_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const VISUAL_IMAGE_MAX_EDGE = 768;

function envFlag(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export type VisualSearchConfig = {
  enabled: boolean;
  model: string;
  generation: number;
  timeoutMs: number;
  useTaskPrefix: boolean;
  useProxy: boolean;
  ipDailyLimit: number;
  globalDailyLimit: number;
  geminiConcurrency: number;
};

export function getVisualSearchConfig(): VisualSearchConfig {
  return {
    enabled: envFlag("SEARCH_VISUAL_ENABLED", false),
    model:
      String(process.env.GEMINI_EMBEDDING_MODEL ?? "").trim() ||
      VISUAL_EMBEDDING_MODEL_DEFAULT,
    generation: envInt("SEARCH_VISUAL_GENERATION", 1, 1, 10_000),
    timeoutMs: envInt(
      "SEARCH_VISUAL_TIMEOUT_MS",
      VISUAL_EMBED_TIMEOUT_MS_DEFAULT,
      200,
      2_000,
    ),
    useTaskPrefix: envFlag("SEARCH_VISUAL_TASK_PREFIX", true),
    useProxy: envFlag("GEMINI_EMBEDDING_USE_PROXY", false),
    ipDailyLimit: envInt(
      "SEARCH_VISUAL_IP_DAILY_LIMIT",
      VISUAL_IP_DAILY_LIMIT_DEFAULT,
      1,
      10_000,
    ),
    globalDailyLimit: envInt(
      "SEARCH_VISUAL_GLOBAL_DAILY_LIMIT",
      VISUAL_GLOBAL_DAILY_LIMIT_DEFAULT,
      1,
      1_000_000,
    ),
    geminiConcurrency: envInt(
      "SEARCH_VISUAL_GEMINI_CONCURRENCY",
      VISUAL_GEMINI_CONCURRENCY_DEFAULT,
      1,
      16,
    ),
  };
}

export function visualSearchWindowSize(limit: number, offset: number): number {
  const requested = Math.max(1, limit) + Math.max(0, offset) + VISUAL_SEARCH_WINDOW_RESERVE;
  return Math.min(VISUAL_SEARCH_MERGED_MAX, requested);
}
