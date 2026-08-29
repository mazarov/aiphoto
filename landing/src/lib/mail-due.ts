import {
  evaluateMailDue,
  mailOutboxKey,
  parseMailUserFacts,
  type MailUserFacts,
} from "@/lib/mail-catalog";
import { resolveAndEnqueueMail, type MailRpcClient } from "@/lib/mail-outbox";
import { isMailTemplateId, type MailTemplateId } from "@/lib/mail-templates";

export type ClaimedMailDue = {
  due_id: string;
  shared_user_id: string;
  template_id: string;
  subject_key: string;
  payload: Record<string, unknown>;
  lease_token: string;
  due_at: string;
};

const DAILY_CAP_REASONS = new Set(["marketing_daily_cap", "winback_daily_cap"]);

function asDueRows(value: unknown): ClaimedMailDue[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is ClaimedMailDue => {
    if (!row || typeof row !== "object") return false;
    const data = row as Record<string, unknown>;
    return (
      typeof data.due_id === "string" &&
      typeof data.shared_user_id === "string" &&
      typeof data.template_id === "string" &&
      typeof data.lease_token === "string"
    );
  });
}

async function loadFacts(
  supabase: MailRpcClient,
  userId: string,
): Promise<MailUserFacts> {
  const { data, error } = await supabase.rpc("landing_mail_user_facts", {
    p_shared_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return parseMailUserFacts(data, userId);
}

export async function processMailDue(options: {
  supabase: MailRpcClient;
  limit?: number;
  leaseSeconds?: number;
}): Promise<{
  claimed: number;
  enqueued: number;
  skipped: number;
  rescheduled: number;
  released: number;
}> {
  const { data, error } = await options.supabase.rpc("claim_mail_due", {
    p_limit: options.limit ?? 8,
    p_lease_seconds: options.leaseSeconds ?? 120,
  });
  if (error) throw new Error(error.message);

  const jobs = asDueRows(data);
  const seen = new Set<string>();
  let enqueued = 0;
  let skipped = 0;
  let rescheduled = 0;
  let released = 0;

  for (const job of jobs) {
    if (seen.has(job.shared_user_id)) {
      await options.supabase.rpc("release_mail_due", {
        p_due_id: job.due_id,
        p_lease_token: job.lease_token,
      });
      released += 1;
      continue;
    }
    seen.add(job.shared_user_id);

    if (!isMailTemplateId(job.template_id)) {
      await options.supabase.rpc("complete_mail_due", {
        p_due_id: job.due_id,
        p_lease_token: job.lease_token,
        p_status: "cancelled",
        p_reason: "unknown_template",
      });
      skipped += 1;
      continue;
    }

    const templateId = job.template_id as MailTemplateId;
    if (templateId === "yk_abandon_5m") {
      const { data: flagOn, error: flagError } = await options.supabase.rpc(
        "landing_mail_config_on",
        { p_key: "yk_abandon_5m_enabled" },
      );
      if (flagError) throw new Error(flagError.message);
      if (flagOn !== true) {
        await options.supabase.rpc("complete_mail_due", {
          p_due_id: job.due_id,
          p_lease_token: job.lease_token,
          p_status: "cancelled",
          p_reason: "flag_off",
        });
        skipped += 1;
        continue;
      }
    }

    const facts = await loadFacts(options.supabase, job.shared_user_id);
    const decision = evaluateMailDue(templateId, facts);

    if (decision.action === "skip") {
      if (DAILY_CAP_REASONS.has(decision.reason)) {
        const { data: nextAt, error: nextError } = await options.supabase.rpc(
          "landing_mail_next_moscow_midnight",
        );
        if (nextError) throw new Error(nextError.message);
        await options.supabase.rpc("reschedule_mail_due", {
          p_due_id: job.due_id,
          p_lease_token: job.lease_token,
          p_due_at: typeof nextAt === "string" ? nextAt : new Date(Date.now() + 86_400_000).toISOString(),
        });
        rescheduled += 1;
        continue;
      }
      await options.supabase.rpc("complete_mail_due", {
        p_due_id: job.due_id,
        p_lease_token: job.lease_token,
        p_status: "cancelled",
        p_reason: decision.reason,
      });
      skipped += 1;
      continue;
    }

    if (decision.discountPercent > 0) {
      const { data: offer, error: offerError } = await options.supabase.rpc(
        "landing_upsert_pricing_offer",
        {
          p_shared_user_id: facts.sharedUserId,
          p_percent: decision.discountPercent,
          p_source_template_id: templateId,
          p_ttl_days: 7,
          p_ttl_minutes: templateId === "yk_abandon_5m" ? 60 : null,
        },
      );
      const row = Array.isArray(offer) ? offer[0] : offer;
      const applied =
        !offerError &&
        row &&
        typeof row === "object" &&
        (row as { applied?: unknown }).applied === true;
      if (!applied) {
        await options.supabase.rpc("complete_mail_due", {
          p_due_id: job.due_id,
          p_lease_token: job.lease_token,
          p_status: "cancelled",
          p_reason: "no_grant",
        });
        skipped += 1;
        continue;
      }
    }

    const payload = {
      ...(job.payload || {}),
      ...decision.payload,
    };
    const result = await resolveAndEnqueueMail(options.supabase, {
      kind: decision.kind,
      templateId,
      idempotencyKey: mailOutboxKey(templateId, job.subject_key, payload),
      sharedUserId: facts.sharedUserId,
      payload,
    });
    if (result.skipReason && result.skipReason !== "enqueue_error") {
      await options.supabase.rpc("complete_mail_due", {
        p_due_id: job.due_id,
        p_lease_token: job.lease_token,
        p_status: "cancelled",
        p_reason: result.skipReason,
      });
      skipped += 1;
      continue;
    }
    if (result.skipReason === "enqueue_error") {
      await options.supabase.rpc("reschedule_mail_due", {
        p_due_id: job.due_id,
        p_lease_token: job.lease_token,
        p_due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      rescheduled += 1;
      continue;
    }

    await options.supabase.rpc("complete_mail_due", {
      p_due_id: job.due_id,
      p_lease_token: job.lease_token,
      p_status: "done",
      p_reason: result.inserted ? "enqueued" : "duplicate",
    });
    enqueued += 1;
  }

  return {
    claimed: jobs.length,
    enqueued,
    skipped,
    rescheduled,
    released,
  };
}
