import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYZE_HISTORY_BUCKET,
  ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT,
  ANALYZE_HISTORY_CLEANUP_MAX_LIMIT,
  ANALYZE_HISTORY_RETENTION_DAYS,
  analyzeHistoryRetentionCutoff,
  cleanupExpiredAnalyzeHistory,
  encodeAnalyzeHistoryCursor,
  parseAnalyzeHistoryCleanupLimit,
  parseAnalyzeHistoryCursor,
  parseAnalyzeHistoryLimit,
} from "./analyze-history";

const DATE = "2026-08-08T21:00:00.000Z";
const ID = "9c0e4de5-8c82-4c3e-8d9c-e1ef4b47a0dd";

test("analyze history cursor round-trips and rejects malformed values", () => {
  assert.deepEqual(parseAnalyzeHistoryCursor(encodeAnalyzeHistoryCursor(DATE, ID)), {
    createdAt: DATE,
    id: ID,
  });
  for (const value of [null, "", `|${ID}`, `${DATE}|`, `invalid|${ID}`, `1|${ID}`, `${DATE}|bad`, `${DATE}|${ID}|extra`]) {
    assert.equal(parseAnalyzeHistoryCursor(value), null);
  }
});

test("analyze history limit defaults, floors, and clamps", () => {
  assert.equal(parseAnalyzeHistoryLimit(null), 30);
  assert.equal(parseAnalyzeHistoryLimit("NaN"), 30);
  assert.equal(parseAnalyzeHistoryLimit("-5"), 1);
  assert.equal(parseAnalyzeHistoryLimit("12.8"), 12);
  assert.equal(parseAnalyzeHistoryLimit("101"), 100);
});

test("analyze history retention is five days", () => {
  assert.equal(ANALYZE_HISTORY_RETENTION_DAYS, 5);
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  assert.equal(analyzeHistoryRetentionCutoff(now), "2026-08-24T12:00:00.000Z");
});

test("analyze history cron limit defaults, floors, and clamps", () => {
  assert.equal(parseAnalyzeHistoryCleanupLimit(null), ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT);
  assert.equal(parseAnalyzeHistoryCleanupLimit("NaN"), ANALYZE_HISTORY_CLEANUP_DEFAULT_LIMIT);
  assert.equal(parseAnalyzeHistoryCleanupLimit("-5"), 1);
  assert.equal(parseAnalyzeHistoryCleanupLimit("12.8"), 12);
  assert.equal(parseAnalyzeHistoryCleanupLimit(String(ANALYZE_HISTORY_CLEANUP_MAX_LIMIT + 50)), ANALYZE_HISTORY_CLEANUP_MAX_LIMIT);
});

type HistoryRow = { id: string; image_path: string | null };

function createCleanupStore(input: {
  pages: HistoryRow[][];
  removeError?: string;
  deleteError?: string;
}) {
  const removed: string[][] = [];
  const deleted: string[][] = [];
  let page = 0;
  const store = {
    from(table: string) {
      assert.equal(table, "analyze_history");
      return {
        select() {
          return {
            lt() {
              return {
                order() {
                  return {
                    async limit() {
                      const data = input.pages[page] ?? [];
                      page += 1;
                      return { data, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            async in(_column: string, ids: string[]) {
              if (input.deleteError) return { error: { message: input.deleteError } };
              deleted.push(ids);
              return { error: null };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        assert.equal(bucket, ANALYZE_HISTORY_BUCKET);
        return {
          async remove(paths: string[]) {
            if (input.removeError) return { error: { message: input.removeError } };
            removed.push(paths);
            return { error: null };
          },
        };
      },
    },
    removed,
    deleted,
  };
  return store;
}

test("cleanup removes MinIO objects before deleting stale rows", async () => {
  const store = createCleanupStore({
    pages: [[
      { id: "a", image_path: "2026/08/20/a.jpg" },
      { id: "b", image_path: null },
    ]],
  });
  const result = await cleanupExpiredAnalyzeHistory(store as never, {
    now: Date.parse("2026-08-29T12:00:00.000Z"),
    limit: 10,
  });
  assert.deepEqual(result, {
    cutoff: "2026-08-24T12:00:00.000Z",
    scanned: 2,
    deletedRows: 2,
    removedFiles: 1,
    hasMore: false,
  });
  assert.deepEqual(store.removed, [["2026/08/20/a.jpg"]]);
  assert.deepEqual(store.deleted, [["a", "b"]]);
});

test("cleanup does not delete rows when MinIO remove fails", async () => {
  const store = createCleanupStore({
    pages: [[{ id: "a", image_path: "2026/08/20/a.jpg" }]],
    removeError: "IncompleteBody",
  });
  await assert.rejects(
    () => cleanupExpiredAnalyzeHistory(store as never, { limit: 10 }),
    /IncompleteBody/,
  );
  assert.equal(store.deleted.length, 0);
});

test("cleanup reports hasMore when the tick hits the row budget", async () => {
  const store = createCleanupStore({
    pages: [Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, image_path: null }))],
  });
  const result = await cleanupExpiredAnalyzeHistory(store as never, { limit: 3 });
  assert.equal(result.deletedRows, 3);
  assert.equal(result.hasMore, true);
});
