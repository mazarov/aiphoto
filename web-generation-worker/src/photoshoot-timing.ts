export function elapsedMs(startedAt: number, now = Date.now()): number {
  return Math.max(0, now - startedAt);
}

export function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function queueWaitMs(createdAt: unknown, claimedAt = Date.now()): number | null {
  const createdMs = parseTimestampMs(createdAt);
  if (createdMs == null) return null;
  return elapsedMs(createdMs, claimedAt);
}

export type PhotoshootTimingSnapshot = {
  queueWaitMs: number | null;
  inputDownloadMs: number | null;
  plannerMs: number | null;
  planPersistMs: number | null;
  provider: string | null;
  providerMs: number | null;
  encodeMs: number | null;
  sheetUploadMs: number | null;
  splitMs: number | null;
  tileUploadMs: number | null;
  workerMs: number;
  enqueueToDoneMs: number | null;
};

export type PhotoshootTimingMarks = {
  createdAt?: unknown;
  startedAt: number;
  inputDownloadMs?: number;
  plannerMs?: number;
  planPersistMs?: number;
  provider?: string;
  providerMs?: number;
  encodeMs?: number;
  sheetUploadMs?: number;
  splitMs?: number;
  tileUploadMs?: number;
};

export function snapshotPhotoshootTiming(
  marks: PhotoshootTimingMarks,
  now = Date.now(),
): PhotoshootTimingSnapshot {
  const createdMs = parseTimestampMs(marks.createdAt);
  return {
    queueWaitMs: queueWaitMs(marks.createdAt, marks.startedAt),
    inputDownloadMs: marks.inputDownloadMs ?? null,
    plannerMs: marks.plannerMs ?? null,
    planPersistMs: marks.planPersistMs ?? null,
    provider: marks.provider ?? null,
    providerMs: marks.providerMs ?? null,
    encodeMs: marks.encodeMs ?? null,
    sheetUploadMs: marks.sheetUploadMs ?? null,
    splitMs: marks.splitMs ?? null,
    tileUploadMs: marks.tileUploadMs ?? null,
    workerMs: elapsedMs(marks.startedAt, now),
    enqueueToDoneMs: createdMs == null ? null : elapsedMs(createdMs, now),
  };
}
