import { isFotosessiiGenerateDockPath } from "./generate-dock-path";

const STORAGE_KEY = "promptshot:photoshoot-enabled";

let memory: boolean | null = null;

export function readCachedPhotoshootEnabled(): boolean | null {
  if (memory !== null) return memory;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === "1") {
      memory = true;
      return true;
    }
    if (raw === "0") {
      memory = false;
      return false;
    }
  } catch {
    /* private mode */
  }
  return null;
}

/** Until config answers: cached value wins; on fotosessii paths assume on (no FOUC). */
export function optimisticPhotoshootEnabled(input: {
  pathname?: string | null;
  cached: boolean | null;
}): boolean {
  if (input.cached === true) return true;
  if (input.cached === false) return false;
  return Boolean(input.pathname && isFotosessiiGenerateDockPath(input.pathname));
}

export function writeCachedPhotoshootEnabled(enabled: boolean): void {
  memory = enabled;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
