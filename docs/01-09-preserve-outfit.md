# 01-09 — Оставить одежду с референс-фото

> Дата: 2026-09-01
> Ветка: `feature/01-09-preserve-outfit`
> Статус: реализация на ветке; флаг `preserve_outfit_enabled=false`
> Поверхности: generate-dock image compose (`CardInlineGeneratePanel`), `POST /api/generate`, worker I2I (Gemini / Grok / Seedream)

## Цель

На обычной генерации с своим фото пользователь может **оставить одежду с референса**, а сцену/позу взять из промпта карточки. По умолчанию поведение не меняется: каталог по-прежнему переодевает под текст.

## Продуктовые решения

| # | Решение |
|---|---|
| D1 | Чип «Оставить одежду» только в `composeMode=image` при выбранном library-фото и включённом флаге |
| D2 | Выкл = `replace` (как сейчас). Вкл = `keep` |
| D3 | При `keep` фото — единственный источник гардероба, обуви и носимых аксессуаров. `Clothing:` карточки гасится |
| D4 | Волосы и макияж не входят в lock |
| D5 | Фотосессия / orbit / video / vibe / local edit — вне скоупа (там свои правила) |
| D6 | Флаг `preserve_outfit_enabled` default **false**. UI и API читают один ключ |
| D7 | Политика пишется в `landing_generations.wardrobe_policy` на enqueue (не в `prompt_text` / `edit_instruction`) |
| D8 | Выбор чипа сохраняется в generation-preferences |
| D9 | Один I2I-вызов, без extra vision-pass |

## Вне scope

- Сегментация одежды / ControlNet / второй референс только с одеждой
- Vibe dual-image
- Принудительный keep на фотосессии (уже LOCK)

## Выкат

1. Применить SQL `235`
2. Задеплоить лендинг и worker (`wardrobe-policy.ts` в `Dockerfile.worker` / `web-generation-worker/Dockerfile`)
3. `UPDATE landing_generation_config SET value = 'true' WHERE key = 'preserve_outfit_enabled'`

## Checklist

- [x] `wardrobe_policy` на `landing_generations` + `p_wardrobe_policy` в enqueue
- [x] Флаг `preserve_outfit_enabled` default false
- [x] Чип «Оставить одежду» + prefs `preserveOutfit`
- [x] Gemini / Grok / Seedream ассемблеры + нейтрализация Clothing
- [x] Fingerprint включает policy
- [x] Worker Docker COPY `wardrobe-policy.ts`
