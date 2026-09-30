# 30-09 — Разбор фото по паттерну кадра

> Дата: 2026-09-30
> Ветка: `feature/30-09-analyze-pattern-router`
> Статус: реализовано, флаг включён в prod (2026-09-30)

`POST /api/extension/analyze` и `POST /api/scout/analyze` при флаге `analyze_pattern_router_enabled` выбирают паттерн кадра и пишут только его секции. Пока значение не `true`, ответ — прежний портретный extract.

## Контракт

Флаг в `landing_generation_config` (SQL `261`). Нет строки, пусто, не `true`, ошибка чтения — старый путь.

Паттерн: `person | object | layout | scene`. Носитель: `photo | illustration | graphic | 3d`.

Строки `Pattern` и `Medium` в пользовательский `prompt` не входят. При включённом флаге они есть в JSON ответа и в `analyze_history.analyze_pattern` / `analyze_medium`.

Хвост `CRITICAL RULES` дописывает сервер. На старом пути он по-прежнему просит сохранить лицо. На новом пути лицо не сохраняем: исходник в генерацию не прикладывается.

Фотосессия при включённом флаге всегда `person` + `photo`, без выбора модели.

Интерактивный роутер: до 2 попыток, 22 с каждая. Картинка для Gemini остаётся JPEG ≤256 px / ≤20 KB. Квота списывается после успешной проверки секций.

Документы и карты не отдельный паттерн: номера и ФИО в `Text` не переносим, регулярками цифры не режем.

## Промт v2 (2026-09-30, вторая итерация)

Первая версия роутера давала согласованный, но тонкий разбор: `Lighting` в одну строку, `Avoid` из одной фразы. Причина — упрощённые спеки секций и отсутствие блока качества из старого extract. Исправлено в `analyze-pattern.ts`:

- `QUALITY_HEADER` — «генератор не видит исходник», геометрия до настроения, технически конкретно, законченные предложения.
- `SECTION_SPECS` — уровень детализации старого 12-секционного extract (Lighting с направлением и кельвинами, Camera в мм, Composition с горизонтом и планами), плюс новые секции.
- `Avoid` — 6–10 конкретных пунктов под паттерн и носитель, не «короткий список».
- `Visual Hook` — описание кадра, а не правило «должен сохраниться».
- Словарь спеков в промте один раз; блоки паттернов — только списки заголовков.
- `normalizeAnalyzeLayout` — `Lighting: текст` на одной строке и `**Lighting:**` приводятся к `Lighting:\nтекст` до валидации и до записи в историю.
- Температура роутера 0.3 (как у старого пути).

Проверка на маяке из истории: `scene` + `illustration`, все секции валидны, Lighting/Camera/Composition по объёму как в старом разборе, `Avoid` 8 пунктов; 4–7 с на попытку.

## Точки входа

| Вход | Хост | Репозиторий | Роутер |
|---|---|---|---|
| `/foto-v-promt`, dock «По фото», `/generaciya/*`, админка | promptshot.ru `/api/extension/analyze` | этот | да |
| Scout | promptshot.ru `/api/scout/analyze` | этот | да |
| Публикация фотосессии | внутри promptshot.ru | этот | lock `person`+`photo` |
| Extension Lite (AI Image Describer) | imageprompt.tools `/api/extension/analyze` | `~/imageprompt` (`mazarov/imageprompt`) | да, после деплоя imageprompt.tools |
| Remix с `/foto-v-promt` | imageprompt.tools `/api/extension/remix` | `~/imageprompt` | знает заголовки паттернов |
| Remix из dock генерации | promptshot.ru `/api/prompt-remix` | этот | знает заголовки паттернов |

`landing/src/lib/analyze-pattern.ts` — общий модуль, **лежит в обоих репозиториях дословно** (без импортов из проекта). Правки — в обоих, потом `diff` на идентичность. Флаг и колонки `analyze_history` общие: один Supabase-проект.

## Включение

```sql
UPDATE public.landing_generation_config
SET value = 'true'
WHERE key = 'analyze_pattern_router_enabled';
```

Откат — то же `UPDATE` на `false`.
