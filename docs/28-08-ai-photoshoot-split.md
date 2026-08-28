# 28-08 — Нарезка листа AI-фотосессии на 4 кадра

> Дата: 2026-08-28  
> Ветка: `feature/28-08-ai-photoshoot-split`  
> Статус: в работе  
> Меняет D2 из `docs/28-08-ai-photoshoot.md`

## Решение

После I2I тот же `web-generation-worker` режет 2×2 лист через `sharp.extract` (логика PackAssemble из photo2sticker, без rembg/Pixian). Лист остаётся каноническим `result_storage_path`. Четыре JPEG — sidecar `lease-1.jpg`…`lease-4.jpg`, пути в `photoshoot_tile_paths` (SQL `225`).

Split fail не валит job: лист уже готов, UI падает на CSS crop.

## Не делаем

- Отдельный rembg-воркер
- Inset/детектор шва (на 1024 лист без желоба не нужен)
- 4 отдельных generation row
