/** In-process Next ISR / image / `use cache` ceiling. Unset LRU can grow until the 2 GiB cgroup dies. */
export const NEXT_CACHE_MAX_MEMORY_BYTES = 32 * 1024 * 1024;
