/**
 * @typedef {object} StvPlatform
 * @property {'chrome'|'web'} id
 * @property {object} storage
 * @property {{ get: (keys: string|string[]) => Promise<Record<string, unknown>>; set: (obj: Record<string, unknown>) => Promise<void>; remove: (keys: string|string[]) => Promise<void> }} storage.local
 * @property {{ get: (keys: string|string[]) => Promise<Record<string, unknown>>; remove: (keys: string|string[]) => Promise<void>; onChanged?: (cb: (changes: unknown, areaName: string) => void) => void }} storage.session
 * @property {{ onMessage?: (cb: (msg: unknown) => void) => void }} runtime
 * @property {(url: string) => void} openOAuthUrl
 * @property {() => string} getOAuthCallbackUrl
 */

export {};
