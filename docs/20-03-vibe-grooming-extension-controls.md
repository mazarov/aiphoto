# Требования: причёска / макияж — чекбоксы в extension + сборка без перезапуска LLM

> Статус: **реализовано (код + миграция `sql/151_*`); решения v1** — см. **§3.4**. Целевая аудитория: разработчик, который впервые трогает vibe-пайплайн и extension.

## 1. Зачем это нужно (продукт)

Сейчас перенос **укладки** и **макияжа** с референса зашит в длинные инструкции LLM и в поле `hair_makeup` в JSON стиля. Пользователь в **расширении** не может:

- отдельно включить/выключить «как на референсе» для **волос** и **макияжа**;
- после генерации сценарного промпта **подкрутить только grooming**, не перезапуская **extract** и **expand** (дорого и может «поехать» поза/свет).

**Цель:** вынести это в **два чекбокса** (и опционально свои текстовые дополнения), одинаково поддерживать **one-shot** и **two-shot**, а финальный текст для image-gen собирать на сервере как **база сцены + вставляемый блок grooming** по политике пользователя.

---

## 2. Термины

| Термин | Значение |
|--------|----------|
| **Two-shot** | `POST /api/vibe/extract` → style JSON → `POST /api/vibe/expand` → текст сцены. |
| **One-shot** | `photo_app_config.vibe_one_shot_extract_prompt = true`: extract один раз отдаёт `{ "prompt": "..." }`, в БД пишется `prefilled_generation_prompt`; expand часто **без второго LLM**. |
| **Grooming** | Совокупность **укладки волос (styling)** и **макияжа** — не смена идентичности лица, а «съёмочный» вид. |
| **Базовый сценарный текст** | Текст промпта **без** отделяемого блока grooming (поза, свет, сет, камера, одежда, вайб и т.д.). |
| **Референс-grooming** | Описание укладки/макияжа **с референса**, сохранённое для повторной сборки. |
| **Политика grooming** | Что пользователь выбрал в UI: включить волосы, включить макияж, свои оверрайды. |

---

## 3. Функциональные требования

### 3.1. Extension (UI)

1. После успешного получения промпта для генерации (после expand или после one-shot + expand с prefilled) показывается блок **«Внешний вид (референс)»**:
   - чекбокс **«Перенести укладку волос»** (по умолчанию **вкл**);
   - чекбокс **«Перенести макияж»** (по умолчанию **вкл**);
   - опционально (фаза 2): два небольших поля **«Свои уточнения: волосы»** / **«Свои уточнения: макияж»** (длина лимитировать, см. §6).

2. Изменение только чекбоксов **не** вызывает `extract` и **не** вызывает `expand` (LLM).

3. После изменения чекбоксов extension запрашивает у API **пересборку** финального промпта и обновляет `finalPromptForGeneration` (и превью, если есть).

4. Один и тот же UI работает и для **two-shot**, и для **one-shot** (различие только в том, откуда сервер берёт сохранённые куски — см. §5).

### 3.2. Сервер (API)

1. Новый (или расширенный) endpoint **без вызова внешних LLM** (только чтение БД + строковая сборка + тот же **`assembleVibeFinalPrompt`**, что и `generate-process`).

2. Вход: `vibeId` (или сессия уже знает vibe), **политика grooming**, опционально **оверрайды текста**.

3. Выход: **тот же JSON-контракт**, что у успешного `POST /api/vibe/expand` сегодня (чтобы extension не плодил ветвления): как минимум `finalPromptForGeneration`, `prompts`, `finalPromptPreviews`, флаги двух картинок, `modelUsed` / `llmProvider` по желанию (можно зафиксировать `modelUsed: "assemble"` или последнюю использованную модель expand — задокументировать).

4. **Обратная совместимость:** старые строки `vibes` без разделённых полей должны продолжать работать (fallback, см. §8).

### 3.3. Генерация картинки

- **v1 — источник правды: клиент.** `POST /api/generate` получает **последний** успешный `finalPromptForGeneration` после expand / assemble (как сейчас). Сервер **не** пересобирает промпт только по `vibe_id` без тела запроса.
- Если пользователь меняет чекбоксы **после** уже отправленной генерации — это **новая** генерация с новым текстом; **не** патчить старые строки `landing_generations`.

### 3.4. Архитектурные решения v1 (зафиксировано)

Один раз закрывают открытые «техвопросы» в пользу **скорости внедрения**, **масштабирования схемы** и **предсказуемых изменений**.

| Тема | Решение |
|------|---------|
| **Схема БД** | `prompt_scene_core` (`text`, nullable) + `grooming_reference` (`jsonb`, nullable) `{ "hair": string, "makeup": string }`. Новые ключи (например `beard`) добавляются без `ALTER` на каждое поле. |
| **Fallback / старые vibes** | Колонка `last_monolithic_prompt` (`text`, nullable): полный «тело до префикса» при **первом успешном** expand (two-shot) и при успешном extract+parse (one-shot). Assemble: если `prompt_scene_core` пусто → `last_monolithic_prompt` **или** `prefilled_generation_prompt`; чекбоксы **не применять** (считать «всё в одном тексте», как сейчас), пока нет раздельных частей. |
| **Контракт LLM** | **Вариант A** для expand и one-shot: `{ "prompt", "grooming": { "hair", "makeup" } }`. Инструкции: **запрет** дублировать grooming-прозу внутри `prompt`. |
| **Валидация длины** | Минимум длины — **только на `prompt`** (тот же порядок величины, что `MIN_VIBE_SCENE_PROMPT_CHARS`, при необходимости слегка снизить после сплита). `grooming.hair` / `grooming.makeup` могут быть `""`, если модель явно фиксирует отсутствие видимого стайлинга — **не** валить expand из-за пустого grooming. |
| **One-shot + prefilled** | `prefilled_generation_prompt` хранит **полный** пользовательский текст сцены для пути без повторного expand. При парсинге JSON one-shot **дополнительно** заполнять `prompt_scene_core` + `grooming_reference` + `last_monolithic_prompt` (собранное тело или сырой `prompt`+grooming по правилам §7), чтобы assemble работал так же, как после two-shot. |
| **Ответ assemble = ответ expand** | `prompts[0].prompt` = **combined body без** image-gen префикса (как сейчас в `expand`: `promptText` до `assembleVibeFinalPrompt`). `finalPromptForGeneration` = `assembleVibeFinalPrompt(combined, …)`. |
| **Оверрайды текста** | **v1:** только чекбоксы. **v2:** `hairOverride` / `makeupOverride` **заменяют** соответствующий ref-сниппет (не конкатенация к ref). |
| **Оба чекбокса off** | Вставка grooming **отсутствует**; нейтрального «заглушечного» абзаца не добавлять. |
| **Когда показывать блок в extension** | Блок «Внешний вид» только если для `vibeId` есть данные для assemble: заполнены `prompt_scene_core` **или** сработал fallback (`last_monolithic_prompt` / `prefilled_generation_prompt`). После успешного expand (two-shot) или после extract+записи строки (one-shot). |
| **CORS / middleware** | Новый путь `/api/vibe/assemble-prompt` включить в **тот же** паттерн, что остальные `/api/vibe/*` в `landing/src/middleware.ts` (без разовых исключений). |

---

## 4. Нефункциональные требования

- **Лимиты:** оверрайды текста ≤ N символов (например 1500 каждый); валидация на API.
- **Auth:** как у `/api/vibe/expand` (тот же пользователь, тот же `vibe_id`).
- **Идемпотентность:** одинаковые входы → одинаковый финальный текст (детерминированный шаблон).
- **Логи:** отдельный префикс логов `[vibe.assemble]` с `userId`, `vibeId`, флаги политики, длины строк.
- **Документация:** после реализации обновить `docs/architecture/01-landing.md`.

---

## 5. Модель данных (что хранить в БД)

Зафиксированный набор в `public.vibes` (миграция одним файлом):

| Поле | Тип | Назначение |
|------|-----|------------|
| `prompt_scene_core` | `text` nullable | База сцены **без** отдельных блоков grooming (см. §7). |
| `grooming_reference` | `jsonb` nullable | `{ "hair": string, "makeup": string }` — референс-grooming для `buildGroomingInsert`. Расширение схемы — новыми ключами в JSON. |
| `last_monolithic_prompt` | `text` nullable | Fallback: полный текст «тела» до префикса image-gen, как выдавал бы монолитный expand; пишется при успешном expand / успешном one-shot parse (§3.4). |

**Когда заполнять:**

- **Two-shot:** после успешного **expand** — распарсить JSON (§6.2), записать три поля выше; клиентский ответ как сегодня + детерминированная персистенция.
- **One-shot:** после успешного extract — тот же JSON; заполнить `prompt_scene_core`, `grooming_reference`, `last_monolithic_prompt`, плюс существующий `prefilled_generation_prompt` по текущим правилам продукта.

**Важно:** `style.hair_makeup` в JSON стиля остаётся для SEO/карточек; колонки выше — **источник для assemble** без LLM.

---

## 6. Контракт API (черновик)

### 6.1. `POST /api/vibe/assemble-prompt` (новый)

**Body (JSON):**

```typescript
type AssemblePromptBody = {
  vibeId: string; // uuid
  groomingPolicy: {
    applyHair: boolean;
    applyMakeup: boolean;
    // v2: hairOverride / makeupOverride — замена ref (не append), см. §3.4
  };
};
```

**Ответ:** как у `expand` (минимум):

- `prompts: [{ accent: "scene", prompt: string }]` — `prompt` = **combined body без** префикса image-gen (**строго как** `prompts[0].prompt` в `expand/route.ts`: текст до `assembleVibeFinalPrompt`).

**Обязательно:** `finalPromptForGeneration`, `finalPromptPreviews`, `finalPromptAssumesTwoImages`, `vibeReferenceInlinePixels` — зеркалировать expand.

**Ошибки:** `401`, `400` (нет vibe / чужой vibe). `409` — только если нет **ни** `prompt_scene_core`+`grooming_reference`, **ни** `last_monolithic_prompt`, **ни** `prefilled_generation_prompt` (крайний случай битой строки).

### 6.2. Изменение `POST /api/vibe/expand` (и при необходимости extract)

Чтобы заполнить `prompt_scene_core` + `grooming_*`, ответ LLM должен быть **машинно разбираемым**.

**Вариант A (предпочтительный):** расширить JSON:

```json
{
  "prompt": "<только база сцены, без отдельных абзацев про макияж/волосы — их вынести в grooming>",
  "grooming": {
    "hair": "...",
    "makeup": "..."
  }
}
```

Инструкции в `EXPAND_PROMPTS_INSTRUCTION` / one-shot instruction нужно **явно** потребовать эту структуру (и для OpenAI `json_object` — слово JSON в тексте уже есть).

**Вариант B (MVP-хак):** не менять LLM, хранить целиком один `prompt`, а `grooming_*` брать только из `style.hair_makeup` (один абзац на оба). Тогда чекбоксы «только макияж» / «только волосы» **невозможны** без второго источника или без LLM. Для полного ТЗ из §3 — **вариант A обязателен**.

---

## 7. Логика сборки финального текста (детально)

### 7.1. Общая функция (псевдокод)

Имя условное: `buildGroomingInsert(refHair, refMakeup, policy) -> string`

```
function buildGroomingInsert(refHair, refMakeup, policy):
  parts = []

  if policy.applyHair:
    if policy.hairOverride is non-empty:
      parts.push("Hair styling: " + policy.hairOverride)
    else if refHair is non-empty:
      parts.push("Hair styling (match reference shoot): " + refHair)

  if policy.applyMakeup:
    if policy.makeupOverride is non-empty:
      parts.push("Makeup and skin finish: " + policy.makeupOverride)
    else if refMakeup is non-empty:
      parts.push("Makeup and skin finish (match reference shoot): " + refMakeup)

  if parts is empty:
    return ""   // пользователь всё отключил — явно не требовать grooming

  return "\n\n" + parts.join("\n\n")
```

Затем:

```
splitPath = non-empty(row.prompt_scene_core)

if !splitPath:
  combined = row.last_monolithic_prompt || row.prefilled_generation_prompt || ""
  // монолит: чекбоксы не меняют текст (лог fallback_monolith)
else:
  groomingBlock = buildGroomingInsert(row.grooming_reference, policy)  // "" если оба чекбокса off
  combined = row.prompt_scene_core + groomingBlock

finalForImageGen = assembleVibeFinalPrompt(combined, hasTwoImages, oneShotExtractConfigEnabled)
```

**Критично:** `assembleVibeFinalPrompt` уже живёт в `landing/src/lib/vibe-gemini-instructions.ts` — **не дублировать** префиксы; только подставлять `combined` вместо «старого монолитного» expand-текста.

### 7.2. Где брать `hasTwoImages` и `oneShotExtractConfigEnabled`

- `hasTwoImages` для превью/assemble — та же логика, что в expand: `getVibeAttachReferenceImageToGeneration` + наличие `source_image_url` (и при необходимости факт загрузки референса в generate — для **текста** префикса достаточно intent + URL как сейчас в expand).
- `oneShotExtractConfigEnabled` — `getVibeOneShotExtractPromptEnabled(supabase)` (как в expand/generate-process).

### 7.3. Что класть в `prompt_scene_core` при первом expand

Инструкция модели должна требовать: в `prompt` **не** дублировать длинные блоки про волосы/макияж — они только в `grooming`. Иначе при включённых чекбоксах будет **дубль**.

Провести **ревизию** текущих `EXPAND_PROMPTS_INSTRUCTION` / one-shot: разделить «сцена» и «grooming» в контракте JSON.

---

## 8. Обратная совместимость (старые vibes)

Порядок (согласован с §3.4 и §7.1):

1. Если заполнены `prompt_scene_core` и (при необходимости) `grooming_reference` — **нормальный** split-путь + чекбоксы.
2. Иначе если есть `last_monolithic_prompt` или `prefilled_generation_prompt` — `combined` = это значение; **чекбоксы не применять** (лог `[vibe.assemble] fallback_monolith`).
3. Иначе — `409` / понятная ошибка; в extension не показывать блок grooming до re-expand / нового extract.

Записи, созданные **до** миграции, получат поведение (2) только после **первого** успешного expand/extract в новой версии (когда заполнится `last_monolithic_prompt`), либо уже имеют `prefilled_generation_prompt` (one-shot).

---

## 9. Extension: пошаговая логика (для `app.js`)

Предполагается чтение текущего кода `extension/sidepanel/app.js` (вызовы `/api/vibe/extract`, `/api/vibe/expand`).

1. **После успешного expand** (или эквивалента для one-shot):
   - сохранить `vibeId`;
   - сохранить в state `groomingPolicy` defaults `{ applyHair: true, applyMakeup: true }`;
   - показывать чекбоксы **только** если сервер/данные допускают assemble (split-поля или fallback-монолит есть в БД — см. §3.4); иначе только превью финального промпта без блока grooming.

2. **При изменении чекбокса** (debounce 200–300 ms по желанию):
   - `POST /api/vibe/assemble-prompt` с телом из §6;
   - по успеху обновить `state.finalPromptForGeneration` (или как поле называется сейчас) и превью;
   - по ошибке показать i18n ключ (добавить в `i18n.js`).

3. **Перед `POST /api/generate`:**
   - использовать **последний** успешный результат assemble (или expand, если assemble не вызывали).

4. **Persist (опционально):** `chrome.storage.local` для дефолтов чекбоксов пользователя.

---

## 10. Порядок реализации (этапы для junior)

### Этап 0 — подготовка

- Прочитать `docs/architecture/01-landing.md` (секция Vibe Pipeline).
- Открыть `landing/src/app/api/vibe/expand/route.ts`, `extract/route.ts`, `vibe-gemini-instructions.ts` (`assembleVibeFinalPrompt`).
- Открыть `extension/sidepanel/app.js` — найти места после expand.

### Этап 1 — миграция БД

- Новый файл `sql/NNN_vibes_prompt_assembly_parts.sql`: `prompt_scene_core`, `grooming_reference` (jsonb), `last_monolithic_prompt` + комментарии.
- Применить на тестовом Supabase.

### Этап 2 — контракт LLM

- Обновить `EXPAND_PROMPTS_INSTRUCTION` (и при необходимости one-shot instruction): строгий JSON с `prompt` + `grooming.hair` + `grooming.makeup`.
- Обновить парсинг в `expand/route.ts`: валидировать JSON, сохранять `prompt_scene_core`, `grooming_reference`, `last_monolithic_prompt`; ответ клиенту как сейчас (combined для превью через существующую сборку).
- Обновить `extract/route.ts` для one-shot: тот же JSON-контракт.

### Этап 3 — endpoint assemble

- Новый route `landing/src/app/api/vibe/assemble-prompt/route.ts`.
- Вынести общую функцию сборки в `vibe-gemini-instructions.ts` или `vibe-assemble-prompt.ts` (без LLM).
- Юнит-тесты на сборку (если в проекте приняты тесты) или ручной чеклист в конце документа.

### Этап 4 — extension

- Разметка чекбоксов в sidepanel HTML (где рендерится шаг генерации).
- Обработчики → `assemble-prompt`.
- i18n RU/DE/EN.

### Этап 5 — документация и регрессия

- Обновить `docs/architecture/01-landing.md`.
- Прогнать smoke из `docs/steal-vibe-smoke-test.md` (если актуален).

---

## 11. Чеклист приёмки (QA)

- [ ] Two-shot: extract → expand → снять оба чекбокса → финальный промпт **без** grooming-вставки.
- [ ] Two-shot: только макияж выкл → в тексте нет блока makeup, есть hair.
- [ ] One-shot: тот же сценарий.
- [ ] Vibe только с `prefilled` / `last_monolithic` без split → assemble OK, чекбоксы не меняют текст.
- [ ] Vibe без каких-либо текстовых полей → 409, UI без блока grooming.
- [ ] Чужой `vibeId` → 401/403/400.
- [ ] Очень длинный `hairOverride` → 400.
- [ ] Генерация использует строку после assemble.

---

## 12. Связанные файлы (на момент написания спеки)

| Область | Файлы |
|---------|--------|
| Инструкции LLM | `landing/src/lib/vibe-gemini-instructions.ts` |
| Expand / extract | `landing/src/app/api/vibe/expand/route.ts`, `extract/route.ts` |
| Сборка префикса | `assembleVibeFinalPrompt` в том же lib-файле |
| Generate | `landing/src/app/api/generate/route.ts`, `generate-process/route.ts` |
| Extension | `extension/sidepanel/app.js`, `i18n.js` |
| Архитектура | `docs/architecture/01-landing.md` |

---

## 13. Риски и явные «не делаем в v1»

- **Не** пытаться вырезать grooming из одного абзаца regex-ом — хрупко.
- **Не** вызывать второй LLM только ради разделения без изменения контракта JSON.
- **v1** — только чекбоксы; оверрайды — **v2** (семантика «замена ref», §3.4).

---

*Документ можно версионировать: при реализации менять статус на «реализовано» и ссылаться из `01-landing.md`.*
