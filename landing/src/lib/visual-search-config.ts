import { createSingleFlight } from "@/lib/visual-search-cache";

export type VisualConfigRow = {
  key?: unknown;
  value?: unknown;
};

type InternalConfigSelectChain = {
  in(
    column: string,
    values: readonly string[],
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type InternalConfigTableReader = {
  from?: (table: string) => {
    select(columns: string): InternalConfigSelectChain;
  };
};

/**
 * Keep `VisualRpcClient` restricted to `rpc(...)` only.
 * Adding `from(table: string)` here forces TypeScript to instantiate
 * `@supabase/postgrest-js` recursive `ParseSelectQuery<string>` types
 * (`TS2589: Type instantiation is excessively deep`) wherever `SupabaseClient`
 * is passed as `VisualRpcClient`.
 */
export type VisualRpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export const SEARCH_VISUAL_ENABLED_CONFIG_KEY = "search_visual_enabled";
export const SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY = "search_visual_max_distance";
export const VISUAL_CONFIG_CACHE_TTL_MS = 30_000;
export const VISUAL_CONFIG_ERROR_RETRY_MS = 5_000;

export const VISUAL_EMBEDDING_DIMENSIONS = 768;
export const VISUAL_EMBEDDING_MODEL_DEFAULT = "gemini-embedding-2";
export const VISUAL_EMBED_TIMEOUT_MS_DEFAULT = 800;
export const VISUAL_MAX_DISTANCE_DEFAULT = 0.7;
export const TEXT_SEARCH_MAX_WINDOW = 100;
export const VISUAL_SEARCH_RPC_MAX_WINDOW = 300;
export const VISUAL_SEARCH_MERGED_MAX = 500;
export const VISUAL_SEARCH_WINDOW_RESERVE = 24;
export const SEARCH_HYBRID_MATERIALIZE_LIMIT = 240;
export const SEARCH_HYBRID_RESULT_TTL_MS = 10 * 60 * 1000;
export const SEARCH_HYBRID_RESULT_MAX_ENTRIES = 500;
export const RRF_K = 60;
export const RRF_TEXT_WEIGHT = 1;
export const RRF_VISUAL_WEIGHT = 0.85;
export const STRONG_FTS_MIN_SCORE = 200;
export const VISUAL_CACHE_TTL_MS = 60 * 60 * 1000;
export const VISUAL_CACHE_MAX_ENTRIES = 2_000;
export const VISUAL_GEMINI_CONCURRENCY_DEFAULT = 4;
export const VISUAL_CIRCUIT_FAILURES = 5;
export const VISUAL_CIRCUIT_WINDOW_MS = 60_000;
export const VISUAL_CIRCUIT_OPEN_MS = 30_000;
export const VISUAL_IP_DAILY_LIMIT_DEFAULT = 60;
export const VISUAL_GLOBAL_DAILY_LIMIT_DEFAULT = 4000;
export const VISUAL_SYSTEM_DAILY_LIMIT_DEFAULT = 10_000;
export const VISUAL_BUDGET_SYSTEM_IP = "system";
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

export function parseVisualEnabledFlag(raw: unknown): boolean {
  const normalized = String(raw ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function parseVisualMaxDistanceFlag(
  raw: unknown,
  fallback: number | null = VISUAL_MAX_DISTANCE_DEFAULT,
): number | null {
  if (raw === undefined || raw === null) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized || ["0", "off", "false", "none", "null"].includes(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed === 0) return null;
  if (parsed > 2) return 2;
  return parsed;
}

export type VisualSearchDbFlags = {
  enabled: boolean;
  maxVisualDistance: number | null;
};

export type VisualSearchConfig = {
  enabled: boolean;
  maxVisualDistance: number | null;
  model: string;
  generation: number;
  timeoutMs: number;
  useTaskPrefix: boolean;
  useProxy: boolean;
  ipDailyLimit: number;
  globalDailyLimit: number;
  systemDailyLimit: number;
  geminiConcurrency: number;
};

let cachedDbFlags: { value: VisualSearchDbFlags; expiresAt: number } | null = null;
let lastKnownDbFlags: VisualSearchDbFlags | null = null;
let testFlagsOverride: Partial<VisualSearchDbFlags> | null = null;
const dbFlagsFlight = createSingleFlight<VisualSearchDbFlags>();

export function setVisualSearchFlagsForTests(
  overrides: Partial<VisualSearchDbFlags> | null,
): void {
  testFlagsOverride = overrides;
}

export function resetVisualSearchConfigCacheForTests(): void {
  cachedDbFlags = null;
  lastKnownDbFlags = null;
  testFlagsOverride = null;
}

function currentSyncDbFlags(): VisualSearchDbFlags {
  const base: VisualSearchDbFlags = cachedDbFlags?.value ??
    lastKnownDbFlags ?? {
      enabled: false,
      maxVisualDistance: VISUAL_MAX_DISTANCE_DEFAULT,
    };
  if (!testFlagsOverride) return base;
  return {
    enabled:
      testFlagsOverride.enabled !== undefined
        ? testFlagsOverride.enabled
        : base.enabled,
    maxVisualDistance:
      testFlagsOverride.maxVisualDistance !== undefined
        ? testFlagsOverride.maxVisualDistance
        : base.maxVisualDistance,
  };
}

function buildVisualSearchConfig(flags: VisualSearchDbFlags): VisualSearchConfig {
  return {
    enabled: flags.enabled,
    maxVisualDistance: flags.maxVisualDistance,
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
    useProxy: envFlag("GEMINI_EMBEDDING_USE_PROXY", true),
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
    systemDailyLimit: envInt(
      "SEARCH_VISUAL_SYSTEM_DAILY_LIMIT",
      VISUAL_SYSTEM_DAILY_LIMIT_DEFAULT,
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

export function getVisualSearchConfig(): VisualSearchConfig {
  return buildVisualSearchConfig(currentSyncDbFlags());
}

export async function resolveVisualSearchConfig(
  supabase?: VisualRpcClient | null,
  nowMs = Date.now(),
): Promise<VisualSearchConfig> {
  if (testFlagsOverride) {
    return buildVisualSearchConfig(currentSyncDbFlags());
  }

  if (cachedDbFlags && cachedDbFlags.expiresAt > nowMs) {
    return buildVisualSearchConfig(cachedDbFlags.value);
  }

  const reader = supabase as unknown as InternalConfigTableReader | null | undefined;
  if (!reader || typeof reader.from !== "function") {
    return buildVisualSearchConfig(currentSyncDbFlags());
  }

  const resolved = await dbFlagsFlight.run("landing_generation_config", async () => {
    if (cachedDbFlags && cachedDbFlags.expiresAt > nowMs) {
      return cachedDbFlags.value;
    }

    try {
      const { data, error } = await reader
        .from!("landing_generation_config")
        .select("key,value")
        .in("key", [
          SEARCH_VISUAL_ENABLED_CONFIG_KEY,
          SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY,
        ]);

      if (error) {
        console.warn("[visual-search-config] config read failed", {
          message: error.message.slice(0, 160),
        });
        const fallback: VisualSearchDbFlags = lastKnownDbFlags ?? {
          enabled: false,
          maxVisualDistance: VISUAL_MAX_DISTANCE_DEFAULT,
        };
        cachedDbFlags = {
          value: fallback,
          expiresAt: nowMs + VISUAL_CONFIG_ERROR_RETRY_MS,
        };
        return fallback;
      }

      const map = new Map<string, string>();
      if (Array.isArray(data)) {
        for (const row of data as VisualConfigRow[]) {
          const k = typeof row?.key === "string" ? row.key.trim() : "";
          if (!k) continue;
          map.set(k, String(row?.value ?? ""));
        }
      }

      const nextFlags: VisualSearchDbFlags = {
        enabled: parseVisualEnabledFlag(map.get(SEARCH_VISUAL_ENABLED_CONFIG_KEY)),
        maxVisualDistance: map.has(SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY)
          ? parseVisualMaxDistanceFlag(
              map.get(SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY),
              VISUAL_MAX_DISTANCE_DEFAULT,
            )
          : VISUAL_MAX_DISTANCE_DEFAULT,
      };

      lastKnownDbFlags = nextFlags;
      cachedDbFlags = {
        value: nextFlags,
        expiresAt: nowMs + VISUAL_CONFIG_CACHE_TTL_MS,
      };
      return nextFlags;
    } catch (err) {
      console.warn("[visual-search-config] config read threw", {
        message: err instanceof Error ? err.message.slice(0, 160) : String(err),
      });
      const fallback: VisualSearchDbFlags = lastKnownDbFlags ?? {
        enabled: false,
        maxVisualDistance: VISUAL_MAX_DISTANCE_DEFAULT,
      };
      cachedDbFlags = {
        value: fallback,
        expiresAt: nowMs + VISUAL_CONFIG_ERROR_RETRY_MS,
      };
      return fallback;
    }
  });

  return buildVisualSearchConfig(resolved);
}

export function visualSearchWindowSize(limit: number, offset: number): number {
  const requested = Math.max(1, limit) + Math.max(0, offset) + VISUAL_SEARCH_WINDOW_RESERVE;
  return Math.min(VISUAL_SEARCH_MERGED_MAX, requested);
}
