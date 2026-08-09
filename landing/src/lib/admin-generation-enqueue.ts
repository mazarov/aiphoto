import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{8,118}$/;

export function normalizeAdminIdempotencyBase(
  supplied: string | null | undefined,
  fallback: string,
): string | null {
  const value = (supplied || "").trim() || fallback;
  return IDEMPOTENCY_KEY_RE.test(value) ? value : null;
}

export function resolveAdminGenerationModel(
  models: readonly unknown[],
  requestedModel: string | null | undefined,
  defaultModel: string | null | undefined,
): string | null {
  const enabled = models.filter(
    (model): model is { id: string; enabled?: boolean } =>
      Boolean(
        model &&
        typeof model === "object" &&
        typeof (model as { id?: unknown }).id === "string" &&
        (model as { id: string }).id.trim() &&
        (model as { enabled?: unknown }).enabled !== false,
      ),
  );
  if (requestedModel) {
    return enabled.find((model) => model.id === requestedModel)?.id ?? null;
  }
  return enabled.find((model) => model.id === defaultModel)?.id ?? enabled[0]?.id ?? null;
}

export function buildAdminEnqueueIdentity(params: {
  baseKey: string;
  index: number;
  requesterAuthUserId: string;
  dbUserId: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  photoPath: string;
}): { idempotencyKey: string; fingerprint: string } {
  const idempotencyKey = `${params.baseKey}:${params.index}`;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    requesterAuthUserId: params.requesterAuthUserId,
    dbUserId: params.dbUserId,
    prompt: params.prompt,
    model: params.model,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
    photoPath: params.photoPath,
    clientSource: "admin",
    index: params.index,
  })).digest("hex");
  return { idempotencyKey, fingerprint };
}
