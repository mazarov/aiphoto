# Источник трафика пользователя и покупки

**Дата:** 2026-08-19
**Статус:** Реализовано; DB migrations и обратимый E2E пройдены, web deploy ожидается
**Ветка:** `feature/19-08-paid-acquisition-analytics`

## Цель

Перед запуском рекламы в Яндекс Директе:

1. сохранить первый рекламный источник на `landing_users`;
2. сохранить снимок источника на каждой покупке;
3. показать источник пользователя/покупки в `/admin/payments`.

Передача `purchase` в Метрику уже реализована отдельно:
[17-08-yandex-direct-purchases.md](./17-08-yandex-direct-purchases.md).

## Модель атрибуции

Используем **first known non-direct touch**:

- первый валидный UTM сохраняется;
- следующий рекламный переход его не перезаписывает;
- если UTM ещё не было, более поздний рекламный переход заполняет источник;
- `yclid` сохраняется независимо от UTM, только если поле пустое;
- пустой источник остаётся `direct / organic / unknown` — не угадываем его по referrer.

## Какие поля сохраняем

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `utm_landing_path` — первый pathname без query/hash
- `yclid`
- `attribution_captured_at`

Санитайз:

- trim и удаление управляющих символов;
- UTM-поля максимум 64 символа;
- path максимум 200 символов;
- `yclid` — существующая числовая валидация;
- пустые и невалидные значения превращаются в `null`.

## Browser capture

Создать first-party identity:

- `promptshot_vid`: неизменяемый UUID visitor, TTL 365 дней;
- `promptshot_sid`: UUID в `sessionStorage`, одна вкладка/сессия;
- `promptshot_utm`: first-known UTM;
- `promptshot_yclid`: существующий независимый click id.

Создать first-party cookie `promptshot_utm`:

- TTL 21 день, как `promptshot_yclid`;
- `Path=/; SameSite=Lax`, `Secure` на HTTPS;
- JSON с UTM и первым landing path;
- существующая валидная cookie важнее нового URL.

Capture вызывается:

- в `YandexMetrikaRouteTracker` на первом render/SPA navigation;
- перед OAuth redirect в `signInWithOAuthProvider`.

`promptshot_yclid` остаётся отдельной cookie и отдельным helper.

## Visitor и anonymous→user

`sql/196_landing_acquisition_attribution.sql` создаёт:

- `landing_acquisition_visitors`: first/last seen, UTM, landing path, yclid;
- `landing_visitor_user_links`: immutable link visitor → shared billing user;
- `acquisition_visitor_id` на `landing_users`;
- `visitor_id` / `session_id` на analyze, client events, history,
  generations, card views и payment ledgers.

Event facts не переписываются после OAuth. Link-таблица связывает старые гостевые
факты с реальным `landing_user_id`. Shared guest owner остаётся техническим FK
генерации и исключается из unique actors.

`ip_hash` используется только для quota/abuse, не как person identity.

## Сохранение на пользователе

Новая миграция `sql/196_landing_traffic_source_attribution.sql` добавляет поля на:

- `landing_users`;
- `landing_yookassa_payments`;
- `landing_robokassa_payments`.

Индексы `landing_users(utm_source)` и `landing_users(utm_campaign)`.

После успешного OAuth `AuthContext` один раз вызывает
`POST /api/me/attribution`.

Endpoint:

1. принимает только реального OAuth user (`is_anonymous !== true`);
2. получает shared `landing_user_id` через `ensureLandingUserForGeneration`;
3. не пишет ничего при `usedGuestOwner=true`;
4. санитайзит body;
5. атомарно записывает UTM bag только при `utm_source IS NULL`;
6. отдельно записывает `yclid` только при `yclid IS NULL`;
7. отсутствие attribution не ломает login.

Важно: `auth.users.id` может не совпадать с `landing_users.id`.
Запись всегда идёт по `ensured.dbUserId`.

## Снимок на покупке

`PricingCards` передаёт UTM рядом с `ymClientId`, `yclid` и
`paywallVariant`.

Оба create route:

- YooKassa;
- Robokassa;

сохраняют UTM snapshot при insert и backfill только пустых полей при
идемпотентном повторе.

Порядок fallback:

1. валидные значения checkout body;
2. сохранённые поля `landing_users`;
3. `null`.

Checkout также страхует persist на `landing_users`, если OAuth-вызов не успел.

Fulfill/reconcile и Measurement Protocol не меняются.

## Pre-auth воронка

| Шаг | Источник |
|---|---|
| `landing_view` | Первый pageview сессии → `extension_client_events` |
| `prompt_copy` | Успешный clipboard write → `extension_client_events` |
| `analyze_success` | `extension_analyze_events.outcome='success'` |
| `generation_started/succeeded` | `landing_generations` |
| `signup_completed` | Первая visitor→user link |
| `checkout_started` | Payment ledger created/pending |
| `payment_succeeded` | Live succeeded + credited payment |
| `repeat_payment` | Вторая и последующая live-оплата user |

`aha` = первое из `prompt_copy`, successful analyze, successful generation.
Pageview, signup и checkout не являются aha.

`POST /api/client-events` принимает только browser-owned `landing_view` и
`prompt_copy`, валидирует visitor/session, не принимает prompt text, raw URL,
email или image. Server facts клиентом не дублируются.

## Admin

`admin_landing_payments` возвращает snapshot:

- source / medium;
- campaign / content;
- term;
- landing path;
- yclid.

`/admin/payments` показывает колонку:

```text
yandex / cpc
campaign · content
/landing-path
```

Пусто → «не указан».

Добавить фильтр:

- `source`;
- `campaign`.

Фильтр работает по snapshot платежа, не по live `landing_users`.

## Не входит в задачу

- multitouch / last-click / cross-device;
- отдельная страница пользователей;
- Telegram Stars attribution;
- изменение цели `purchase` и Measurement Protocol.

Расход, CAC / ROAS / LTV и launch gates описаны в
[19-08-yandex-direct-acquisition.md](./19-08-yandex-direct-acquisition.md).

## Acceptance

- URL с UTM → OAuth → поля заполнены на правильном `landing_users.id`.
- Anonymous / shared guest owner не изменены.
- Второй рекламный URL не перезаписывает первый источник.
- Пользователь без UTM позже получает первый размеченный источник.
- YooKassa и Robokassa сохраняют одинаковый snapshot.
- Идемпотентный повтор create backfill-ит только `null`.
- `/admin/payments` показывает и фильтрует источник.
- Без cookie/UTM login и оплата продолжают работать.

## Чеклист

- [x] `sql/196_landing_acquisition_attribution.sql`
- [x] `sql/198_fix_acquisition_visitor_upsert.sql`
- [x] Visitor/session identity + immutable visitor→user link
- [x] Pure sanitize/resolve helpers и тесты
- [x] Browser cookie capture
- [x] `POST /api/me/attribution`
- [x] Persist в `AuthContext`
- [x] Pre-auth facts и `POST /api/client-events`
- [x] Snapshot в YooKassa/Robokassa
- [x] Source/campaign в admin payments
- [x] Обновить `docs/architecture/01-landing.md`
- [x] Обратимый production DB E2E: visitor/link, YooKassa/Robokassa snapshot,
  admin filters и client event; тестовые записи удалены
- [ ] Web deploy и внешний provider/MP test purchase
