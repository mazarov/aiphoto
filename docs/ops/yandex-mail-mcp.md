# MCP: отправка писем через Яндекс.Почту

Минимальный stdio MCP (`yandex-mail`) для Cursor. Отправка только после явного `dry_run=false`.

## Разовая настройка

1. В Яндексе: [Пароли приложений](https://id.yandex.ru/security/app-passwords) → создать пароль для «Почта».
2. Скопировать env:

```bash
cp .cursor/yandex-smtp.env.example .cursor/yandex-smtp.env
```

3. В `.cursor/yandex-smtp.env` указать `YANDEX_SMTP_USER` / `YANDEX_SMTP_PASS` (и при необходимости host/port). `From` должен совпадать с этим ящиком или алиасом на нём. Не коммитить `.env` — только gitignored-файл.
4. Перезапустить MCP в Cursor: **Customize → MCP → yandex-mail** (включить, если выключен).

Конфиг проекта: [`.cursor/mcp.json`](../../.cursor/mcp.json). Секреты в git не попадают (`.cursor/yandex-smtp.env` в `.gitignore`).

## Инструменты

| Tool | Что делает |
|---|---|
| `yandex_mail_status` | Проверяет, что user/password заданы. Пароль не печатает. |
| `yandex_send_email` | `to`, `subject`, `body`. **`dry_run` по умолчанию true** — только превью. |

Реальная отправка: пользователь явно просит отправить, агент вызывает `yandex_send_email` с `dry_run: false`.
