# Требования: генерация по тексту промпта без фото

> Дата: 2026-08-14  
> Статус: в реализации (`feature/14-08-text-only-generation-requirements`)  
> Контекст: worker уже умеет `sourceType=text_only` и `assembleTextToImageFinalPrompt`. Гейт «нужно фото» снят с `CardInlineGeneratePanel` и `POST /api/generate` для `prompt_card` и `seo_page`.

---

## 1. Context and assumptions

### 1.1 Цель

Пользователь может **запустить генерацию только по тексту промпта**, без выбранных фото, в трёх поверхностях лендингового композера:

| Поверхность | Сейчас | Цель |
|---|---|---|
| Модалка / fullscreen с карточки промта (`source=card`, `chrome=fullscreen`) | Нет | Да, промпт ≥ 8 символов |
| Dock `/generate` и листинг (`chrome=dock`, `generationSurface=prompt_card`) | Нет | Да, промпт ≥ 8 символов |
| Dock `/generaciya-foto` (`generationSurface=seo_page`) | Да, промпт ≥ 8 | Без регрессии |

Фото остаются **опциональным** входом: если выбраны — image-to-image с identity-правилами; если нет — text-to-image.

### 1.2 Что считается данным

- Один композер: `CardInlineGeneratePanel` → `POST /api/generate` → очередь `landing_enqueue_generation` → `web-generation-worker`.
- Worker уже резолвит пустой `input_photo_paths` как `text_only` и собирает промпт через `assembleTextToImageFinalPrompt` (без identity-preservation).
- Auth, кредиты, idempotency, ownership путей — без изменений. Feature flag `prompt_card_generation` **снят**: генерация доступна всем. Kill switch очереди — `GENERATION_QUEUE_ENABLED`.
- Минимальная длина промпта: **8 символов** (как сейчас).
- Continuation / local edit (`parentGenerationId` + `editInstruction`) не является text-only: вход — готовый результат предыдущей генерации.

### 1.3 Вне scope

- STV / `GenerationModal` (iframe `/embed/stv`) — по-прежнему требует user photos.
- Админ-модалка / `POST /api/admin/generate` — по-прежнему pinned photo.
- Отдельный тариф / скидка кредитов за text-only.
- Негативный промпт, batch, WebSocket вместо polling.

### 1.4 Что уточнять не нужно для старта

Продуктовое решение уже зафиксировано запросом: text-only должен работать **везде, где живёт `CardInlineGeneratePanel`**, а не только на SEO-странице.

---

## 2. Target architecture

### 2.1 Source of truth: capability ≠ surface

**Запрещено** использовать `generationSurface === "seo_page"` как флаг «можно без фото».

`generationSurface` остаётся **лейблом воронки** (`prompt_card` | `seo_page`), не capability-switch.

Единое правило для **initial** генерации лендингового композера:

```
если есть parentGenerationId → источник = результат предыдущей генерации (фото пользователя не нужны)
иначе если photoStoragePaths.length ≥ 1 → источник = user_photos
иначе → источник = text_only  (достаточно prompt.trim().length ≥ 8)
```

Один флаг в UI и API, например `allowsTextOnlyGeneration = true` для всех вызовов из `CardInlineGeneratePanel` (и `seo_page`, и `prompt_card`). Не плодить per-route if.

### 2.2 Data flow

```
CardInlineGeneratePanel
  prompt ≥ 8
  selectedPhotos: 0..N (N опционально)
        │
        ▼
POST /api/generate
  generationSurface: prompt_card | seo_page   ← аналитика
  photoStoragePaths: [] | [...owned paths]
        │
        ├─ auth / credits / idempotency
        ├─ photos: 0 допустимо; если >0 — ownership + max_photos
        └─ enqueue input_photo_paths = [] | paths
                │
                ▼
worker resolveGenerationInputSource
  []     → text_only  → assembleTextToImageFinalPrompt
  paths  → user_photos → assembleLandingCardFinalPrompt
  parent → generation_result → assembleLandingCardEditPrompt
```

### 2.3 Границы ответственности

| Слой | Ответственность |
|---|---|
| UI (`CardInlineGeneratePanel`) | CTA enabled при `prompt ≥ 8` и не busy; фото не блокируют старт; ошибка «Выберите хотя бы одно фото» не показывается для initial gen |
| API (`POST /api/generate`) | Не отвергает пустой `photoStoragePaths` для `prompt_card` и `seo_page`; логирует реальный `sourceType` |
| Worker | Без изменений контракта: пустые paths → text-only prompt assembly |
| `generationSurface` | Rollout + метрики. Не гейтит наличие фото |

### 2.4 Поверхности — одинаковое поведение

| Место | `source` | `chrome` | `generationSurface` | Text-only |
|---|---|---|---|---|
| Модалка / desktop aside карточки | `card` | `fullscreen` | `prompt_card` (default) | Да |
| Dock `/generate`, `/`, `/trends`, `/catalog`, `/search`, `/favorites`, `/generations` | `blank` или seed с карточки | `dock` | `prompt_card` | Да |
| Dock `/generaciya-foto` | `blank` / seed | `dock` | `seo_page` | Да (как сейчас) |

`GenerateMobileModal` и `GenerateSurface` не добавляют свой гейт по фото: они только монтируют ту же панель.

### 2.5 Промпт карточки без фото

Промпты карточек писались под image-to-image («этот человек в сцене»). Без фото модель **изобретает** субъекта по тексту — это ожидаемо.

- Не подменять промпт карточки и не блокировать старт.
- Не слать identity-rules (`GENERATE_LANDING_CARD_CRITICAL_RULES`) при пустом входе: worker уже выбирает `assembleTextToImageFinalPrompt`.
- Фото в шите остаются способом зафиксировать идентичность, не обязательным шагом.

---

## 3. Functional requirements

### F1. CTA

Кнопка «Сгенерировать» **enabled**, если:

- пользователь авторизован (иначе — auth modal, как сейчас);
- нет `busy` / `libraryLoading` / `configError`;
- `draftPrompt.trim().length ≥ 8`;
- это не continuation без `editInstruction`.

**Не** disabled из-за `selectedPhotos.length === 0`.

Исключение: `phase === "done"` с результатом — CTA открывает редактор промпта / «Повторить», как сейчас.

### F2. `runGenerate` (initial)

Убрать ветку:

```
if (!isContinuation && !selectedPhotos.length && !allowsTextOnlyGeneration)
  → "Выберите хотя бы одно фото"
```

Для initial gen пустой `photoStoragePaths: []` — валидный запрос.

### F3. API validation

Удалить (или сделать no-op) гейт:

```
allowsTextOnlyGeneration = generationSurface === "seo_page"
если нет parent и photos < 1 и !allowsTextOnlyGeneration → 400 "Нужно минимум 1 фото"
```

Новые правила:

| Условие | Результат |
|---|---|
| `prompt.trim().length < 8` | 400, без изменений |
| parent + photos одновременно | 400, без изменений |
| parent без валидного edit contract | 400, без изменений |
| photos ≥ 1, чужой path | 403, без изменений |
| photos > max_photos | 400, без изменений |
| нет parent, photos = 0, prompt ≥ 8 | **200 enqueue**, `sourceType=text_only` |
| нет parent, photos ≥ 1, prompt ≥ 8 | 200 enqueue, `sourceType=user_photos` |

Feature flag `prompt_card_generation` **снят**. Генерация доступна всем; text-only не зависит от cohort. Операционный kill switch — `GENERATION_QUEUE_ENABLED`.

### F4. Логи API

Сейчас при пустых фото пишется `sourceType: "user_photos"` — это ложь.

Писать:

- `text_only` если нет parent и `photoStoragePaths.length === 0`
- `user_photos` если нет parent и photos > 0
- `generation_result` если есть parent

Поле `photos: 0` уже есть — оставить.

### F5. UI копирайт фото-шита

Пустая библиотека не должна звучать как блокер старта. Смысл: фото опциональны и сохраняются для следующих генераций / переноса идентичности.

Не менять лимит `max_photos` и загрузку.

### F6. Continuation

Без изменений: фото пользователя не требуются, нужен `editInstruction` и completed parent. Это не text-only.

### F7. Кредиты и модель

Стоимость = стоимость выбранной модели, **одинаковая** для text-only и user_photos. Не ветвить `landing_generation_credit_costs` по наличию фото.

### F8. Регрессия `/generaciya-foto`

Hero «По описанию» → `seedBlankPrompt` → dock → генерация без фото — как сейчас. Не завязывать разрешение на pathname.

---

## 4. Scaling and bottlenecks

Text-only снижает friction → больше enqueue с тех же listing/card сессий.

| Риск | Почему | Контрмера |
|---|---|---|
| Рост RPS `POST /api/generate` | Старт без загрузки фото | Существующие auth + credits + idempotency. Kill switch `GENERATION_QUEUE_ENABLED`. Не добавлять отдельный лимит «только text-only», пока нет метрик. |
| Очередь worker | Gemini 120s timeout уже bottleneck | Тот же lease/retry. Наблюдать `generation.create` + `sourceType=text_only` vs `user_photos`. |
| Gemini cost | Text-only всё ещё IMAGE modality | Те же кредиты. Если доля text-only > ~50% enqueue — отдельно решить, нужен ли cheaper model default (не в этом изменении). |
| Stampede с карточки | Один и тот же промпт карточки без фото | Idempotency-Key с клиента (как сейчас). Fingerprint уже включает `photoStoragePaths` — `[]` vs paths дают разные jobs, это правильно. |

Не вводить отдельную очередь / отдельный worker для text-only.

---

## 5. Reliability and SLOs

Существующие SLO очереди и polling не меняются. Добавить наблюдаемость:

| Сигнал | Зачем |
|---|---|
| `generation.create` + `sourceType` (`text_only` / `user_photos` / `generation_result`) | Доля text-only, нельзя смешивать с user_photos |
| `generation_input_resolved.sourceType` (worker) | Сверка API vs worker |
| fail-rate Gemini по `sourceType` | Text-only может чаще давать пустой image part |
| p95 enqueue → completed | Регрессия очереди после снятия фото-гейта |

Допустимая деградация: при падении Gemini — тот же refund/failed status, без отдельного UX для text-only.

---

## 6. Security and compliance

- Пустые `photoStoragePaths` не ослабляют auth, ownership, credits.
- Нельзя слать чужие paths: проверка `isStoragePathOwnedByAuthUser` только если массив непустой.
- `generationSurface` с клиента **не** повышает привилегии: text-only разрешён и для `prompt_card`, подделка `seo_page` ничего не даёт.
- Prompt ≥ 8 — единственный контентный минимум; отдельный abuse-классификатор в этом изменении не требуется (как на `/generaciya-foto`).
- Секреты Gemini по-прежнему только в worker/env.

---

## 7. Evolution (без big bang)

Один PR, без миграции БД: схема уже принимает `input_photo_paths = []`.

Порядок:

1. API: снять фото-гейт для initial gen; починить `sourceType` в логах.
2. UI: `allowsTextOnlyGeneration = true` для панели (или удалить флаг); CTA + `runGenerate`.
3. Копирайт пустого фото-шита.
4. Тесты: API 200 при `photos=[]` + `prompt_card`; UI не disabled без фото; worker-тест `text_only` уже есть — не ломать.
5. Обновить `docs/architecture/01-landing.md` (дата + абзац: text-only на всех поверхностях панели, не только `seo_page`).
6. В `docs/16-03-web-generation-module.md` §3.4 фото = опционально; пункт «Генерация без фото» убрать из вне scope.

Откат: вернуть серверный 400 на пустые photos для `prompt_card` (UI снова начнёт получать ошибку). Предпочтительнее держать сервер источником правды.

---

## 8. Acceptance

- [ ] Модалка карточки: промпт ≥ 8, 0 фото → enqueue, статус completed, картинка по тексту.
- [ ] Модалка карточки: ≥ 1 фото → по-прежнему identity image-to-image.
- [ ] Dock `/generate` и листинг: то же.
- [ ] `/generaciya-foto`: text-only не сломан.
- [ ] CTA не серая только из-за отсутствия фото.
- [ ] `POST /api/generate` с `generationSurface=prompt_card` и `photoStoragePaths=[]` не возвращает «Нужно минимум 1 фото».
- [ ] Continuation без пользовательских фото работает как сейчас.
- [ ] STV и admin по-прежнему требуют фото.
- [ ] В логах create/worker `sourceType=text_only` при нуле фото.
- [ ] Кредиты списаны по модели, не по наличию фото.

---

## 9. Не делать

- Не ветвить text-only через `isGenerateDockSeoPagePath` / pathname.
- Не заводить второй композер или отдельный API.
- Не менять STV / admin в этом изменении.
- Не делать фото «скрытыми обязательными» (disabled CTA, toast после клика).
- Не слать landing-card identity rules в Gemini при пустом входе.
