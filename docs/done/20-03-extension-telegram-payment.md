# Extension → Telegram Stars Payment

> Дата: 2026-03-20

## 1. Проблема

Extension (Steal This Vibe) использует `landing_users.credits` для генерации.
Сейчас **нет способа купить кредиты** — пользователь видит `insufficient_credits` и не может продолжить.

## 2. Решение

Оплата через **Telegram Stars** в существующем боте PromptShot (`aiphoto`).
Extension перенаправляет пользователя в бот → бот показывает пакеты → пользователь платит Stars → кредиты зачисляются в `landing_users.credits`.

## 3. Архитектура

### 3.1. Два мира кредитов (текущее состояние)

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Web (extension + сайт)          │  │  Telegram Bot                    │
├──────────────────────────────────┤  ├──────────────────────────────────┤
│  Таблица: landing_users          │  │  Таблица: photo_users            │
│  ID: Supabase auth UUID          │  │  ID: uuid (внутренний)           │
│  Идент.: auth.users.id           │  │  Идент.: telegram_id (bigint)    │
│  Кредиты: landing_users.credits  │  │  Кредиты: photo_users.credits    │
│  Списание: landing_deduct_credits│  │  Списание: photo_deduct_credits  │
│  Оплата: НЕТ                    │  │  Оплата: Telegram Stars          │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

**Принцип: кредиты остаются раздельными.** Бот-кредиты не объединяются с web-кредитами. Это минимизирует риск и не трогает существующую логику бота.

### 3.2. Целевой flow

```
Extension (sidepanel)
│
├─ "Недостаточно кредитов: нужно 3, доступно 0"
│   └─ кнопка «Купить кредиты ⭐»
│
├─ Клик → POST /api/buy-credits-link
│   └─ Ответ: { deepLink: "https://t.me/BotName?start=weblink_<otp>" }
│
├─ Extension открывает deep link в новой вкладке
│   └─ Пользователь попадает в Telegram бота
│
├─ Бот: /start weblink_<otp>
│   ├─ Валидация OTP → привязка telegram_id ↔ landing_user_id
│   ├─ Сообщение: "Аккаунт привязан ✅"
│   └─ Показ пакетов кредитов (inline keyboard)
│
├─ Пользователь выбирает пакет → sendInvoice → оплата Stars
│
├─ successful_payment:
│   ├─ Начисление кредитов в landing_users.credits (не photo_users!)
│   └─ Сообщение: "Зачислено N кредитов для PromptShot!"
│
└─ Extension: polling /api/me каждые 5 сек
    └─ credits увеличился → тост "Кредиты зачислены!" → можно генерировать
```

### 3.3. Повторная покупка (уже привязан)

```
Extension → POST /api/buy-credits-link
  └─ Проверка: уже привязан?
     ├─ Да → deepLink без OTP: "t.me/BotName?start=webcredits"
     └─ Нет → deepLink с OTP:  "t.me/BotName?start=weblink_<otp>"

Бот: /start webcredits
  └─ По telegram_id → lookup landing_user_telegram_links
     ├─ Привязка есть → сразу пакеты
     └─ Привязки нет → "Перейдите через extension для привязки"
```

## 4. База данных

### 4.1. Новая таблица: `landing_user_telegram_links`

```sql
-- Миграция: 145_landing_user_telegram_links.sql
CREATE TABLE IF NOT EXISTS landing_user_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(landing_user_id),
  UNIQUE(telegram_id)
);

CREATE INDEX idx_lutl_telegram_id ON landing_user_telegram_links(telegram_id);
CREATE INDEX idx_lutl_landing_user_id ON landing_user_telegram_links(landing_user_id);
```

**Ограничения:**
- `UNIQUE(landing_user_id)` — один web-аккаунт = один Telegram
- `UNIQUE(telegram_id)` — один Telegram = один web-аккаунт
- Защита от злоупотреблений: нельзя привязать один Telegram к нескольким web-акаунтам для переливания кредитов

### 4.2. Новая таблица: `landing_link_tokens`

```sql
-- Миграция: 145_landing_user_telegram_links.sql (тот же файл)
CREATE TABLE IF NOT EXISTS landing_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id) ON DELETE CASCADE,
  otp text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llt_otp ON landing_link_tokens(otp) WHERE NOT used;
```

**OTP формат:** 12-символьный hex (`crypto.randomBytes(6).toString("hex")`).
**TTL:** 10 минут. Одноразовый (used = true после привязки).

### 4.3. Новая таблица: `landing_web_transactions`

```sql
-- Миграция: 146_landing_web_transactions.sql
CREATE TABLE IF NOT EXISTS landing_web_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id),
  telegram_id bigint NOT NULL,
  amount int NOT NULL,
  price_stars int NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'created',
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lwt_landing_user ON landing_web_transactions(landing_user_id);
CREATE INDEX idx_lwt_state ON landing_web_transactions(state);
CREATE INDEX idx_lwt_charge ON landing_web_transactions(telegram_payment_charge_id);
```

**Зачем отдельная таблица?** Чтобы не трогать `photo_transactions` (которая привязана к `photo_users.id`). Web-транзакции ссылаются на `landing_users.id`.

### 4.4. RPC: начисление web-кредитов

```sql
-- Миграция: 146_landing_web_transactions.sql (тот же файл)
CREATE OR REPLACE FUNCTION landing_add_credits(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits int;
BEGIN
  UPDATE landing_users
  SET credits = credits + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO v_credits;

  IF NOT FOUND THEN RETURN -1; END IF;
  RETURN v_credits;
END;
$$;
```

## 5. API (Landing — Next.js)

### 5.1. `POST /api/buy-credits-link`

**Auth:** required (Supabase cookie).

**Логика:**
1. Получить `user.id` из auth
2. Проверить `landing_user_telegram_links` — есть ли привязка?
   - Есть → вернуть `{ deepLink: "https://t.me/{BOT}?start=webcredits", linked: true }`
   - Нет → создать OTP в `landing_link_tokens`, вернуть `{ deepLink: "https://t.me/{BOT}?start=weblink_{otp}", linked: false }`
3. Очистить просроченные токены: `DELETE FROM landing_link_tokens WHERE expires_at < now()`

**Response:**
```json
{
  "deepLink": "https://t.me/PixelNanoBot?start=weblink_a1b2c3d4e5f6",
  "linked": false
}
```

**Env:** `TELEGRAM_BOT_LINK` — базовый URL бота (напр. `https://t.me/PixelNanoBot`). Не хардкодить имя бота.

### 5.2. `GET /api/me` — без изменений

Уже возвращает `{ user, credits }` из `landing_users`. Extension поллит этот endpoint для отслеживания зачисления.

## 6. Бот (aiphoto/src/index.ts)

### 6.1. Обработка `/start weblink_<otp>`

В существующем обработчике `/start`:

```
if (startPayload.startsWith("weblink_")) {
  const otp = startPayload.replace("weblink_", "");
  // 1. Найти токен: SELECT * FROM landing_link_tokens WHERE otp = ? AND NOT used AND expires_at > now()
  // 2. Если не найден → "Ссылка устарела, попробуйте снова из extension"
  // 3. Проверить landing_user_telegram_links — уже привязан telegram_id?
  //    → Если да к другому user → "Этот Telegram уже привязан к другому аккаунту"
  // 4. UPSERT landing_user_telegram_links (landing_user_id, telegram_id)
  // 5. UPDATE landing_link_tokens SET used = true WHERE id = token.id
  // 6. Сообщение: "✅ Аккаунт PromptShot привязан!"
  // 7. Показать WEB_CREDIT_PACKS (showWebCreditPacks)
}
```

### 6.2. Обработка `/start webcredits`

```
if (startPayload === "webcredits") {
  // 1. По ctx.from.id найти landing_user_telegram_links
  // 2. Если привязки нет → "Привяжите аккаунт через extension"
  // 3. Показать WEB_CREDIT_PACKS (showWebCreditPacks)
}
```

### 6.3. Пакеты для web-кредитов

```typescript
const WEB_CREDIT_PACKS = [
  { credits: 1, price: 1, label_ru: "🔹 Мини", label_en: "🔹 Mini" },
  { credits: 10, price: 150, label_ru: "⭐ Старт", label_en: "⭐ Start" },
  { credits: 30, price: 300, label_ru: "💎 Поп",   label_en: "💎 Pop" },
  { credits: 100, price: 700, label_ru: "👑 Про",   label_en: "👑 Pro" },
];
```

**Callback формат:** `webpack_{credits}_{price}` (напр. `webpack_1_1`, `webpack_10_150`).

Пакеты задаются в `payment-bot` (могут отличаться от старых бот-пакетов фото-бота), но:
- Отдельный callback prefix `webpack_` для отличия от обычных `pack_`
- `trialOnly` / `adminOnly` / `hidden` — отдельный вопрос, можно добавить позже

### 6.4. Обработка `webpack_{credits}_{price}`

```
bot.action(/^webpack_(\d+)_(\d+)$/, async (ctx) => {
  const credits = parseInt(match[1]);
  const price = parseInt(match[2]);
  const telegramId = ctx.from.id;

  // 1. Найти привязку: SELECT landing_user_id FROM landing_user_telegram_links WHERE telegram_id = ?
  // 2. Если нет → ошибка
  // 3. Валидировать пакет в WEB_CREDIT_PACKS
  // 4. Создать landing_web_transactions (landing_user_id, telegram_id, amount, price_stars, state: "created")
  // 5. sendInvoice (payload = "[{transaction_id}]", currency: "XTR", price)
});
```

### 6.5. `successful_payment` — web-транзакции

В существующем `successful_payment` handler добавить ветку:

```
const transactionId = invoicePayload.replace(/[\[\]]/g, "");

// Попробовать найти в landing_web_transactions
const { data: webTx } = await supabase
  .from("landing_web_transactions")
  .select("*")
  .eq("id", transactionId)
  .eq("state", "created")
  .maybeSingle();

if (webTx) {
  // Web payment flow:
  // 1. UPDATE landing_web_transactions SET state = 'done', charge_ids...
  // 2. landing_add_credits(webTx.landing_user_id, webTx.amount)
  // 3. Сообщение: "✅ Зачислено {amount} кредитов для PromptShot!"
  // 4. Notification в алерт-канал
  return;
}

// ... fallback: existing photo_transactions flow ...
```

**Idempotency:** проверка `telegram_payment_charge_id` в `landing_web_transactions` (аналогично `photo_transactions`).

### 6.6. `pre_checkout_query` — без изменений

Уже отвечает instant OK для всех запросов. Валидация в `successful_payment`.

## 7. Extension (sidepanel)

### 7.1. Кнопка «Купить кредиты»

Показывается когда:
- `state.credits < requiredCredits` (до запуска генерации)
- При ошибке `insufficient_credits` (после попытки)

```html
<button class="buy-credits-btn" onclick="openBuyCredits()">
  Купить кредиты ⭐
</button>
```

### 7.2. `openBuyCredits()`

```javascript
async function openBuyCredits() {
  try {
    const data = await api("/api/buy-credits-link", { method: "POST" });
    window.open(data.deepLink, "_blank");
    startCreditPolling();
  } catch (err) {
    setToast("error", normalizeUiError(err, "Не удалось получить ссылку"));
  }
}
```

### 7.3. Polling кредитов

```javascript
let creditPollTimer = null;
const CREDIT_POLL_INTERVAL = 5000;
const CREDIT_POLL_MAX = 60; // 5 мин макс

function startCreditPolling() {
  let polls = 0;
  const prevCredits = state.credits;
  state.info = "Ожидаем оплату… Вернитесь сюда после оплаты в Telegram";
  render();

  creditPollTimer = setInterval(async () => {
    polls++;
    await checkAuth(); // обновляет state.credits
    if (state.credits > prevCredits) {
      clearInterval(creditPollTimer);
      setToast("success", `Зачислено ${state.credits - prevCredits} кредитов!`);
      state.info = "";
      render();
    } else if (polls >= CREDIT_POLL_MAX) {
      clearInterval(creditPollTimer);
      state.info = "Таймаут ожидания. Если вы оплатили — обновите страницу.";
      render();
    }
  }, CREDIT_POLL_INTERVAL);
}
```

### 7.4. UI состояния

| Состояние | Что показываем |
|-----------|---------------|
| `credits < required` | Кнопка «Купить кредиты ⭐» + текст «Нужно {N}, доступно {M}» |
| После клика на «Купить» | «Ожидаем оплату…» + spinner + deep link открыт |
| Кредиты зачислены | Toast «Зачислено N кредитов!» + кнопка Generate активна |
| Таймаут polling | «Таймаут ожидания. Обновите страницу.» |
| Ошибка API | Нормализованное сообщение через `normalizeUiError` |

## 8. Безопасность

### 8.1. OTP

- 12 hex символов = 48 бит энтропии (достаточно для 10-минутного TTL)
- Одноразовый: `used = true` после привязки
- TTL: 10 минут (`expires_at < now()` → невалиден)
- Очистка: при каждом вызове `/api/buy-credits-link` чистим expired токены

### 8.2. One-to-one привязка

- `UNIQUE(telegram_id)` в `landing_user_telegram_links` — один Telegram аккаунт не может быть привязан к нескольким web-аккаунтам
- `UNIQUE(landing_user_id)` — один web-аккаунт не может иметь несколько Telegram привязок
- Предотвращает атаку: «создать 10 web-аккаунтов → привязать один Telegram → покупать кредиты и переливать»

### 8.3. Idempotency платежей

- `telegram_payment_charge_id` в `landing_web_transactions` — проверка дублей
- Atomic update `state: created → done` — только одна запись может быть обновлена
- Аналогично существующей логике в `photo_transactions`

### 8.4. Race condition: OTP

- Между генерацией OTP и использованием в боте — 10 мин окно
- Если пользователь генерирует OTP повторно до использования первого — оба валидны, но первый использованный привяжет аккаунт, второй просто сделает то же самое (upsert)

## 9. Граничные случаи

| Кейс | Поведение |
|------|-----------|
| Telegram уже привязан к другому web-аккаунту | Бот: «Этот Telegram уже привязан к другому аккаунту PromptShot» |
| Web-аккаунт уже привязан к другому Telegram | API: возвращает deep link без OTP (привязка уже есть) |
| OTP просрочен | Бот: «Ссылка устарела. Нажмите "Купить кредиты" в extension ещё раз» |
| Пользователь не авторизован на сайте | Extension: redirect на auth (уже реализовано) |
| Бот не запущен у пользователя | Telegram откроет диалог с кнопкой Start — нормальный flow |
| Двойная оплата (duplicate charge) | Idempotency guard по `telegram_payment_charge_id` |
| Пользователь оплатил, но extension закрыт | При следующем открытии `checkAuth()` покажет обновлённый баланс |
| Бот-кредиты vs web-кредиты | Раздельные: оплата через `webpack_` → `landing_users.credits`, обычная `pack_` → `photo_users.credits` |

## 10. Что НЕ меняется

- `landing_deduct_credits` — списание кредитов на лендинге (без изменений)
- `photo_deduct_credits` — списание кредитов в боте (без изменений)
- `/api/generate` — проверка и списание кредитов (без изменений)
- `/api/me` — возврат user + credits (без изменений)
- `photo_transactions` — таблица транзакций бота (без изменений)
- `pre_checkout_query` handler — instant OK (без изменений)
- CREDIT_PACKS бота — обычные бот-пакеты (без изменений)

## 11. Миграции

| # | Файл | Что |
|---|------|-----|
| 145 | `145_landing_user_telegram_links.sql` | Таблицы `landing_user_telegram_links` + `landing_link_tokens` |
| 146 | `146_landing_web_transactions.sql` | Таблица `landing_web_transactions` + RPC `landing_add_credits` |

## 12. Env Variables

| Переменная | Где | Описание |
|---|---|---|
| `TELEGRAM_BOT_LINK` | Landing (.env) | `https://t.me/PixelNanoBot` — для генерации deep link |

Бот уже имеет `TELEGRAM_BOT_TOKEN` и доступ к Supabase — дополнительных переменных не нужно.

## 13. Оценка

| Шаг | Время |
|-----|-------|
| SQL: миграции 145 + 146 | 0.5 дня |
| API: `POST /api/buy-credits-link` | 0.5 дня |
| Бот: `weblink_`, `webcredits`, `webpack_`, `successful_payment` | 1 день |
| Extension: кнопка, deep link, polling | 0.5 дня |
| E2E тестирование (test env) | 0.5 дня |
| **Итого** | **~3 дня** |

## 14. Архитектурный ревью

### Проверено: нет конфликтов

| Аспект | Статус | Детали |
|--------|--------|--------|
| `photo_transactions` trigger | OK | В боте кредиты `photo_users` начисляются через DB trigger `add_credits_on_transaction` при `state → done`. Для web-транзакций триггер **не нужен** — используем явный `landing_add_credits` RPC, т.к. trigger привязан к `photo_transactions`, а мы пишем в `landing_web_transactions` |
| `pre_checkout_query` | OK | Уже instant OK без DB запросов — работает для любых invoice (бот и web) |
| `successful_payment` routing | OK | Добавляется lookup в `landing_web_transactions` **перед** existing `photo_transactions` flow. Если найден — web path, если нет — existing path. Invoice payload формат одинаковый `[{uuid}]` |
| CORS | OK | `/api/buy-credits-link` — POST с auth, уже покрывается middleware.ts CORS для extension |
| Auth | OK | Extension уже передаёт cookies через `credentials: "include"`, `/api/buy-credits-link` использует тот же `supabase-server-auth` |
| Supabase access из бота | OK | Бот уже использует `SUPABASE_SERVICE_ROLE_KEY` — может писать в `landing_*` таблицы без RLS ограничений |

### Потенциальные риски

| Риск | Митигация |
|------|-----------|
| Бот не знает имя web-пользователя для персонализации | Можно достать из `landing_users.display_name` по `landing_user_id`. Не критично для MVP |
| Пользователь привязал Telegram, потом удалил web-аккаунт | `ON DELETE CASCADE` в `landing_user_telegram_links` — запись удалится. При следующей покупке — «привязка не найдена» |
| Пользователь не вернулся в extension после оплаты | Кредиты всё равно зачислены. При следующем открытии extension `checkAuth()` покажет баланс |
| Race condition: два OTP для одного user одновременно | Оба валидны, первый использованный сделает UPSERT, второй сделает тот же UPSERT (идемпотентно) |
| Бот перезапущен между `sendInvoice` и `successful_payment` | `landing_web_transactions` персистентна, `successful_payment` найдёт транзакцию по payload UUID |

### Решение: начисление кредитов

Для `photo_transactions` кредиты начисляются **DB триггером** (`on_transaction_done`).
Для `landing_web_transactions` кредиты начисляются **явно в коде** через `landing_add_credits` RPC.

Почему не триггер для web:
1. Триггер на `photo_transactions` привязан к `photo_users.credits` — чужая таблица
2. Создавать аналогичный триггер на `landing_web_transactions` — overhead для одного use case
3. Явный вызов RPC проще отлаживать, логировать и тестировать

## 15. Smoke Test

1. **Привязка:** Extension → «Купить кредиты» → Telegram → бот пишет «✅ Привязан» → DB: `landing_user_telegram_links` содержит запись
2. **Оплата:** Выбрать пакет → оплатить Stars → бот пишет «Зачислено N» → DB: `landing_users.credits` увеличился, `landing_web_transactions.state = 'done'`
3. **Extension polling:** После оплаты → sidepanel показывает тост «Зачислено N кредитов» → кнопка Generate активна
4. **Повторная покупка:** Extension → «Купить кредиты» → бот сразу показывает пакеты (без привязки)
5. **Просроченный OTP:** Подождать 10+ минут → в боте «Ссылка устарела»
6. **Duplicate:** Попытка привязать Telegram к второму web-аккаунту → «Уже привязан к другому аккаунту»
7. **Idempotency:** Повторная обработка того же `successful_payment` → не начисляет кредиты дважды
