import { aws4SignHeaders } from "@/lib/aws4";
import type { RenderedMail } from "@/lib/mail-templates";

export type PostboxConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string;
  replyTo: string;
};

export type PostboxSendResult =
  | { ok: true; messageId: string }
  | { ok: false; status: number; retryable: boolean; code: string };

export function getPostboxConfig(): PostboxConfig | null {
  const endpoint = (process.env.POSTBOX_ENDPOINT || "https://postbox.cloud.yandex.net").replace(/\/+$/, "");
  const region = (process.env.POSTBOX_REGION || "ru-central1").trim();
  const accessKeyId = (process.env.POSTBOX_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.POSTBOX_SECRET_ACCESS_KEY || "").trim();
  const from = (process.env.POSTBOX_FROM || "noreply@promptshot.ru").trim();
  const replyTo = (process.env.POSTBOX_REPLY_TO || "support_ru@promptshot.ru").trim();
  if (!accessKeyId || !secretAccessKey || !from) return null;
  return { endpoint, region, accessKeyId, secretAccessKey, from, replyTo };
}

export function buildPostboxSendEmailBody(
  config: Pick<PostboxConfig, "from" | "replyTo">,
  toEmail: string,
  rendered: RenderedMail,
): string {
  return JSON.stringify({
    FromEmailAddress: config.from,
    ReplyToAddresses: [config.replyTo],
    Destination: { ToAddresses: [toEmail] },
    Content: {
      Simple: {
        Subject: { Data: rendered.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: rendered.text, Charset: "UTF-8" },
          Html: { Data: rendered.html, Charset: "UTF-8" },
        },
        ...(rendered.headers.length > 0 ? { Headers: rendered.headers } : {}),
      },
    },
  });
}

export async function sendPostboxEmail(
  config: PostboxConfig,
  toEmail: string,
  rendered: RenderedMail,
  fetchImpl: typeof fetch = fetch,
): Promise<PostboxSendResult> {
  const url = new URL("/v2/email/outbound-emails", `${config.endpoint}/`);
  const body = buildPostboxSendEmailBody(config, toEmail, rendered);
  const headers = aws4SignHeaders({
    method: "POST",
    url,
    region: config.region,
    service: "ses",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    body,
  });
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let messageId = "";
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && typeof parsed.MessageId === "string") messageId = parsed.MessageId;
    } catch {
      messageId = "";
    }
    if (response.ok) {
      return { ok: true, messageId: messageId || "unknown" };
    }
    return {
      ok: false,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      code: `http_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      retryable: true,
      code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network",
    };
  }
}
