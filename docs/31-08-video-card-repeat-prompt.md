# 31-08 — Повтор видео из листинга: look + motion

> Дата: 2026-08-31  
> Ветка: `feature/31-08-video-card-repeat-prompt`  
> Статус: цепочка photo → I2V в коде  
> Поверхности: publish/ensure карточки, `POST /api/generate` `pipeline`, worker followup, card «Повторить»

## Цель

Посетитель на витрине выбирает опубликованный ролик и повторяет его со своим фото: сначала фото по look-промпту карточки, затем то же движение, что было в исходном клипе.

I2V по чужому кадру это не делает — модели остаются image-to-video.

## Продуктовые решения

| # | Решение |
|---|---|
| D1 | На publish/ensure видео-карточки писать **две секции**: image-промпт parent-фото + `Motion:` |
| D2 | Parent look: `parent_generation_id`, иначе `landing_user_photos.source_generation_id`. Один уровень |
| D3 | Секция `Motion:` пишется всегда (в т.ч. generic «Оживи изображение»), чтобы Repeat умел split |
| D4 | Уже созданная UGC-карточка: тот же assemble на повторном ensure |
| D5 | Repeat с витрины = **два job**. a) image I2I (look + 1 фото посетителя) b) video I2V (parent = a, только motion) |
| D6 | SSOT followup — worker после `generation_completed` image. Клиент только poll + hop. GET `[id]` чинит потерянный followup тем же idempotency key |
| D7 | Кредиты: проверка `image + video` на первом enqueue, списание image сразу, video — на followup. Image fail → video не стартует. Video enqueue fail → остаётся фото |
| D8 | I2V user beat: SSOT `videoI2vUserPrompt` (секция `Motion:` или короткий beat, clamp 400). Каталожный Visual Hook в Grok/Veo не уходит |
| D9 | Модели остаются image-to-video. Catalog mp4 / V2V / analyze-video — вне scope |
| D10 | Флаг `listing_video_repeat_chain` в `landing_generation_config` (SQL `234`, default `true` — это замена сломанного I2V-only Repeat) |

## Пайплайн

```
publish video → card variants: [image look] + Motion: [beat]
listing → /p/[slug] → Повторить + 1 своё фото
  → POST /api/generate  modality=image + pipeline.kind=listing_video_repeat
  → landing_generations.pipeline_spec
  → worker: image I2I
  → worker: landing_enqueue_generation video, parent=image, idempotency listing-video-repeat:{imageId}
  → I2V (Grok/Veo/Seedance) с videoI2vUserPrompt(motion)
```

`pipeline_spec`:

```json
{
  "kind": "listing_video_repeat",
  "videoPrompt": "Крылья медленно раскрываются",
  "videoModel": "grok-imagine-video-1.5",
  "durationSeconds": 4,
  "aspectRatio": "9:16",
  "resolution": "720p",
  "credits": 30
}
```

Не новый `edit_kind`. `landing_enqueue_generation` не меняем.

Старые карточки без look: split даёт пустой `imagePrompt` → клиент падает в обычный I2V (одно фото, только motion). Re-Publish собирает две секции.

## Вне scope (v2)

- Analyze видео (12 блоков + Motion) на publish
- SQL-бэкфилл всех старых карточек
- Video-to-video / reference mp4
- Hover Repeat на masonry

## Выкат

1. Применить SQL `234` (колонка `pipeline_spec` + флаг)
2. Задеплоить **лендинг и worker**
3. Старые клипы: автор ещё раз жмёт «Опубликовать» / ensure — в карточке появятся обе секции
