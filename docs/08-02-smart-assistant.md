# Умный ассистент: архитектура нового поколения

## Проблема

LLM-ассистент работает как FSM (конечный автомат), замаскированный под диалог:
- Жёсткие шаги 0-7, LLM обязан возвращать `step: N` в `<!-- PARAMS -->`
- Код парсит текст LLM вместо получения структурированных данных
- Confirm-логика — regex по списку слов
- Нет merge параметров — LLM может потерять ранее собранные данные
- Промпт 250 строк — LLM плохо следует сложным пошаговым алгоритмам

---

## Целевая архитектура: Agent с Function Calling

### Принцип

Вместо пошагового алгоритма — **цель + инструменты**:
- LLM получает цель (собрать параметры) и набор функций (tools)
- LLM сам решает когда вызвать функцию, код получает чистый JSON
- Код управляет состоянием, LLM управляет диалогом

### Почему это лучше

| Текущий подход | Agent-архитектура |
|---|---|
| Step-based FSM (`step: 0-7`) | Intent-based routing через tools |
| `<!-- PARAMS:{} -->` в тексте | Function calling → структурированный JSON |
| Regex confirm (`["да", "ок"]`) | LLM классификация intent через tool |
| Промпт 250 строк с алгоритмом | Промпт 50 строк с целью + tools |
| Код парсит текст LLM | Код получает JSON из function calls |

---

## Реализация

### 1. Function Calling (tools)

Gemini 2.0 Flash поддерживает function calling. Определяем 3 tool:

```typescript
const tools = [
  {
    name: "update_sticker_params",
    description: "Call when user provides sticker parameters (style, emotion, pose, text). Can update one or several at once.",
    parameters: {
      type: "object",
      properties: {
        style: { type: "string", description: "Sticker style (e.g. anime, cartoon, minimal)" },
        emotion: { type: "string", description: "Emotion to show (e.g. happy, sad, surprised)" },
        pose: { type: "string", description: "Pose or gesture (e.g. peace sign, thumbs up)" },
        text: { type: "string", nullable: true, description: "Text on sticker, or null if none" },
      }
    }
  },
  {
    name: "confirm_and_generate",
    description: "Call when user confirms all parameters and is ready to generate",
  },
  {
    name: "request_photo",
    description: "Call when assistant needs to ask for a photo",
  }
];
```

**Как работает:**
1. Пользователь пишет "аниме стиль, весёлый"
2. LLM вызывает `update_sticker_params({ style: "anime", emotion: "happy" })`
3. Код получает чистый JSON, мержит с existing данными в `assistant_sessions`
4. Код инжектирует `[SYSTEM STATE]` в следующее сообщение
5. LLM видит что не хватает pose и text — спрашивает

### 2. System Prompt (50 строк вместо 250)

```
You are a sticker creation assistant. Your goal: collect 4 parameters 
from the user (style, emotion, pose, text) and confirm them.

You have these tools:
- update_sticker_params() — call when user provides any parameter
- confirm_and_generate() — call when user confirms everything
- request_photo() — call when you need to ask for a photo

Rules:
1. First, understand user's goal, then ask for a photo
2. Ask one parameter at a time, unless user provides several
3. If user gives multiple params in one message — accept all via one tool call
4. NEVER ask for already collected parameters (see [SYSTEM STATE])
5. When all 4 params collected — show mirror and wait for confirmation
6. After mirror, if user doesn't ask to change anything — call confirm_and_generate

Speak simply and clearly. No marketing language.
Address user by first_name. Use user's language.
```

### 3. State Injection (память из БД)

Перед каждым вызовом LLM — инжектируем состояние из `assistant_sessions`:

```typescript
function buildStateInjection(aSession: AssistantSessionRow): string {
  const collected = {
    style: aSession.style || null,
    emotion: aSession.emotion || null,
    pose: aSession.pose || null,
    text: aSession.sticker_text, // null = не спрашивали, "none" = без текста
  };

  const missing = Object.entries(collected)
    .filter(([_, v]) => v === null)
    .map(([k]) => k);

  return [
    `[SYSTEM STATE]`,
    `Collected: ${JSON.stringify(collected)}`,
    missing.length > 0
      ? `Still need: ${missing.join(", ")}`
      : `All parameters collected. Show mirror and wait for confirmation.`,
    `DO NOT ask for already collected parameters.`,
  ].join("\n");
}
```

### 4. Merge параметров (защита от потери данных)

Tool calls обрабатываются кодом — merge с existing:

```typescript
function handleToolCall(
  toolName: string,
  args: Record<string, any>,
  aSession: AssistantSessionRow
): Partial<AssistantSessionRow> {
  if (toolName === "update_sticker_params") {
    return {
      style: args.style || aSession.style || undefined,
      emotion: args.emotion || aSession.emotion || undefined,
      pose: args.pose || aSession.pose || undefined,
      sticker_text: args.text !== undefined ? args.text : aSession.sticker_text,
    };
  }
  if (toolName === "confirm_and_generate") {
    return { confirmed: true };
  }
  return {};
}
```

**Ключевое:** `args.style || aSession.style` — если LLM не передал style, берём из БД. Данные никогда не теряются.

### 5. Confirm через LLM (без regex)

Больше нет списка confirm-слов. LLM сам решает:
- Пользователь написал "да" → LLM вызывает `confirm_and_generate()`
- Пользователь написал "Возьми всё из предыдущего" → LLM вызывает `confirm_and_generate()`
- Пользователь написал "измени стиль на 3D" → LLM вызывает `update_sticker_params({ style: "3D" })`

Нет regex, нет edge cases, нет списков слов.

---

## Миграция: быстрые фиксы + долгосрочный переход

### Фаза 1: Быстрые фиксы (1 час) — делаем СЕЙЧАС

Эти фиксы работают с текущей `<!-- PARAMS -->` архитектурой:

| # | Задача | Сложность | Эффект |
|---|--------|-----------|--------|
| 1 | Merge параметров в `assistant-db.ts` | 15 мин | Критическое — данные не теряются |
| 2 | State injection перед `callAIChat` | 30 мин | LLM не забывает собранное |
| 3 | Расширить confirm-слова (30+) | 5 мин | Фиксит конкретный баг |
| 4 | Валидация step (step не может назад) | 15 мин | Страховка от ошибок LLM |

### Фаза 2: Function Calling (4-6 часов)

| # | Задача | Сложность |
|---|--------|-----------|
| 1 | Добавить tools definition в `ai-chat.ts` | 30 мин |
| 2 | Обработка function_call response от Gemini | 1 час |
| 3 | `handleToolCall()` с merge в `assistant-db.ts` | 30 мин |
| 4 | Новый system prompt (50 строк) | 1 час |
| 5 | Рефакторинг `index.ts`: убрать `parseAssistantMetadata`, regex confirm | 1-2 часа |
| 6 | Тестирование на тестовом боте | 1 час |

### Фаза 3: Продвинутые features (по необходимости)

- Multi-turn tool calls (несколько function calls в одном ответе)
- Tool для показа примеров стилей
- Tool для проверки баланса
- Аналитика: какие tools вызываются чаще всего

---

## Совместимость с Gemini API

Gemini 2.0 Flash поддерживает function calling через `tools` в request body:

```typescript
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
  {
    contents: messages,
    tools: [{ function_declarations: tools }],
    tool_config: { function_calling_config: { mode: "AUTO" } },
  },
  { headers: { "x-goog-api-key": GEMINI_API_KEY } }
);

// Response содержит либо text, либо functionCall:
const part = response.data.candidates[0].content.parts[0];
if (part.functionCall) {
  const { name, args } = part.functionCall;
  const updates = handleToolCall(name, args, aSession);
  await updateAssistantSession(aSession.id, updates);
}
```

---

## Файлы для изменений

**Фаза 1 (быстрые фиксы):**
- `src/lib/assistant-db.ts` — `mergeAssistantParams()` заменяет `mapParamsToSessionFields`
- `src/index.ts` — state injection, confirm-слова, валидация step

**Фаза 2 (function calling):**
- `src/lib/ai-chat.ts` — tools definition, новый system prompt, обработка functionCall
- `src/lib/assistant-db.ts` — `handleToolCall()`
- `src/index.ts` — упрощение routing (убрать `<!-- PARAMS -->` парсинг)
