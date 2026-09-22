/** In-process Next ISR / image / `use cache` ceiling. Unset LRU can grow until the 2 GiB cgroup dies. */
export const NEXT_CACHE_MAX_MEMORY_BYTES = 32 * 1024 * 1024;

/** On-disk `/_next/image` LRU. Next 15.5.7 had no ceiling; 15.5.14+ evicts past this size. */
export const NEXT_IMAGE_DISK_CACHE_MAX_BYTES = 256 * 1024 * 1024;

/**
 * Replaces the Next default that includes 2048 and 3840.
 * `fill` images otherwise decode the largest device width.
 */
export const NEXT_IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920] as const;
