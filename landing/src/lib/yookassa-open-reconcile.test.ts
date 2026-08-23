import assert from "node:assert/strict";
import test from "node:test";
import {
  OPEN_RECONCILE_DEBOUNCE_MS,
  OPEN_RECONCILE_STORAGE_KEY,
  markOpenReconcileRunAt,
  readOpenReconcileLastRunAt,
  shouldRunClientOpenReconcile,
} from "./yookassa-open-reconcile";

test("client open reconcile runs when never attempted", () => {
  assert.equal(shouldRunClientOpenReconcile(null, 1_000), true);
  assert.equal(shouldRunClientOpenReconcile(Number.NaN, 1_000), true);
});

test("client open reconcile waits for the 30s debounce", () => {
  assert.equal(shouldRunClientOpenReconcile(1_000, 30_999), false);
  assert.equal(shouldRunClientOpenReconcile(1_000, 31_000), true);
  assert.equal(OPEN_RECONCILE_DEBOUNCE_MS, 30_000);
});

test("sessionStorage helpers persist the last run timestamp", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
  assert.equal(readOpenReconcileLastRunAt(storage), null);
  markOpenReconcileRunAt(storage, 42_000);
  assert.equal(store.get(OPEN_RECONCILE_STORAGE_KEY), "42000");
  assert.equal(readOpenReconcileLastRunAt(storage), 42_000);
});
