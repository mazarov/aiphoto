import assert from "node:assert/strict";
import test from "node:test";
import { createCircuitBreaker } from "./visual-search-circuit";
import { enqueueTokensCreditedMail, processMailOutbox, type MailRpcClient } from "./mail-outbox";

function rpcClient(handlers: Record<string, (args?: Record<string, unknown>) => unknown>): MailRpcClient {
  return {
    async rpc(fn, args) {
      if (!(fn in handlers)) return { data: null, error: { message: `missing ${fn}` } };
      return { data: handlers[fn](args), error: null };
    },
  };
}

const job = {
  outbox_id: "out-1",
  kind: "transactional" as const,
  template_id: "welcome" as const,
  to_email: "user@example.com",
  shared_user_id: "user-1",
  campaign_id: null,
  payload: { display_name: "Максим" },
  lease_token: "lease-1",
  attempt_count: 1,
  max_attempts: 5,
};

test("tokens credited key is provider + payment id", async () => {
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const supabase = rpcClient({
    landing_mail_resolve_email: () => "user@example.com",
    landing_enqueue_mail: (args) => {
      calls.push({ fn: "landing_enqueue_mail", args });
      return { outbox_id: "out-1", inserted: true, skip_reason: null };
    },
  });
  const result = await enqueueTokensCreditedMail(supabase, {
    provider: "yookassa",
    paymentId: "pay-1",
    authUserId: "auth-1",
    landingUserId: "land-1",
    planId: "start",
    credits: 100,
  });
  assert.equal(result.inserted, true);
  assert.equal(calls[0]?.args?.p_idempotency_key, "yookassa_credited:pay-1");
  assert.equal(calls[0]?.args?.p_template_id, "tokens_credited");
});

test("processMailOutbox sends claimed jobs and honors allowlist + circuit", async () => {
  const calls: string[] = [];
  const supabase = rpcClient({
    claim_mail_outbox: () => [job],
    landing_mail_skip_reason: () => null,
    complete_mail_outbox: () => {
      calls.push("complete");
      return true;
    },
    skip_mail_outbox: (args) => {
      calls.push(`skip:${args?.p_reason}`);
      return true;
    },
    retry_mail_outbox: () => {
      calls.push("retry");
      return "pending";
    },
  });
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ MessageId: "msg-1" }), { status: 200 });
  const sent = await processMailOutbox({
    supabase,
    fetchImpl,
    config: {
      endpoint: "https://postbox.cloud.yandex.net",
      region: "ru-central1",
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      from: "noreply@promptshot.ru",
      replyTo: "support_ru@promptshot.ru",
    },
    allowlist: [],
    sleep: async () => undefined,
  });
  assert.equal(sent.sent, 1);
  assert.deepEqual(calls, ["complete"]);

  const skipped = await processMailOutbox({
    supabase,
    fetchImpl,
    config: {
      endpoint: "https://postbox.cloud.yandex.net",
      region: "ru-central1",
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      from: "noreply@promptshot.ru",
      replyTo: "support_ru@promptshot.ru",
    },
    allowlist: ["other@example.com"],
    sleep: async () => undefined,
  });
  assert.equal(skipped.skipped, 1);
  assert.equal(calls.at(-1), "skip:allowlist");

  const open = createCircuitBreaker({ failureThreshold: 1, windowMs: 60_000, openMs: 60_000 });
  open.failure(1_000);
  const blocked = await processMailOutbox({
    supabase,
    fetchImpl,
    config: {
      endpoint: "https://postbox.cloud.yandex.net",
      region: "ru-central1",
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      from: "noreply@promptshot.ru",
      replyTo: "support_ru@promptshot.ru",
    },
    circuit: open,
    now: () => 1_100,
    allowlist: [],
    sleep: async () => undefined,
    random: () => 0.5,
  });
  assert.equal(blocked.retried, 1);
  assert.equal(calls.at(-1), "retry");
});
