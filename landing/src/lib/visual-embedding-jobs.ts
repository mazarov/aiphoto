import sharp from "sharp";
import { embedImageBytes } from "@/lib/gemini-embedding";
import { getStoragePublicUrl } from "@/lib/supabase";
import {
  VISUAL_IMAGE_MAX_EDGE,
  VISUAL_MAX_IMAGE_BYTES,
  getVisualSearchConfig,
  type VisualRpcClient,
} from "@/lib/visual-search-config";

export type VisualEmbeddingJob = {
  job_id: string;
  media_id: string;
  card_id: string;
  generation: number;
  lease_token: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  attempt_count: number;
  source_fingerprint: string | null;
};

type JobsClient = VisualRpcClient;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sniffMime(bytes: Uint8Array, fallback: string | null): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  return fallback && ALLOWED_MIME.has(fallback) ? fallback : "";
}

export async function downloadCanonicalPhoto(options: {
  bucket: string;
  path: string;
  mimeType: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = getStoragePublicUrl(options.bucket, options.path);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`image_fetch_${response.status}`);
  }
  const raw = new Uint8Array(await response.arrayBuffer());
  if (raw.byteLength === 0 || raw.byteLength > 20 * 1024 * 1024) {
    throw new Error("image_too_large");
  }
  const resized = await sharp(raw)
    .rotate()
    .resize({
      width: VISUAL_IMAGE_MAX_EDGE,
      height: VISUAL_IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
  if (resized.byteLength > VISUAL_MAX_IMAGE_BYTES) {
    throw new Error("image_too_large");
  }
  const mimeType = sniffMime(resized, "image/jpeg");
  if (!mimeType) throw new Error("image_mime");
  return { bytes: resized, mimeType };
}

export async function processVisualEmbeddingJobs(options: {
  supabase: JobsClient;
  limit?: number;
  leaseSeconds?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  errors: Record<string, number>;
}> {
  const config = getVisualSearchConfig();
  const { data, error } = await options.supabase.rpc("claim_visual_embedding_jobs", {
    p_limit: options.limit ?? 8,
    p_lease_seconds: options.leaseSeconds ?? 120,
  });
  if (error) throw new Error(error.message);

  const jobs = (data || []) as VisualEmbeddingJob[];
  const errors: Record<string, number> = {};
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const photo = await downloadCanonicalPhoto({
        bucket: job.storage_bucket,
        path: job.storage_path,
        mimeType: job.mime_type,
        fetchImpl: options.fetchImpl,
      });
      const vector = await embedImageBytes({
        bytes: photo.bytes,
        mimeType: photo.mimeType,
        timeoutMs: Math.max(config.timeoutMs, 8_000),
        model: config.model,
        useProxy: config.useProxy,
      });
      const done = await options.supabase.rpc("complete_visual_embedding_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_embedding: `[${vector.join(",")}]`,
        p_fingerprint: job.source_fingerprint,
        p_model: config.model,
      });
      if (done.error || done.data !== true) {
        throw new Error("complete_failed");
      }
      completed += 1;
    } catch (error) {
      const code =
        error instanceof Error ? error.message.slice(0, 64) : "unknown";
      errors[code] = (errors[code] ?? 0) + 1;
      await options.supabase.rpc("fail_visual_embedding_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_error_code: code,
      });
      failed += 1;
    }
  }

  return { claimed: jobs.length, completed, failed, errors };
}
