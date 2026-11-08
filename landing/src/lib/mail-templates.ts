import { mailOneClickUnsubscribeUrl, mailUnsubscribeUrl } from "@/lib/mail-unsubscribe";
import { npsScoreLines } from "@/lib/nps-token";

export const MAIL_PLAN_LABELS: Record<string, string> = {
  trial: "Пробный",
  start: "Оптимальный",
  pro: "Большой",
  max: "Максимум",
};

export const MAIL_TEMPLATE_IDS = [
  "tokens_credited",
  "welcome",
  "campaign",
  "onboard_d1",
  "onboard_d3",
  "onboard_d7",
  "analyze_intent",
  "no_credits",
  "yk_abandon_5m",
  "yk_abandon_40m",
  "yk_abandon_24h",
  "paid_unused",
  "credits_empty",
  "low_balance_upgrade",
  "winback_14",
  "winback_30",
  "nps_after_2",
  "nps_credits_empty",
  "card_repeat_reward",
] as const;

export type MailTemplateId = (typeof MAIL_TEMPLATE_IDS)[number];

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

const MAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const CTA_LINE = /^(.{1,80}?):\s+(https?:\/\/\S+)$/;
const NPS_LINE = /^([1-9]|10)\s+—\s+(https?:\/\/\S+)$/;
const UNSUB_LINE = /^Отписаться от рассылок:\s+(https?:\/\/\S+)$/;
const URL_IN_TEXT = /https?:\/\/[^\s<>]+/g;

type MailBlock =
  | { type: "p"; text: string }
  | { type: "button"; label: string; href: string }
  | { type: "link"; label: string; href: string }
  | { type: "nps"; scores: Array<{ score: string; href: string }> };

function linkify(text: string): string {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const index = match.index ?? 0;
    html += escapeHtml(text.slice(last, index));
    const url = match[0];
    html += `<a href="${escapeHtml(url)}" style="color:#4f46e5;text-decoration:underline;">${escapeHtml(url)}</a>`;
    last = index + url.length;
  }
  html += escapeHtml(text.slice(last));
  return html;
}

function parseMailBlocks(lines: string[]): {
  greeting: string;
  blocks: MailBlock[];
  unsubscribe: string | null;
  signature: string[];
} {
  const flat = lines.join("\n").split("\n");
  const signatureAt = flat.findIndex((line) => line.trim() === "—");
  const head = signatureAt >= 0 ? flat.slice(0, signatureAt) : flat;
  const signature = signatureAt >= 0 ? flat.slice(signatureAt).map((line) => line.trim()).filter(Boolean) : [];

  let greeting = "";
  const body: string[] = [];
  let seen = false;
  for (const line of head) {
    if (!seen) {
      if (!line.trim()) continue;
      greeting = line.trim();
      seen = true;
      continue;
    }
    body.push(line);
  }

  const blocks: MailBlock[] = [];
  let unsubscribe: string | null = null;
  let buttonUsed = false;
  let nps: Array<{ score: string; href: string }> | null = null;

  function flushNps() {
    if (nps && nps.length > 0) blocks.push({ type: "nps", scores: nps });
    nps = null;
  }

  for (const raw of body) {
    const line = raw.trim();
    if (!line) {
      flushNps();
      continue;
    }
    const unsub = line.match(UNSUB_LINE);
    if (unsub) {
      flushNps();
      unsubscribe = unsub[1];
      continue;
    }
    const score = line.match(NPS_LINE);
    if (score) {
      if (!nps) nps = [];
      nps.push({ score: score[1], href: score[2] });
      continue;
    }
    flushNps();
    const cta = line.match(CTA_LINE);
    if (cta) {
      const label = cta[1].trim();
      const href = cta[2];
      if (!buttonUsed) {
        blocks.push({ type: "button", label, href });
        buttonUsed = true;
      } else {
        blocks.push({ type: "link", label, href });
      }
      continue;
    }
    blocks.push({ type: "p", text: line });
  }
  flushNps();

  return { greeting, blocks, unsubscribe, signature };
}

function renderMailBlocks(blocks: MailBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "p") {
        return `<p style="margin:0 0 12px;font-family:${MAIL_FONT};font-size:16px;line-height:1.5;color:#18181b;">${linkify(block.text)}</p>`;
      }
      if (block.type === "button") {
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td bgcolor="#4f46e5" style="border-radius:12px;background:#4f46e5;"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:12px 20px;font-family:${MAIL_FONT};font-size:15px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(block.label)}</a></td></tr></table>`;
      }
      if (block.type === "link") {
        return `<p style="margin:0 0 8px;font-family:${MAIL_FONT};font-size:14px;line-height:1.5;"><a href="${escapeHtml(block.href)}" style="color:#4f46e5;text-decoration:underline;">${escapeHtml(block.label)}</a></p>`;
      }
      const cells = block.scores
        .map(
          (item) =>
            `<td style="padding:0 4px 8px 0;"><a href="${escapeHtml(item.href)}" style="display:inline-block;width:32px;line-height:32px;text-align:center;border-radius:8px;background:#eef2ff;font-family:${MAIL_FONT};font-size:14px;font-weight:600;color:#4f46e5;text-decoration:none;">${escapeHtml(item.score)}</a></td>`,
        )
        .join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;"><tr>${cells}</tr></table>`;
    })
    .join("");
}

function renderMailFooter(signature: string[], unsubscribe: string | null): string {
  const signatureHtml = signature
    .map((line) => {
      if (/^https?:\/\//.test(line)) {
        const label = line.replace(/^https?:\/\//, "");
        return `<a href="${escapeHtml(line)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(label)}</a>`;
      }
      return escapeHtml(line);
    })
    .join("<br/>");
  const signatureBlock = signatureHtml
    ? `<p style="margin:8px 0 0;font-family:${MAIL_FONT};font-size:13px;line-height:1.5;color:#71717a;">${signatureHtml}</p>`
    : "";
  const unsubBlock = unsubscribe
    ? `<p style="margin:8px 0 0;font-family:${MAIL_FONT};font-size:12px;line-height:1.5;"><a href="${escapeHtml(unsubscribe)}" style="color:#a1a1aa;text-decoration:underline;">Отписаться от рассылок</a></p>`
    : "";
  if (!signatureBlock && !unsubBlock) return "";
  return `<tr><td style="padding:0 32px 32px;">${signatureBlock}${unsubBlock}</td></tr>`;
}

function layoutMailHtml(lines: string[], subject: string): string {
  const parsed = parseMailBlocks(lines);
  const greeting = parsed.greeting
    ? `<h1 style="margin:0 0 16px;font-family:${MAIL_FONT};font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">${escapeHtml(parsed.greeting)}</h1>`
    : "";
  const footer = renderMailFooter(parsed.signature, parsed.unsubscribe);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f4f4f5;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border-radius:16px;"><tr><td style="padding:32px 32px 8px;"><p style="margin:0 0 20px;font-family:${MAIL_FONT};font-size:14px;line-height:1.4;font-weight:600;color:#4f46e5;">PromptShot</p>${greeting}${renderMailBlocks(parsed.blocks)}</td></tr>${footer}</table></td></tr></table></body></html>`;
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

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildMail(
  subject: string,
  lines: string[],
  toEmail: string,
  marketing: boolean,
): RenderedMail {
  const text = lines.join("\n");
  return {
    subject,
    text,
    html: layoutMailHtml(lines, subject),
    headers: marketing ? marketingHeaders(toEmail) : [],
  };
}

export function isMailTemplateId(value: string): value is MailTemplateId {
  return (MAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function renderMailTemplate(
  templateId: MailTemplateId,
  payload: Record<string, unknown>,
  toEmail: string,
): RenderedMail {
  const name = payloadString(payload, "display_name");
  const hi = greeting(name);
  const plan = planLabel(payloadString(payload, "plan_id"));
  const credits = payload.credits;
  const creditLabel =
    typeof credits === "number" || typeof credits === "string" ? String(credits) : "—";

  if (templateId === "tokens_credited") {
    return buildMail(
      "Токены PromptShot зачислены",
      [
        hi,
        "",
        `Спасибо, что оплатили пакет «${plan}» в PromptShot.`,
        "",
        `Токены (${creditLabel}) уже на вашем аккаунте.`,
        "",
        "Сделать фото: https://promptshot.ru/generaciya/foto-po-opisaniyu",
        "Баланс: https://promptshot.ru/pricing",
        "",
        "Если что-то выглядит не так — ответьте на это письмо, поможем.",
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "welcome") {
    return buildMail(
      "Добро пожаловать в PromptShot",
      [
        hi,
        "",
        "Каталог промтов можно смотреть и копировать бесплатно.",
        "10 разборов фото в сутки — тоже бесплатно.",
        "Чтобы собрать фото в PromptShot, нужен пакет. Самый маленький — «Пробный».",
        "",
        "Открыть сервис: https://promptshot.ru",
        "Тарифы: https://promptshot.ru/pricing",
        "",
        "Если письмо пришло по ошибке — просто игнорируйте его.",
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "onboard_d1") {
    return buildMail(
      "Как сделать первое фото в PromptShot",
      [
        hi,
        "",
        "Три шага: откройте карточку промта, добавьте своё фото и запустите генерацию.",
        "Если токенов нет — пакет «Пробный» на https://promptshot.ru/pricing",
        "",
        "Начать: https://promptshot.ru/generaciya/foto-po-opisaniyu",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "onboard_d3") {
    return buildMail(
      "Промт, с которого обычно начинают",
      [
        hi,
        "",
        "Откройте одну карточку и соберите кадр со своим фото.",
        "Каталог: https://promptshot.ru",
        "Пакет «Пробный»: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "onboard_d7") {
    return buildMail(
      "−20% на пакеты PromptShot",
      [
        hi,
        "",
        "Семь дней на все пакеты — скидка 20%, если войдёте тем же аккаунтом.",
        "Пробный: 79 ₽ вместо 99 ₽.",
        "",
        "Открыть тарифы: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "analyze_intent") {
    return buildMail(
      "Разбор готов — осталось фото",
      [
        hi,
        "",
        "Вы уже получили промт из фото. Следующий шаг — генерация в PromptShot.",
        "",
        "Открыть разборы: https://promptshot.ru/analyses",
        "Сделать фото: https://promptshot.ru/generaciya/foto-po-opisaniyu",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "no_credits") {
    return buildMail(
      "Не хватило токенов PromptShot",
      [
        hi,
        "",
        "Генерация ждала токенов. Самый маленький пакет — «Пробный».",
        "",
        "Тарифы: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "yk_abandon_5m") {
    const planId = payloadString(payload, "plan_id") || "trial";
    return buildMail(
      "Оплата PromptShot не завершена — скидка 25% на час",
      [
        hi,
        "",
        `Платёж за пакет «${plan}» не завершился. Токены ещё не начислены.`,
        "Можно оплатить со скидкой 25%. Ссылка действует 1 час, войдите тем же аккаунтом.",
        "",
        `Оплатить со скидкой 25%: https://promptshot.ru/pricing?plan=${planId}`,
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "yk_abandon_40m") {
    return buildMail(
      "Оплата PromptShot не завершена",
      [
        hi,
        "",
        `Платёж за пакет «${plan}» начат, токены ещё не начислены.`,
        "Можно закончить на сайте. Сейчас на пакеты действует скидка 10%.",
        "",
        `Открыть тарифы: https://promptshot.ru/pricing?plan=${payloadString(payload, "plan_id") || "trial"}`,
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "yk_abandon_24h") {
    return buildMail(
      "Пакет PromptShot ещё можно оплатить",
      [
        hi,
        "",
        `Оплата пакета «${plan}» не завершилась. Токены не начислены.`,
        "На все пакеты сейчас скидка 20% — войдите тем же аккаунтом.",
        "",
        `Открыть тарифы: https://promptshot.ru/pricing?plan=${payloadString(payload, "plan_id") || "trial"}`,
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "paid_unused") {
    return buildMail(
      "Токены ждут первую генерацию",
      [
        hi,
        "",
        "Оплата прошла, токены на аккаунте, генераций пока нет.",
        "",
        "Сделать фото: https://promptshot.ru/generaciya/foto-po-opisaniyu",
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "credits_empty") {
    return buildMail(
      "Токены PromptShot закончились",
      [
        hi,
        "",
        "Баланс на нуле. Можно пополнить пакет на сайте.",
        "",
        "Тарифы: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "low_balance_upgrade") {
    return buildMail(
      "Скидка 20% на все пакеты PromptShot",
      [
        hi,
        "",
        "Вы уже создали фото в PromptShot, а токенов осталось немного.",
        "На все пакеты действует скидка 20%. Предложение на 24 часа и только для этого аккаунта.",
        "",
        "Выбрать пакет со скидкой 20%: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "winback_14") {
    return buildMail(
      "Новый промт на PromptShot",
      [
        hi,
        "",
        "Пока вас не было, в каталоге появились новые карточки.",
        "Семь дней на пакеты действует скидка 10%.",
        "",
        "Каталог: https://promptshot.ru",
        "Тарифы: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "winback_30") {
    return buildMail(
      "Вернуться к генерации в PromptShot",
      [
        hi,
        "",
        "Можно снова собрать фото в сервисе. Семь дней на пакеты — скидка 20%.",
        "",
        "Тарифы: https://promptshot.ru/pricing",
        "",
        `Отписаться от рассылок: ${mailUnsubscribeUrl(toEmail)}`,
        "",
        signature(),
      ],
      toEmail,
      true,
    );
  }

  if (templateId === "card_repeat_reward") {
    const earned = payload.card_earned_total;
    const maxCredits = payload.card_max_credits;
    const earnedLabel =
      typeof earned === "number" || typeof earned === "string" ? String(earned) : "—";
    const maxLabel =
      typeof maxCredits === "number" || typeof maxCredits === "string"
        ? String(maxCredits)
        : "50";
    const slug = payloadString(payload, "card_slug");
    const title = payloadString(payload, "card_title");
    const cardLine = slug
      ? `Карточка${title ? ` «${title}»` : ""}: https://promptshot.ru/p/${slug}`
      : null;
    return buildMail(
      "Вам начислен +1 кредит за генерацию по вашему фото в PromptShot",
      [
        hi,
        "",
        "Другой пользователь сгенерировал фото по вашей опубликованной карточке.",
        "",
        `Начислен +${creditLabel} кредит. По этой карточке накоплено ${earnedLabel} из ${maxLabel}.`,
        ...(cardLine ? [cardLine] : []),
        "",
        "Сделать фото: https://promptshot.ru/generaciya/foto-po-opisaniyu",
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  if (templateId === "nps_after_2" || templateId === "nps_credits_empty") {
    const subject =
      templateId === "nps_after_2"
        ? "Насколько PromptShot полезен?"
        : "Один вопрос про PromptShot";
    const lead =
      templateId === "nps_after_2"
        ? "Вы уже сделали первые фото в PromptShot. Насколько готовы порекомендовать сервис друзьям — от 1 до 10?"
        : "Токены на этом круге закончились. Насколько готовы порекомендовать PromptShot друзьям — от 1 до 10?";
    return buildMail(
      subject,
      [
        hi,
        "",
        lead,
        "Нажмите оценку — откроется короткая страница, там же можно оставить комментарий.",
        "",
        ...npsScoreLines(payloadString(payload, "survey_id")),
        "",
        signature(),
      ],
      toEmail,
      false,
    );
  }

  const subject =
    (typeof payload.subject === "string" && payload.subject.trim()) || "Письмо PromptShot";
  const body =
    (typeof payload.body_text === "string" && payload.body_text.trim()) || "";
  const unsubscribe = mailUnsubscribeUrl(toEmail);
  return buildMail(
    subject,
    [hi, "", body, "", `Отписаться от рассылок: ${unsubscribe}`, "", signature()],
    toEmail,
    true,
  );
}
