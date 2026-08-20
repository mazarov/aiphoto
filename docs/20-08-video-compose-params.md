# 20-08 — Video compose: параметры, цена, два фото

> Дата: 2026-08-20
> Статус: код готов; выкат: SQL 200 → worker → landing
> Ветка: `feature/20-08-video-compose-params`

## Цель

В compose «Оживить» пользователь выбирает формат и длительность. Цена на CTA растёт от длительности. Кадр и исходное фото показаны раздельно. Развёрнутый промпт прячет параметры.

## Контракт

| Параметр | Значения | Доплата |
|---|---|---|
| Формат | `9:16`, `16:9` | 0 |
| Длительность | 4 / 6 / 8 / 10 сек | +0 / +10 / +20 / +30 |
| Качество | `720p` | 0 (Omni Flash не умеет 1080p) |
| База | `video_models.cost` | 30 |

Итого: `30 / 40 / 50 / 60`. Считает сервер (`calculateVideoCreditCost`), UI только показывает.

Gemini Interactions: `response_format.duration` вида `"6s"`. `video_config` по-прежнему только `{ task: "image_to_video" }`. SQL `200` — allowlist `{4,6,8,10}`.

## Превью

- **Для генерации** — кадр (result parent / linked generation).
- **Референс** — исходный аплоад (`GET /api/generations/:id` → `inputPhotoUrl`).
- Одно фото без parent — только «Для генерации».

## UI

Чипы формат / время / качество открывают непрозрачный поповер (один за раз), который перекрывает ряд. Модель и quantity=1 — display-only.

`promptExpanded` скрывает `VideoComposeBar` и footer через `hidden` (dock и modal).
