import { createHash } from "node:crypto";
import {
  extensionRateLimitDayWindowStartIso,
  extensionRateLimitIpHash,
  extensionRateLimitParsedIp,
} from "@/lib/extension-rate-limit-ip";
import {
  GeminiEmbeddingError,
  embedSearchQuery,
} from "@/lib/gemini-embedding";
import { loadSearchQueryEmbedding } from "@/lib/search-query-embedding-cache";
import { normalizeSearchQueryForCache } from "@/lib/search-query-normalize";
import {
  createConcurrencyGate,
  createSingleFlight,
  createTtlLruCache,
} from "@/lib/visual-search-cache";
import { createCircuitBreaker } from "@/lib/visual-search-circuit";
import {
  VISUAL_BUDGET_SYSTEM_IP,
  VISUAL_CACHE_MAX_ENTRIES,
  VISUAL_CACHE_TTL_MS,
  VISUAL_CIRCUIT_FAILURES,
  VISUAL_CIRCUIT_OPEN_MS,
  VISUAL_CIRCUIT_WINDOW_MS,
  getVisualSearchConfig,
  resolveVisualSearchConfig,
  type VisualRpcClient,
  type VisualSearchConfig,
} from "@/lib/visual-search-config";

export type VisualBudgetActor = "user" | "system";

export type VisualEmbedSource = "l1" | "l2_db" | "gemini" | "none";

export type VisualGuardReason =
  | "disabled"
  | "missing_key"
  | "circuit_open"
  | "rate_limited"
  | "guard_unavailable"
  | "timeout"
  | "provider_error"
  | "malformed_vector";

export type VisualEmbedOutcome =
  | {
      ok: true;
      vector: number[];
      cacheHit: boolean;
      embedSource: "l1" | "l2_db" | "gemini";
      queryHash: string;
      circuitState: string;
    }
  | {
      ok: false;
      reason: VisualGuardReason;
      cacheHit: boolean;
      embedSource: "none";
      circuitState: string;
    };

type RateLimitClient = VisualRpcClient;

const queryCache = createTtlLruCache<number[]>(
  VISUAL_CACHE_MAX_ENTRIES,
  VISUAL_CACHE_TTL_MS,
);
const queryFlight = createSingleFlight<{
  vector: number[];
  source: "l1" | "l2_db" | "gemini";
}>();
const circuit = createCircuitBreaker({
  failureThreshold: VISUAL_CIRCUIT_FAILURES,
  windowMs: VISUAL_CIRCUIT_WINDOW_MS,
  openMs: VISUAL_CIRCUIT_OPEN_MS,
});
let geminiGate = createConcurrencyGate(
  getVisualSearchConfig().geminiConcurrency,
);

export function resetVisualSearchGuardsForTests() {
  queryCache.clear();
  circuit.success();
  geminiGate = createConcurrencyGate(getVisualSearchConfig().geminiConcurrency);
}

export function visualQueryCacheKey(
  query: string,
  config: Pick<VisualSearchConfig, "model" | "generation" | "useTaskPrefix">,
): string {
  return createHash("sha256")
    .update(
      [
        normalizeSearchQueryForCache(query),
        config.model,
        String(config.generation),
        config.useTaskPrefix ? "1" : "0",
      ].join("\n"),
    )
    .digest("hex");
}

function asReason(error: unknown): VisualGuardReason {
  if (error instanceof GeminiEmbeddingError) {
    if (error.code === "rate_limited") return "rate_limited";
    if (error.code === "timeout") return "timeout";
    if (error.code === "malformed_vector") return "malformed_vector";
    if (error.code === "missing_key") return "missing_key";
    return "provider_error";
  }
  return "provider_error";
}

function isBudgetFailure(reason: VisualGuardReason): boolean {
  return (
    reason === "timeout" ||
    reason === "rate_limited" ||
    reason === "provider_error" ||
    reason === "malformed_vector"
  );
}

export async function reserveVisualSearchBudget(options: {
  supabase: RateLimitClient;
  headers: Headers;
  config?: VisualSearchConfig;
  now?: Date;
  budgetActor?: VisualBudgetActor;
}): Promise<
  | { allowed: true; ipHash: string }
  | { allowed: false; reason: "rate_limited" | "guard_unavailable"; ipHash: string }
> {
  const config =
    options.config ?? (await resolveVisualSearchConfig(options.supabase));
  const actor = options.budgetActor ?? "user";
  const ip =
    actor === "system"
      ? VISUAL_BUDGET_SYSTEM_IP
      : extensionRateLimitParsedIp(options.headers);
  const ipHash = extensionRateLimitIpHash(ip, options.now);
  const ipMax =
    actor === "system" ? config.systemDailyLimit : config.ipDailyLimit;
  try {
    const { data, error } = await options.supabase.rpc(
      "visual_search_rate_limit_increment",
      {
        p_ip_hash: ipHash,
        p_window_start: extensionRateLimitDayWindowStartIso(options.now),
        p_ip_max: ipMax,
        p_global_max: config.globalDailyLimit,
      },
    );
    if (error) {
      return { allowed: false, reason: "guard_unavailable", ipHash };
    }
    const row = data as { allowed?: unknown } | null;
    if (row?.allowed !== true) {
      return { allowed: false, reason: "rate_limited", ipHash };
    }
    return { allowed: true, ipHash };
  } catch {
    return { allowed: false, reason: "guard_unavailable", ipHash };
  }
}

export async function embedSearchQueryWithGuards(options: {
  query: string;
  headers: Headers;
  supabase: RateLimitClient;
  config?: VisualSearchConfig;
  now?: Date;
  budgetActor?: VisualBudgetActor;
  skipPersistentLookup?: boolean;
  embed?: typeof embedSearchQuery;
}): Promise<VisualEmbedOutcome> {
  const config =
    options.config ?? (await resolveVisualSearchConfig(options.supabase));
  const circuitState = circuit.state();
  if (!config.enabled) {
    return {
      ok: false,
      reason: "disabled",
      cacheHit: false,
      embedSource: "none",
      circuitState,
    };
  }

  const cacheKey = visualQueryCacheKey(options.query, config);
  const cached = queryCache.get(cacheKey);
  if (cached) {
    return {
      ok: true,
      vector: cached,
      cacheHit: true,
      embedSource: "l1",
      queryHash: cacheKey,
      circuitState,
    };
  }

  try {
    const resolved = await queryFlight.run(cacheKey, async () => {
      const replay = queryCache.get(cacheKey);
      if (replay) {
        return { vector: replay, source: "l1" as const };
      }

      // L2 Postgres lookup runs BEFORE Gemini API key, circuit breaker, and daily budget checks
      // so stored queries continue serving hybrid search during Gemini/proxy outages or quota exhaustion.
      if (!options.skipPersistentLookup) {
        const stored = await loadSearchQueryEmbedding({
          supabase: options.supabase,
          queryHash: cacheKey,
        });
        if (stored) {
          queryCache.set(cacheKey, stored);
          return { vector: stored, source: "l2_db" as const };
        }
      }

      if (!(process.env.GEMINI_API_KEY ?? "").trim()) {
        const deny = new Error("missing_key");
        deny.name = "missing_key";
        throw deny;
      }

      if (!circuit.allow()) {
        const deny = new Error("circuit_open");
        deny.name = "circuit_open";
        throw deny;
      }

      const budget = await reserveVisualSearchBudget({
        supabase: options.supabase,
        headers: options.headers,
        config,
        now: options.now,
        budgetActor: options.budgetActor,
      });
      if (!budget.allowed) {
        const deny = new Error(budget.reason);
        deny.name = budget.reason;
        throw deny;
      }

      const embed = options.embed ?? embedSearchQuery;
      const values = await geminiGate.run(() =>
        embed({
          query: options.query,
          timeoutMs: config.timeoutMs,
          useTaskPrefix: config.useTaskPrefix,
          model: config.model,
          useProxy: config.useProxy,
        }),
      );
      queryCache.set(cacheKey, values);
      circuit.success();
      return { vector: values, source: "gemini" as const };
    });

    return {
      ok: true,
      vector: resolved.vector,
      cacheHit: resolved.source !== "gemini",
      embedSource: resolved.source,
      queryHash: cacheKey,
      circuitState: circuit.state(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.name === "rate_limited" ||
        error.name === "guard_unavailable" ||
        error.name === "missing_key" ||
        error.name === "circuit_open"
      ) {
        return {
          ok: false,
          reason: error.name,
          cacheHit: false,
          embedSource: "none",
          circuitState: circuit.state(),
        };
      }
    }
    const reason = asReason(error);
    if (isBudgetFailure(reason)) {
      circuit.failure();
    }
    return {
      ok: false,
      reason,
      cacheHit: false,
      embedSource: "none",
      circuitState: circuit.state(),
    };
  }
}
