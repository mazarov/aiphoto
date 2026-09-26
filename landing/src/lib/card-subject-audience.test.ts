import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AudienceVisionError } from "./audience-vision-core";
import {
  classifyCardSubjectAudience,
  processSubjectAudienceBacklog,
  scheduleCardSubjectAudience,
  type CardSubjectAudienceResult,
} from "./card-subject-audience";

const CARD = {
  card_id: "card-1",
  media_id: "media-1",
  storage_bucket: "photos",
  storage_path: "cards/one.jpg",
  mime_type: "image/jpeg",
  current_audience: ["muzhchina"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockClient(options: {
  enabled?: boolean;
  proxyValue?: string | null;
  claim?: unknown;
  budgetAllowed?: boolean;
  complete?: boolean;
  onRpc?: (fn: string, args: Record<string, unknown> | undefined) => void;
}): { client: SupabaseClient; rpcNames: string[] } {
  const rpcNames: string[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        in() {
          return Promise.resolve({
            data: [
              { key: "card_subject_audience_enabled", value: options.enabled ? "true" : "false" },
              { key: "card_subject_audience_daily_limit", value: "3000" },
            ],
            error: null,
          });
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          if (table === "photo_app_config") {
            return Promise.resolve({
              data: options.proxyValue == null ? null : { value: options.proxyValue },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      rpcNames.push(fn);
      options.onRpc?.(fn, args);
      if (fn === "claim_subject_audience_batch") {
        return { data: options.claim ?? [], error: null };
      }
      if (fn === "card_subject_audience_take_budget") {
        return { data: { allowed: options.budgetAllowed !== false }, error: null };
      }
      if (fn === "complete_subject_audience") {
        return { data: options.complete !== false, error: null };
      }
      if (fn === "fail_subject_audience" || fn === "subject_audience_coverage") {
        return { data: fn === "subject_audience_coverage" ? { pending: 1 } : true, error: null };
      }
      return { data: null, error: { message: `unexpected ${fn}` } };
    },
  };
  return { client: client as unknown as SupabaseClient, rpcNames };
}

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of previous) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("disabled flag does not claim or call the network", async () => {
  await withEnv({ GEMINI_PROXY_BASE_URL: "https://proxy.example" }, async () => {
    const { client, rpcNames } = mockClient({ enabled: false });
    let fetched = 0;
    const result = await classifyCardSubjectAudience({
      supabase: client,
      cardId: "card-1",
      fetchImpl: async () => {
        fetched += 1;
        return jsonResponse({});
      },
    });
    assert.equal(result.status, "disabled");
    assert.deepEqual(rpcNames, []);
    assert.equal(fetched, 0);
  });
});

test("empty proxy with gemini_use_proxy on does not call Google", async () => {
  await withEnv({ GEMINI_PROXY_BASE_URL: undefined, GEMINI_API_KEY: "test-key" }, async () => {
    const { client, rpcNames } = mockClient({ enabled: true, proxyValue: "true" });
    let fetched = 0;
    await assert.rejects(
      () => classifyCardSubjectAudience({
        supabase: client,
        cardId: "card-1",
        fetchImpl: async () => {
          fetched += 1;
          return jsonResponse({});
        },
      }),
      (error: unknown) => error instanceof AudienceVisionError && error.code === "missing_proxy",
    );
    assert.equal(fetched, 0);
    assert.deepEqual(rpcNames, []);
  });
});

test("classification stores the raw audience, including none and low confidence", async () => {
  await withEnv({
    GEMINI_PROXY_BASE_URL: "https://proxy.example",
    GEMINI_API_KEY: "test-key",
    SUPABASE_URL: "https://db.example",
  }, async () => {
    const completed: Array<Record<string, unknown> | undefined> = [];
    const urls: string[] = [];
    for (const sample of [
      { audience: "none", confidence: 0.88, people_count: 0 },
      { audience: "devushka", confidence: 0.4, people_count: 1 },
    ]) {
      const { client } = mockClient({
        enabled: true,
        proxyValue: "true",
        claim: [CARD],
        onRpc(fn, args) {
          if (fn === "complete_subject_audience") completed.push(args);
        },
      });
      const result = await classifyCardSubjectAudience({
        supabase: client,
        cardId: CARD.card_id,
        fetchImpl: async (url) => {
          urls.push(String(url));
          if (String(url).includes("generativelanguage.googleapis.com")) {
            throw new Error("direct google");
          }
          if (String(url).includes("/storage/")) {
            return new Response(Uint8Array.from([0xff, 0xd8, 0xff]));
          }
          return jsonResponse({
            candidates: [{
              content: {
                parts: [{ text: JSON.stringify({
                  ...sample,
                  has_visible_face: true,
                  has_child: false,
                }) }],
              },
            }],
          });
        },
      });
      assert.equal(result.status, "classified");
      assert.equal(result.audience, sample.audience);
      assert.equal(result.confidence, sample.confidence);
    }
    assert.equal(completed[0]?.p_audience, "none");
    assert.equal(completed[0]?.p_confidence, 0.88);
    assert.equal(completed[1]?.p_audience, "devushka");
    assert.equal(completed[1]?.p_confidence, 0.4);
    assert.equal(urls.some((url) => url.includes("generativelanguage.googleapis.com")), false);
    assert.equal(urls.some((url) => url.startsWith("https://proxy.example/")), true);
  });
});

test("429 is recorded as rate_limited and does not complete", async () => {
  await withEnv({
    GEMINI_PROXY_BASE_URL: "https://proxy.example",
    GEMINI_API_KEY: "test-key",
    SUPABASE_URL: "https://db.example",
  }, async () => {
    const failures: Array<Record<string, unknown> | undefined> = [];
    const { client, rpcNames } = mockClient({
      enabled: true,
      claim: [CARD],
      onRpc(fn, args) {
        if (fn === "fail_subject_audience") failures.push(args);
      },
    });
    const result = await classifyCardSubjectAudience({
      supabase: client,
      cardId: CARD.card_id,
      fetchImpl: async (url) => {
        if (String(url).includes("/storage/")) return new Response(Uint8Array.from([1, 2, 3]));
        return new Response("busy", { status: 429 });
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.reason, "rate_limited");
    assert.equal(failures[0]?.p_error, "rate_limited");
    assert.equal(rpcNames.includes("complete_subject_audience"), false);
  });
});

test("backlog stays idle while the flag is off", async () => {
  const { client, rpcNames } = mockClient({ enabled: false });
  const result = await processSubjectAudienceBacklog({
    supabase: client,
    limit: 8,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.equal(result.status, "disabled");
  assert.equal(result.processed, 0);
  assert.deepEqual(rpcNames, []);
});

test("publish kick registers one after-callback and classifies once", async () => {
  const calls: string[] = [];
  let scheduled: (() => Promise<void>) | null = null;
  scheduleCardSubjectAudience({
    supabase: {} as SupabaseClient,
    cardId: "card-1",
    afterImpl(work) {
      assert.equal(scheduled, null);
      scheduled = work;
    },
    classify: async () => {
      calls.push("classify");
      return { status: "classified", audience: "muzhchina", confidence: 0.9 } satisfies CardSubjectAudienceResult;
    },
  });
  assert.equal(calls.length, 0);
  assert.ok(scheduled);
  await scheduled();
  assert.deepEqual(calls, ["classify"]);
});
