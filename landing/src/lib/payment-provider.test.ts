import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_ROBOKASSA_FEATURE_KEY,
  decidePaymentProvider,
  getPaymentProvider,
  hashAuthUserBucket,
  parseEmailList,
  parseRolloutBps,
  resolvePaymentProvider,
} from "./payment-provider";

test("payment provider env defaults to YooKassa and accepts Robokassa", () => {
  const previous = process.env.PAYMENT_PROVIDER;
  try {
    delete process.env.PAYMENT_PROVIDER;
    assert.equal(getPaymentProvider(), "yookassa");
    process.env.PAYMENT_PROVIDER = " ROBOKASSA ";
    assert.equal(getPaymentProvider(), "robokassa");
    process.env.PAYMENT_PROVIDER = "unknown";
    assert.throws(() => getPaymentProvider(), /Unsupported PAYMENT_PROVIDER/);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous;
  }
});

test("decidePaymentProvider pins unpaid, then canary, then rollout", () => {
  const canaryEmails = new Set(["azarov.maxim@gmail.com"]);
  assert.equal(
    decidePaymentProvider({
      email: "customer@example.com",
      unpaidProvider: "yookassa",
      canaryEmails,
      envProvider: "robokassa",
      rolloutEnabled: true,
      rolloutBps: 10000,
      assignmentBucket: 0,
    }),
    "yookassa",
  );
  assert.equal(
    decidePaymentProvider({
      email: " AZAROV.MAXIM@gmail.com ",
      canaryEmails,
      envProvider: "yookassa",
      rolloutEnabled: false,
      rolloutBps: 0,
      assignmentBucket: 9999,
    }),
    "robokassa",
  );
  assert.equal(
    decidePaymentProvider({
      email: "customer@example.com",
      canaryEmails,
      envProvider: "yookassa",
      rolloutEnabled: true,
      rolloutBps: 5000,
      assignmentBucket: 4999,
    }),
    "robokassa",
  );
  assert.equal(
    decidePaymentProvider({
      email: "customer@example.com",
      canaryEmails,
      envProvider: "yookassa",
      rolloutEnabled: true,
      rolloutBps: 5000,
      assignmentBucket: 5000,
    }),
    "yookassa",
  );
  assert.equal(
    decidePaymentProvider({
      email: "customer@example.com",
      canaryEmails,
      envProvider: "yookassa",
      rolloutEnabled: false,
      rolloutBps: 5000,
      assignmentBucket: 0,
    }),
    "yookassa",
  );
});

test("hashAuthUserBucket is stable and in 0..9999", () => {
  const first = hashAuthUserBucket("user-1", PAYMENT_ROBOKASSA_FEATURE_KEY);
  const second = hashAuthUserBucket("user-1", PAYMENT_ROBOKASSA_FEATURE_KEY);
  assert.equal(first, second);
  assert.ok(first >= 0 && first <= 9999);
  assert.notEqual(
    first,
    hashAuthUserBucket("user-2", PAYMENT_ROBOKASSA_FEATURE_KEY),
  );
});

test("parse helpers sanitize emails and clamp bps", () => {
  assert.deepEqual(parseEmailList(" A@x.com, b@y.com ;C@z.com\n"), [
    "a@x.com",
    "b@y.com",
    "c@z.com",
  ]);
  assert.equal(parseRolloutBps("5000"), 5000);
  assert.equal(parseRolloutBps(12000), 10000);
  assert.equal(parseRolloutBps(-1), 0);
  assert.equal(parseRolloutBps("nope"), 0);
});

function createResolveSupabase(input: {
  unpaid?: {
    yookassa?: Record<string, unknown> | null;
    robokassa?: Record<string, unknown> | null;
  };
  rollout?: { enabled: boolean; rollout_bps: number } | null;
  canary?: string;
  assignment?: { bucket: number } | null;
  insertError?: { message: string; code?: string } | null;
}) {
  const inserts: unknown[] = [];
  return {
    inserts,
    from(table: string) {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        async maybeSingle() {
          if (table === "landing_yookassa_payments") {
            return { data: input.unpaid?.yookassa ?? null, error: null };
          }
          if (table === "landing_robokassa_payments") {
            return { data: input.unpaid?.robokassa ?? null, error: null };
          }
          if (table === "landing_feature_rollouts") {
            return { data: input.rollout ?? null, error: null };
          }
          if (table === "landing_generation_config") {
            return { data: { value: input.canary ?? "" }, error: null };
          }
          if (table === "landing_user_feature_assignments") {
            return { data: input.assignment ?? null, error: null };
          }
          return { data: null, error: null };
        },
        async insert(row: unknown) {
          inserts.push(row);
          return { error: input.insertError ?? null };
        },
      };
      return query;
    },
  };
}

test("resolvePaymentProvider uses unpaid pin and falls back to YooKassa on error", async () => {
  const previous = process.env.PAYMENT_PROVIDER;
  const previousCanary = process.env.ROBOKASSA_CANARY_EMAILS;
  try {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.ROBOKASSA_CANARY_EMAILS;
    const pinned = await resolvePaymentProvider({
      supabase: createResolveSupabase({
        unpaid: {
          yookassa: {
            id: "yk-1",
            plan_id: "trial",
            credits: 70,
            created_at: new Date().toISOString(),
            credited_at: null,
            status: "canceled",
          },
        },
      }) as never,
      authUserId: "user-1",
      email: "customer@example.com",
    });
    assert.equal(pinned, "yookassa");

    const canary = await resolvePaymentProvider({
      supabase: createResolveSupabase({
        canary: "azarov.maxim@gmail.com",
        rollout: { enabled: false, rollout_bps: 0 },
      }) as never,
      authUserId: "user-1",
      email: "azarov.maxim@gmail.com",
    });
    assert.equal(canary, "robokassa");

    const treatment = await resolvePaymentProvider({
      supabase: createResolveSupabase({
        rollout: { enabled: true, rollout_bps: 5000 },
        assignment: { bucket: 100 },
      }) as never,
      authUserId: "user-1",
      email: "customer@example.com",
    });
    assert.equal(treatment, "robokassa");

    const control = await resolvePaymentProvider({
      supabase: createResolveSupabase({
        rollout: { enabled: true, rollout_bps: 5000 },
        assignment: { bucket: 9000 },
      }) as never,
      authUserId: "user-1",
      email: "customer@example.com",
    });
    assert.equal(control, "yookassa");

    const failed = await resolvePaymentProvider({
      supabase: {
        from() {
          throw new Error("db down");
        },
      } as never,
      authUserId: "user-1",
      email: "customer@example.com",
    });
    assert.equal(failed, "yookassa");
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous;
    if (previousCanary === undefined) delete process.env.ROBOKASSA_CANARY_EMAILS;
    else process.env.ROBOKASSA_CANARY_EMAILS = previousCanary;
  }
});
