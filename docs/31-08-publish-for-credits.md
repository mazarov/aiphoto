# 31-08 — Публикация генераций за кредиты

> Дата: 2026-08-31  
> Ветка: `feature/31-08-publish-for-credits`  
> Статус: код на ветке; флаг `publish_reward_enabled=false`  
> Поверхности: result chrome (`GenerationPublishStrip` + ⋮), `/generations`, `/p/[slug]` owner, `POST /api/generations/[id]/publish`, `PATCH /api/my-cards/[slug]/visibility`

## Цель

Пользователь публикует свою генерацию в каталог и сразу получает кредиты: **1** за фото, **5** за видео, **2** за фотосессию. Дневной кэп **20** (Europe/Moscow). Видео впервые становится карточкой `/p/[slug]` (постер + mp4).

## Продуктовые решения

| # | Решение |
|---|---|
| D1 | Начисление сразу при первом `false → true`. Hide/show и «Обновить промпты» не дают второй бонус |
| D2 | 1 раз на `landing_generations.id`. Unpublish не clawback |
| D3 | Кэп 20 кр/день/аккаунт, MSK. Суммы и кэп в `landing_generation_config` |
| D4 | Старые карточки без `first_published_at` — без бэкапа |
| D5 | Admin publish без бонуса. User routes only |
| D6 | Видео = poster `photo` + mp4 `video`. Listing RPC не трогаем |
| D7 | Флаг `publish_reward_enabled` default **false** |
| D8 | `+N✦` на полоске результата, в ⋮ и на тайле `/generations`. Не в rail |
| D9 | Кэп не покрывает N — CTA без `+N`, публикация всё равно проходит |
| D10 | Один тап, без модалки |

## Вне scope

- Модерация / hold
- Clawback
- Бейдж «Видео» в listing RPC
- Worker auto-draft для video
- Telegram / STV

## Выкат

1. Применить SQL `231`
2. Задеплоить код
3. `UPDATE landing_generation_config SET value = 'true' WHERE key = 'publish_reward_enabled'`
