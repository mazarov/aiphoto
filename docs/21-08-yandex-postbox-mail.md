# Исходящая почта PromptShot через Yandex Cloud Postbox

Ветка транспорта: `feature/21-08-yandex-postbox-mail`. SQL: `sql/205_landing_mail.sql`.
Архитектура лендинга: `docs/architecture/01-landing.md`. Ops: `docs/ops/yandex-cloud-postbox.md`.
Lifecycle-цепочки: `docs/22-08-lifecycle-mail.md`, SQL `sql/206_landing_mail_lifecycle.sql`.

## Решение

- Один транспорт: Yandex Cloud Postbox (SESv2, регион `ru-central1`).
- Два класса писем: **transactional** (welcome, токены) и **marketing** (кампании).
- Оплата и signup **не ждут SMTP**. После fulfill/ensure только `landing_enqueue_mail`.
- Auth-письма Supabase GoTrue (confirm / reset / magic link) **не заменяем**.
- 1:1 ответы людей остаются в Cursor MCP Yandex Mail (`support_ru@promptshot.ru`).
- Отправитель: `noreply@promptshot.ru`, Reply-To: `support_ru@promptshot.ru`.
- Email: `COALESCE(auth.users.email, imageprompt_users.email)`. `landing_users` email не хранит.
- Адреса `*@promptshot.internal` не пишем.
- Postbox — РФ-сервис, вызываем **напрямую**, без `GEMINI_PROXY`.
- Отдельного Docker mail-worker нет. Отправка — landing cron, как visual-embeddings.

## Квота

Цена не ограничивает (первые 2000 писем/мес бесплатно). Суточный потолок Postbox:

- **5000** писем / 24 часа
- **1** письмо / секунду (пока не поднимут rps)

5000/сутки ≈ 1.5 часа одной очереди при 1 rps. Это потолок **отправки**, не разрешение full-scan базы.

Кампании на сегмент можно слать, но не каждый день и не ценой транзакционных. Claim (`sql/206`):

1. transactional (welcome, токены, abandon, paid_unused);
2. lifecycle marketing;
3. ручные кампании.

Резерв tx: 500 слотов / сутки `Europe/Moscow`. `landing_mail_campaign_enqueue` не стартует, если оставшихся слотов меньше размера сегмента или после send резерв tx < 500.

До прогрева DKIM cron режет получателей через `POSTBOX_TEST_ALLOWLIST`. Попадание вне списка → `skipped/allowlist` навсегда.

## Очередь

Таблицы: `landing_mail_preferences`, `landing_mail_suppression`, `landing_mail_campaigns`, `landing_mail_outbox`.

Идемпотентность:

| Событие | ключ |
|---|---|
| YooKassa credited | `yookassa_credited:{payment_id}` |
| Robokassa credited | `robokassa_credited:{payment_id}` |
| Welcome | `welcome:{shared_user_id}` |
| Кампания | `campaign:{campaign_id}:{email}` |

Cron `POST /api/cron/mail-outbox` (`CRON_SECRET`): claim `SKIP LOCKED` (tx → lifecycle mkt → campaign) → gate (suppression / unsubscribe / internal) → allowlist → SESv2 → complete / skip / retry. Due-планировщик — `POST /api/cron/mail-due`. Retry как у worker: 30 с, затем 90 с × 0.8–1.2. Max 5 попыток. Circuit 3 ошибки / 60 с / open 60 с. Пауза ≥1.1 с между send.

## Транзакционные письма

- Токены: после SQL fulfill, если `credited === true`. YooKassa — в `reconcileYooKassaPayment`. Robokassa — в `after()` ResultURL, как Metrika.
- Welcome: one-shot из `ensureLandingUserForGeneration` для не-guest. Не блокирует generate.

## Маркетинг

- `/admin/mail`: вкладка «Каталог» (превью без отправки) и кампании (dry-run + send).
- Сегменты: `all_email`, `paid`, `exploring`, `paid_active`, `paid_quiet`, `empty`, `trial_only`.
- `List-Unsubscribe` + `List-Unsubscribe-Post` на `/api/mail/unsubscribe`. Люди открывают `/unsubscribe?t=`.
- Хард opt-in чекбокса в продукте нет — follow-up.

## События

`POST /api/mail/postbox-events` (`POSTBOX_WEBHOOK_SECRET`) → `landing_mail_suppress` для hard bounce и complaint. Transient bounce не глушим.

## Env (landing / Dockhost)

`POSTBOX_ENDPOINT`, `POSTBOX_REGION`, `POSTBOX_ACCESS_KEY_ID`, `POSTBOX_SECRET_ACCESS_KEY`, `POSTBOX_FROM`, `POSTBOX_REPLY_TO`, `MAIL_UNSUBSCRIBE_SECRET`, `POSTBOX_WEBHOOK_SECRET`, `POSTBOX_TEST_ALLOWLIST`, существующие `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.
