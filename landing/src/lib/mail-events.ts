import { normalizeMailEmail } from "@/lib/mail-email";

export type MailSuppressionReason = "hard_bounce" | "complaint" | "invalid";

export type ParsedMailEvent = {
  email: string;
  reason: MailSuppressionReason;
  source: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectEmails(value: unknown): string[] {
  if (typeof value === "string") {
    const email = normalizeMailEmail(value);
    return email ? [email] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return collectEmails(item);
      const row = asRecord(item);
      if (!row) return [];
      return collectEmails(row.emailAddress ?? row.email ?? row.EmailAddress);
    });
  }
  return [];
}

function eventName(payload: Record<string, unknown>): string {
  const raw = payload.eventType ?? payload.notificationType ?? payload.event ?? payload.type;
  return String(raw || "").trim().toLowerCase();
}

function bounceReason(payload: Record<string, unknown>): MailSuppressionReason | null {
  const bounce = asRecord(payload.bounce);
  const bounceType = String(bounce?.bounceType ?? bounce?.bounce_type ?? "").toLowerCase();
  if (bounceType === "transient" || bounceType === "temporary") return null;
  return "hard_bounce";
}

export function parsePostboxEvents(payload: unknown): ParsedMailEvent[] {
  const root = asRecord(payload);
  if (!root) return [];
  const records = Array.isArray(root.Records)
    ? root.Records.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : [root];
  const events: ParsedMailEvent[] = [];

  for (const record of records) {
    const body = typeof record.body === "string"
      ? asRecord(safeJson(record.body)) ?? record
      : record;
    const name = eventName(body);
    const mail = asRecord(body.mail);
    const destinations = collectEmails(mail?.destination);

    if (name.includes("complaint")) {
      const complained = collectEmails(asRecord(body.complaint)?.complainedRecipients);
      for (const email of complained.length ? complained : destinations) {
        events.push({ email, reason: "complaint", source: "postbox_complaint" });
      }
      continue;
    }

    if (name.includes("bounce")) {
      const reason = bounceReason(body);
      if (!reason) continue;
      const bounced = collectEmails(asRecord(body.bounce)?.bouncedRecipients);
      for (const email of bounced.length ? bounced : destinations) {
        events.push({ email, reason, source: "postbox_bounce" });
      }
    }
  }

  return events;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function authorizePostboxWebhook(request: Request, secret = process.env.POSTBOX_WEBHOOK_SECRET || ""): boolean {
  const expected = secret.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const alt = request.headers.get("x-postbox-secret")?.trim() ?? "";
  return header === `Bearer ${expected}` || alt === expected;
}
