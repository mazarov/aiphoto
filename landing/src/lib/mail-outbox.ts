import { hashMailEmail, isValidMailEmail, parseMailAllowlist } from "@/lib/mail-email";
import { mailRetryDelaySeconds } from "@/lib/mail-retry";
import {
  renderMailTemplate,
  type MailTemplateId,
} from "@/lib/mail-templates";
import { getPostboxConfig, sendPostboxEmail, type PostboxConfig } from "@/lib/postbox";
import { createCircuitBreaker, type CircuitBreaker } from "@/lib/visual-search-circuit";

export type MailKind = "transactional" | "marketing";

export type MailRpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type MailEnqueueInput = {
  kind: MailKind;
  templateId: MailTemplateId;
  idempotencyKey: string;
  toEmail?: string | null;
  authUserId?: string | null;
  sharedUserId?: string | null;
  campaignId?: string | null;
  payload?: Record<string, unknown>;
};

export type MailEnqueueResult = {
  outboxId: string | null;
  inserted: boolean;
  skipReason: string | null;
};

export type ClaimedMailJob = {
  outbox_id: string;
  kind: MailKind;
  template_id: MailTemplateId;
  to_email: string;
  shared_user_id: string | null;
  campaign_id: string | null;
  payload: Record<string, unknown>;
  lease_token: string;
  attempt_count: number;
  max_attempts: number;
};

const MIN_SEND_GAP_MS = 1100;
const mailCircuit = createCircuitBreaker({
  failureThreshold: 3,
  windowMs: 60_000,
  openMs: 60_000,
});

function asEnqueueRow(value: unknown): MailEnqueueResult {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    return { outboxId: null, inserted: false, skipReason: "empty" };
  }
  const data = row as Record<string, unknown>;
  return {
    outboxId: typeof data.outbox_id === "string" ? data.outbox_id : null,
    inserted: data.inserted === true,
    skipReason: typeof data.skip_reason === "string" ? data.skip_reason : null,
  };
}

export async function enqueueMail(
  supabase: MailRpcClient,
  input: MailEnqueueInput,
): Promise<MailEnqueueResult> {
  const { data, error } = await supabase.rpc("landing_enqueue_mail", {
    p_kind: input.kind,
    p_template_id: input.templateId,
    p_idempotency_key: input.idempotencyKey,
    p_to_email: input.toEmail || null,
    p_shared_user_id: input.sharedUserId || null,
    p_campaign_id: input.campaignId || null,
    p_payload: input.payload || {},
  });
  if (error) throw new Error(error.message);
  return asEnqueueRow(data);
}

export async function resolveAndEnqueueMail(
  supabase: MailRpcClient,
  input: MailEnqueueInput,
): Promise<MailEnqueueResult> {
  try {
    let toEmail = input.toEmail || null;
    if (!isValidMailEmail(toEmail)) {
      const { data, error } = await supabase.rpc("landing_mail_resolve_email", {
        p_auth_user_id: input.authUserId || null,
        p_shared_user_id: input.sharedUserId || null,
      });
      if (error) throw new Error(error.message);
      toEmail = typeof data === "string" ? data : null;
    }
    if (!isValidMailEmail(toEmail)) {
      return { outboxId: null, inserted: false, skipReason: "no_email" };
    }
    return await enqueueMail(supabase, { ...input, toEmail });
  } catch (error) {
    console.warn("[mail] enqueue failed", {
      templateId: input.templateId,
      key: input.idempotencyKey,
      message: error instanceof Error ? error.message : String(error),
    });
    return { outboxId: null, inserted: false, skipReason: "enqueue_error" };
  }
}

export async function enqueueTokensCreditedMail(
  supabase: MailRpcClient,
  input: {
    provider: "yookassa" | "robokassa";
    paymentId: string;
    authUserId: string;
    landingUserId: string;
    planId: string;
    credits: number;
  },
): Promise<MailEnqueueResult> {
  return resolveAndEnqueueMail(supabase, {
    kind: "transactional",
    templateId: "tokens_credited",
    idempotencyKey: `${input.provider}_credited:${input.paymentId}`,
    authUserId: input.authUserId,
    sharedUserId: input.landingUserId,
    payload: {
      plan_id: input.planId,
      credits: input.credits,
    },
  });
}

export async function enqueueWelcomeMail(
  supabase: MailRpcClient,
  input: {
    authUserId: string;
    sharedUserId: string;
    email?: string | null;
    displayName?: string | null;
  },
): Promise<MailEnqueueResult> {
  return resolveAndEnqueueMail(supabase, {
    kind: "transactional",
    templateId: "welcome",
    idempotencyKey: `welcome:${input.sharedUserId}`,
    toEmail: input.email,
    authUserId: input.authUserId,
    sharedUserId: input.sharedUserId,
    payload: {
      display_name: input.displayName || null,
    },
  });
}

export function scheduleWelcomeMail(
  supabase: MailRpcClient,
  input: {
    authUserId: string;
    sharedUserId: string;
    email?: string | null;
    displayName?: string | null;
  },
): void {
  void enqueueWelcomeMail(supabase, input).catch((error) => {
    console.warn("[mail] welcome enqueue failed", {
      userId: input.sharedUserId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function processMailOutbox(options: {
  supabase: MailRpcClient;
  limit?: number;
  leaseSeconds?: number;
  fetchImpl?: typeof fetch;
  config?: PostboxConfig | null;
  circuit?: CircuitBreaker;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  allowlist?: string[];
}): Promise<{
  configured: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
  circuitOpen: boolean;
}> {
  const config = options.config === undefined ? getPostboxConfig() : options.config;
  if (!config) {
    return {
      configured: false,
      claimed: 0,
      sent: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      circuitOpen: false,
    };
  }

  const { data, error } = await options.supabase.rpc("claim_mail_outbox", {
    p_limit: options.limit ?? 8,
    p_lease_seconds: options.leaseSeconds ?? 120,
  });
  if (error) throw new Error(error.message);

  const jobs = (Array.isArray(data) ? data : []) as ClaimedMailJob[];
  const circuit = options.circuit ?? mailCircuit;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const allowlist = options.allowlist ?? parseMailAllowlist(process.env.POSTBOX_TEST_ALLOWLIST);
  let sent = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;
  let lastSendAt = 0;

  for (const job of jobs) {
    const now = options.now?.() ?? Date.now();
    if (!circuit.allow(now)) {
      const status = await retryJob(options.supabase, job, "circuit_open", options.random);
      if (status === "failed") failed += 1;
      else retried += 1;
      continue;
    }

    const { data: skipReason, error: skipError } = await options.supabase.rpc(
      "landing_mail_skip_reason",
      { p_email: job.to_email, p_kind: job.kind },
    );
    if (skipError) throw new Error(skipError.message);
    if (typeof skipReason === "string" && skipReason) {
      await options.supabase.rpc("skip_mail_outbox", {
        p_outbox_id: job.outbox_id,
        p_lease_token: job.lease_token,
        p_reason: skipReason,
      });
      skipped += 1;
      continue;
    }

    if (allowlist.length > 0 && !allowlist.includes(job.to_email)) {
      await options.supabase.rpc("skip_mail_outbox", {
        p_outbox_id: job.outbox_id,
        p_lease_token: job.lease_token,
        p_reason: "allowlist",
      });
      console.info("[mail] skipped allowlist", { hash: hashMailEmail(job.to_email) });
      skipped += 1;
      continue;
    }

    const elapsed = now - lastSendAt;
    if (lastSendAt > 0 && elapsed < MIN_SEND_GAP_MS) {
      await sleep(MIN_SEND_GAP_MS - elapsed);
    }

    const rendered = renderMailTemplate(job.template_id, job.payload || {}, job.to_email);
    const result = await sendPostboxEmail(
      config,
      job.to_email,
      rendered,
      options.fetchImpl,
    );
    lastSendAt = options.now?.() ?? Date.now();

    if (result.ok) {
      circuit.success(lastSendAt);
      await options.supabase.rpc("complete_mail_outbox", {
        p_outbox_id: job.outbox_id,
        p_lease_token: job.lease_token,
        p_provider_message_id: result.messageId,
      });
      sent += 1;
      continue;
    }

    circuit.failure(lastSendAt);
    if (!result.retryable) {
      await options.supabase.rpc("skip_mail_outbox", {
        p_outbox_id: job.outbox_id,
        p_lease_token: job.lease_token,
        p_reason: result.code,
      });
      skipped += 1;
      continue;
    }

    const status = await retryJob(options.supabase, job, result.code, options.random);
    if (status === "failed") failed += 1;
    else retried += 1;
  }

  return {
    configured: true,
    claimed: jobs.length,
    sent,
    skipped,
    retried,
    failed,
    circuitOpen: circuit.state(options.now?.() ?? Date.now()) === "open",
  };
}

async function retryJob(
  supabase: MailRpcClient,
  job: ClaimedMailJob,
  code: string,
  random?: () => number,
): Promise<string> {
  const { data, error } = await supabase.rpc("retry_mail_outbox", {
    p_outbox_id: job.outbox_id,
    p_lease_token: job.lease_token,
    p_error_code: code,
    p_delay_seconds: mailRetryDelaySeconds(job.attempt_count, random),
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : "pending";
}
