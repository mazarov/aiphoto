/**
 * Runtime wiring for STV core (Chrome side panel vs web embed).
 * Must call configureStv() before importing/running stv-core boot.
 */

/** @typedef {import('./platform/types.js').StvPlatform} StvPlatform */

/** @type {{ platform: StvPlatform; createSupabaseClient: (apiOrigin: string) => Promise<unknown>; getApiOrigin: () => string } | null} */
let runtime = null;

/**
 * @param {{ platform: StvPlatform; createSupabaseClient: (apiOrigin: string) => Promise<unknown>; getApiOrigin: () => string }} cfg
 */
export function configureStv(cfg) {
  runtime = cfg;
}

export function getStvRuntime() {
  if (!runtime) {
    throw new Error("[stv] configureStv() must run before stv-core");
  }
  return runtime;
}
