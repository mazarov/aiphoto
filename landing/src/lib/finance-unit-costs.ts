import type { FinanceCogsProvider, GeminiFamilyId } from "./finance-types";

export type FinanceModelUnitCost = {
  perImage?: Partial<Record<string, number>>;
  perSecond?: Partial<Record<string, number>>;
};

export type FinanceModelUnitCosts = Record<string, FinanceModelUnitCost>;

export type LiveCogsRow = {
  day: string;
  model_id: string;
  image_size: string;
  duration_seconds: number;
  jobs: number;
  billed_jobs: number;
  billed_usd: number;
};

export type PricedCogsRow = {
  day: string;
  modelId: string;
  family: GeminiFamilyId;
  provider: FinanceCogsProvider;
  jobs: number;
  billedUsd: number;
  estimatedUsd: number;
  subtotalUsd: number;
  missingPrice: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function positiveNumber(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function parseFinanceModelUnitCosts(raw: unknown): FinanceModelUnitCosts {
  if (typeof raw === "string") {
    try {
      return parseFinanceModelUnitCosts(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  const root = asRecord(raw);
  if (!root) return {};
  const out: FinanceModelUnitCosts = {};
  for (const [modelId, item] of Object.entries(root)) {
    const record = asRecord(item);
    if (!record) continue;
    const perImageRaw = asRecord(record.perImage);
    const perSecondRaw = asRecord(record.perSecond);
    const perImage: FinanceModelUnitCost["perImage"] = {};
    const perSecond: FinanceModelUnitCost["perSecond"] = {};
    if (perImageRaw) {
      for (const [size, price] of Object.entries(perImageRaw)) {
        const amount = positiveNumber(price);
        if (amount != null) perImage[size] = amount;
      }
    }
    if (perSecondRaw) {
      for (const [size, price] of Object.entries(perSecondRaw)) {
        const amount = positiveNumber(price);
        if (amount != null) perSecond[size] = amount;
      }
    }
    if (Object.keys(perImage).length || Object.keys(perSecond).length) {
      out[modelId] = { perImage, perSecond };
    }
  }
  return out;
}

export function cogsProviderFromFamily(family: GeminiFamilyId): FinanceCogsProvider {
  if (family.startsWith("grok-")) return "xai";
  if (
    family === "seedream-image"
    || family === "flux-image"
    || family === "seedance-video"
  ) {
    return "openrouter";
  }
  if (family === "other") return "other";
  return "google";
}

export function classifyCogsProvider(modelId: string): FinanceCogsProvider {
  const id = modelId.toLowerCase();
  if (id.startsWith("grok-")) return "xai";
  if (
    id.startsWith("seedream-")
    || id.startsWith("flux-")
    || id.startsWith("seedance-")
    || id.includes("bytedance")
    || id.includes("black-forest")
  ) {
    return "openrouter";
  }
  if (id.startsWith("gemini-") || id.startsWith("veo-")) return "google";
  return "other";
}

export function classifyGenerationFamily(modelId: string): GeminiFamilyId {
  const id = modelId.toLowerCase();
  if (id.startsWith("seedance-")) return "seedance-video";
  if (id.startsWith("seedream-")) return "seedream-image";
  if (id.startsWith("flux-")) return "flux-image";
  if (id.startsWith("grok-imagine-video")) return "grok-imagine-video";
  if (id.startsWith("grok-imagine-image") || id.startsWith("grok-")) return "grok-imagine-image";
  if (id.startsWith("veo-")) return "veo-video";
  if (id.includes("omni") && id.includes("flash")) return "gemini-omni-video";
  if (id.includes("3.1") && id.includes("lite") && id.includes("image")) {
    return "gemini-3.1-flash-lite-image";
  }
  if (id.includes("3.1") && id.includes("flash") && id.includes("image")) {
    return "gemini-3.1-flash-image";
  }
  if (id.includes("3-pro") && id.includes("image")) return "gemini-3-pro-image";
  if (id.includes("2.5-flash") && id.includes("lite")) return "gemini-2.5-flash-lite";
  if (id.includes("2.5-flash") && id.includes("image")) return "gemini-2.5-flash-image";
  if (id.includes("3-pro")) return "gemini-3-pro-text";
  if (id.includes("2.5-flash")) return "gemini-2.5-flash-text";
  if (id.startsWith("gemini-")) return "other";
  return "other";
}

function pickSizedPrice(prices: Partial<Record<string, number>> | undefined, key: string): number | null {
  if (!prices) return null;
  if (prices[key] != null) return prices[key];
  const upper = key.toUpperCase();
  if (prices[upper] != null) return prices[upper];
  const lower = key.toLowerCase();
  if (prices[lower] != null) return prices[lower];
  const fallback = prices["1K"] ?? prices["720p"] ?? Object.values(prices)[0];
  return fallback != null ? fallback : null;
}

export function estimateJobUsd(
  costs: FinanceModelUnitCosts,
  input: { modelId: string; imageSize?: string | null; durationSeconds?: number | null },
): number | null {
  const spec = costs[input.modelId];
  if (!spec) return null;
  if (spec.perSecond && Object.keys(spec.perSecond).length) {
    const seconds = Math.max(0, Number(input.durationSeconds) || 0);
    const rate = pickSizedPrice(spec.perSecond, input.imageSize || "720p");
    if (rate == null || seconds <= 0) return null;
    return rate * seconds;
  }
  return pickSizedPrice(spec.perImage, input.imageSize || "1K");
}

export function priceLiveCogsRows(
  rows: LiveCogsRow[],
  costs: FinanceModelUnitCosts,
): PricedCogsRow[] {
  return rows.map((row) => {
    const billedUsd = Number(row.billed_usd) || 0;
    const billedJobs = Math.max(0, Number(row.billed_jobs) || 0);
    const jobs = Math.max(0, Number(row.jobs) || 0);
    const unbilled = Math.max(0, jobs - billedJobs);
    const unit = estimateJobUsd(costs, {
      modelId: row.model_id,
      imageSize: row.image_size,
      durationSeconds: row.duration_seconds,
    });
    const estimatedUsd = unit != null ? unit * unbilled : 0;
    return {
      day: row.day,
      modelId: row.model_id,
      family: classifyGenerationFamily(row.model_id),
      provider: classifyCogsProvider(row.model_id),
      jobs,
      billedUsd,
      estimatedUsd,
      subtotalUsd: billedUsd + estimatedUsd,
      missingPrice: unbilled > 0 && unit == null,
    };
  });
}
