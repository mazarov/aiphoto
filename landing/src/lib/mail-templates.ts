import { mailOneClickUnsubscribeUrl, mailUnsubscribeUrl } from "@/lib/mail-unsubscribe";

export const MAIL_PLAN_LABELS: Record<string, string> = {
  trial: "Проба",
  start: "Старт",
  pro: "Про",
  max: "Максимум",
};

export type MailTemplateId = "tokens_credited" | "welcome" | "campaign";

export type RenderedMail = {
  subject: string;
  text: string;
  html: string;
  headers: Array<{ Name: string; Value: string }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greeting(displayName: string | null | undefined): string {
  const name = String(displayName || "").trim();
  return name ? `Здравствуйте, ${name}!` : "Здравствуйте!";
}

function signature(): string {
  return "—\nКоманда PromptShot\nhttps://promptshot.ru";
}

function wrapHtml(body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b">${body.replace(/\n/g, "<br/>")}</body></html>`;
}

function marketingHeaders(email: string): Array<{ Name: string; Value: string }> {
  const url = mailOneClickUnsubscribeUrl(email);
  if (!url) return [];
  return [
    { Name: "List-Unsubscribe", Value: `<${url}>` },
    { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
  ];
}

export function planLabel(planId: string | null | undefined): string {
  const key = String(planId || "").trim().toLowerCase();
  return MAIL_PLAN_LABELS[key] || planId || "пакет";
}

export function renderMailTemplate(
  templateId: MailTemplateId,
  payload: Record<string, unknown>,
  toEmail: string,
): RenderedMail {
  if (templateId === "tokens_credited") {
    const subject = "Токены PromptShot зачислены";
    const text = [
      greeting(typeof payload.display_name === "string" ? payload.display_name : null),
      "",
      `Спасибо, что оплатили пакет «${planLabel(typeof payload.plan_id === "string" ? payload.plan_id : null)}» в PromptShot.`,
      "",
      `Токены (${typeof payload.credits === "number" ? payload.credits : payload.credits || "—"}) уже на вашем аккаунте.`,
      "",
      "Проверить баланс: https://promptshot.ru/pricing",
      "",
      "Если что-то выглядит не так — ответьте на это письмо, поможем.",
      "",
      signature(),
    ].join("\n");
    return { subject, text, html: wrapHtml(escapeHtml(text)), headers: [] };
  }

  if (templateId === "welcome") {
    const subject = "Добро пожаловать в PromptShot";
    const text = [
      greeting(typeof payload.display_name === "string" ? payload.display_name : null),
      "",
      "Вы зарегистрировались в PromptShot — каталоге промтов и генерации фото.",
      "",
      "Открыть сервис: https://promptshot.ru",
      "Тарифы и токены: https://promptshot.ru/pricing",
      "",
      "Если письмо пришло по ошибке — просто игнорируйте его.",
      "",
      signature(),
    ].join("\n");
    return { subject, text, html: wrapHtml(escapeHtml(text)), headers: [] };
  }

  const subject =
    (typeof payload.subject === "string" && payload.subject.trim()) || "Письмо PromptShot";
  const body =
    (typeof payload.body_text === "string" && payload.body_text.trim()) || "";
  const unsubscribe = mailUnsubscribeUrl(toEmail);
  const text = [
    greeting(typeof payload.display_name === "string" ? payload.display_name : null),
    "",
    body,
    "",
    `Отписаться от рассылок: ${unsubscribe}`,
    "",
    signature(),
  ].join("\n");
  return {
    subject,
    text,
    html: wrapHtml(escapeHtml(text)),
    headers: marketingHeaders(toEmail),
  };
}
