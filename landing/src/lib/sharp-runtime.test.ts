import assert from "node:assert/strict";
import test from "node:test";
import {
  SHARP_MAX_WAITERS,
  SHARP_PIPELINE_LIMIT,
  SharpBusyError,
  configureSharpRuntime,
  resetSharpRuntimeForTests,
  runSharpLimited,
  sharpPipelineActive,
} from "./sharp-runtime";

test("sharp gate keeps two pipelines and rejects the fifth waiter", async () => {
  resetSharpRuntimeForTests();
  configureSharpRuntime({
    cache() {
      return undefined;
    },
    concurrency() {
      return undefined;
    },
  });

  let releaseHold: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  const running = Array.from({ length: SHARP_PIPELINE_LIMIT }, () =>
    runSharpLimited(() => hold),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sharpPipelineActive(), SHARP_PIPELINE_LIMIT);

  const waiting = Array.from({ length: SHARP_MAX_WAITERS }, () =>
    runSharpLimited(async () => "ok"),
  );
  await new Promise((resolve) => setImmediate(resolve));

  await assert.rejects(
    () => runSharpLimited(async () => "overflow"),
    (error: unknown) => error instanceof SharpBusyError,
  );

  releaseHold();
  await Promise.all([...running, ...waiting]);
  assert.equal(sharpPipelineActive(), 0);
  resetSharpRuntimeForTests();
});
