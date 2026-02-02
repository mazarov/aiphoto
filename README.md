# Photo2Sticker Bot Service

Сервис состоит из двух процессов:
- API (Telegram webhook)
- Worker (очередь генерации)

## Запуск локально

```bash
npm install
npm run dev:api
npm run dev:worker
```

По умолчанию API запускается с long polling, если `PUBLIC_BASE_URL` пустой.
Если нужен webhook, укажи публичный URL (например, ngrok) в `PUBLIC_BASE_URL`
и сервис сам вызовет `setWebhook`.

## ENV
См. `.env.example`.

## Примечания
- Все ключи в ENV.
- Таблицы `users`, `sessions`, `transactions`, `bot_texts` используются как есть.
- Для очереди используется таблица `jobs` (будет добавлена позже).
