import assert from "node:assert/strict";
import test from "node:test";
import { SUPABASE_SERVER_AUTH } from "./supabase-server-client";
import { supabaseCookieClientOptions } from "./supabase-cookie-client";

test("cookie auth client disables GoTrue refresh like the service-role client", () => {
  const options = supabaseCookieClientOptions({
    getAll: () => [],
    set: () => undefined,
  });
  assert.deepEqual(options.auth, { ...SUPABASE_SERVER_AUTH });
  assert.equal(options.auth.autoRefreshToken, false);
  assert.equal(options.auth.persistSession, false);
  assert.equal(options.auth.detectSessionInUrl, false);
});
