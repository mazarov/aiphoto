# SEO и бесплатный трафик в существующей атрибуции

**Дата:** 2026-08-24
**Статус:** Реализовано; web deploy и production SQL apply ожидаются
**Ветка:** `feature/24-08-seo-traffic-attribution`
**База:** [19-08-traffic-source-attribution.md](./19-08-traffic-source-attribution.md)

## Цель

Научиться видеть, откуда пришёл пользователь, если это не реклама, и те же поля тянуть на оплату.

Сейчас first-touch пишется только при `utm_source` / `yclid`. Органика остаётся пустой (`direct / organic / unknown`), referrer не используется. Из-за этого в `/admin/payments` и на `landing_users` нет SEO-канала.

Не строить вторую куку, вторую таблицу и отдельные «параметры пользователя». Расширить уже существующий пайплайн:

```text
первая страница → cookie promptshot_utm → OAuth POST /api/me/attribution
  → landing_users → снимок на YooKassa / Robokassa
```

## Модель

Один снимок на visitor / user / payment. Приоритет:

```text
пустой < бесплатный (SEO / direct / referral) < платный
```

Правила:

- платный канал **может** перетереть бесплатный;
- бесплатный **не может** перетереть платный;
- между двумя платными — первый клик, как сейчас;
- между двумя бесплатными — первый заход, страницу не менять на внутренний переход;
- `yclid` по-прежнему независим: пишется только если поле пустое; при апгрейде SEO → ads заполняется, если пришёл.

Не угадывать SEO по правилу «нет UTM = SEO». Пустой referrer — `direct`, не `*_seo`.

Multitouch, last-click и «SEO помог, потом кликнул объявление» **не** храним. Если в окне атрибуции был платный клик, пользователь и оплата считаются платными.

## Поля

Новых колонок нет. Используем уже существующие:

| Поле | Платный | Яндекс SEO | Google SEO | Direct | Referral |
|---|---|---|---|---|---|
| `utm_source` | `yandex` / `ya` (как в объявлении) | `yandex_seo` | `google_seo` | `direct` | `referral` |
| `utm_medium` | `cpc` (или иной платный medium из URL) | `organic` | `organic` | `none` | `referral` |
| `utm_campaign` | из URL | `null` | `null` | `null` | `null` |
| `utm_content` | из URL | `null` | `null` | `null` | host реферера, без path/query |
| `utm_term` | из URL | `null` | `null` | `null` | `null` |
| `utm_landing_path` | первый pathname | первый pathname | первый pathname | первый pathname | первый pathname |
| `yclid` | из URL, если есть | `null` | `null` | `null` | `null` |

Первая страница — **только** `utm_landing_path` (pathname без query/hash, max 200).  
`utm_medium` для пути **не** использовать: medium — канал (`cpc` / `organic` / `none` / `referral`), лимит 64 символа, от него зависит детект Директа.

Синтетические значения (`yandex_seo`, `organic`, …) пишутся только в куку и БД. В адресную строку их не подставлять.

`utm_source=yandex` без `cpc` / `yclid` для органики **не** писать: фильтр «yandex» в оплатах и finance останется рекламным.

## Что считается платным

Платный входящий снимок, если выполняется любое:

1. валидный `yclid`;
2. `utm_medium` ∈ `{cpc, cpm, ppc}` (без учёта регистра);
3. текущее правило объявления: `utm_source` ∈ `{yandex, ya}` **и** `utm_medium=cpc`.

Не платные, даже если в source есть слово yandex:

- `yandex_seo` / `google_seo` / `bing_seo` + `organic`;
- `direct` + `none`;
- `referral` + `referral`.

Хелпер `isPaidAttribution(bag, yclid)` — SSOT для cookie resolve, `/api/me/attribution`, visitor upsert, checkout persist и тестов. Детект «этот **URL** — рекламный клик» (`isPaidAdClickSearch`) не менять: он смотрит только query, не куку.

## Классификация бесплатного захода

Только если текущий URL **не** платный. Смотрим `document.referrer`.

| Referrer | `utm_source` | `utm_medium` | `utm_content` |
|---|---|---|---|
| `yandex.ru`, `ya.ru`, `yandex.by`, `yandex.kz`, `yandex.com` и `*.yandex.*` | `yandex_seo` | `organic` | `null` |
| `google.com`, `google.ru`, `www.google.*`, `googleusercontent.com` не использовать | host `google.` → `google_seo` | `organic` | `null` |
| `bing.com` | `bing_seo` | `organic` | `null` |
| пустой / не парсится / `android-app:` без host | `direct` | `none` | `null` |
| другой внешний host | `referral` | `referral` | host (`t.me`, `vk.com`), max 64 |
| same-origin (внутренний клик, SPA) | не классифицировать заново | — | — |

Same-origin referrer и клиентская навигация без нового внешнего входа **не** меняют уже записанный снимок и **не** переписывают `utm_landing_path`.

Первая страница — pathname того хита, на котором **впервые** записали бесплатный снимок. Не страница логина, не `/pricing` в конце воронки, не `/auth/callback`.

Исключить как посадочную:

- `/auth` и `/auth/*`
- `/api/*`

`/`, листинги, `/p/*`, `/generaciya-foto`, `/foto-v-promt`, `/sobytiya/*` — валидные посадочные.

Ключ запроса (`/search?q=`) в v1 не сохраняем, только pathname.

## Cookie и visitor

Те же имена и TTL:

- `promptshot_utm` — 21 день, `Path=/; SameSite=Lax`, `Secure` на HTTPS;
- `promptshot_yclid` — без изменений;
- `promptshot_vid` / `promptshot_sid` — без изменений.

`resolveFirstKnownAttribution` больше не равен «есть `utm_source` → замок». Новый resolve:

1. stored платный → вернуть stored, не писать;
2. URL платный → persist платный (апгрейд поверх пустого или бесплатного);
3. stored бесплатный → вернуть stored, не писать;
4. текущий хит классифицируется как бесплатный (внешний вход) → persist синтетический bag + текущий pathname;
5. иначе пустой, persist нет.

`parseAttributionCookie` должен принимать синтетический bag (`yandex_seo` и т.д.), не только рекламный UTM.

Capture по-прежнему из `YandexMetrikaRouteTracker` и перед OAuth redirect. На каждом SPA-переходе вызывается resolve, но перезапись только по правилам выше.

## Сервер: платный может апгрейднуть SEO

Сейчас триггеры и persist пишут bag **только если `utm_source IS NULL`**. После записи `yandex_seo` поздний Директ не попадёт на пользователя.

Нужна **новая** миграция (не править `sql/196_*` / `sql/198_*`). Следующий свободный номер в `sql/` на момент реализации.

Одинаковое правило апгрейда на:

- `landing_users_protect_attribution`
- `landing_acquisition_visitors_protect`
- копирование visitor → `landing_users` при link
- `POST /api/me/attribution`
- страховка persist на create YooKassa / Robokassa

```text
если stored пустой и incoming валидный → записать incoming
если stored бесплатный и incoming платный → заменить bag, выставить attribution_captured_at = now()
если stored платный → оставить stored
yclid: если OLD.yclid не пустой → оставить; иначе взять incoming
anon / authenticated по-прежнему не могут менять attribution напрямую
usedGuestOwner=true — по-прежнему не пишем
```

Снимок оплаты:

1. валидный checkout body;
2. поля `landing_users`;
3. `null`.

Если в body платный, а на пользователе ещё SEO — в ledger пишем платный **и** апгрейдим `landing_users`.  
Идемпотентный повтор create по-прежнему backfill-ит только `null`, кроме случая апгрейда бесплатный → платный (это не backfill дырки, это замена по правилу приоритета).

Логин и оплата без cookie / referrer не падают.

На сервер **не** слать сырой `document.referrer` и полный URL. Только уже санитайженный bag + visitor/session. Клиент может соврать — это тот же trust model, что у текущих UTM.

Разрешённые синтетические `utm_source` на persist: `yandex_seo`, `google_seo`, `bing_seo`, `direct`, `referral`. Иной source без признаков платного отбрасывать до пустого, не изобретать канал.

## Admin и finance

`/admin/payments` уже рисует `source / medium` и `utm_landing_path`. Должно начать показывать, например:

```text
yandex_seo / organic
/sobytiya/den-rozhdeniya
```

```text
direct / none
/
```

Пустой bag по-прежнему «Не указан».

`formatPaymentTrafficSource.isDirect` остаётся **только** `yandex|ya` + `cpc`.  
`yandex_seo` не Директ.

Фильтр `source` уже есть — должны находиться `yandex_seo`, `google_seo`, `direct`, `referral`. Отдельную SEO-страницу пользователей и новый finance-отчёт в v1 не делать.

Join расходов Директа (`utm_campaign` как numeric campaign id) не менять. Синтетический bag без numeric campaign в CAC/ROAS не попадает. Проверить, что `yandex_seo` не вливается в delivery/cohort Директа как paid source.

## Что не меняем

- Measurement Protocol и цель `purchase`;
- Telegram Stars;
- multitouch / last-click / cross-device;
- запись ключевых слов органики (Вебмастер живёт отдельно);
- Chrome Web Store UTM на исходящих ссылках;
- guest owner / anonymous persist;
- названия cookie и TTL.

## Затронутый код (ориентир)

- `landing/src/lib/traffic-source-attribution.ts` — tier, paid helper, resolve, cookie parse;
- `landing/src/lib/traffic-source-attribution-browser.ts` — referrer → bag, не переписывать path на SPA;
- `landing/src/lib/ad-landing-title.ts` — не ломать `isPaidAdClickSearch`;
- `landing/src/lib/admin-payments.ts` — `isDirect` не считать `*_seo`;
- `landing/src/lib/payment-attribution.ts` — апгрейд paid поверх SEO;
- `landing/src/app/api/me/attribution/route.ts`;
- create routes YooKassa / Robokassa;
- `sql/211_seo_traffic_attribution_upgrade.sql` — protect/upsert с апгрейдом;
- тесты: `traffic-source-attribution.test.ts`, `payment-attribution.test.ts`, `admin-payments.test.ts`;
- после реализации: `docs/architecture/01-landing.md` (дата + абзац про organic bag и paid-over-SEO).

## Acceptance

- Заход с `yandex.ru` на `/sobytiya/den-rozhdeniya` без UTM → cookie и после OAuth: `yandex_seo` / `organic` / path кластера.
- Тот же пользователь позже открывает URL с `yclid` или `utm_source=yandex&utm_medium=cpc` → bag на visitor, user и следующей оплате становится платным. Path и source SEO не сохраняются.
- Пользователь уже платный → органический заход ничего не меняет.
- Второй рекламный URL не перетирает первый платный.
- Внутренний переход `/den-rozhdeniya` → `/pricing` → OAuth не записывает `/pricing` и не меняет канал.
- Пустой referrer на `/` → `direct` / `none` / `/`, не `yandex_seo`.
- Referral с `https://t.me/foo` → `referral` / `referral` / content `t.me` + path первой страницы.
- `yandex_seo` не проходит `isPaidAttribution` и не помечается `isDirect` в админке.
- Оплата YooKassa и Robokassa пишут одинаковый snapshot.
- Без referrer/cookie логин и checkout работают.
- Сырой referrer не уходит в API и не пишется в БД.

## Чеклист

- [x] Хелпер канала: paid vs unpaid vs empty + тесты referrer host
- [x] Cookie resolve: first unpaid + paid-over-unpaid, first paid wins
- [x] Browser capture с referrer, без записи синтетики в URL
- [x] Новая SQL-миграция: апгрейд на visitor и `landing_users`
- [x] `POST /api/me/attribution` и checkout persist с тем же правилом
- [x] Снимок оплаты: body платный перекрывает user SEO и апгрейдит user
- [x] Admin: корректный primary/path, `isDirect` только Директ
- [x] Finance: органика не в join Директа
- [x] Обновить `docs/architecture/01-landing.md`
- [ ] Обратимый DB smoke: SEO persist, paid upgrade, повторный paid не меняет, тестовые строки удалить
