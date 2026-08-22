# Исходящая почта PromptShot через Yandex Cloud Postbox

Ветка: `feature/21-08-yandex-postbox-mail`. SQL: `sql/205_landing_mail.sql`.
Архитектура лендинга: `docs/architecture/01-landing.md`. Ops: `docs/ops/yandex-cloud-postbox.md`.

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

Цена не ограничивает (первые 2000 писем/мес бесплатно). Упираемся в дефолт Postbox:

- 200 писем / 24 часа
- 1 письмо / секунду

Кампании на всю базу **не слать**, пока YC не поднимет квоту. До DKIM/квоты cron режет получателей через `POSTBOX_TEST_ALLOWLIST`. Попадание вне списка → `skipped/allowlist` навсегда.

## Очередь

Таблицы: `landing_mail_preferences`, `landing_mail_suppression`, `landing_mail_campaigns`, `landing_mail_outbox`.

Идемпотентность:

| Событие | ключ |
|---|---|
| YooKassa credited | `yookassa_credited:{payment_id}` |
| Robokassa credited | `robokassa_credited:{payment_id}` |
| Welcome | `welcome:{shared_user_id}` |
| Кампания | `campaign:{campaign_id}:{email}` |

Cron `POST /api/cron/mail-outbox` (`CRON_SECRET`): claim `SKIP LOCKED` → gate (suppression / unsubscribe / internal) → allowlist → SESv2 → complete / skip / retry. Retry как у worker: 30 с, затем 90 с × 0.8–1.2. Max 5 попыток. Circuit 3 ошибки / 60 с / open 60 с. Пауза ≥1.1 с между send.

## Транзакционные письма

- Токены: после SQL fulfill, если `credited === true`. YooKassa — в `reconcileYooKassaPayment`. Robokassa — в `after()` ResultURL, как Metrika.
- Welcome: one-shot из `ensureLandingUserForGeneration` для не-guest. Не блокирует generate.

## Маркетинг

- `/admin/mail`: dry-run (count + 5 адресов), затем явная отправка.
- Сегменты: `all_email`, `paid`.
- `List-Unsubscribe` + `List-Unsubscribe-Post` на `/api/mail/unsubscribe`. Люди открывают `/unsubscribe?t=`.
- Хард opt-in чекбокса в продукте нет — follow-up.

## События

`POST /api/mail/postbox-events` (`POSTBOX_WEBHOOK_SECRET`) → `landing_mail_suppress` для hard bounce и complaint. Transient bounce не глушим.

## Env (landing / Dockhost)

`POSTBOX_ENDPOINT`, `POSTBOX_REGION`, `POSTBOX_ACCESS_KEY_ID`, `POSTBOX_SECRET_ACCESS_KEY`, `POSTBOX_FROM`, `POSTBOX_REPLY_TO`, `MAIL_UNSUBSCRIBE_SECRET`, `POSTBOX_WEBHOOK_SECRET`, `POSTBOX_TEST_ALLOWLIST`, существующие `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.
