# Умный ассистент: системные улучшения

## Проблема

LLM-ассистент теряет контекст и сбрасывает step, когда пользователь отвечает нестандартно.

**Пример:**
1. Ассистент собрал все 4 параметра, показал зеркало (step 6)
2. Пользователь ответил "Возьми все из предыдущего сообщения"
3. Ассистент не распознал это как подтверждение -> начал заново спрашивать стиль и эмоцию

**Корневые причины:**
- Нет "памяти" на уровне кода -- текущий step хранится только в метаданных ответа LLM
- System prompt слишком длинный и процедурный -- LLM плохо следует сложным пошаговым алгоритмам
- Нет валидации на уровне кода -- если LLM вернул step=2 хотя все параметры собраны, код не поправляет
- Confirm-логика ограничена списком из 9 слов
- Нет merge параметров -- если LLM "забыл" вернуть style (null), перезаписывает уже собранное значение

---

## Решение 1: Merge параметров (критическое)

**Проблема:** `mapParamsToSessionFields(result.params)` записывает то, что вернул LLM. Если на шаге эмоции LLM вернёт `style: null`, уже собранный стиль будет потерян.

**Решение:** Merge incoming params с уже сохранёнными в `assistant_sessions`:

```typescript
function mergeAssistantParams(
  existing: AssistantSessionRow,
  incoming: AssistantParams | null
): Partial<AssistantSessionRow> {
  if (!incoming) return {};
  return {
    style: incoming.style || existing.style || undefined,
    emotion: incoming.emotion || existing.emotion || undefined,
    pose: incoming.pose || existing.pose || undefined,
    sticker_text: incoming.text || existing.sticker_text || undefined,
    confirmed: incoming.confirmed || false,
    current_step: Math.max(incoming.step || 0, existing.current_step || 0), // step только вперёд
  };
}
```

**Где:** `src/lib/assistant-db.ts` -- новая функция, заменяет `mapParamsToSessionFields`.

**Вызов:** во всех точках `index.ts` где сейчас `mapParamsToSessionFields(result.params)` -- заменить на `mergeAssistantParams(aSession, result.params)`.

**Без этого все остальные решения не защищают от потери данных.**

---

## Решение 2: Инъекция состояния перед callAIChat

Перед каждым `callAIChat` добавлять system-сообщение с текущим состоянием из БД:

```typescript
const collected = {
  style: aSession.style || null,
  emotion: aSession.emotion || null,
  pose: aSession.pose || null,
  text: aSession.sticker_text,  // null = ещё не спрашивали, "none" = без текста
};

const missing = Object.entries(collected)
  .filter(([_, v]) => v === null)
  .map(([k]) => k);

const stateMsg = [
  `[SYSTEM STATE]`,
  `Collected: ${JSON.stringify(collected)}`,
  missing.length > 0
    ? `Still need: ${missing.join(", ")}`
    : `All parameters collected. Waiting for user confirmation.`,
  `DO NOT ask for already collected parameters again.`,
  `DO NOT go back to earlier steps.`,
].join("\n");
```

**Где:** `src/index.ts` -- перед каждым `callAIChat` в блоках `assistant_chat` и `wait_assistant_confirm`. Добавлять как последний system-message перед user-message.

**Эффект:** LLM получает "память" из БД, не зависит от собственного контекста.

---

## Решение 3: Валидация step на уровне кода

Не доверять `result.params.step` полностью -- код проверяет собранные параметры:

```typescript
function validateStep(params: AssistantParams, aSession: AssistantSessionRow): number {
  const hasStyle = !!(params.style || aSession.style);
  const hasEmotion = !!(params.emotion || aSession.emotion);
  const hasPose = !!(params.pose || aSession.pose);
  const hasText = params.text !== null || aSession.sticker_text !== null;

  const allCollected = hasStyle && hasEmotion && hasPose && hasText;

  if (allCollected && params.step < 6) {
    console.log(`[Assistant] Step override: ${params.step} -> 6 (all params collected)`);
    return 6;
  }

  // Step не может идти назад
  if (params.step < (aSession.current_step || 0)) {
    console.log(`[Assistant] Step rollback prevented: ${params.step} -> ${aSession.current_step}`);
    return aSession.current_step;
  }

  return params.step;
}
```

**Где:** `src/index.ts` -- после `parseAssistantMetadata`, перед проверкой `if (result.params?.step === 6)`.

---

## Решение 4: Расширить confirm-логику

Текущий список (9 слов):
```
["да", "ок", "ok", "yes", "confirm", "подтверждаю", "верно", "всё верно", "все верно"]
```

Расширенный список:
```typescript
const confirmWords = [
  // Русские
  "да", "ок", "подтверждаю", "верно", "всё верно", "все верно",
  "возьми", "оставь", "принимаю", "давай", "пойдёт", "пойдет",
  "норм", "согласен", "согласна", "подходит", "именно", "точно",
  "правильно", "всё так", "все так", "генерируй", "делай",
  "запускай", "поехали", "го",
  // English
  "ok", "yes", "confirm", "correct", "right", "perfect",
  "looks good", "all good", "do it", "generate", "go",
  "sure", "yep", "yeah", "lgtm",
];
```

**Не добавлять:** эвристику "короткое сообщение без отказа = confirm". Это опасно -- "привет" будет считаться подтверждением. Расширенного списка достаточно; неоднозначные ответы пусть обрабатывает LLM.

---

## Решение 5: Упростить system prompt (долгосрочное)

**Проблема:** текущий промпт ~250 строк с жёсткими шагами 0-7. LLM плохо следуют сложным пошаговым алгоритмам.

**Идея:** заменить процедурные шаги на цель + ограничения:

```
Цель: собрать 4 параметра для генерации стикера.
Параметры: style, emotion, pose, text (или "none").

Правила:
1. Сначала узнай цель пользователя, потом попроси фото
2. Спрашивай по одному, если пользователь не дал всё сразу
3. Если пользователь дал несколько параметров в одном сообщении -- прими все
4. НИКОГДА не спрашивай заново то, что уже собрано (см. [SYSTEM STATE])
5. Когда все 4 параметра есть -- покажи зеркало и жди подтверждения
6. Если пользователь после зеркала не просит ничего менять -- считай подтверждением
```

Короткий prompt = LLM лучше его соблюдает. Требует тестирования.

---

## Приоритет реализации

| # | Задача | Сложность | Эффект |
|---|--------|-----------|--------|
| 1 | Merge параметров | 15 мин | Критическое -- без этого данные теряются |
| 2 | Инъекция состояния | 30 мин | Предотвращает сброс step |
| 3 | Расширить confirm-слова | 5 мин | Фиксит конкретный баг |
| 4 | Валидация step | 15 мин | Страховка от ошибок LLM |
| 5 | Упростить system prompt | 2-3 часа | Системное улучшение, требует тестирования |

Решения 1-4 можно реализовать за 1 час и они решат 95% проблем. Решение 5 -- отдельная итерация.

---

## Файлы для изменений

- `src/lib/assistant-db.ts` -- `mergeAssistantParams()` (заменяет `mapParamsToSessionFields`)
- `src/index.ts` -- confirm-слова, инъекция состояния, валидация step, замена mapParams на merge
- `src/lib/ai-chat.ts` -- system prompt (только для решения 5)
