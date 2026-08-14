---
name: promptshot-admin-email
description: Sends PromptShot admin emails from support_ru@promptshot.ru via the yandex-mail MCP (yandex_mail_status, yandex_send_email). Use when the user asks to write, preview, or send email from the admin mailbox, рассылка, письмо пользователям, support_ru, Яндекс.Почта, or MCP yandex-mail.
---

# PromptShot admin email

Письма от имени сервиса идут **только** с ящика `support_ru@promptshot.ru` через MCP **yandex-mail**. Не SMTP-скрипт вручную, не Gmail, не лендинговые env.

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
