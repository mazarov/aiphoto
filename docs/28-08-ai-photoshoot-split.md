# 28-08 — Нарезка листа AI-фотосессии на 4 кадра

> Дата: 2026-08-28  
> Ветка: `feature/28-08-ai-photoshoot-split`  
> Статус: в работе  
> Меняет D2 из `docs/28-08-ai-photoshoot.md`

## Решение

После I2I тот же `web-generation-worker` режет 2×2 лист через `sharp.extract` (логика PackAssemble из photo2sticker, без rembg/Pixian). Лист остаётся внутренним `result_storage_path` для нарезки. Четыре JPEG — sidecar `lease-1.jpg`…`lease-4.jpg`, пути в `photoshoot_tile_paths` (SQL `225`). Пользователю лист не показываем и не отдаём: poll/история/оверлей/UGC/скачивание — только тайлы (`resolvePhotoshootUserFacingResult`). Publish пишет все 4 тайла в одну `prompt_cards` (`photoshootUserFacingMediaPaths`).

Split fail валит job (retryable `photoshoot_split_failed`): без 4 кадров photoshoot не completed.

## Не делаем

- Отдельный rembg-воркер
- Inset/детектор шва
- 4 отдельных generation row
