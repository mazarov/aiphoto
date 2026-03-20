# PromptShot Payment Service

Проект сейчас состоит из двух ключевых частей:
- `payment-bot/` — standalone Telegram bot для покупки web-кредитов.
- `landing/` — Next.js API/UI, где extension получает deep link (`/api/buy-credits-link`).

## Локальный запуск payment bot

```bash
cd payment-bot
npm install
npm run dev
```

Или из корня:

```bash
npm run dev:api
```

## Сборка и запуск

```bash
npm run build:api
npm run start:api
```

## ENV

- Для `payment-bot`: см. `payment-bot/.env.example`
- Для `landing`: см. `landing/.env.example`

Ключевая переменная для связки extension -> bot:
- `TELEGRAM_BOT_LINK` (на стороне landing), например `https://t.me/<bot_username>`

## Инфраструктурные проверки

Перед деплоем можно проверить целостность entrypoints:

```bash
npm run check:entrypoints
```
