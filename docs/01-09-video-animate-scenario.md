# 01-09 — Video compose снова пишет motion-сценарий

> Дата: 2026-09-01
> Ветка: `feature/01-09-video-animate-scenario`
> Поверхность: generate-dock video tile (`CardInlineGeneratePanel`) + `POST /api/generate/animate-scenario`

## Проблема

После выноса видео в отдельную compose-плитку `POST /api/generate/animate-scenario` вызывался только в `enterVideoCompose` / seed `intent=animate`. Кадр при этом часто ещё не выбран: пользователь жмёт «Видео», потом фото в «Ваши фото». Ручка не стартует, в поле остаётся пусто или `Оживи изображение`.

## Решения

| # | Решение |
|---|---|
| D1 | SSOT источника кадра: `resolveVideoAnimateScenarioSource` (parent XOR одно library-фото, в т.ч. `generation-<uuid>.jpg`) |
| D2 | Один эффект в панели: смена `composeMode=video` или кадра → `shouldRequestVideoAnimateScenario` → ручка |
| D3 | Видео — одно фото, как «Промт по фото»: radio-выбор, cap 1, clamp при входе |
| D4 | Без кадра плитка «Видео» открывает «Ваши фото», не шторку моделей |
| D5 | Catalog Repeat (`intent=animate` + не-generic `Motion:`) ручку не зовёт — не затираем посеянный beat |

## Вне scope

- Контракт Gemini / proxy у `animate-scenario`
- Worker I2V assembly
- Listing video Repeat enqueue
