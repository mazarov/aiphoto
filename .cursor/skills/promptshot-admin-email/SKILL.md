---
name: promptshot-admin-email
description: Sends and reads PromptShot admin email from support_ru@promptshot.ru via the yandex-mail MCP (status, list, read, send). Use when the user asks to write, preview, send, or read support mail, inbox, рассылка, письмо пользователям, support_ru, Яндекс.Почта, or MCP yandex-mail.
---

# PromptShot admin email

Письма от имени сервиса идут **только** с ящика `support_ru@promptshot.ru` через MCP **yandex-mail**. Не SMTP-скрипт вручную, не Gmail, не лендинговые env.

Входящие читаются тем же MCP (IMAP). Не просить у пользователя адрес отправителя, если письмо уже в ящике.

## Прочитать ящик

1. `yandex_mail_status`. Нужны `configured: true`, `imap_ok: true` (или хотя бы `password_set: true`).
2. Если `imap_ok: false` — не гадать. Напомнить включить IMAP в Яндекс.Почте → Настройки → Почтовые программы, и перезапустить MCP **yandex-mail**.
3. `yandex_list_messages` по задаче: свежие в `INBOX` (`limit` 10–20), или `unread_only: true`, или `from` / `subject`.
4. Нужный тред — `yandex_read_message` с `uid` (и `folder`, если не INBOX).
5. Не вываливать весь ящик в чат. Кратко: кто, тема, суть; полное тело — только если нужно ответить.
6. Письма через IMAP **не** помечаются прочитанными.

## Перед любой отправкой

1. Вызвать `yandex_mail_status`. Нужны `configured: true`, `user: support_ru@promptshot.ru`, `password_set: true`.
2. Если `configured: false` — не слать. Проверить `.cursor/yandex-smtp.env`, попросить перезапустить MCP (выкл/вкл **yandex-mail**). Пароль в чат не печатать.
3. Черновик показать пользователю.
4. Сначала `yandex_send_email` с `dry_run: true` (это дефолт). Показать превью.
5. Реальный send **только** после явного «отправь» / «шли». Тогда `dry_run: false`.
6. По одному получателю на вызов. Не слать пачкой без отдельного OK на список.

## Тон

- От кого: Команда PromptShot / админ сервиса.
- Подпись:

```
—
Команда PromptShot
https://promptshot.ru
```

- Не объяснять webhook/ledger/внутренности, если пользователь не просил техразбор.
- Если цель — узнать, почему не получилось оплатить: просить рассказать опыт, писать что хотим улучшить сервис для всех. Не ставить диагноз за пользователя.
- Если цель — извиниться за задержку токенов: токены уже на балансе, ссылка https://promptshot.ru/pricing. Черновик-шаблон: `docs/ops/yookassa-payment-delay-email-ru.md`.

## Запрещено

- Класть SMTP-секреты в git, код, коммиты, чат.
- Слать с другого From, чем MCP status.
- `dry_run: false` без прямой просьбы отправить.
- Добавлять эти переменные в env лендинга / Dockhost.
