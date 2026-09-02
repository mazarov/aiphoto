/**
 * Cache-Control for public Storage objects with unique paths (UUID / lease token).
 * Supabase default is 3600s — Lighthouse then flags dockhost mp4/jpg as 1h cache
 * (~5 MB repeat-view waste). Immutable paths can live a year.
 *
 * Worker imports this module — do not duplicate TTL in process-*.ts.
 */
export const PUBLIC_OBJECT_CACHE_CONTROL_SECONDS = "31536000";

export function publicObjectUploadOptions<T extends Record<string, unknown>>(
  options: T
): T & { cacheControl: string } {
  return { ...options, cacheControl: PUBLIC_OBJECT_CACHE_CONTROL_SECONDS };
}
