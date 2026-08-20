import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLibrarySourceGenerationId,
  resolveVideoEnqueueParentGenerationId,
} from "../../landing/src/lib/user-generation-photo-paths";
import {
  ProcessingError,
  assertVideoInputSource,
  resolveGenerationInputSource,
  RESULTS_BUCKET,
  videoInputLogFields,
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

test("video input log fields distinguish upload vs parent result", () => {
  assert.deepEqual(
    videoInputLogFields(
      {
        sourceType: "user_photos",
        bucket: "web-generation-uploads",
        paths: ["auth-user-id/input.jpg"],
      },
      job(),
    ),
    {
      sourceType: "user_photos",
      sourceCount: 1,
      sourcePath: "auth-user-id/input.jpg",
      sourceBucket: "web-generation-uploads",
      parentGenerationId: null,
      linkedGenerationId: null,
    },
  );
  assert.deepEqual(
    videoInputLogFields(
      {
        sourceType: "generation_result",
        bucket: RESULTS_BUCKET,
        paths: ["db-user-id/parent/result.png"],
      },
      job({ parent_generation_id: "parent-id", input_photo_paths: [] }),
      "linked-id",
    ),
    {
      sourceType: "generation_result",
      sourceCount: 1,
      sourcePath: "db-user-id/parent/result.png",
      sourceBucket: RESULTS_BUCKET,
      parentGenerationId: "parent-id",
      linkedGenerationId: "linked-id",
    },
  );
});

test("library filename recovers the source generation id", () => {
  assert.equal(
    parseLibrarySourceGenerationId("generation-3d1b3c6c-7565-4ae8-bb01-338863065d83.jpg"),
    "3d1b3c6c-7565-4ae8-bb01-338863065d83",
  );
  assert.equal(parseLibrarySourceGenerationId("1786898245_pt4p8b.jpg"), null);
  assert.equal(
    resolveVideoEnqueueParentGenerationId(null, "generation-3d1b3c6c-7565-4ae8-bb01-338863065d83.jpg"),
    "3d1b3c6c-7565-4ae8-bb01-338863065d83",
  );
  assert.equal(
    resolveVideoEnqueueParentGenerationId("explicit-parent", "generation-3d1b3c6c-7565-4ae8-bb01-338863065d83.jpg"),
    "explicit-parent",
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
