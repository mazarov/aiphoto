# Промпт по фото — генерация промпта из загруженного изображения

> Статус: идея / планирование
> Дата: 2026-03-16

## Суть

Пользователь на лендинге загружает фото → получает детальный промпт для воспроизведения этого фото в нейросетях (Midjourney, DALL-E, Flux, Stable Diffusion).

## Flow

```
Кнопка "Промпт по фото"
  → Загрузка фото (drag & drop / file picker)
  → Ресайз на клиенте до ~1024px
  → POST /api/prompt-from-photo
  → Gemini Vision API (Flash)
  → Структурированный промпт
  → Отображение + кнопка "Скопировать"
```

## Стоимость

| Модель | Стоимость за запрос | Запросов на $1 |
|---|---|---|
| Gemini 2.5 Flash | ~$0.0003 | ~3000 |
| Gemini 2.5 Pro | ~$0.003 | ~300 |

Рекомендация: Flash достаточен для этой задачи.

## Архитектура (MVP)

```
Landing (Next.js)
  └── /api/prompt-from-photo (API route)
        ├── validate file (size ≤ 5MB, type: image/*)
        ├── resize if needed (sharp)
        ├── call Gemini Vision API
        ├── extract structured prompt
        ├── save to prompt_library (без фото)
        ├── rate limit (by IP)
        └── return prompt to client
```

## Наполнение базы промптов (UGC)

Каждый запрос пользователя сохраняется в БД для будущей prompt gallery:

- Сохраняем **только промпт**, фото не храним
- Gemini в том же запросе ставит `quality_score` (1-10) и `category`
- Публикация: только промпты с `quality_score ≥ 7`
- Автофильтрация: NSFW, слишком короткие, мусорные

### Таблица `prompt_library`

```sql
create table prompt_library (
  id uuid primary key default gen_random_uuid(),
  prompt_text text not null,
  category text,              -- portrait, landscape, food, architecture, etc.
  style text,                 -- realistic, anime, cinematic, etc.
  target_model text,          -- midjourney, dalle, flux, sd
  quality_score int,          -- 1-10 from Gemini
  language text default 'en',
  is_published boolean default false,
  created_at timestamptz default now()
);
```

### Стратегия наполнения

| Фаза | Действие |
|---|---|
| MVP | Все промпты → `is_published = false`, ручная проверка качества |
| v2 | Автопубликация при `quality_score ≥ 7` |
| v3 | Кластеризация, категории, SEO-страницы `/prompts/[slug]` |
| v4 | Upvote от пользователей, топ промптов |

## Дополнительные фичи (после MVP)

- **Выбор нейросети:** дропдаун MJ / DALL-E / Flux / SD — промпт адаптируется под синтаксис
- **Варианты стиля:** один клик — реалистичный / аниме / cinematic промпт
- **Негативный промпт:** для SD — генерировать negative prompt
- **Хранение фото (opt-in):** пользователь соглашается → thumbnail 400x400 → пара "фото + промпт" в галерее (без лиц)

## Защита от абьюза

- Rate limit: 5 запросов / IP / час (без авторизации)
- После лимита: предложить авторизацию через Telegram
- Ресайз на клиенте: canvas API → max 1024px → снижает трафик
- Лимит размера на сервере: 5 МБ

## Конверсия

- Первый промпт бесплатно → "Хочешь больше? Авторизуйся через Telegram"
- Кнопка "Сгенерировать в нашем боте" рядом с промптом
- Prompt gallery → SEO-трафик → конверсия в бота

## Открытые вопросы

- [ ] Нужен ли дисклеймер о сохранении промпта?
- [ ] Какой лимит бесплатных запросов? (3/день? 5/час?)
- [ ] Хранить ли фото позже (opt-in с фильтром лиц)?
- [ ] Prompt gallery — отдельный раздел или интеграция с текущими карточками?
