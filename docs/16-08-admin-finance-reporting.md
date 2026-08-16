# PromptShot: admin finance reporting

> Дата: 2026-08-16  
> Ветка: `feature/16-08-admin-finance-reporting`

## Цель

В `/admin/analytics` сразу видеть **непотраченные кредиты** (live из БД), а кассовые потоки — на отдельной странице `/admin/finance` (после «Оплаты»):

1. средства полученные — реестр ЮKassa (CSV или ZIP);
2. средства потраченные на Gemini — Google Cloud Billing CSV;
3. остаток кредитов на балансах пользователей + список.

Первый период — август 2026. API ЮKassa/GCP и Telegram Stars в v1 нет.

## Поведение

- `/admin/analytics` — обзор и кредиты. `/admin/finance` — касса выгрузок. Старый `?tab=finance` редиректит.
- p3: график остатка по дням (реконструкция от live-баланса) и разбивка тех, кто начислял/тратил за выбранный период; колонка **Осталось** — live-баланс.
- SQL `186`: «Топ пользователей» и credit-разбивка режутся фильтром Сегодня/7/30/90.
- p1 показывает gross / комиссия+НДС / налог 6% / Gemini RUB / **чистый доход**.
- p2 — USD `Subtotal ($)` × статический курс **$1 = 90 ₽**.
- Чистый доход = выручка (gross) − комиссия и НДС ЮKassa − УСН 6% с выручки − Gemini.
- График по дням: выручка / косты / прибыль; пунктир — накопленные обязательства на текущий момент.
- Отдельный график: затраты Gemini по семействам моделей по дням.
- Повторная загрузка файла за тот же месяц и `kind` **заменяет** импорт в одной транзакции.
- PII плательщика из реестра ЮKassa (ФИО, адрес, ИНН, идентификатор платёжного средства) не сохраняется.
- Реальные выгрузки в git не кладутся.

## Данные

Миграция `sql/184_admin_finance_reporting.sql`:

- `admin_finance_imports` unique `(kind, period_month)`
- `admin_finance_revenue_lines`
- `admin_finance_cogs_lines`
- index `landing_users (credits DESC, id) WHERE credits > 0`
- RPC `admin_finance_replace_import`, `admin_credit_liability_summary`, `admin_credit_liabilities`, `admin_credit_daily_flow` — только `service_role`
- SQL `185`: daily flow + granted/spent в списке пользователей

Оценка обязательства в RUB = `credits_total * 0,5 ₽`: 1 генерация = 5 кредитов = 2,5 ₽. Это себестоимость исполнения, не blended-цена покупки из ЮKassa и не касса.

## API

Все `requireAnalyticsAdmin`, `Cache-Control: no-store`.

| Route | Назначение |
|-------|------------|
| `GET /api/admin/credits` | summary + daily flow + cursor-список (осталось / начислено / потрачено, `q`) |
| `GET /api/admin/finance?month=YYYY-MM` | KPI и разбивки импортов месяца |
| `POST /api/admin/finance/import` | multipart `kind`, `period`, `file`; курс в UI не спрашиваем, P&L всегда $1=90 ₽ |

Лимит файла 10 MB. ZIP ЮKassa: ищем CSV внутри; если только XLSX — 400 `yookassa_csv_required`.

## Парсеры

- ЮKassa: шапка «Идентификатор платежа», `;`-CSV, стоп на «Сумма принятых», UTF-8 или windows-1251. Парсер header-driven: августовский zip из Downloads в песочнице не читался, колонки берутся по названиям из [реестра ЮKassa](https://yookassa.ru/docs/support/merchant/payments/reports/reports-old). Если в zip только XLSX — ошибка `yookassa_csv_required`.
- GCP: колонка `Subtotal ($)`, quoted thousands в `Usage amount`.

## Cutover

1. Применить `sql/184_admin_finance_reporting.sql`, `sql/185_admin_credit_dynamics.sql` и `sql/186_admin_analytics_period_users.sql` в целевой Supabase.
2. Задеплоить landing.
3. На `/admin/finance` загрузить августовский реестр ЮKassa и Billing CSV.

## Tests

- [x] Парсер ЮKassa: title/footer, PII не попадает в строки, duplicate id, empty registry.
- [x] Парсер GCP: quoted usage, Subtotal, family grouping.
- [x] ZIP → CSV; XLSX-only ZIP → ошибка.
- [x] period/kind/rate и credit cursor/limit.
- [ ] Применить SQL `184` в целевой Supabase.
- [ ] Production deploy.
- [ ] Smoke: обзор кредитов, импорт августа, повторный replace-импорт.
