import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  AUTH_RETURN_COOKIE,
  AUTH_RETURN_PATH_KEY,
  appendAuthError,
  sanitizeAuthReturnPath,
} from "@/lib/auth-return-path";

export const OAUTH_EXCHANGE_STORAGE_PREFIX = "promptshot:oauth-exchange:";

type ExchangeState = "pending" | "done";

export type FinishOAuthAuthClient = {
  exchangeCodeForSession: (
    code: string
  ) => Promise<{ error: { message: string } | null }>;
  getUser: () => Promise<{ data: { user: { id: string } | null } }>;
};

type FinishOAuthDeps = {
  auth?: FinishOAuthAuthClient;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

const inflightExchanges = new Map<string, Promise<string>>();

function consumeRememberedReturnPath(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  if (!stored) return null;
  return sanitizeAuthReturnPath(stored);
}

/** Resolve post-OAuth destination from `?next=` or remembered return path. */
export function resolveOAuthNextPath(searchParams: URLSearchParams): string {
  if (searchParams.has("next")) {
    return sanitizeAuthReturnPath(searchParams.get("next"));
  }
  return consumeRememberedReturnPath() ?? "/";
}

function clearAuthReturnCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function oauthExchangeStorageKey(code: string): string {
  return `${OAUTH_EXCHANGE_STORAGE_PREFIX}${code}`;
}

/** Replay after a successful first PKCE exchange (verifier already consumed). */
export function isRecoverableOAuthExchangeError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid flow state") ||
    normalized.includes("code verifier") ||
    normalized.includes("pkce")
  );
}

function resolveStorage(
  storage?: FinishOAuthDeps["storage"]
): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (storage) return storage;
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function readExchangeState(
  storage: Pick<Storage, "getItem"> | null,
  code: string
): ExchangeState | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(oauthExchangeStorageKey(code));
    if (value === "pending" || value === "done") return value;
  } catch {
    // ignore
  }
  return null;
}

function writeExchangeState(
  storage: Pick<Storage, "setItem"> | null,
  code: string,
  state: ExchangeState
): void {
  if (!storage) return;
  try {
    storage.setItem(oauthExchangeStorageKey(code), state);
  } catch {
    // ignore
  }
}

function clearExchangeState(
  storage: Pick<Storage, "removeItem"> | null,
  code: string
): void {
  if (!storage) return;
  try {
    storage.removeItem(oauthExchangeStorageKey(code));
  } catch {
    // ignore
  }
}

function defaultAuthClient(): FinishOAuthAuthClient {
  return createSupabaseBrowser().auth;
}

async function redirectIfSessionExists(
  auth: FinishOAuthAuthClient,
  safeNext: string
): Promise<string | null> {
  const { data } = await auth.getUser();
  if (!data.user) return null;
  clearAuthReturnCookie();
  return safeNext;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for a peer exchange marked pending in storage (no second /token). */
async function awaitPeerExchangeSession(
  auth: FinishOAuthAuthClient,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
  code: string,
  safeNext: string
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const recovered = await redirectIfSessionExists(auth, safeNext);
    if (recovered) {
      writeExchangeState(storage, code, "done");
      return recovered;
    }
    const state = readExchangeState(storage, code);
    if (state === null) {
      return appendAuthError(safeNext, "oauth_exchange_failed");
    }
    if (state === "done") {
      return appendAuthError(safeNext, "oauth_session_missing");
    }
    await sleep(50);
  }
  return appendAuthError(safeNext, "oauth_exchange_timeout");
}

async function runOAuthCodeExchange(
  code: string,
  safeNext: string,
  deps: FinishOAuthDeps
): Promise<string> {
  const storage = resolveStorage(deps.storage);
  const auth = deps.auth ?? defaultAuthClient();

  const prior = readExchangeState(storage, code);
  if (prior === "done") {
    const recovered = await redirectIfSessionExists(auth, safeNext);
    if (recovered) return recovered;
    return appendAuthError(safeNext, "oauth_session_missing");
  }
  if (prior === "pending") {
    return awaitPeerExchangeSession(auth, storage, code, safeNext);
  }

  writeExchangeState(storage, code, "pending");
  const { error } = await auth.exchangeCodeForSession(code);

  if (!error) {
    writeExchangeState(storage, code, "done");
    clearAuthReturnCookie();
    return safeNext;
  }

  if (isRecoverableOAuthExchangeError(error.message)) {
    const recovered = await redirectIfSessionExists(auth, safeNext);
    if (recovered) {
      writeExchangeState(storage, code, "done");
      return recovered;
    }
  }

  clearExchangeState(storage, code);
  console.error("OAuth exchange failed:", error.message);
  return appendAuthError(safeNext, error.message);
}

/**
 * Complete PKCE OAuth in the browser (single writer for session cookies).
 * Safe to call again after a successful exchange: invalid flow state / missing
 * PKCE verifier + active session is treated as success. Concurrent remounts
 * share one in-flight promise; sessionStorage covers reload of the same code.
 */
export async function finishOAuthCodeExchange(
  code: string,
  next: string,
  deps: FinishOAuthDeps = {}
): Promise<string> {
  const safeNext = sanitizeAuthReturnPath(next);
  const existing = inflightExchanges.get(code);
  if (existing) return existing;

  const promise = runOAuthCodeExchange(code, safeNext, deps).finally(() => {
    inflightExchanges.delete(code);
  });
  inflightExchanges.set(code, promise);
  return promise;
}

export function clearOAuthExchangeInflightForTests(): void {
  inflightExchanges.clear();
}
