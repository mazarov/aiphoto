# Scout analyze — открытая ручка фото→промт для бота

> Дата: 2026-08-23  
> Ветка: `feature/23-08-scout-analyze`  
> Статус: implemented

Отдельная ручка для Grok Bot: без логина, без Bearer, без `landing_users.credits`.  
Публичный `POST /api/extension/analyze` не меняется (там по-прежнему 10 бесплатных + 1 кредит).

## Контракт

```
GET/POST https://promptshot.ru/api/scout/analyze
```

Авторизации нет. Единственная защита — **200 успешных разборов на UTC-сутки** на бакете `scout:v1` (общий пул на всю ручку). Дальше `429`. Ошибка Gemini слот не сжигает.

Кто знает URL, делит эти 200 слотов. Не публиковать в sitemap.

### Body (POST)

Ровно одно из `image_base64` (data URL) или `image_url`.  
Бот шлёт **base64** — URL с X с лендинга в РФ часто не скачивается.

`locale` по умолчанию `ru`. Extract тот же photoreal Gemini Flash.

### Ответ

```json
{
  "prompt": "...",
  "quota": {
    "mode": "free",
    "free_max": 200,
    "remaining_free": 194,
    "daily_limit": 200,
    "credits_charged": 0
  }
}
```

GET без body — только `quota`.

### История

`analyze_history.client_source = scout`, `user_id = null`, `credits_spent = 0`.

## Бот

```text
POST https://promptshot.ru/api/scout/analyze
Content-Type: application/json

{ "image_base64": "data:image/jpeg;base64,...", "locale": "ru" }
```

Если `429` — лимит на сегодня, стоп. Промт не выдумывать.
