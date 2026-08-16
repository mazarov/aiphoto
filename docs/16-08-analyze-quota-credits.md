# Требования: квота анализа фото → промт (10 бесплатных / день, далее 1 кредит)

> Дата: 2026-08-16  
> Статус: реализация в `feature/16-08-analyze-quota-credits` (бесплатных в сутки: **10**, не 5)  
> Поверхности: `/foto-v-promt`, стартер «По фото» на `/generaciya-foto`, `POST /api/extension/analyze`

## Цель

Ограничить себестоимость Gemini-анализа и привязать платный перерасход к аккаунту, **не ломая SEO-aha** «загрузил фото — получил промт».

Принятое правило:

1. **10 успешных анализов в сутки — бесплатно.**
2. **Каждый следующий в эти сутки — 1 кредит** с баланса `landing_users.credits`.
3. **Платный анализ только под авторизацией** (не anonymous / не STV-guest). Гость после 10-го бесплатного обязан войти; кредиты ему не списываются.

Подписка, отдельная «валюта анализа» и обязательный вход *до первого* анализа — **не входят** в эту фичу.

---

## 1. Context and assumptions

### 1.1 Как сейчас

| Что | Факт |
|---|---|
| Эндпоинт | `POST /api/extension/analyze` (prod same-origin). Dev: `/api/imageprompt-proxy/extension/analyze` → imageprompt.tools — **не SSOT квоты**, см. §7 |
| Квота | `extension_rate_limit_per_day`, дефолт **30** на IP **или** user, один `max` |
| Гость | IP-hash (UTC-день). Auth опционален |
| После 30 у гостя | 429 + `auth_required: true`, но после входа лимит тот же 30 и IP **мержится** в user — новых попыток нет |
| Сбой RPC квоты | **fail-open** → Gemini всё равно вызывается |
| Кредиты | Анализ не списывает. Генерация: 5 или 10 токенов через `landing_deduct_credits` |
| `/foto-v-promt` | Виджет работает без входа. При `auth_required` сейчас ссылка на **imageprompt.tools** — это баг относительно PromptShot |
| `/generaciya-foto` «По фото» | Файл не выбирается, пока нет аккаунта (`openAuthModal`). Generate и так за логином |
| Модель | `gemini-2.5-flash`, успех → private `analyze_history` |
| Сутки | UTC (`extensionRateLimitDayWindowStartIso`) |

### 1.2 Продуктовые решения (зафиксировано)

| # | Решение |
|---|---|
| D1 | Бесплатных в сутки: **5** на идентичность, не 5 гостю + 5 после входа |
| D2 | Идентичность: гость = salted IP, юзер = `imageprompt_users.id` / `landing_users`. При логине **merge IP → user**, как сейчас. Если гость уже сделал 5, после входа в этот UTC-день сразу платный режим |
| D3 | Счётчик увеличивается только при **успешном** анализе (как сейчас confirm). Fail/timeout/safety не тратят бесплатный слот и не тратят кредит |
| D4 | Стоимость сверх 5: **ровно 1** кредит. Тот же кошелёк, что у генерации. Второй баланс не заводим |
| D5 | Гость **не может** платить. После 5 → только вход. Дальше 1 кредит, если на балансе ≥ 1; иначе pricing overlay |
| D6 | Anonymous JWT и STV-guest (`isStvGuestUser`) = гость. Виртуальные 999 кредитов **нельзя** списывать за анализ |
| D7 | Верхнего дневного потолка на *платные* анализы в v1 нет: упёрся в баланс — стоп |
| D8 | Сутки в v1 — **UTC**, чтобы переиспользовать текущее окно. Не переносить на Europe/Moscow без отдельной задачи |
| D9 | Подписка — out of scope |
| D10 | NSFW/safety Gemini — out of scope (follow-up). Эта фича не заменяет модерацию |

### 1.3 Вне scope

- Обязательный OAuth до **первого** анализа на `/foto-v-promt`
- YooKassa recurring / тариф «анализы в месяц»
- Extension Lite и remix на **imageprompt.tools** (другой бэкенд; follow-up)
- `POST /api/prompt-remix` на лендинге (уже требует auth, свою квоту анализа не делит)
- Админ `POST /api/admin/*` generation/publish
- Смена SEO-кластера `/foto-v-promt` (URL, index, JSON-LD типы) — только тексты про лимит, §6
- Хранение/ретеншн `analyze_history`

---

## 2. Target architecture

### 2.1 Source of truth

Один серверный гейт: **`POST /api/extension/analyze`**.

UI не имеет права «просто вызвать Gemini» или обойти квоту. Клиент показывает остаток и модалки по полям ответа API.

`generationSurface` / pathname **не** гейтят квоту. Одинаковые правила для всех вызовов этого маршрута.

### 2.2 Идентичность и бакет

```
request
  ├─ real session (не anonymous, не STV-guest) + resolved landing/shared user
  │     bucket = user:{dbUserId}
  │     merge today's IP usage into user bucket (как extension_rate_limit_merge_ip_to_user)
  └─ иначе
        bucket = ip hash (как сейчас)
        authenticated = false
```

Конфиг (defaults, читаются с сервера, без хардкода в нескольких местах):

| Ключ | Default | Смысл |
|---|---|---|
| `analyze_free_per_day` | `5` | Бесплатных успешных + pending в окне |
| `analyze_credit_cost` | `1` | Кредитов за анализ сверх бесплатных |

Старый `extension_rate_limit_per_day` (=30) для **этого** эндпоинта больше не является max. Не оставлять два конфликтующих потолка.

### 2.3 Атомарный reserve

Новый RPC (следующий номер после `184`, ориентир **`185_analyze_quota_credits.sql`**). Один вызов до Gemini:

```
usage = count + pending в текущем UTC-дне по bucket

если usage < free_per_day:
  pending += 1
  return { allowed, mode: "free", remaining_free, credits_charged: 0 }

если не авторизован (см. D6):
  return { allowed: false, error: "auth_required" }

если credits < analyze_credit_cost:
  return { allowed: false, error: "no_credits" }

атомарно landing_deduct_credits(cost)
pending += 1   // или отдельный paid-hold
return { allowed, mode: "paid", remaining_free: 0, credits_charged: 1, credits_left }
```

Параллельные запросы: два гостя при `count=4` → один free, второй `auth_required` (или второй free, если ещё есть слот). Нельзя двум пройти free при `count=4` без лока.

### 2.4 Gemini и confirm/release

Как сейчас, но **fail-closed**:

| Исход | Free | Paid |
|---|---|---|
| Preflight RPC недоступен | **Не** вызывать Gemini. 503 `quota_unavailable` | то же |
| Reserve отказал | 429/401/402 по error, без Gemini | то же |
| Gemini успех | `confirm`: pending−1, count+1. Кредит не трогать | confirm hold; кредит уже списан |
| Gemini fail / timeout / пустой ответ / 4xx-5xx | `release` pending. Кредит не был списан | `release` + **refund 1** (`credits_refunded` идемпотентно) |
| Клиент оборвал запрос после reserve | release/refund по тому же правилу, что fail | то же |

Запрещено: списать кредит после успеха без hold (гонка двух paid с 1 кредитом).

Запрещено: считать неуспех в 5 бесплатных.

### 2.5 Data flow

```
/foto-v-promt виджет ─┐
/generaciya-foto «По фото» ─┼─► POST /api/extension/analyze
                             │      ├─ resolve identity
                             │      ├─ RPC reserve (free | auth_required | no_credits | paid)
                             │      ├─ Gemini flash
                             │      └─ confirm / release+refund
                             ▼
                      { prompt, quota... } | error
```

`/generaciya-foto`: в v1 **не снимать** текущий вход до выбора файла. Гостевые 5 живут на `/foto-v-promt`. Залогиненный на «По фото» ест **ту же** дневную квоту (если утром крутил `/foto-v-promt` с того же IP и потом вошёл — merge).

### 2.6 История

В `analyze_history` для каждого успешного site-analyze:

- `credits_spent` int NOT NULL DEFAULT 0 (0 = free, 1 = paid)
- опционально `quota_mode` `free` | `paid`

Нужно, чтобы админка и разбор COGS видели платные разборы. Не писать строку истории, если Gemini неуспешен.

---

## 3. Functional requirements

### F1. Гость, бесплатные

Пока `usage < 5` в текущие UTC-сутки по IP:

- Анализ без аккаунта разрешён.
- Кредиты не списываются.
- В ответе: `quota.mode=free`, `quota.remaining_free`, `quota.free_max=5`.

### F2. Гость, слоты кончились

- Gemini не вызывать.
- HTTP **401** (предпочтительно) или 429 с телом ниже. Клиент обязан открыть **PromptShot `AuthModal`**, не imageprompt.tools.
- Тело: `error: "auth_required"`, `auth_required: true`, человекочитаемый `message`.

После успешного входа: повторный submit того же фото (UX: не терять preview; на виджете — кнопка «Повторить анализ»). Если merge показал usage ≥ 5 — сразу F4/F5, не вторая пятёрка.

### F3. Авторизованный, бесплатные

Тот же порог 5 на user-bucket (после merge). Пока usage < 5 — как F1, `authenticated: true`.

### F4. Авторизованный, платный, баланс ≥ 1

- Списать `analyze_credit_cost` (1).
- При успехе отдать промт + `quota.mode=paid`, `credits_charged: 1`, актуальный остаток кредитов.
- UI: если перед запросом `remaining_free=0`, показать «Анализ спишет 1 токен» (не отдельный confirm-модал, по аналогии с генерацией).
- После успеха — событие обновления баланса (`CREDIT_BALANCE_REFRESH_EVENT`), как после генерации.

### F5. Авторизованный, платный, баланс 0

- Gemini не вызывать, кредит не уводить в минус.
- HTTP **402** или 403, `error: "no_credits"`.
- Клиент: тот же pricing overlay, что у генерации (`usePricingModal`), цель Метрики можно переиспользовать `prompt_card_generation_pricing` **или** завести `analyze_no_credits` — лучше отдельную, чтобы не смешивать воронки.

### F6. Остаток до запроса

Чтобы кнопка не врала:

- Либо `GET /api/extension/analyze/quota` (`credentials: include`, no-store),
- либо те же поля в каждом ответе analyze + кэш на клиенте до полуночи UTC.

Минимум в GET/ответе:

```json
{
  "authenticated": false,
  "free_max": 5,
  "remaining_free": 3,
  "next_mode": "free",
  "credit_cost": 1
}
```

Для авторизованного при `remaining_free=0`: `next_mode: "paid" | "no_credits"`, `credits` (реальный баланс, не 999).

### F7. Fail-closed

Любая ошибка чтения/записи квоты или списания → **503** `quota_unavailable`, без Gemini. Залогировать. Не повторять `rate_limit.fail_open`.

### F8. Админ / open-debug

Специального безлимита на site-analyze нет. Allowlist бесплатных генераций **не** открывает безлимитный анализ.

### F9. Тексты ошибок (RU)

| Ситуация | Смысл сообщения |
|---|---|
| Гость, 5 из 5 | «Бесплатные разборы на сегодня закончились. Войдите, чтобы продолжить — дальше 1 токен за анализ.» |
| Авторизован, 0 токенов | «Бесплатные разборы на сегодня закончились. Пополните токены: анализ стоит 1 токен.» |
| 503 квота | «Сервис лимитов временно недоступен. Попробуйте ещё раз.» |
| Успех paid | Тост/строка: «Списан 1 токен» |

Не обещать «безлимит» и не слать на imageprompt.tools.

---

## 4. API

### 4.1 `POST /api/extension/analyze`

Контракт входа без изменений (`image_base64` / `image_url`, style, locale).

Успех 200 — добавить (имена можно уточнить, семантика обязательна):

```json
{
  "prompt": "...",
  "quota": {
    "mode": "free",
    "free_max": 5,
    "remaining_free": 2,
    "credits_charged": 0,
    "authenticated": false
  }
}
```

Ошибки:

| HTTP | `error` | Когда |
|---|---|---|
| 401 | `auth_required` | Гость, бесплатные исчерпаны |
| 402 | `no_credits` | Юзер, бесплатные исчерпаны, баланс < 1 |
| 429 | `rate_limited` | Не использовать как замену 401/402. Оставить только если появится отдельный anti-abuse cap |
| 503 | `quota_unavailable` | RPC/БД квоты недоступны |
| 4xx/5xx как сейчас | validation / upstream | Без списания |

Поля `auth_required: true` сохранить для совместимости с `image-prompt-analyze-client.ts`. Добавить `no_credits: true` там же.

### 4.2 `GET /api/extension/analyze/quota`

Обязателен, если UI показывает остаток до загрузки фото. Cookie session. `Cache-Control: no-store`.

### 4.3 Клиенты, которые надо провести через новый контракт

| Клиент | Файл | Что сделать |
|---|---|---|
| Виджет `/foto-v-promt` | `PromptSceneLiteWidget.tsx` | 401 → `openAuthModal`; 402 → pricing; убрать CTA на imageprompt.tools; показать remaining |
| Общий helper | `image-prompt-analyze-client.ts` | Распознать `no_credits`; прокинуть quota |
| Стартер «По фото» | `GeneraciyaFotoStarter.tsx` | После auth: 402 → pricing; не глотать ошибку как generic; при 401 (не должно при isAuthed) — всё равно AuthModal |
| Dev proxy | `imageprompt-proxy/.../analyze` | Либо гейтить так же (если dev ходит в tools — **расхождение квоты**). Для локальной проверки фичи в prod-логике нужен same-origin `/api/extension/analyze`, не tools |

---

## 5. UI / UX

### 5.1 `/foto-v-promt`

- На пустой панели: «N из 5 бесплатных сегодня» (N с quota API).
- После 5 у гостя: не глухой экран, а вход PromptShot (Google/Яндекс), тот же `AuthModal`.
- После входа не сбрасывать выбранное фото, если оно ещё в памяти.
- Paid: предупреждение про 1 токен **до** повторного сабмита, если quota уже известна.

### 5.2 `/generaciya-foto` «По фото»

- Вход до файла — как сейчас.
- Если залогинен и `next_mode=paid` — подпись у CTA про 1 токен.
- `no_credits` → pricing overlay, файл можно не терять.
- Не открывать гостевой analyze на этой странице в v1.

### 5.3 Баланс в шапке

После paid-анализа обновить чип кредитов тем же событием, что генерация.

---

## 6. SEO и копирайт

Страница `/foto-v-promt` остаётся indexable, виджет на SSR-странице живой.

Обновить SSOT `landing/src/lib/foto-v-promt-copy.ts` (hero, FAQ «бесплатно», meta description), чтобы везде было согласовано:

- 5 бесплатных разборов в сутки без регистрации;
- дальше нужен аккаунт PromptShot, каждый следующий разбор — 1 токен.

HowTo шаг «загрузите фото на странице» остаётся. Не писать «безлимитно» / «без ограничений».

JSON-LD FAQ брать из тех же строк, что видимый FAQ.

Хабы каталога (`seo-content.ts` «промты копируй бесплатно») **не** менять: это другой джоб (копирование карточки), не analyze.

---

## 7. Расширение и dev-прокси

v1 закрывает **PromptShot site analyze**.

| Контур | v1 |
|---|---|
| `promptshot.ru` → `/api/extension/analyze` | Новая квота |
| `next dev` → imageprompt.tools через proxy | Не считать прод-поведением; для приёмки фичи гонять same-origin analyze |
| Chrome extension / imageprompt.tools | Отдельный follow-up, иначе COGS утечёт туда |

---

## 8. Аналитика

События (analyze_events / Метрика — что уже пишется в `recordAnalyzeEvent`, плюс новые goals при необходимости):

| Событие | Зачем |
|---|---|
| `analyze_free_success` | Aha без оплаты |
| `analyze_paid_success` | Overage |
| `analyze_auth_required` | Гость упёрся в 5 |
| `analyze_no_credits` | Юзер упёрся в баланс |
| `analyze_quota_unavailable` | Дыра fail-closed |

В `recordAnalyzeEvent` / admin overview: разбивка free vs paid, guest vs user. Не смешивать с `prompt_card_generation_*`.

---

## 9. Миграция и выкат

1. SQL: RPC reserve/confirm/release+refund, колонка `analyze_history.credits_spent`, конфиг `analyze_free_per_day` / `analyze_credit_cost`.
2. Выключить fail-open в `extension-rate-limit.ts` **для analyze** (remix на tools не трогать вслепую).
3. Деплой landing.
4. Применить SQL на БД лендинга **до** или атомарно с деплоем: иначе новый код вызовет отсутствующий RPC → 503 (это безопаснее, чем старый безлимит, но виджет «умрёт»). Порядок: SQL → деплой.
5. Прогнать чеклист §11.
6. Обновить `docs/architecture/01-landing.md` (квота analyze, кредиты, fail-closed) — после реализации, дата в шапке.

Старые строки `extension_rate_limit` с max=30 можно не чистить: окно дневное.

---

## 10. Риски

| Риск | Как закрываем |
|---|---|
| 5+5 после логина | Merge IP→user, один free_max |
| Гость крутит IP/VPN | v1 принимаем; платный путь требует аккаунт. Отдельный anti-abuse cap — follow-up |
| Двойной клик съест 2 кредита | Hold до Gemini, idempotent refund |
| 999 STV-guest | D6, никогда не deduct |
| SEO pogo-stick | 5 бесплатных без входа на `/foto-v-promt`; честный FAQ |
| Виджет шлёт на tools | F9, §4.3 |
| Dev ходит в tools без новой квоты | §7, приёмка только на same-origin |

---

## 11. Чеклист приёмки

- [ ] Гость: 5 успешных анализов на `/foto-v-promt` за UTC-сутки.
- [ ] Гость 6-й: нет вызова Gemini (проверить логи), AuthModal PromptShot, не imageprompt.tools.
- [ ] Гость сделал 5 → вошёл → 6-й списывает 1 кредит, не даёт ещё 5 free.
- [ ] Юзер с нуля: 5 free, 6-й при балансе ≥1 списывает 1, чип баланса −1.
- [ ] Юзер после 5 при 0 кредитов: pricing overlay, баланс 0, нет Gemini.
- [ ] Gemini 500 после paid-hold: кредит вернулся, слот не съеден как успех.
- [ ] Параллельно два гостевых запроса на 5-й слот: один успех, второй auth_required (или строго не больше 5 success).
- [ ] RPC квоты выключен/ошибка: 503, нет Gemini.
- [ ] STV-guest / anonymous: не списывает 999.
- [ ] `/generaciya-foto` «По фото»: залогиненный делит квоту с `/foto-v-promt`.
- [ ] FAQ/hero/meta `/foto-v-promt`: 5 в сутки, далее аккаунт и 1 токен.
- [ ] Admin analyze-history: у paid строки `credits_spent=1`.

---

## 12. Follow-up (не блокируют v1)

1. Safety settings Gemini + не писать blocked в history (непотреб).
2. Та же квота на imageprompt.tools / extension.
3. Подписка, если появится когорта weekly cap-hitters.
4. Сутки `Europe/Moscow`.
5. Дневной anti-abuse cap на paid (например 50), если начнут жечь пакеты на разбор.
