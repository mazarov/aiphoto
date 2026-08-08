# 07-08 — Цепочка изменения картинки

> Дата: 2026-08-07  
> Статус: реализовано

## Цель

После inline-генерации внутри карточки пользователь может нажать «Что изменить», описать требуемую локальную правку свободным текстом и получить следующую версию на основе последнего результата.

Публичный промпт исходной карточки неизменяем: персональный remix сохраняется только в `landing_generations.prompt_text` новой пользовательской генерации.

## Flow

```text
Карточка + фото пользователя
  → POST /api/generate
  → completed generation
  → «Что изменить»
  → Landing /api/prompt-remix
  → Gemini 2.5 Flash
  → полный персональный prompt snapshot
  → POST /api/generate { parentGenerationId, prompt, editInstruction }
  → worker читает result parent generation
  → Gemini image получает только parent image + локальную edit instruction
  → новая completed generation
```

Каждая следующая итерация использует:

- изображение последней успешно завершённой генерации;
- полный персональный `prompt_text` для истории, copy и UGC;
- отдельную `edit_instruction` как единственную текстовую задачу image-модели;
- ранее выбранные model, aspect ratio и image size.

## Границы данных

- `prompt_cards` и `prompt_variants` исходной карточки не обновляются.
- `landing_generations.card_id` сохраняет атрибуцию исходной карточки.
- `landing_generations.parent_generation_id` задаёт owned source для следующей итерации.
- `landing_generations.edit_instruction` хранит локальную delta-команду и не публикуется вместо полного промпта.
- Следующий remix принимает текущий editable `prompt + changeRequest`; результат сохраняется как новый полный `prompt_text`. UGC-карточка создаётся best-effort и не является source of truth.
- Клиент не передаёт bucket/path результата: API и worker резолвят их по owned generation ID.
- Parent нельзя удалить, пока дочерняя генерация находится в `pending` или `processing`.

## Надёжность

- API проверяет auth, ownership и completed status parent.
- Локальный remix API требует auth и internal-generation allowlist; секрет Gemini остаётся на сервере.
- `landing_enqueue_generation` повторяет проверку внутри транзакции до списания кредита.
- Idempotency fingerprint включает `parentGenerationId` и `editInstruction`.
- Worker принимает только `web-generation-results` как bucket parent result.
- Worker для новых child jobs собирает короткий local-edit prompt с preserve-everything-else rules; строки без `edit_instruction` временно используют legacy full-prompt fallback.
- Временная ошибка remix не запускает генерацию и не списывает кредит.
- Terminal failure дочерней генерации использует существующий механизм однократного refund.

## Реализовано

- [x] Additive migration `171_landing_generation_parent.sql`
- [x] Additive migration `172_landing_generation_edit_instruction.sql`
- [x] Continuation input в `POST /api/generate`
- [x] Parent-result source в durable worker
- [x] Разделение full prompt snapshot и local edit instruction
- [x] Защита parent в single/bulk delete
- [x] Result composer «Изменить картинку»
- [x] Повторяемая цепочка remix → generation
- [x] Worker unit tests для выбора и валидации source
- [x] Обновление архитектурной документации

## Smoke-сценарии rollout

После миграции `172`, затем worker и только после этого Landing:

1. «Убери шарф/кофту с плеч» — предмет исчезает полностью, лицо, поза, фон и свет сохраняются.
2. «Добавь солнечные очки» — меняется только область очков с естественными светом и перспективой.
3. «Сделай платье синим» — меняется только цвет выбранной вещи, фасон и остальные цвета сохраняются.
4. Повтор child-request с тем же `Idempotency-Key` и payload возвращает ту же generation; другая `editInstruction` с тем же key даёт conflict.
5. Legacy child row без `edit_instruction` обрабатывается через прежнюю full-prompt сборку.
