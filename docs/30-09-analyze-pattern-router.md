# 30-09 — Разбор фото по паттерну кадра

> Дата: 2026-09-30
> Ветка: `feature/30-09-analyze-pattern-router`
> Статус: реализовано, флаг выключен

`POST /api/extension/analyze` и `POST /api/scout/analyze` при флаге `analyze_pattern_router_enabled` выбирают паттерн кадра и пишут только его секции. Пока значение не `true`, ответ — прежний портретный extract.

## Контракт

Флаг в `landing_generation_config` (SQL `261`). Нет строки, пусто, не `true`, ошибка чтения — старый путь.

Паттерн: `person | object | layout | scene`. Носитель: `photo | illustration | graphic | 3d`.

Строки `Pattern` и `Medium` в пользовательский `prompt` не входят. При включённом флаге они есть в JSON ответа и в `analyze_history.analyze_pattern` / `analyze_medium`.

Хвост `CRITICAL RULES` дописывает сервер. На старом пути он по-прежнему просит сохранить лицо. На новом пути лицо не сохраняем: исходник в генерацию не прикладывается.

Фотосессия при включённом флаге всегда `person` + `photo`, без выбора модели.

Интерактивный роутер: до 2 попыток, 22 с каждая. Картинка для Gemini остаётся JPEG ≤256 px / ≤20 KB. Квота списывается после успешной проверки секций.

Документы и карты не отдельный паттерн: номера и ФИО в `Text` не переносим, регулярками цифры не режем.

## Включение

```sql
UPDATE public.landing_generation_config
SET value = 'true'
WHERE key = 'analyze_pattern_router_enabled';
```

Откат — то же `UPDATE` на `false`.
