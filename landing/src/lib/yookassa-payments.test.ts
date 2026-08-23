import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPEN_RECONCILE_LIMIT,
  DEFAULT_STALE_OLDER_THAN_MINUTES,
  OPEN_RECONCILE_COOLDOWN_MS,
  pickAlreadyCreditedOpenPayment,
  reconcileOpenYooKassaPaymentsForAuthUser,
  type ReconcileResult,
} from "./yookassa-payments";

type OpenRow = {
  id: string;
  plan_id: string;
  credits: number;
  yookassa_payment_id: string | null;
};

function createQuery(result: { data: OpenRow[] | null; error: { message: string } | null }) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    in() {
      return query;
    },
    not() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    then(
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

function createSupabase(rows: OpenRow[]) {
  return {
    from(table: string) {
      assert.equal(table, "landing_yookassa_payments");
      return createQuery({ data: rows, error: null });
    },
  };
}

function creditedResult(paymentId: string): ReconcileResult {
  return {
    paymentId,
    status: "succeeded",
    credited: true,
    creditsAfter: 30,
  };
}

test("stale cron default is one minute", () => {
  assert.equal(DEFAULT_STALE_OLDER_THAN_MINUTES, 1);
  assert.equal(DEFAULT_OPEN_RECONCILE_LIMIT, 5);
  assert.equal(OPEN_RECONCILE_COOLDOWN_MS, 15_000);
});

test("open reconcile is a no-op when the user has no provider-backed rows", async () => {
  const calls: string[] = [];
  const summary = await reconcileOpenYooKassaPaymentsForAuthUser(
    createSupabase([]) as never,
    "auth-1",
    {
      source: "open",
      skipCooldown: true,
      reconcilePayment: async (_supabase, providerPaymentId) => {
        calls.push(providerPaymentId);
        return creditedResult("pay-1");
      },
    },
  );
  assert.deepEqual(summary, { scanned: 0, credited: [], skippedByCooldown: false });
  assert.deepEqual(calls, []);
});

test("open reconcile skips rows without a provider id", async () => {
  const calls: string[] = [];
  const summary = await reconcileOpenYooKassaPaymentsForAuthUser(
    createSupabase([
      {
        id: "local-1",
        plan_id: "trial",
        credits: 30,
        yookassa_payment_id: null,
      },
    ]) as never,
    "auth-1",
    {
      source: "open",
      skipCooldown: true,
      reconcilePayment: async (_supabase, providerPaymentId) => {
        calls.push(providerPaymentId);
        return creditedResult("pay-1");
      },
    },
  );
  assert.equal(summary.scanned, 1);
  assert.deepEqual(summary.credited, []);
  assert.deepEqual(calls, []);
});

test("open reconcile fulfills one succeeded payment", async () => {
  const summary = await reconcileOpenYooKassaPaymentsForAuthUser(
    createSupabase([
      {
        id: "local-1",
        plan_id: "trial",
        credits: 30,
        yookassa_payment_id: "yk-1",
      },
    ]) as never,
    "auth-1",
    {
      source: "create",
      reconcilePayment: async () => creditedResult("local-1"),
    },
  );
  assert.equal(summary.scanned, 1);
  assert.deepEqual(summary.credited, [
    {
      paymentId: "local-1",
      planId: "trial",
      credits: 30,
      creditsAfter: 30,
    },
  ]);
});

test("open reconcile caps provider lookups at five", async () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: `local-${index}`,
    plan_id: "trial",
    credits: 30,
    yookassa_payment_id: `yk-${index}`,
  }));
  const calls: string[] = [];
  await reconcileOpenYooKassaPaymentsForAuthUser(
    createSupabase(rows) as never,
    "auth-1",
    {
      source: "open",
      skipCooldown: true,
      limit: 50,
      reconcilePayment: async (_supabase, providerPaymentId) => {
        calls.push(providerPaymentId);
        return {
          paymentId: providerPaymentId,
          status: "pending",
          credited: false,
          creditsAfter: null,
        };
      },
    },
  );
  assert.equal(calls.length, 5);
});

test("open reconcile cooldown skips a second call for the same user", async () => {
  const store = new Map<string, number>();
  const supabase = createSupabase([
    {
      id: "local-1",
      plan_id: "trial",
      credits: 30,
      yookassa_payment_id: "yk-1",
    },
  ]);
  const first = await reconcileOpenYooKassaPaymentsForAuthUser(
    supabase as never,
    "auth-1",
    {
      source: "open",
      nowMs: 1_000,
      cooldownStore: store,
      reconcilePayment: async () => creditedResult("local-1"),
    },
  );
  const second = await reconcileOpenYooKassaPaymentsForAuthUser(
    supabase as never,
    "auth-1",
    {
      source: "open",
      nowMs: 5_000,
      cooldownStore: store,
      reconcilePayment: async () => {
        throw new Error("should not run");
      },
    },
  );
  assert.equal(first.skippedByCooldown, false);
  assert.equal(first.credited.length, 1);
  assert.deepEqual(second, { scanned: 0, credited: [], skippedByCooldown: true });
});

test("create path can pick the credited payment for the same plan", () => {
  const credited = pickAlreadyCreditedOpenPayment(
    [
      {
        paymentId: "start-1",
        planId: "start",
        credits: 100,
        creditsAfter: 100,
      },
      {
        paymentId: "trial-1",
        planId: "trial",
        credits: 30,
        creditsAfter: 30,
      },
    ],
    "trial",
  );
  assert.equal(credited?.paymentId, "trial-1");
  assert.equal(pickAlreadyCreditedOpenPayment([], "trial"), null);
});
