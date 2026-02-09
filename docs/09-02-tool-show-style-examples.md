# Tool: show_style_examples

## Цель

Ассистент показывает пользователю примеры стикеров в разных стилях, чтобы помочь с выбором. Это:
- Снижает неопределённость ("как будет выглядеть?")
- Ускоряет выбор стиля
- Повышает конверсию (пользователь видит качество до покупки)

---

## Когда вызывается

LLM вызывает `show_style_examples` когда:
- Пользователь просит показать примеры ("покажи примеры", "что есть?", "какие стили бывают?")
- Пользователь не может определиться со стилем
- LLM считает что пример поможет (пользователь описал стиль неточно)

LLM **не вызывает** если:
- Пользователь уже уверенно назвал стиль
- Все параметры уже собраны

---

## Tool Definition

```typescript
{
  name: "show_style_examples",
  description: "Call to show the user example stickers. Use when user asks to see examples, can't decide on a style, or when showing an example would help. Pass style_id to show specific style, or null to show list of all available styles with examples.",
  parameters: {
    type: "object",
    properties: {
      style_id: {
        type: "string",
        nullable: true,
        description: "Style preset ID to show example for (e.g. 'anime', 'cartoon'). If null, show list of available styles."
      },
    },
  },
}
```

---

## Обработка в коде

### `handleToolCall()` в `assistant-db.ts`

```typescript
if (toolCall.name === "show_style_examples") {
  return {
    updates: {},
    action: "show_examples",
  };
}
```

Action `"show_examples"` — не меняет данные сессии, только триггерит отправку стикера.

### Обработка action в `index.ts`

```typescript
if (action === "show_examples") {
  const styleId = result.toolCall?.args?.style_id;
  
  if (styleId) {
    // Показать пример конкретного стиля
    const example = await getStyleExample(styleId);
    if (example?.telegram_file_id) {
      await ctx.replyWithSticker(example.telegram_file_id);
    } else {
      // Нет примера для этого стиля
      const noExample = lang === "ru"
        ? `К сожалению, примера для стиля "${styleId}" пока нет.`
        : `Sorry, no example available for "${styleId}" style yet.`;
      await ctx.reply(noExample);
    }
  } else {
    // Показать список доступных стилей с примерами
    const stylesWithExamples = await getStylesWithExamples();
    if (stylesWithExamples.length > 0) {
      const list = stylesWithExamples.map(s => {
        const name = lang === "ru" ? s.name_ru : s.name_en;
        return `${s.emoji} ${name}`;
      }).join("\n");
      
      const header = lang === "ru"
        ? "Вот стили, для которых есть примеры:\n\n"
        : "Here are styles with examples available:\n\n";
      
      // Inline buttons для каждого стиля
      const buttons = stylesWithExamples.map(s => [
        Markup.button.callback(
          `${s.emoji} ${lang === "ru" ? s.name_ru : s.name_en}`,
          `assistant_example_${s.id}`
        )
      ]);
      
      await ctx.reply(header + list, Markup.inlineKeyboard(buttons));
    } else {
      const noExamples = lang === "ru"
        ? "Пока примеров нет, но опиши стиль словами — я пойму!"
        : "No examples yet, but describe the style in words — I'll understand!";
      await ctx.reply(noExamples);
    }
  }
  
  // Отправить текст LLM (если есть)
  if (replyText) await ctx.reply(replyText, getMainMenuKeyboard(lang));
}
```

### Новая функция `getStylesWithExamples()`

```typescript
async function getStylesWithExamples(): Promise<StylePreset[]> {
  // Получить style_preset_id которые имеют примеры
  const { data: exampleStyleIds } = await supabase
    .from("stickers")
    .select("style_preset_id")
    .eq("is_example", true)
    .not("telegram_file_id", "is", null)
    .not("style_preset_id", "is", null);

  if (!exampleStyleIds?.length) return [];

  const uniqueIds = [...new Set(exampleStyleIds.map(e => e.style_preset_id))];

  const presets = await getStylePresets();
  return presets.filter(p => uniqueIds.includes(p.id));
}
```

### Callback для inline-кнопок примеров

```typescript
bot.action(/^assistant_example_(.+)$/, async (ctx) => {
  safeAnswerCbQuery(ctx);
  const styleId = ctx.match[1];
  
  const example = await getStyleExample(styleId);
  if (example?.telegram_file_id) {
    await ctx.replyWithSticker(example.telegram_file_id);
  }
});
```

### Fallback (если LLM вернул только tool call без текста)

```typescript
if (action === "show_examples") {
  const styleId = result.toolCall?.args?.style_id;
  if (styleId) {
    return isRu
      ? `Вот пример стиля ${styleId}:`
      : `Here's an example of ${styleId} style:`;
  }
  return isRu
    ? "Вот доступные стили — нажми чтобы увидеть пример:"
    : "Here are the available styles — tap to see an example:";
}
```

---

## System Prompt

Добавить в промпт:

```
## Style Examples
You can show style examples to help users choose.
- Call show_style_examples(style_id) to show a specific style example
- Call show_style_examples(null) to show list of all available styles
- Use this when user is unsure about style or asks to see options
- Available style IDs will be provided in [SYSTEM STATE]
```

---

## Данные для [SYSTEM STATE]

В `buildStateInjection()` добавить список доступных стилей:

```typescript
// Inject available styles (for LLM to reference)
if (availableStyles.length > 0) {
  const styleList = availableStyles.map(s => `${s.id}: ${s.name_en}`).join(", ");
  lines.push(`Available styles with examples: ${styleList}`);
}
```

Это позволит LLM знать какие `style_id` можно использовать в tool call.

---

## Существующая инфраструктура

Уже реализовано и готово к использованию:

| Функция | Файл | Что делает |
|---|---|---|
| `getStylePresets()` | `index.ts:89` | Список стилей из `style_presets` (с кешем 5 мин) |
| `getStyleExample(styleId, offset)` | `index.ts:113` | Получить пример стикера по `style_preset_id` |
| `countStyleExamples(styleId)` | `index.ts:127` | Количество примеров для стиля |

Таблица `stickers`:
- `is_example: boolean` — помечен ли стикер как пример
- `style_preset_id: text` — привязка к стилю
- `telegram_file_id: text` — file_id для отправки через Telegram API

---

## Файлы для изменений

| Файл | Что менять |
|---|---|
| `src/lib/ai-chat.ts` | Добавить tool в `ASSISTANT_TOOLS`, обновить system prompt |
| `src/lib/assistant-db.ts` | Добавить `"show_examples"` в `handleToolCall()`, обновить `buildStateInjection()` со списком стилей |
| `src/index.ts` | Добавить `getStylesWithExamples()`, обработку `action === "show_examples"`, callback `assistant_example_*`, fallback |

**Оценка: ~1.5 часа**

---

## Ограничения

- Показываем только 1 пример за раз (по одному стикеру на стиль)
- Если для стиля нет `is_example = true` стикеров — не показываем его в списке
- LLM не видит сам стикер — только знает что код его отправил
- `telegram_file_id` привязан к боту: примеры из прод-бота не работают в тест-боте (нужны отдельные примеры для тестовой среды)
