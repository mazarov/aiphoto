import assert from "node:assert/strict";
import test from "node:test";
import { processMailDue } from "./mail-due";
import type { MailRpcClient } from "./mail-outbox";

function rpcClient(handlers: Record<string, (args?: Record<string, unknown>) => unknown>): MailRpcClient {
  return {
    async rpc(fn, args) {
      if (!(fn in handlers)) return { data: null, error: { message: `missing ${fn}` } };
      return { data: handlers[fn](args), error: null };
    },
  };
}

const dueJob = {
  due_id: "due-1",
  shared_user_id: "user-1",
  template_id: "no_credits",
  subject_key: "user-1",
  payload: { idempotency_key: "no_credits:user-1" },
  lease_token: "lease-1",
  due_at: new Date().toISOString(),
};

test("due processor skips no_credits without a credit-block fact", async () => {
  const calls: string[] = [];
  const supabase = rpcClient({
    claim_mail_due: () => [dueJob],
    landing_mail_user_facts: () => ({
      shared_user_id: "user-1",
      has_credit_block: false,
      has_yookassa_row: false,
      has_credited: false,
    }),
    complete_mail_due: (args) => {
      calls.push(String(args?.p_reason));
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.skipped, 1);
  assert.deepEqual(calls, ["no_credits_stop"]);
});

test("due processor cancels 5m abandon when flag is off", async () => {
  const calls: string[] = [];
  const supabase = rpcClient({
    claim_mail_due: () => [
      {
        ...dueJob,
        template_id: "yk_abandon_5m",
        subject_key: "pay-1",
        payload: { idempotency_key: "yk_abandon_5m:pay-1", plan_id: "trial" },
      },
    ],
    landing_mail_config_on: () => false,
    complete_mail_due: (args) => {
      calls.push(String(args?.p_reason));
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.skipped, 1);
  assert.deepEqual(calls, ["flag_off"]);
});

test("due processor upserts grant before abandon enqueue", async () => {
  const calls: string[] = [];
  const supabase = rpcClient({
    claim_mail_due: () => [
      {
        ...dueJob,
        template_id: "yk_abandon_40m",
        subject_key: "pay-1",
        payload: { idempotency_key: "yk_abandon_40m:pay-1", plan_id: "trial" },
      },
    ],
    landing_mail_user_facts: () => ({
      shared_user_id: "user-1",
      display_name: "Максим",
      has_credited: false,
    }),
    landing_upsert_pricing_offer: () => {
      calls.push("grant");
      return { offer_id: "off-1", percent: 10, applied: true };
    },
    landing_mail_resolve_email: () => "user@example.com",
    landing_enqueue_mail: (args) => {
      calls.push(`enqueue:${args?.p_template_id}`);
      return { outbox_id: "out-1", inserted: true, skip_reason: null };
    },
    complete_mail_due: () => {
      calls.push("done");
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.enqueued, 1);
  assert.deepEqual(calls, ["grant", "enqueue:yk_abandon_40m", "done"]);
});

test("due processor grants 25 percent for 60 minutes on 5m abandon", async () => {
  const calls: string[] = [];
  const supabase = rpcClient({
    claim_mail_due: () => [
      {
        ...dueJob,
        template_id: "yk_abandon_5m",
        subject_key: "pay-1",
        payload: { idempotency_key: "yk_abandon_5m:pay-1", plan_id: "trial" },
      },
    ],
    landing_mail_config_on: () => true,
    landing_mail_user_facts: () => ({
      shared_user_id: "user-1",
      display_name: "Максим",
      has_credited: false,
    }),
    landing_upsert_pricing_offer: (args) => {
      calls.push(`grant:${args?.p_percent}:${args?.p_ttl_minutes}`);
      return { offer_id: "off-1", percent: 25, applied: true };
    },
    landing_mail_resolve_email: () => "user@example.com",
    landing_enqueue_mail: (args) => {
      calls.push(`enqueue:${args?.p_template_id}`);
      return { outbox_id: "out-1", inserted: true, skip_reason: null };
    },
    complete_mail_due: () => {
      calls.push("done");
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.enqueued, 1);
  assert.deepEqual(calls, ["grant:25:60", "enqueue:yk_abandon_5m", "done"]);
});

test("due processor sends an eligible low-balance upgrade once", async () => {
  const calls: string[] = [];
  const offerId = "11111111-1111-4111-8111-111111111111";
  const supabase = rpcClient({
    claim_mail_due: () => [
      {
        ...dueJob,
        template_id: "low_balance_upgrade",
        subject_key: offerId,
        payload: {
          offer_id: offerId,
          idempotency_key: `low_balance_upgrade:${offerId}`,
          plan_id: "start",
        },
      },
    ],
    landing_mail_config_on: () => true,
    landing_low_balance_upgrade_mail_eligible: () => true,
    landing_mail_user_facts: () => ({
      shared_user_id: "user-1",
      display_name: "Максим",
      credits: 10,
      marketing_sent_today: false,
    }),
    landing_mail_resolve_email: () => "user@example.com",
    landing_enqueue_mail: (args) => {
      calls.push(`enqueue:${args?.p_template_id}`);
      return { outbox_id: "out-1", inserted: true, skip_reason: null };
    },
    landing_record_pricing_offer_event: (args) => {
      calls.push(String(args?.p_event));
      return true;
    },
    complete_mail_due: () => {
      calls.push("done");
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.enqueued, 1);
  assert.deepEqual(calls, ["enqueue:low_balance_upgrade", "email", "done"]);
});

test("due processor stops low-balance mail after eligibility is lost", async () => {
  const reasons: string[] = [];
  const offerId = "11111111-1111-4111-8111-111111111111";
  const supabase = rpcClient({
    claim_mail_due: () => [
      {
        ...dueJob,
        template_id: "low_balance_upgrade",
        subject_key: offerId,
        payload: { offer_id: offerId },
      },
    ],
    landing_mail_config_on: () => true,
    landing_low_balance_upgrade_mail_eligible: () => false,
    complete_mail_due: (args) => {
      reasons.push(String(args?.p_reason));
      return true;
    },
  });
  const result = await processMailDue({ supabase });
  assert.equal(result.skipped, 1);
  assert.deepEqual(reasons, ["upgrade_ineligible"]);
});
