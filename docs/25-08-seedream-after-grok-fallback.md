# 25-08 — Seedream 4.5 как фолбек после Grok

> Дата: 2026-08-25  
> Статус: реализация  
> Ветка: `feature/25-08-seedream-after-grok-fallback`

## Цель

Тот же image-job: **Gemini → Grok → Seedream 4.5**. Если пользователь выбрал Grok и xAI упал — сразу Seedream. Seedream как primary дальше не прыгает.

Кредиты как у текущего Grok-фолбека: **не пересчитываем**. Flash за 1–5 кр может отработать Seedream ($0.04) без досписания.

## Цепочка

| Primary | 1-й хоп | 2-й хоп |
|---|---|---|
| Gemini* | Grok | Seedream |
| Grok | Seedream | — |
| Seedream | — | — |

Grok skip (circuit / нет `XAI_*` / kill-switch) → сразу Seedream, не terminal fail.

`shutdown` — не стартуем следующий vendor.

## Config

| Ключ | Значение | Выкл |
|---|---|---|
| `image_fallback_model` | `grok-imagine-image-2.0` | пусто / `enabled:false` у Grok |
| `image_fallback_secondary_model` | `seedream-4.5` | пусто / `enabled:false` у Seedream |

SQL `217`. Не править 204/215/216.

## Worker

`shouldAttemptGrokFallback` + `shouldAttemptSeedreamFallback`.  
Persist `fallback_used` + `executed_model` на каждый хоп. Retry после Seedream-хопа идёт в `openrouter-seedream` по `executed_model`.

## Откат

```sql
UPDATE landing_generation_config
SET value = '', updated_at = now()
WHERE key = 'image_fallback_secondary_model';
```

Пикер Seedream не трогает.
