# Умный ассистент: системные улучшения

## Проблема

LLM-ассистент теряет контекст и сбрасывает step, когда пользователь отвечает нестандартно.

**Пример:**
1. Ассистент собрал все 4 параметра, показал зеркало (step 6)
2. Пользователь ответил "Возьми все из предыдущего сообщения"
3. Ассистент не распознал это как подтверждение → начал заново спрашивать стиль и эмоцию

**Корневые причины:**
- Нет "памяти" на уровне кода — текущий step хранится только в метаданных ответа LLM
- System prompt слишком длинный и процедурный — LLM плохо следует сложным пошаговым алгоритмам
- Нет валидации на уровне кода — если LLM вернул step=2 хотя все параметры собраны, код не поправляет
- Confirm-логика ограничена списком из 9 слов

---

## Решение 1: Инъекция состояния (быстрый фикс)

Перед каждым `callAIChat` добавлять system-сообщение с текущим состоянием:

```typescript
const collected = {
  style: aSession.style || null,
  emotion: aSession.emotion || null,
  pose: aSession.pose || null,
  text: aSession.text_on_sticker,  // null = ещё не спрашивали, "none" = пользователь сказал "без текста"
};

const missing = Object.entries(collected)
  .filter(([_, v]) => v === null)
  .map(([k]) => k);

const stateMsg = [
  `[SYSTEM STATE]`,
  `Collected: ${JSON.stringify(collected)}`,
  missing.length > 0
    ? `Still need: ${missing.join(", ")}`
    : `All parameters collected. Waiting for confirmation.`,
  `DO NOT ask for already collected parameters again.`,
].join("\n");
```

**Где:** в `index.ts` перед каждым вызовом `callAIChat` в блоках `assistant_chat` и `wait_assistant_confirm`.

**Как:** добавлять `stateMsg` как последний system-message перед user-message.

---

## Решение 2: Валидация step на уровне кода

Не доверять `result.params.step` полностью — код проверяет собранные параметры:

```typescript
function validateStep(params: AssistantParams, aSession: any): number {
  const hasStyle = !!(params.style || aSession.style);
  const hasEmotion = !!(params.emotion || aSession.emotion);
  const hasPose = !!(params.pose || aSession.pose);
  const hasText = (params.text !== null && params.text !== undefined) || aSession.text_on_sticker !== null;

  const allCollected = hasStyle && hasEmotion && hasPose && hasText;

  if (allCollected && params.step < 6) {
    console.log(`[Assistant] Step override: ${params.step} → 6 (all params collected)`);
    return 6;
  }
  return params.step;
}
```

**Где:** в `index.ts` после `parseAssistantMetadata`, перед проверкой `if (result.params?.step === 6)`.

---

## Решение 3: Расширить confirm-логику

Текущий список:
```
["да", "ок", "ok", "yes", "confirm", "подтверждаю", "верно", "всё верно", "все верно"]
```

Добавить:
```
["возьми", "оставь", "принимаю", "go", "давай", "пойдёт", "пойдет", "норм",
 "согласен", "согласна", "подходит", "именно", "точно", "правильно",
 "всё так", "все так", "генерируй", "делай", "запускай", "поехали",
 "lgtm", "sure", "yep", "yeah", "correct", "right", "perfect",
 "looks good", "all good", "do it", "generate"]
```

**Дополнительно:** если сообщение короткое (< 30 символов) и не содержит слов-корректировок ("измени", "поменяй", "change", "другой", "не так"), считать его подтверждением:

```typescript
const isLikelyConfirm = userText.length < 30
  && !["измени", "поменяй", "change", "другой", "не так", "нет", "no"].some(w => userText.includes(w));
```

---

## Решение 4: Упростить system prompt (долгосрочное)

Заменить 7 жёстких шагов на цель-ориентированный prompt:

**Было:** процедурные шаги 0-7 с жёсткими формулировками.

**Стало:**
```
Цель: собрать 4 параметра для генерации стикера.
Параметры: style, emotion, pose, text (или "none").

Правила:
1. Спрашивай по одному, если пользователь не дал всё сразу
2. Если пользователь дал несколько параметров в одном сообщении — прими все
3. НИКОГДА не спрашивай заново то, что уже собрано
4. Когда все 4 параметра есть — покажи зеркало и жди подтверждения
5. Если пользователь после зеркала не просит ничего менять — считай это подтверждением
```

Короткий prompt = LLM лучше его соблюдает.

---

## Приоритет реализации

| # | Задача | Сложность | Эффект |
|---|--------|-----------|--------|
| 1 | Расширить confirm-слова | 5 мин | Фиксит конкретный баг |
| 2 | Инъекция состояния перед callAIChat | 30 мин | Предотвращает сброс step |
| 3 | Валидация step по собранным параметрам | 15 мин | Страховка от ошибок LLM |
| 4 | Упростить system prompt | 1-2 часа | Системное улучшение качества |

---

## Файлы для изменений

- `src/index.ts` — confirm-слова, инъекция состояния, валидация step
- `src/lib/ai-chat.ts` — system prompt, buildSystemPrompt()
- `src/lib/assistant-db.ts` — возможно, доп. поля для хранения состояния
