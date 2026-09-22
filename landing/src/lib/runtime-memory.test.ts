import assert from "node:assert/strict";
import test from "node:test";
import { parseCgroupStat, readCgroupMemory } from "./runtime-memory";

test("parseCgroupStat reads anon and file", () => {
  assert.deepEqual(parseCgroupStat("anon 10\nfile 20\ninactive_anon 3\n"), {
    anon: 10,
    file: 20,
  });
});

test("readCgroupMemory uses cgroup v2 current and stat", () => {
  const files: Record<string, string> = {
    "/sys/fs/cgroup/memory.current": "123\n",
    "/sys/fs/cgroup/memory.stat": "anon 40\nfile 80\n",
  };
  const snapshot = readCgroupMemory((path) => {
    if (!(path in files)) throw new Error(`missing ${path}`);
    return files[path];
  });
  assert.deepEqual(snapshot, { current: 123, anon: 40, file: 80 });
});

test("readCgroupMemory returns null when the cgroup files are absent", () => {
  assert.equal(
    readCgroupMemory(() => {
      throw new Error("enoent");
    }),
    null,
  );
});
