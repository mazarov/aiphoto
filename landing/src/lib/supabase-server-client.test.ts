import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPABASE_SERVER_AUTH,
  createSupabaseServer,
  rememberOnce,
  resetSupabaseServerClientForTests,
} from "./supabase-server-client";

test("server auth disables GoTrue refresh and session storage", () => {
  assert.equal(SUPABASE_SERVER_AUTH.persistSession, false);
  assert.equal(SUPABASE_SERVER_AUTH.autoRefreshToken, false);
  assert.equal(SUPABASE_SERVER_AUTH.detectSessionInUrl, false);
});

test("rememberOnce creates once and reuses the same instance", () => {
  const slot: { current: { id: number } | null } = { current: null };
  let created = 0;
  const first = rememberOnce(slot, () => {
    created += 1;
    return { id: created };
  });
  const second = rememberOnce(slot, () => {
    created += 1;
    return { id: created };
  });
  assert.equal(created, 1);
  assert.equal(first, second);
  assert.equal(first.id, 1);
});

test("createSupabaseServer reuses one service-role client", () => {
  resetSupabaseServerClientForTests();
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  try {
    const first = createSupabaseServer();
    const second = createSupabaseServer();
    assert.equal(first, second);
  } finally {
    resetSupabaseServerClientForTests();
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
