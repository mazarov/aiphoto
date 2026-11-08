# Чеки НПД из CSV админки через сессию «Мой налог»

Операторский Tampermonkey-скрипт: CSV успешных оплат PromptShot → `POST /api/v1/income` в **уже открытой** сессии `https://lknpd.nalog.ru`. Логин/пароль ФНС в код не пишем.

Ветка: `feature/19-09-lknpd-income-from-cabinet`.

## Зачем

С 29.12.2025 YooKassa не регистрирует чеки самозанятых. Каждую live `succeeded`-оплату нужно провести в «Мой налог» и отдать чек покупателю. Кликер по `/sales/create` хрупкий. Этот контур бьёт в тот же API, что и веб-кабинет.

API кабинета **неофициальное**. Контракт может измениться. Скрипт — временный операторский контур, не продукт на сайте.

## Что ставит оператор

1. В Яндекс.Браузере: Tampermonkey или Violentmonkey.
2. Новый скрипт из `src/standalone/lknpd-income.user.js` (после правки core/boot: `node src/standalone/build-lknpd-income-user.mjs`).
3. Открыть `https://lknpd.nalog.ru` и войти как обычно (ЛК / Госуслуги).
4. Дождаться, пока панель справа покажет ИНН. Если «нет Bearer» — открыть «Продажи», чтобы кабинет сам сходил в API, затем «Проверить сессию».
5. В админке скачать CSV: `/admin/payments?format=csv&status=succeeded&test=live`.
6. Загрузить CSV в панель. Сверка: локальный журнал + `GET /api/v1/incomes`.
7. Сначала **dry-run**. Потом снять галку и подтвердить сумму.

## Контракт

| Вход CSV | В ФНС |
|---|---|
| `id` | идемпотентность `#ps:<uuid>` в названии услуги и журнал `localStorage` |
| `amount_rub` | `totalAmount` |
| `credited_at`, иначе `created_at` | `operationTime` в `Europe/Moscow` |
| `plan_id` + `paywall_variant` | название пакета |
| `credits` | «N ток.» |
| `test=true` / не `succeeded` | отсев |

Покупатель: физлицо (`FROM_INDIVIDUAL`). Оплата: `ACCOUNT` (эквайринг).

Ответ: `approvedReceiptUuid`. Печать: `/api/v1/receipt/{inn}/{uuid}/print`.

Журнал: `promptshot.lknpd.receipts.v1` — только uuid/сумма/ссылка, не токен.

## Файлы

- `src/standalone/lknpd-income-core.mjs` — CSV, payload, журнал
- `src/standalone/lknpd-income-boot.mjs` — панель и клиент кабинета
- `src/standalone/lknpd-income.user.js` — generated Tampermonkey
- `src/standalone/lknpd-income-fixture.html` — мок без ФНС
- тесты: `lknpd-income-core.test.mjs`, `lknpd-income-boot.test.mjs`

```bash
node --test src/standalone/lknpd-income-core.test.mjs src/standalone/lknpd-income-boot.test.mjs
```

## Не делать

- Серверный логин в ФНС
- Автоклик «выдать счёт»
- Писать Bearer в git / env продукта
- Регистрировать test-платежи
