# Multi-Bot Architecture

## Цель

Поддержка нескольких Telegram-ботов (до 10) в рамках одного процесса API и общей базы данных.

## Бизнес-логика

| Аспект | Поведение |
|--------|-----------|
| Пользователь | Единый — идентификация по `telegram_id` |
| Кредиты | Общие между всеми ботами |
| Стикер-паки | Общие между всеми ботами |
| Сессии | Раздельные — каждый бот ведёт свою сессию с пользователем |
| Пресеты | Промпты единые, но у каждого бота свой набор видимых стилей/эмоций/движений |

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                   API (index.ts)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Bot 1   │  │ Bot 2   │  │ Bot N   │         │
│  │Telegraf │  │Telegraf │  │Telegraf │         │
│  └────┬────┘  └────┬────┘  └────┬────┘         │
│       │            │            │               │
│       ▼            ▼            ▼               │
│  /webhook/1   /webhook/2   /webhook/N          │
│       │            │            │               │
│       └────────────┴────────────┘               │
│                    │                            │
│            Shared Handlers                      │
│         (ctx enriched with bot_id)             │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                   Supabase                      │
│  ┌───────┐ ┌────────┐ ┌──────┐ ┌─────────────┐ │
│  │ bots  │ │sessions│ │ jobs │ │users(shared)│ │
│  │       │ │+bot_id │ │+bot_id│ │             │ │
│  └───────┘ └────────┘ └──────┘ └─────────────┘ │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                Worker (worker.ts)               │
│   Poll jobs → get bot_id → use correct token   │
└─────────────────────────────────────────────────┘
```

## База данных

### Новая таблица `bots`

```sql
CREATE TABLE bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX bots_active_idx ON bots (is_active);
```

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Primary Key |
| token | text | Telegram Bot Token (секретный) |
| username | text | @username бота (без @) |
| name | text | Отображаемое имя бота |
| is_active | boolean | Активен ли бот |
| created_at | timestamp | Дата создания |

### Изменения в существующих таблицах

```sql
-- Добавить bot_id в sessions
ALTER TABLE sessions ADD COLUMN bot_id uuid REFERENCES bots(id);
CREATE INDEX sessions_bot_id_idx ON sessions (bot_id);

-- Добавить bot_id в jobs
ALTER TABLE jobs ADD COLUMN bot_id uuid REFERENCES bots(id);
CREATE INDEX jobs_bot_id_idx ON jobs (bot_id);
```

### Пресеты с фильтрацией по ботам (для будущего)

```sql
-- Опция 1: Массив bot_id (NULL = все боты)
ALTER TABLE style_presets ADD COLUMN visible_for_bots uuid[];
ALTER TABLE emotion_presets ADD COLUMN visible_for_bots uuid[];
ALTER TABLE motion_presets ADD COLUMN visible_for_bots uuid[];

-- Опция 2: Junction table (если нужна более сложная логика)
CREATE TABLE bot_style_presets (
  bot_id uuid REFERENCES bots(id),
  style_id text REFERENCES style_presets(id),
  sort_order int DEFAULT 0,
  PRIMARY KEY (bot_id, style_id)
);
```

**Логика фильтрации:**
- `visible_for_bots IS NULL` → показывать всем ботам
- `visible_for_bots @> ARRAY[bot_id]` → показывать только указанным ботам

## API (index.ts)

### Инициализация

```typescript
// Загрузить всех активных ботов
const { data: bots } = await supabase
  .from("bots")
  .select("*")
  .eq("is_active", true);

// Создать Map инстансов Telegraf
const botInstances = new Map<string, Telegraf>();

for (const bot of bots) {
  const instance = new Telegraf(bot.token);
  
  // Обогатить контекст bot_id
  instance.use((ctx, next) => {
    ctx.botId = bot.id;
    ctx.botUsername = bot.username;
    return next();
  });
  
  // Подключить общие хэндлеры
  setupHandlers(instance);
  
  botInstances.set(bot.id, instance);
}
```

### Webhook endpoints

```typescript
// Роут для каждого бота
app.post("/webhook/:botId", async (req, res) => {
  const { botId } = req.params;
  const bot = botInstances.get(botId);
  
  if (!bot) {
    return res.status(404).send("Bot not found");
  }
  
  await bot.handleUpdate(req.body);
  res.sendStatus(200);
});
```

### Регистрация webhooks

```typescript
async function registerWebhooks(apiUrl: string) {
  for (const [botId, bot] of botInstances) {
    const webhookUrl = `${apiUrl}/webhook/${botId}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook registered for bot ${botId}: ${webhookUrl}`);
  }
}
```

### Изменения в хэндлерах

```typescript
// При создании сессии
const { data: session } = await supabase
  .from("sessions")
  .insert({
    user_id: user.id,
    bot_id: ctx.botId,  // <-- добавить
    state: "idle",
  })
  .select()
  .single();

// При создании job
await supabase.from("jobs").insert({
  session_id: session.id,
  user_id: user.id,
  bot_id: ctx.botId,  // <-- добавить
  status: "queued",
});
```

### Фильтрация пресетов по боту (будущее)

```typescript
async function getStylePresets(botId: string) {
  const { data } = await supabase
    .from("style_presets")
    .select("*")
    .eq("is_active", true)
    .or(`visible_for_bots.is.null,visible_for_bots.cs.{${botId}}`)
    .order("sort_order");
  
  return data;
}
```

## Worker (worker.ts)

### Загрузка токена по bot_id

```typescript
// Кэш токенов
const botTokenCache = new Map<string, string>();

async function getBotToken(botId: string): Promise<string> {
  if (botTokenCache.has(botId)) {
    return botTokenCache.get(botId)!;
  }
  
  const { data: bot } = await supabase
    .from("bots")
    .select("token")
    .eq("id", botId)
    .single();
  
  if (!bot?.token) {
    throw new Error(`Bot token not found for bot_id: ${botId}`);
  }
  
  botTokenCache.set(botId, bot.token);
  return bot.token;
}
```

### Изменения в telegram.ts

```typescript
// Вместо глобального токена - передавать токен в каждую функцию
export async function sendSticker(
  token: string,  // <-- добавить
  chatId: number,
  stickerBuffer: Buffer,
  replyMarkup?: any
): Promise<string> {
  const apiBase = `https://api.telegram.org/bot${token}`;
  // ...
}

export async function sendMessage(
  token: string,  // <-- добавить
  chatId: number,
  text: string,
  replyMarkup?: any
) {
  const apiBase = `https://api.telegram.org/bot${token}`;
  // ...
}
```

### Изменения в runJob

```typescript
async function runJob(job: any) {
  // Получить токен бота
  const botToken = await getBotToken(job.bot_id);
  
  // Использовать токен во всех вызовах Telegram API
  await sendMessage(botToken, telegramId, text);
  await sendSticker(botToken, telegramId, stickerBuffer, replyMarkup);
  await editMessageText(botToken, chatId, messageId, text);
  // ...
}
```

## Конфигурация

### Убрать из ENV

```diff
- TELEGRAM_BOT_TOKEN=xxx
```

### Управление ботами

Боты добавляются/редактируются напрямую в таблице `bots` через:
- Supabase Dashboard
- SQL запросы
- Будущая админка

```sql
-- Добавить нового бота
INSERT INTO bots (token, username, name) VALUES
  ('123456:ABC-DEF...', 'my_sticker_bot', 'My Sticker Bot');

-- Деактивировать бота
UPDATE bots SET is_active = false WHERE username = 'old_bot';
```

## Миграция с текущего бота

### Шаг 1: Создать таблицу и вставить текущего бота

```sql
-- Создать таблицу bots
CREATE TABLE bots (...);

-- Вставить текущего бота (токен из ENV)
INSERT INTO bots (id, token, username, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'CURRENT_TOKEN', 'photo2sticker_bot', 'Photo2Sticker');
```

### Шаг 2: Добавить bot_id в существующие таблицы

```sql
-- Добавить колонки
ALTER TABLE sessions ADD COLUMN bot_id uuid REFERENCES bots(id);
ALTER TABLE jobs ADD COLUMN bot_id uuid REFERENCES bots(id);

-- Заполнить существующие записи текущим ботом
UPDATE sessions SET bot_id = '00000000-0000-0000-0000-000000000001' WHERE bot_id IS NULL;
UPDATE jobs SET bot_id = '00000000-0000-0000-0000-000000000001' WHERE bot_id IS NULL;

-- Сделать NOT NULL после миграции данных
ALTER TABLE sessions ALTER COLUMN bot_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN bot_id SET NOT NULL;
```

### Шаг 3: Обновить код

1. Обновить `src/lib/telegram.ts` — добавить `token` параметр во все функции
2. Обновить `src/worker.ts` — загружать токен по `job.bot_id`
3. Обновить `src/index.ts` — создавать N инстансов Telegraf
4. Убрать `TELEGRAM_BOT_TOKEN` из конфига

### Шаг 4: Зарегистрировать webhooks

```bash
# Для каждого бота
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://api.example.com/webhook/{BOT_ID}"
```

## Checklist реализации

- [ ] SQL миграция: создать таблицу `bots`
- [ ] SQL миграция: добавить `bot_id` в `sessions`, `jobs`
- [ ] Обновить `src/lib/telegram.ts` — параметр `token`
- [ ] Обновить `src/worker.ts` — загрузка токена по `bot_id`
- [ ] Обновить `src/index.ts` — множественные Telegraf инстансы
- [ ] Обновить `src/index.ts` — webhook роутинг по `botId`
- [ ] Убрать `TELEGRAM_BOT_TOKEN` из `src/config.ts`
- [ ] Мигрировать данные существующего бота
- [ ] Зарегистрировать webhooks для всех ботов
- [ ] Тестирование с 2+ ботами

## Безопасность

- **Токены в БД**: Supabase RLS должен запрещать чтение `bots.token` из клиента
- **Webhook validation**: Опционально добавить secret token для валидации
- **Rate limiting**: Учитывать лимиты Telegram API (30 msg/sec per bot)
