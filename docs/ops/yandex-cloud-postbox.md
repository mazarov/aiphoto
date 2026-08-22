# Ops: Yandex Cloud Postbox для promptshot.ru

Код очереди уже в лендинге. Письма не уйдут, пока не выполнен этот чеклист.

## 1. Облако и биллинг

1. Создать / взять платежный аккаунт Yandex Cloud.
2. Включить сервис Postbox в `ru-central1`.
3. Создать статическую пару ключей (Access Key ID + Secret). Только env, не в git.

## 2. Идентичность домена

1. Добавить identity `promptshot.ru` (From: `noreply@promptshot.ru`).
2. Выпустить DKIM. В DNS домена — CNAME из консоли Postbox (не выдумывать селектор).
3. SPF: добавить механизм Postbox из документации YC к существующей записи `promptshot.ru`.
4. DMARC: политика минимум `p=none` на время прогрева, rua на админский ящик.
5. Дождаться статуса identity = verified.

## 3. Квота

Дефолт: **200 писем / сутки** и **1 письмо / сек**. Для кампаний этого мало.

1. Запросить у поддержки YC лимит выше 200/day и >1 rps.
2. Пока квоту не подняли — не жать «Отправить» на сегмент `all_email` / `paid`.

## 4. Dockhost env

Выставить на лендинге (не в MCP yandex-mail):

- `POSTBOX_ENDPOINT=https://postbox.cloud.yandex.net`
- `POSTBOX_REGION=ru-central1`
- `POSTBOX_ACCESS_KEY_ID` / `POSTBOX_SECRET_ACCESS_KEY`
- `POSTBOX_FROM=noreply@promptshot.ru`
- `POSTBOX_REPLY_TO=support_ru@promptshot.ru`
- `MAIL_UNSUBSCRIBE_SECRET` — длинный случайный HMAC
- `POSTBOX_WEBHOOK_SECRET` — Bearer для `/api/mail/postbox-events`
- `POSTBOX_TEST_ALLOWLIST` — свои адреса до прогрева
- `CRON_SECRET` уже есть; добавить вызов `POST /api/cron/mail-outbox` раз в минуту

Postbox не проксировать через `GEMINI_PROXY`.

## 5. Прогрев

1. Применить `sql/205_landing_mail.sql`.
2. Оставить allowlist. Сделать dry-run в `/admin/mail`, затем send на 1–2 своих адреса.
3. Проверить DKIM/SPF в заголовках полученного письма.
4. Подключить webhook bounce/complaint на `https://promptshot.ru/api/mail/postbox-events`.
5. Снять allowlist только после verified DKIM и квоты.
6. MCP `support_ru@promptshot.ru` не трогать — это ручные ответы, не кампании.

## 6. Стоп-кран

- Убрать `POSTBOX_ACCESS_KEY_ID` / secret → cron отвечает `configured: false`, очередь копится.
- Поставить узкий `POSTBOX_TEST_ALLOWLIST` → остальные claimed-письма уходят в `skipped/allowlist`.
- Не слать кампанию повторно: ключ `campaign:{id}:{email}`.
