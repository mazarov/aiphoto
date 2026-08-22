import {
  MAIL_TEMPLATE_IDS,
  renderMailTemplate,
  type MailTemplateId,
} from "@/lib/mail-templates";
import type { MailKind } from "@/lib/mail-outbox";

export const MAIL_DAILY_CAP = 5000;
export const MAIL_TX_RESERVE = 500;
export const MAIL_WINBACK_DAILY_CAP = 200;

export type MailCatalogEntry = {
  id: MailTemplateId;
  kind: MailKind;
  title: string;
  audience: string;
  when: string;
  stop: string;
  discountPercent: number;
  cta: string;
  idempotencyKey: string;
};

export type MailUserFacts = {
  sharedUserId: string;
  displayName: string | null;
  hasGeneration: boolean;
  lastGenerationAt: string | null;
  hasAnalyze: boolean;
  hasYookassaRow: boolean;
  hasCredited: boolean;
  credits: number;
  hasCreditBlock: boolean;
  latestUncreditedPlanId: string | null;
  marketingSentToday: boolean;
  winbackSentToday: number;
  lastCreditsEmptyAt: string | null;
};

export type MailDueDecision =
  | { action: "send"; kind: MailKind; payload: Record<string, unknown>; discountPercent: number }
  | { action: "skip"; reason: string };

const CATALOG: MailCatalogEntry[] = [
  {
    id: "welcome",
    kind: "transactional",
    title: "Регистрация",
    audience: "Первый ensure с email",
    when: "Сразу",
    stop: "Ключ welcome:{user} уже есть",
    discountPercent: 0,
    cta: "https://promptshot.ru и https://promptshot.ru/pricing",
    idempotencyKey: "welcome:{user}",
  },
  {
    id: "onboard_d1",
    kind: "marketing",
    title: "Онбординг D+1",
    audience: "0 генераций, 0 оплат, нет строки ЮKassa",
    when: "+1 сутки после welcome",
    stop: "Генерация, любой платёж или отписка",
    discountPercent: 0,
    cta: "https://promptshot.ru/generaciya-foto",
    idempotencyKey: "onboard_d1:{user}",
  },
  {
    id: "onboard_d3",
    kind: "marketing",
    title: "Онбординг D+3",
    audience: "Всё ещё exploring",
    when: "+3 суток после welcome",
    stop: "Генерация, любой платёж или отписка",
    discountPercent: 0,
    cta: "https://promptshot.ru",
    idempotencyKey: "onboard_d3:{user}",
  },
  {
    id: "onboard_d7",
    kind: "marketing",
    title: "Онбординг D+7",
    audience: "Всё ещё exploring",
    when: "+7 суток после welcome",
    stop: "Генерация, любой платёж или отписка",
    discountPercent: 20,
    cta: "https://promptshot.ru/pricing",
    idempotencyKey: "onboard_d7:{user}",
  },
  {
    id: "analyze_intent",
    kind: "marketing",
    title: "Разбор без генерации",
    audience: "Есть analyze, 0 ген, 0 оплаты",
    when: "+6 ч после первого разбора",
    stop: "Генерация или платёж",
    discountPercent: 0,
    cta: "https://promptshot.ru/generaciya-foto",
    idempotencyKey: "analyze_intent:{user}",
  },
  {
    id: "no_credits",
    kind: "marketing",
    title: "Упёрся в paywall",
    audience: "Серверный отказ платной генерации или 11-го разбора",
    when: "+2 ч, всё ещё нет строки платежа",
    stop: "Строка платежа или credited. Не из баланса 0",
    discountPercent: 0,
    cta: "https://promptshot.ru/pricing",
    idempotencyKey: "no_credits:{user}",
  },
  {
    id: "yk_abandon_40m",
    kind: "transactional",
    title: "Бросил ЮKassa 40 мин",
    audience: "ЮKassa created/pending/canceled, нет credited",
    when: "+30–40 мин от created_at",
    stop: "Любой credited_at",
    discountPercent: 10,
    cta: "https://promptshot.ru/pricing?plan=",
    idempotencyKey: "yk_abandon_40m:{payment_id}",
  },
  {
    id: "yk_abandon_24h",
    kind: "transactional",
    title: "Бросил ЮKassa 24 ч",
    audience: "Тот же незакрытый платёж",
    when: "+24 ч от created_at",
    stop: "Любой credited_at",
    discountPercent: 20,
    cta: "https://promptshot.ru/pricing?plan=",
    idempotencyKey: "yk_abandon_24h:{payment_id}",
  },
  {
    id: "tokens_credited",
    kind: "transactional",
    title: "Токены зачислены",
    audience: "YooKassa/Robokassa credited",
    when: "Сразу после fulfill",
    stop: "Ключ платежа",
    discountPercent: 0,
    cta: "https://promptshot.ru/generaciya-foto",
    idempotencyKey: "{provider}_credited:{payment_id}",
  },
  {
    id: "paid_unused",
    kind: "transactional",
    title: "Оплатил и не сгенерил",
    audience: "Есть credited, 0 генераций",
    when: "+24 ч после первого credited",
    stop: "Первая генерация",
    discountPercent: 0,
    cta: "https://promptshot.ru/generaciya-foto",
    idempotencyKey: "paid_unused:{user}",
  },
  {
    id: "credits_empty",
    kind: "marketing",
    title: "Токены кончились",
    audience: "Был paid, credits=0, ген < 7 дней",
    when: "После обнуления баланса",
    stop: "Новый credited; не чаще раза в 14 дней",
    discountPercent: 0,
    cta: "https://promptshot.ru/pricing",
    idempotencyKey: "credits_empty:{user}:{yyyy-mm-dd}",
  },
  {
    id: "winback_14",
    kind: "marketing",
    title: "Win-back 14 дней",
    audience: "Была генерация, тишина ≥ 14 дней",
    when: "last_gen+14d + jitter до 24 ч",
    stop: "Новая генерация; cap 200/сутки",
    discountPercent: 10,
    cta: "https://promptshot.ru/pricing",
    idempotencyKey: "winback_14:{user}:{cycle}",
  },
  {
    id: "winback_30",
    kind: "marketing",
    title: "Win-back 30 дней",
    audience: "Тишина ≥ 30 дней, 14-дневное уже ушло",
    when: "last_gen+30d + jitter",
    stop: "Новая генерация; cap 200/сутки",
    discountPercent: 20,
    cta: "https://promptshot.ru/pricing",
    idempotencyKey: "winback_30:{user}:{cycle}",
  },
  {
    id: "campaign",
    kind: "marketing",
    title: "Ручная кампания",
    audience: "Сегмент из /admin/mail",
    when: "Явный send",
    stop: "Отписка; уже было marketing сегодня",
    discountPercent: 0,
    cta: "из тела письма",
    idempotencyKey: "campaign:{id}:{email}",
  },
];

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

export function listMailCatalog(): MailCatalogEntry[] {
  return CATALOG;
}

export function getMailCatalogEntry(id: MailTemplateId): MailCatalogEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`unknown_mail_template:${id}`);
  return entry;
}

export function mailCatalogFixture(id: MailTemplateId): Record<string, unknown> {
  return {
    display_name: "Максим",
    plan_id: "trial",
    credits: 30,
    subject: "Письмо PromptShot",
    body_text: "Пример тела кампании.",
  };
}

export function renderMailCatalogPreview(id: MailTemplateId) {
  const entry = getMailCatalogEntry(id);
  const rendered = renderMailTemplate(id, mailCatalogFixture(id), "preview@promptshot.ru");
  return { ...entry, subject: rendered.subject, text: rendered.text, html: rendered.html };
}

export function listMailCatalogPreviews() {
  return MAIL_TEMPLATE_IDS.map((id) => renderMailCatalogPreview(id));
}

function hoursSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return (nowMs - then) / 3_600_000;
}

export function parseMailUserFacts(raw: unknown, fallbackUserId: string): MailUserFacts {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    sharedUserId:
      typeof row.shared_user_id === "string" && row.shared_user_id
        ? row.shared_user_id
        : fallbackUserId,
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    hasGeneration: row.has_generation === true,
    lastGenerationAt: typeof row.last_generation_at === "string" ? row.last_generation_at : null,
    hasAnalyze: row.has_analyze === true,
    hasYookassaRow: row.has_yookassa_row === true,
    hasCredited: row.has_credited === true,
    credits: Number(row.credits || 0) || 0,
    hasCreditBlock: row.has_credit_block === true,
    latestUncreditedPlanId:
      typeof row.latest_uncredited_plan_id === "string" ? row.latest_uncredited_plan_id : null,
    marketingSentToday: row.marketing_sent_today === true,
    winbackSentToday: Number(row.winback_sent_today || 0) || 0,
    lastCreditsEmptyAt:
      typeof row.last_credits_empty_at === "string" ? row.last_credits_empty_at : null,
  };
}

export function mailOutboxKey(
  templateId: MailTemplateId,
  subjectKey: string,
  payload: Record<string, unknown>,
): string {
  const fromPayload = payload.idempotency_key;
  if (typeof fromPayload === "string" && fromPayload.trim()) return fromPayload.trim();
  if (templateId === "yk_abandon_40m" || templateId === "yk_abandon_24h") {
    return `${templateId}:${subjectKey}`;
  }
  if (templateId === "winback_14" || templateId === "winback_30") {
    return `${templateId}:${subjectKey}`;
  }
  return `${templateId}:${subjectKey}`;
}

export function evaluateMailDue(
  templateId: MailTemplateId,
  facts: MailUserFacts,
  nowMs: number = Date.now(),
): MailDueDecision {
  const entry = getMailCatalogEntry(templateId);
  if (entry.kind === "marketing" && facts.marketingSentToday) {
    return { action: "skip", reason: "marketing_daily_cap" };
  }
  if (
    (templateId === "winback_14" || templateId === "winback_30") &&
    facts.winbackSentToday >= MAIL_WINBACK_DAILY_CAP
  ) {
    return { action: "skip", reason: "winback_daily_cap" };
  }

  if (templateId === "onboard_d1" || templateId === "onboard_d3" || templateId === "onboard_d7") {
    if (facts.hasGeneration || facts.hasYookassaRow || facts.hasCredited) {
      return { action: "skip", reason: "left_exploring" };
    }
  }
  if (templateId === "analyze_intent") {
    if (!facts.hasAnalyze || facts.hasGeneration || facts.hasYookassaRow || facts.hasCredited) {
      return { action: "skip", reason: "analyze_intent_stop" };
    }
  }
  if (templateId === "no_credits") {
    if (!facts.hasCreditBlock || facts.hasYookassaRow || facts.hasCredited) {
      return { action: "skip", reason: "no_credits_stop" };
    }
  }
  if (templateId === "yk_abandon_40m" || templateId === "yk_abandon_24h") {
    if (facts.hasCredited) return { action: "skip", reason: "credited" };
  }
  if (templateId === "paid_unused") {
    if (!facts.hasCredited || facts.hasGeneration) {
      return { action: "skip", reason: "paid_unused_stop" };
    }
  }
  if (templateId === "credits_empty") {
    if (!facts.hasCredited || facts.credits > 0) {
      return { action: "skip", reason: "credits_empty_stop" };
    }
    const silentHours = hoursSince(facts.lastGenerationAt, nowMs);
    if (silentHours == null || silentHours > 7 * 24) {
      return { action: "skip", reason: "credits_empty_stale_gen" };
    }
    const emptyHours = hoursSince(facts.lastCreditsEmptyAt, nowMs);
    if (emptyHours != null && emptyHours < 14 * 24) {
      return { action: "skip", reason: "credits_empty_cooldown" };
    }
  }
  if (templateId === "winback_14") {
    const silentHours = hoursSince(facts.lastGenerationAt, nowMs);
    if (silentHours == null || silentHours < 14 * 24) {
      return { action: "skip", reason: "winback_too_soon" };
    }
  }
  if (templateId === "winback_30") {
    const silentHours = hoursSince(facts.lastGenerationAt, nowMs);
    if (silentHours == null || silentHours < 30 * 24) {
      return { action: "skip", reason: "winback_too_soon" };
    }
  }

  return {
    action: "send",
    kind: entry.kind,
    discountPercent: entry.discountPercent,
    payload: {
      display_name: facts.displayName,
      plan_id: facts.latestUncreditedPlanId || "trial",
    },
  };
}
