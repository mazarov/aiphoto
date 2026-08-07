export const UPLOADS_BUCKET = "web-generation-uploads";
export const RESULTS_BUCKET = "web-generation-results";

export class ProcessingError extends Error {
  constructor(
    readonly errorType: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProcessingError";
  }
}

export type GenerationInputJob = {
  requester_auth_user_id: string | null;
  input_photo_paths: string[] | null;
  parent_generation_id: string | null;
};

export type ParentGenerationInput = {
  requester_auth_user_id: string | null;
  status: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
};

export type GenerationInputSource = {
  sourceType: "user_photos" | "generation_result";
  bucket: string;
  paths: string[];
};

export function resolveGenerationInputSource(
  job: GenerationInputJob,
  parent: ParentGenerationInput | null = null,
): GenerationInputSource {
  if (!job.parent_generation_id) {
    const paths = job.input_photo_paths || [];
    if (!paths.length) throw new ProcessingError("input_missing", "No input photos", false);
    return { sourceType: "user_photos", bucket: UPLOADS_BUCKET, paths };
  }

  if (!parent) {
    throw new ProcessingError("parent_generation_missing", "Parent generation not found", false);
  }
  if (
    !job.requester_auth_user_id ||
    parent.requester_auth_user_id !== job.requester_auth_user_id
  ) {
    throw new ProcessingError(
      "parent_generation_forbidden",
      "Parent generation belongs to another requester",
      false,
    );
  }
  if (
    parent.status !== "completed" ||
    parent.result_storage_bucket !== RESULTS_BUCKET ||
    !parent.result_storage_path
  ) {
    throw new ProcessingError(
      "parent_generation_not_ready",
      "Parent generation result is unavailable",
      false,
    );
  }
  return {
    sourceType: "generation_result",
    bucket: RESULTS_BUCKET,
    paths: [parent.result_storage_path],
  };
}
