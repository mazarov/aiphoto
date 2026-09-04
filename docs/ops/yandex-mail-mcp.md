# MCP: почта support_ru через Яндекс (SMTP + IMAP)

Минимальный stdio MCP (`yandex-mail`) для Cursor. Тот же app-пароль для отправки и чтения.

- Отправка: SMTP `smtp.yandex.ru:465`, только после явного `dry_run=false`.
- Чтение: IMAP `imap.yandex.ru:993`. Письма **не** помечаются прочитанными (`EXAMINE` + `BODY.PEEK`).

## Разовая настройка

1. В Яндексе: [Пароли приложений](https://id.yandex.ru/security/app-passwords) → создать пароль для «Почта».
2. В ящике [Почтовые программы](https://mail.yandex.ru/#setup/client): включить «С сервера imap.yandex.ru по протоколу IMAP» и «Пароли приложений и OAuth-токены».
3. Скопировать env:

```bash
cp .cursor/yandex-smtp.env.example .cursor/yandex-smtp.env
```

4. В `.cursor/yandex-smtp.env` указать `YANDEX_SMTP_USER` / `YANDEX_SMTP_PASS` (и при необходимости host/port). `From` должен совпадать с этим ящиком или алиасом на нём. Не коммитить `.env` — только gitignored-файл.
5. Перезапустить MCP в Cursor: **Customize → MCP → yandex-mail** (выкл/вкл). После смены кода IMAP-инструменты появятся только после рестарта.

Конфиг проекта: [`.cursor/mcp.json`](../../.cursor/mcp.json). Секреты в git не попадают (`.cursor/yandex-smtp.env` в `.gitignore`).

## Инструменты

| Tool | Что делает |
|---|---|
| `yandex_mail_status` | SMTP+IMAP env. Пароль не печатает. Если IMAP залогинился — `inbox.messages` / `inbox.unseen`. |
| `yandex_send_email` | `to`, `subject`, `body`. **`dry_run` по умолчанию true** — только превью. |
| `yandex_list_folders` | Папки ящика (INBOX, Sent, Спам, …). |
| `yandex_list_messages` | Последние письма: `uid`, from, subject, date, seen. Default `INBOX`, `limit` 20 (макс. 50). Фильтры: `unread_only`, `from`, `subject`. |
| `yandex_read_message` | Текст письма по `uid` (+ `folder`). HTML снимается. Вложения — только имена, не байты. |

Реальная отправка: пользователь явно просит отправить, агент вызывает `yandex_send_email` с `dry_run: false`.

## Ограничения

- Тело письма в `yandex_read_message` обрезается (~12k символов).
- Не логировать и не коммитить пароль, полные письма с ПДн в git.
- После правок `src/standalone/mcp-yandex-mail*.mjs` нужен рестарт MCP.
