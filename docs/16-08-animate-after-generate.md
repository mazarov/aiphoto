# 16-08 — Оживить фото (Veo Omni Flash)

> Дата: 2026-08-16  
> Статус: код готов, выкат: SQL 189 → worker → landing → `video_animate_enabled=true`  
> Ветка: `feature/16-08-animate-after-generate`

## Цель

После готового фото и из generate-dock пользователь может оживить один кадр в короткое видео. Это отдельный durable job, не шаг внутри image-генерации.

## Контракт v1

| Параметр | Значение |
|---|---|
| Промпт по умолчанию | Gemini 2.5 Flash придумывает короткий сценарий по фото; fallback `Оживи изображение` |
| Модель UI | Veo Omni Flash |
| Модель API | `gemini-omni-flash-preview` |
| Кадр | `9:16` или `16:9` |
| Длительность | 4 сек |
| Разрешение | 720p (`image_size`) |
| Количество | 1 |
| Кредиты | 30 из `landing_generation_config.video_models` |
| Источник | ровно одно фото: parent image generation **или** одно upload-фото |
| UGC / библиотека | нет |

Text-only video и video-from-video запрещены.

Провайдер: Gemini Interactions API (`POST /v1beta/interactions`).  
Официальный Omni unary: `background=false`, `store=false`, `stream=false`. `video_config` — только `{ task: "image_to_video" }`; `aspect_ratio` — в `response_format`. `background=true` на consumer API даёт opaque `invalid_request` («You will not be charged»). Длительность 4с храним у себя.

## Flow

```text
фото (generation result или библиотека)
  → клик «Оживить» → POST /api/generate/animate-scenario (Flash 2.5 + фото + исходный промпт)
  → короткий сценарий в поле промпта
  → POST /api/generate { modality: "video" }
  → landing_enqueue_generation (30 кредитов, create_ugc=false)
  → web-generation-worker claim (video cap)
  → Interactions create → provider_operation_id
  → poll / resume
  → upload mp4 → completed
  → клиент poll /api/generations/:id
```

## Статусы

`pending` → `processing` → `completed` | `failed`

`provider_operation_id` пишется сразу после submit. Рестарт воркера только poll-ит тот же Interaction.

## Выключатель

`landing_generation_config.video_animate_enabled` = `true` | `false`.  
Пока `false` — API отвечает `video_disabled`, UI не показывает «Оживить».  
Исключение: allowlist `INTERNAL_GENERATE_ALLOWLIST` / default `azarov.maxim@gmail.com` — CTA и enqueue доступны всегда. Локальный `next dev` тоже открыт.

## Rollback

1. `video_animate_enabled=false`
2. Worker перестаёт claim-ить video, если выключить `WORKER_VIDEO_PROCESSING_ENABLED`
3. Колонки аддитивны — откат схемы не нужен

## Выкат

1. SQL `189`
2. Worker
3. Landing
4. Включить флаг после admin-прогона
