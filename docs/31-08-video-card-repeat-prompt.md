# 31-08 — Промпт видео-карточки для повтора

> Дата: 2026-08-31  
> Ветка: `feature/31-08-video-card-repeat-prompt`  
> Статус: v1 в коде  
> Поверхности: `ensureCardForCompletedGeneration`, UGC `prompt_variants`, card «Повторить»

## Цель

Опубликованная видео-карточка хранит промпт, по которому посетитель может повторить **сцену + движение** на своём фото. Сейчас в карточку попадает только motion `landing_generations.prompt_text` («шары поднимаются…») — он корректен лишь при оживлении **того же** parent-кадра.

## Продуктовые решения

| # | Решение |
|---|---|
| D1 | На publish/ensure видео-карточки писать **image-промпт parent-фото + Motion**, не голый motion |
| D2 | Parent: `parent_generation_id`, иначе `landing_user_photos.source_generation_id` у input-фото. Один уровень, не video→video |
| D3 | Generic motion (`Оживи изображение`) не добавлять, если есть image-промпт |
| D4 | Уже созданная UGC-карточка: тот же assemble на повторном ensure (повторный Publish чинит старые клипы) |
| D5 | «Повторить» без смены UX: сеет `promptTexts` карточки в video-dock + «Ваши фото» |
| D6 | Модели остаются image-to-video. Reference mp4 / V2V — вне scope |

## Вне scope (v2)

- Analyze видео (12 блоков фото + Motion) на publish
- Двухшаговый Repeat (сначала фото, потом I2V)
- SQL-бэкфилл всех старых карточек
- Video-to-video

## Выкат

1. Задеплоить лендинг  
2. Старые клипы: автор ещё раз нажимает «Опубликовать» / ensure — промпт пересоберётся  
3. Analyze-video — отдельная спека
