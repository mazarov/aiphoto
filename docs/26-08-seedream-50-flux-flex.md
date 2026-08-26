# 26-08 — Seedream 5.0 Pro + Flux 2 Flex (OpenRouter)

> Дата: 2026-08-26  
> Статус: реализация  
> Ветка: `feature/26-08-seedream-50-flux-flex`

## Цель

Два новых пункта пикера в прод, тот же OpenRouter Image API и DO-прокси:

| Пикер | OpenRouter | Кредиты |
|---|---|---|
| `seedream-5.0-pro` | `bytedance-seed/seedream-5-0-pro` | 10 |
| `flux-2-flex` | `black-forest-labs/flux.2-flex` | 10 |

Дефолтный image-фолбек после Grok: **Seedream 4.5 → Seedream 5.0 Pro**.

Seedream 4.5 в пикере остаётся.

## Контракт

- Submit: `POST {OPENROUTER_BASE_URL}/api/v1/images`, sync, `n=1`, `output_format=png`.
- Seedream 5.0 Pro: `resolution` `1K` \| `2K` (4K → 2K). До 14 референсов.
- Flux 2 Flex: `resolution` не шлём (поля нет в модели). UI 1K/2K, 4K → 2K. До 8 референсов.
- Референсы — signed Storage URL, не `/u/`.
- `executed_model` = продукт-id (`seedream-5.0-pro` / `flux-2-flex` / `seedream-4.5`), не хардкод 4.5.

## Fallback

`image_fallback_secondary_model` = `seedream-5.0-pro` (SQL `218`).  
Цепочка без изменений: Gemini → Grok → Seedream. Primary Seedream/Flux без следующего хопа.

Kill-switch: пустое значение или `enabled:false` у `seedream-5.0-pro`.

## Worker Docker

`openrouter-seedream.ts` импортирует `landing/src/lib/generation/image-options.ts`.  
Файл должен быть в `web-generation-worker/tsconfig.json` include **и** в `COPY` `Dockerfile.worker` / `web-generation-worker/Dockerfile`. Иначе Dockhost `tsc` — `TS2307`.

## Выкат

1. Задеплоить landing + worker.
2. Применить `sql/218_seedream_50_flux_flex.sql`.
3. Новых env нет — те же `OPENROUTER_*`.

Откат фолбека:

```sql
UPDATE landing_generation_config
SET value = 'seedream-4.5', updated_at = now()
WHERE key = 'image_fallback_secondary_model';
```

Откат пикера: `enabled:false` у `seedream-5.0-pro` / `flux-2-flex`.
