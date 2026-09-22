import sharp from "sharp";

/** libvips operation cache. Unique catalog photos should not fill this. */
export const SHARP_CACHE_MEMORY_MB = 32;
export const SHARP_CACHE_ITEMS = 16;
export const SHARP_CONCURRENCY = 1;
/** Parallel sharp pipelines in this process, including waits. */
export const SHARP_PIPELINE_LIMIT = 2;
export const SHARP_MAX_WAITERS = 4;

export class SharpBusyError extends Error {
  constructor() {
    super("sharp_busy");
    this.name = "SharpBusyError";
  }
}

export function isSharpBusyError(error: unknown): error is SharpBusyError {
  return error instanceof SharpBusyError;
}

type SharpControl = {
  cache: (options: { memory: number; files: number; items: number }) => unknown;
  concurrency: (threads: number) => unknown;
};

let configured = false;
let active = 0;
const waiters: Array<() => void> = [];

export function configureSharpRuntime(api: SharpControl = sharp): void {
  if (configured) return;
  api.cache({ memory: SHARP_CACHE_MEMORY_MB, files: 0, items: SHARP_CACHE_ITEMS });
  api.concurrency(SHARP_CONCURRENCY);
  configured = true;
}

export function resetSharpRuntimeForTests(): void {
  configured = false;
  active = 0;
  waiters.splice(0, waiters.length);
}

function releaseSharpSlot(): void {
  const next = waiters.shift();
  if (next) {
    next();
    return;
  }
  active = Math.max(0, active - 1);
}

export function sharpPipelineActive(): number {
  return active;
}

export function sharpPipelineWaiting(): number {
  return waiters.length;
}

export async function runSharpLimited<T>(task: () => Promise<T>): Promise<T> {
  configureSharpRuntime();
  if (active >= SHARP_PIPELINE_LIMIT) {
    if (waiters.length >= SHARP_MAX_WAITERS) throw new SharpBusyError();
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else {
    active += 1;
  }
  try {
    return await task();
  } finally {
    releaseSharpSlot();
  }
}
