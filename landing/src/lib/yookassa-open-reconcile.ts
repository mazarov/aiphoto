export const OPEN_RECONCILE_DEBOUNCE_MS = 30_000;
export const OPEN_RECONCILE_STORAGE_KEY = "promptshot_yk_open_reconcile_at";

export function shouldRunClientOpenReconcile(
  lastRunAtMs: number | null,
  nowMs: number,
  debounceMs: number = OPEN_RECONCILE_DEBOUNCE_MS,
): boolean {
  if (lastRunAtMs == null || !Number.isFinite(lastRunAtMs)) return true;
  return nowMs - lastRunAtMs >= debounceMs;
}

export function readOpenReconcileLastRunAt(
  storage: Pick<Storage, "getItem">,
): number | null {
  const raw = storage.getItem(OPEN_RECONCILE_STORAGE_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function markOpenReconcileRunAt(
  storage: Pick<Storage, "setItem">,
  nowMs: number,
): void {
  storage.setItem(OPEN_RECONCILE_STORAGE_KEY, String(nowMs));
}
