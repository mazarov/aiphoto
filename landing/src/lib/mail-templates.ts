import { mailOneClickUnsubscribeUrl, mailUnsubscribeUrl } from "@/lib/mail-unsubscribe";

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
  "winback_14",
  "winback_30",
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
    html: wrapHtml(escapeHtml(text)),
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
        "Сделать фото: https://promptshot.ru/generaciya-foto",
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
        "Начать: https://promptshot.ru/generaciya-foto",
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
        "Сделать фото: https://promptshot.ru/generaciya-foto",
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
        "Сделать фото: https://promptshot.ru/generaciya-foto",
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
