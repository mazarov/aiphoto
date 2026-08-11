import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAuthError,
  resolveOAuthCallbackError,
  sanitizeAuthReturnPath,
} from "./auth-return-path";
import {
  clearOAuthExchangeInflightForTests,
  finishOAuthCodeExchange,
  isRecoverableOAuthExchangeError,
  oauthExchangeStorageKey,
  type FinishOAuthAuthClient,
} from "./auth-finish-oauth";

test("keeps same-origin next paths", () => {
  assert.equal(sanitizeAuthReturnPath("/admin/payments"), "/admin/payments");
  assert.equal(sanitizeAuthReturnPath("/pricing?test=true"), "/pricing?test=true");
});

test("strips prior auth_error from return path", () => {
  assert.equal(
    sanitizeAuthReturnPath("/promty-dlya-foto-muzhchiny?auth_error=no_code"),
    "/promty-dlya-foto-muzhchiny"
  );
});

test("rejects absolute / protocol-relative next", () => {
  assert.equal(sanitizeAuthReturnPath("https://evil.test/x"), "/");
  assert.equal(sanitizeAuthReturnPath("//evil.test"), "/");
});

test("appends auth_error without breaking existing query", () => {
  assert.equal(
    appendAuthError("/admin/payments", "no_code"),
    "/admin/payments?auth_error=no_code"
  );
  assert.equal(
    appendAuthError("/pricing?test=true", "no_code"),
    "/pricing?test=true&auth_error=no_code"
  );
});

test("resolves GoTrue callback error params", () => {
  const params = new URLSearchParams({
    error: "server_error",
    error_description: "Database error saving new user",
  });
  assert.equal(
    resolveOAuthCallbackError(params),
    "Database error saving new user"
  );
  assert.equal(resolveOAuthCallbackError(new URLSearchParams()), "no_code");
});

test("marks PKCE verifier and flow-state errors as recoverable", () => {
  assert.equal(
    isRecoverableOAuthExchangeError(
      "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser"
    ),
    true
  );
  assert.equal(
    isRecoverableOAuthExchangeError("invalid flow state, no valid flow state found"),
    true
  );
  assert.equal(
    isRecoverableOAuthExchangeError("Database error saving new user"),
    false
  );
});

test("oauth exchange storage key is stable per code", () => {
  assert.equal(
    oauthExchangeStorageKey("abc"),
    "promptshot:oauth-exchange:abc"
  );
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key() {
      return null;
    },
  };
}

test("finishOAuthCodeExchange recovers PKCE verifier miss when session exists", async () => {
  clearOAuthExchangeInflightForTests();
  const storage = memoryStorage();
  let exchanges = 0;
  const auth: FinishOAuthAuthClient = {
    async exchangeCodeForSession() {
      exchanges += 1;
      return {
        error: {
          message: "PKCE code verifier not found in storage.",
        },
      };
    },
    async getUser() {
      return { data: { user: { id: "user-1" } } };
    },
  };

  const destination = await finishOAuthCodeExchange("code-pkce", "/pricing", {
    auth,
    storage,
  });
  assert.equal(destination, "/pricing");
  assert.equal(exchanges, 1);
  assert.equal(storage.getItem(oauthExchangeStorageKey("code-pkce")), "done");
});

test("finishOAuthCodeExchange single-flights concurrent calls for the same code", async () => {
  clearOAuthExchangeInflightForTests();
  const storage = memoryStorage();
  let exchanges = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const auth: FinishOAuthAuthClient = {
    async exchangeCodeForSession() {
      exchanges += 1;
      await gate;
      return { error: null };
    },
    async getUser() {
      return { data: { user: { id: "user-1" } } };
    },
  };

  const first = finishOAuthCodeExchange("code-race", "/pricing", { auth, storage });
  const second = finishOAuthCodeExchange("code-race", "/pricing", { auth, storage });
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, "/pricing");
  assert.equal(b, "/pricing");
  assert.equal(exchanges, 1);
});

test("finishOAuthCodeExchange skips /token when storage already done and session exists", async () => {
  clearOAuthExchangeInflightForTests();
  const storage = memoryStorage();
  storage.setItem(oauthExchangeStorageKey("code-done"), "done");
  let exchanges = 0;
  const auth: FinishOAuthAuthClient = {
    async exchangeCodeForSession() {
      exchanges += 1;
      return { error: null };
    },
    async getUser() {
      return { data: { user: { id: "user-1" } } };
    },
  };

  const destination = await finishOAuthCodeExchange("code-done", "/pricing", {
    auth,
    storage,
  });
  assert.equal(destination, "/pricing");
  assert.equal(exchanges, 0);
});

test("finishOAuthCodeExchange keeps auth_error when PKCE fails without session", async () => {
  clearOAuthExchangeInflightForTests();
  const storage = memoryStorage();
  const auth: FinishOAuthAuthClient = {
    async exchangeCodeForSession() {
      return {
        error: { message: "PKCE code verifier not found in storage." },
      };
    },
    async getUser() {
      return { data: { user: null } };
    },
  };

  const destination = await finishOAuthCodeExchange("code-fail", "/pricing", {
    auth,
    storage,
  });
  assert.equal(
    destination,
    "/pricing?auth_error=PKCE%20code%20verifier%20not%20found%20in%20storage."
  );
  assert.equal(storage.getItem(oauthExchangeStorageKey("code-fail")), null);
});
