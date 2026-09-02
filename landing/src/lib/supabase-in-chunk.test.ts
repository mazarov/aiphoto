import assert from "node:assert/strict";
import test from "node:test";
import {
  POSTGREST_IN_CHUNK,
  chunkForPostgrestIn,
} from "./supabase";

test("PostgREST IN chunk stays at 40 ids so OpenResty URI stays under 4–8 KB", () => {
  assert.equal(POSTGREST_IN_CHUNK, 40);
  assert.deepEqual(chunkForPostgrestIn([]), []);
  assert.deepEqual(chunkForPostgrestIn(["a"]), [["a"]]);
  assert.equal(chunkForPostgrestIn(Array.from({ length: 40 }, (_, i) => i)).length, 1);
  assert.deepEqual(
    chunkForPostgrestIn(Array.from({ length: 41 }, (_, i) => i)).map((part) => part.length),
    [40, 1]
  );
  assert.deepEqual(
    chunkForPostgrestIn(Array.from({ length: 200 }, (_, i) => i)).map((part) => part.length),
    [40, 40, 40, 40, 40]
  );
});
