import assert from "node:assert/strict";
import test from "node:test";
import {
  ProcessingError,
  assertVideoInputSource,
  resolveGenerationInputSource,
  RESULTS_BUCKET,
  type GenerationInputJob,
  type ParentGenerationInput,
} from "./input-source";

function job(overrides: Partial<GenerationInputJob> = {}): GenerationInputJob {
  return {
    requester_auth_user_id: "auth-user-id",
    input_photo_paths: ["auth-user-id/input.jpg"],
    parent_generation_id: null,
    ...overrides,
  };
}

const completedParent: ParentGenerationInput = {
  requester_auth_user_id: "auth-user-id",
  status: "completed",
  result_storage_bucket: RESULTS_BUCKET,
  result_storage_path: "db-user-id/parent/result.png",
};

test("initial generation reads owned upload paths", () => {
  assert.deepEqual(resolveGenerationInputSource(job()), {
    sourceType: "user_photos",
    bucket: "web-generation-uploads",
    paths: ["auth-user-id/input.jpg"],
  });
});

test("text-only generation resolves without upload paths", () => {
  assert.deepEqual(
    resolveGenerationInputSource(job({ input_photo_paths: [] })),
    {
      sourceType: "text_only",
      bucket: "web-generation-uploads",
      paths: [],
    },
  );
});

test("continuation reads only the completed parent result", () => {
  assert.deepEqual(
    resolveGenerationInputSource(
      job({
        parent_generation_id: "parent-id",
        input_photo_paths: [],
      }),
      completedParent,
    ),
    {
      sourceType: "generation_result",
      bucket: RESULTS_BUCKET,
      paths: ["db-user-id/parent/result.png"],
    },
  );
});

test("continuation rejects a missing parent", () => {
  assert.throws(
    () =>
      resolveGenerationInputSource(
        job({ parent_generation_id: "parent-id", input_photo_paths: [] }),
      ),
    (error) =>
      error instanceof ProcessingError &&
      error.errorType === "parent_generation_missing" &&
      error.retryable === false,
  );
});

test("continuation rejects a parent owned by another requester", () => {
  assert.throws(
    () =>
      resolveGenerationInputSource(
        job({ parent_generation_id: "parent-id", input_photo_paths: [] }),
        { ...completedParent, requester_auth_user_id: "other-user-id" },
      ),
    (error) =>
      error instanceof ProcessingError &&
      error.errorType === "parent_generation_forbidden",
  );
});

test("video source rejects text-only and accepts a single image", () => {
  assert.throws(
    () =>
      assertVideoInputSource({
        sourceType: "text_only",
        bucket: "web-generation-uploads",
        paths: [],
      }),
    (error) =>
      error instanceof ProcessingError && error.errorType === "video_source_required",
  );
  assert.equal(
    assertVideoInputSource({
      sourceType: "user_photos",
      bucket: "web-generation-uploads",
      paths: ["user/a.jpg"],
    }).paths.length,
    1,
  );
});

test("continuation rejects an unfinished parent or unexpected bucket", () => {
  for (const parent of [
    { ...completedParent, status: "processing" },
    { ...completedParent, result_storage_bucket: "web-generation-uploads" },
  ]) {
    assert.throws(
      () =>
        resolveGenerationInputSource(
          job({ parent_generation_id: "parent-id", input_photo_paths: [] }),
          parent,
        ),
      (error) =>
        error instanceof ProcessingError &&
        error.errorType === "parent_generation_not_ready",
    );
  }
});
