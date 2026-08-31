# 31-08 — Фолбек фотосессии на Flux 2 Flex

> Дата: 2026-08-31  
> Статус: реализация  
> Ветка: `feature/31-08-photoshoot-flux-fallback`

## Цель

Seedream 5.0 Pro как `photoshoot_model` режет будуар / бельё (`safety_block`, без следующего хопа). Тот же attempt один раз зовёт **Flux 2 Flex** с `safety_tolerance=5`. Планер не перезапускаем. Кредиты те же 15.

## Цепочка

| Primary фотосессии | Хоп |
|---|---|
| Seedream / Grok / Gemini | Flux 2 Flex, `safety_tolerance=5` |
| Flux 2 Flex | — |

Обычные image-job (не `edit_kind=photoshoot`) не меняются: Gemini → Grok → Seedream.

`shutdown` — хопа нет. Circuit Seedream не блокирует Flux-хоп (safety Seedream не должен глушить rescue).

## Config

| Ключ | Значение | Выкл |
|---|---|---|
| `photoshoot_fallback_model` | `flux-2-flex` | пусто / `false` / `enabled:false` у Flux в `models` |

SQL `233`. Не править 224/227/228.

`safety_tolerance=5` шлём в OpenRouter Image API **только** если photoshoot + Flux (primary, хоп и retry после persist `executed_model`). Seedream это поле не получает.

## Откат

```sql
UPDATE landing_generation_config
SET value = '', updated_at = now()
WHERE key = 'photoshoot_fallback_model';
```
