import { isStoragePathOwnedByAuthUser } from "../../landing/src/lib/user-generation-photo-paths";

export const UPLOADS_BUCKET = "web-generation-uploads";
export const RESULTS_BUCKET = "web-generation-results";
export const VIDEO_IDENTITY_WALK_LIMIT = 8;

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
  input_photo_paths?: string[] | null;
  parent_generation_id?: string | null;
};

export type GenerationInputSource = {
  sourceType: "text_only" | "user_photos" | "generation_result";
  bucket: string;
  paths: string[];
};

export function resolveGenerationInputSource(
  job: GenerationInputJob,
  parent: ParentGenerationInput | null = null,
): GenerationInputSource {
  if (!job.parent_generation_id) {
    const paths = job.input_photo_paths || [];
    return {
      sourceType: paths.length ? "user_photos" : "text_only",
      bucket: UPLOADS_BUCKET,
      paths,
    };
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

export function assertVideoInputSource(source: GenerationInputSource): GenerationInputSource {
  if (source.sourceType === "text_only" || source.paths.length !== 1) {
    throw new ProcessingError(
      "video_source_required",
      "Video generation requires exactly one source image",
      false,
    );
  }
  return source;
}

export function pickOwnedIdentityPhotoPath(
  requesterAuthUserId: string | null,
  paths: string[] | null | undefined,
): string | null {
  if (!requesterAuthUserId) return null;
  for (const raw of paths || []) {
    const path = String(raw || "").trim();
    if (isStoragePathOwnedByAuthUser(path, requesterAuthUserId)) return path;
  }
  return null;
}

export function resolveVideoIdentityReference(
  source: GenerationInputSource,
  requesterAuthUserId: string | null,
  ancestors: Array<Pick<ParentGenerationInput, "input_photo_paths">>,
): GenerationInputSource | null {
  for (const ancestor of ancestors) {
    const path = pickOwnedIdentityPhotoPath(requesterAuthUserId, ancestor.input_photo_paths);
    if (path) {
      return {
        sourceType: "user_photos",
        bucket: UPLOADS_BUCKET,
        paths: [path],
      };
    }
  }
  if (source.sourceType === "user_photos" && source.paths[0]) {
    return {
      sourceType: "user_photos",
      bucket: source.bucket || UPLOADS_BUCKET,
      paths: [source.paths[0]],
    };
  }
  return null;
}

export function videoInputLogFields(
  source: GenerationInputSource,
  job: Pick<GenerationInputJob, "parent_generation_id">,
  identity: GenerationInputSource | null = null,
  linkedGenerationId: string | null = null,
): {
  sourceType: GenerationInputSource["sourceType"];
  sourceCount: number;
  sourcePath: string | null;
  sourceBucket: string;
  parentGenerationId: string | null;
  linkedGenerationId: string | null;
  hasIdentityReference: boolean;
  identityPath: string | null;
  identityBucket: string | null;
} {
  return {
    sourceType: source.sourceType,
    sourceCount: source.paths.length,
    sourcePath: source.paths[0] || null,
    sourceBucket: source.bucket,
    parentGenerationId: job.parent_generation_id,
    linkedGenerationId,
    hasIdentityReference: Boolean(identity?.paths[0]),
    identityPath: identity?.paths[0] || null,
    identityBucket: identity?.bucket || null,
  };
}
