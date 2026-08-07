# 07-08 — Цепочка изменения картинки

> Дата: 2026-08-07  
> Статус: реализовано

## Цель

После inline-генерации внутри карточки пользователь может нажать «Изменить картинку», описать требуемую правку свободным текстом и получить следующую версию на основе последнего результата.

Публичный промпт исходной карточки неизменяем: персональный remix сохраняется только в `landing_generations.prompt_text` новой пользовательской генерации.

## Flow

```text
Карточка + фото пользователя
  → POST /api/generate
  → completed generation
  → «Изменить картинку»
  → Landing /api/prompt-remix
  → Gemini 2.5 Flash
  → персональный prompt
  → POST /api/generate { parentGenerationId, prompt }
  → worker читает result parent generation
  → новая completed generation
```

Каждая следующая итерация использует:

- изображение последней успешно завершённой генерации;
- её персональный `prompt_text`;
- ранее выбранные model, aspect ratio и image size.

## Границы данных

- `prompt_cards` и `prompt_variants` исходной карточки не обновляются.
- `landing_generations.card_id` сохраняет атрибуцию исходной карточки.
- `landing_generations.parent_generation_id` задаёт owned source для следующей итерации.
- Следующий remix принимает только `parentGenerationId + changeRequest`; сервер читает актуальный `landing_generations.prompt_text`. UGC-карточка создаётся best-effort и не является source of truth.
- Клиент не передаёт bucket/path результата: API и worker резолвят их по owned generation ID.
- Parent нельзя удалить, пока дочерняя генерация находится в `pending` или `processing`.

## Надёжность

- API проверяет auth, ownership и completed status parent.
- Локальный remix API требует auth и internal-generation allowlist; секрет Gemini остаётся на сервере.
- `landing_enqueue_generation` повторяет проверку внутри транзакции до списания кредита.
- Idempotency fingerprint включает `parentGenerationId`.
- Worker принимает только `web-generation-results` как bucket parent result.
- Временная ошибка remix не запускает генерацию и не списывает кредит.
- Terminal failure дочерней генерации использует существующий механизм однократного refund.

## Реализовано

- [x] Additive migration `171_landing_generation_parent.sql`
- [x] Continuation input в `POST /api/generate`
- [x] Parent-result source в durable worker
- [x] Защита parent в single/bulk delete
- [x] Result composer «Изменить картинку»
- [x] Повторяемая цепочка remix → generation
- [x] Worker unit tests для выбора и валидации source
- [x] Обновление архитектурной документации
