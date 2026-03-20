# Standalone Payment Bot для PromptShot

> Дата: 2026-03-20

## 1. Проблема

Extension (Steal This Vibe) использует `landing_users.credits`. Покупка кредитов реализована через Telegram Stars. Сейчас payment-логика живёт внутри большого `aiphoto/src/index.ts` (~5300 строк), который содержит AI-ассистента, карусели стилей, генерацию стикеров и десятки хендлеров, не относящихся к web-оплатам.

Нужен **отдельный легковесный бот**, который:
- принимает deep link из extension
- привязывает Telegram ↔ landing_user
- показывает пакеты кредитов
- принимает Stars и начисляет `landing_users.credits`

## 2. Решение

Новый **standalone Telegram бот** (`PromptShotPayBot`), минимальный по коду. Переиспользуем паттерны из `photo2sticker-bot` и `aiphoto`, но без AI-ассистента, стилей, воркера и прочего.

## 3. Что переиспользуем из photo2sticker / aiphoto

| Что | Откуда | Как |
|-----|--------|-----|
| Структура проекта | `aiphoto/` | `src/index.ts`, `src/config.ts`, `src/lib/supabase.ts` |
| Dockerfile | `aiphoto/Dockerfile.api` | Копия, без изменений |
| Payment flow | `aiphoto/src/index.ts` | Извлечь `webpack_*`, `successful_payment` web-ветку, `handleWebCreditsStartPayload` |
| Alerts | `aiphoto/src/lib/alerts.ts` | Копия целиком |
| Supabase client | `aiphoto/src/lib/supabase.ts` | Копия целиком |
| SQL миграции | `aiphoto/sql/145_*.sql`, `146_*.sql` | Уже применены — бот просто использует эти таблицы |
| Telegraf + Express | `aiphoto/package.json` | `telegraf`, `express`, `@supabase/supabase-js`, `dotenv` |

## 4. Что НЕ нужно

- AI-ассистент (`ai-chat.ts`, `assistant-db.ts`, `gemini-chat.ts`)
- Стили, эмоции, motion (`style_presets_v2`, `emotion_presets`, карусели)
- Worker (`worker.ts`, `sharp`, `rembg`)
- Генерация изображений (`gemini-image-part.ts`, `image-utils.ts`)
- Тексты/локализация (`texts.ts`, таблица `photo_texts`)
- Support bot (`support-bot.ts`)
- Broadcast (`broadcast-valentine.ts`)
- Всё, что работает с `photo_users`, `photo_sessions`, `photo_transactions`

## 5. Архитектура

```
┌───────────────────────────────────────┐
│  PromptShotPayBot (standalone)        │
│                                       │
│  src/                                 │
│  ├── index.ts       ← Telegraf бот   │
│  ├── config.ts      ← Env vars       │
│  └── lib/                             │
│      ├── supabase.ts                  │
│      └── alerts.ts                    │
│                                       │
│  Таблицы (read/write):                │
│  • landing_user_telegram_links        │
│  • landing_link_tokens                │
│  • landing_web_transactions           │
│  • landing_users (credits)            │
│                                       │
│  RPC: landing_add_credits             │
└───────────────────────────────────────┘
```

## 6. Файловая структура нового бота

```
aiphoto/payment-bot/
├── src/
│   ├── index.ts           ← Точка входа (Express + Telegraf)
│   ├── config.ts          ← Env-конфиг
│   └── lib/
│       ├── supabase.ts    ← Supabase client
│       └── alerts.ts      ← Алерты в канал
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## 7. config.ts

```typescript
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  appEnv: process.env.APP_ENV || "prod",
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  supabaseUrl: required("SUPABASE_SUPABASE_PUBLIC_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  port: Number(process.env.PORT || 3002),
  webhookPath: process.env.WEBHOOK_PATH || "/telegram/webhook",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  alertChannelId: process.env.ALERT_CHANNEL_ID || "",
};
```

**Минимальные env:**
- `TELEGRAM_BOT_TOKEN` — токен нового бота из BotFather
- `SUPABASE_SUPABASE_PUBLIC_URL` — тот же Supabase что и лендинг
- `SUPABASE_SERVICE_ROLE_KEY` — service role ключ

**Опциональные env:**
- `APP_ENV` — `prod` / `test`
- `PORT` — порт (default 3002, чтобы не конфликтовать с aiphoto 3001)
- `PUBLIC_BASE_URL` — для webhook; без него = long polling
- `ALERT_CHANNEL_ID` — Telegram chat ID для алертов
- `TELEGRAM_WEBHOOK_SECRET` — секрет webhook

## 8. index.ts — полный список хендлеров

### 8.1. `/start weblink_<otp>` — привязка аккаунта

```
1. Валидация OTP (12 hex chars)
2. SELECT landing_link_tokens WHERE otp = ? AND NOT used AND expires_at > now()
3. Проверка: telegram_id уже привязан к другому landing_user?
4. Проверка: landing_user уже привязан к другому telegram?
5. UPSERT landing_user_telegram_links
6. UPDATE landing_link_tokens SET used = true
7. Ответ: "✅ Аккаунт PromptShot привязан!"
8. Показать пакеты кредитов
```

### 8.2. `/start webcredits` — повторная покупка

```
1. SELECT landing_user_telegram_links WHERE telegram_id = ?
2. Привязка есть → показать пакеты
3. Привязки нет → "Привяжите аккаунт через extension"
```

### 8.3. `/start` (без payload) — приветствие

```
1. "Этот бот для оплаты кредитов PromptShot."
2. "Нажмите «Купить кредиты» в extension, чтобы начать."
```

### 8.4. Callback `webpack_{credits}_{price}` — выбор пакета

```
1. Валидация пакета в WEB_CREDIT_PACKS
2. SELECT landing_user_telegram_links WHERE telegram_id = ?
3. Привязки нет → ошибка
4. Cancel старые created транзакции
5. INSERT landing_web_transactions (state: created)
6. sendInvoice (currency: XTR, payload: [transaction_id])
```

### 8.5. `pre_checkout_query` — instant OK

```
ctx.answerPreCheckoutQuery(true)
```

### 8.6. `successful_payment` — зачисление

```
1. Extract transaction_id из payload
2. Idempotency: проверка telegram_payment_charge_id
3. UPDATE landing_web_transactions SET state = done
4. RPC landing_add_credits
5. Ответ: "✅ Зачислено N кредитов для PromptShot!"
6. Alert в канал
```

### 8.7. Пакеты

```typescript
const WEB_CREDIT_PACKS = [
  { credits: 10, price: 150, label_ru: "⭐ Старт", label_en: "⭐ Start" },
  { credits: 30, price: 300, label_ru: "💎 Поп",   label_en: "💎 Pop" },
  { credits: 100, price: 700, label_ru: "👑 Про",   label_en: "👑 Pro" },
];
```

## 9. Что поменять в landing

Только env:
```
TELEGRAM_BOT_LINK=https://t.me/<новый_бот_username>
```

API endpoint `/api/buy-credits-link` уже реализован и не зависит от конкретного бота — он просто читает `TELEGRAM_BOT_LINK`.

## 10. Что поменять в aiphoto/src/index.ts

**Удалить** (после запуска standalone бота):
- `WEB_CREDIT_PACKS`
- `showWebCreditPacks()`
- `handleWebCreditsStartPayload()`
- `bot.action(/^webpack_.../)` 
- Web-ветку в `successful_payment`
- Вызов `handleWebCreditsStartPayload` в `bot.start`

Эти хендлеры переезжают в `payment-bot/src/index.ts`.

## 11. Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

## 12. package.json

```json
{
  "name": "promptshot-payment-bot",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.48.0",
    "axios": "^1.7.9",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "telegraf": "^4.16.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.19.0",
    "tsx": "^4.20.5",
    "typescript": "5.6.3"
  }
}
```

**Нет:** `sharp`, `cheerio`, `xlsx`, `form-data`, `openai` — они не нужны.

## 13. .env.example

```bash
TELEGRAM_BOT_TOKEN=
SUPABASE_SUPABASE_PUBLIC_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
APP_ENV=prod
PORT=3002
PUBLIC_BASE_URL=
ALERT_CHANNEL_ID=
TELEGRAM_WEBHOOK_SECRET=
```

## 14. Деплой

Тот же Dockhost, новый контейнер:
- Image: build из `aiphoto/payment-bot/Dockerfile`
- Port: 3002
- Env: из `.env`
- Healthcheck: `GET /` → 200

## 15. Оценка

| Шаг | Время |
|-----|-------|
| Создать бота в BotFather | 5 мин |
| Scaffold: package.json, tsconfig, Dockerfile | 15 мин |
| Перенести config.ts, lib/supabase.ts, lib/alerts.ts | 15 мин |
| Написать index.ts (все хендлеры из §8) | 1-2 часа |
| Удалить web-payment код из aiphoto/src/index.ts | 15 мин |
| Обновить TELEGRAM_BOT_LINK на landing | 5 мин |
| Деплой + smoke test | 30 мин |
| **Итого** | **~3 часа** |

## 16. Smoke Test

1. Extension → «Купить кредиты» → открывается **новый бот** (не aiphoto)
2. Бот: «✅ Аккаунт привязан!» + пакеты кредитов
3. Выбрать пакет → invoice → оплатить Stars
4. Бот: «✅ Зачислено N кредитов»
5. Extension: toast «Зачислено N кредитов» (polling сработал)
6. Повторная покупка → бот сразу показывает пакеты
7. Другой web-аккаунт + тот же Telegram → «Уже привязан к другому аккаунту»
