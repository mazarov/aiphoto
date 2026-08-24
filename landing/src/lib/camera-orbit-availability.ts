const STORAGE_KEY = "promptshot:camera-orbit-enabled";

let memory: boolean | null = null;

export function readCachedCameraOrbitEnabled(): boolean | null {
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

export function writeCachedCameraOrbitEnabled(enabled: boolean): void {
  memory = enabled;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
