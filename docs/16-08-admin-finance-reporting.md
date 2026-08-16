# PromptShot: admin finance reporting

> Дата: 2026-08-16  
> Ветка: `feature/16-08-admin-finance-reporting`

## Цель

В `/admin/analytics` сразу видеть **непотраченные кредиты** (live из БД) и вкладку **Финансы** для кассовых потоков из сырых выгрузок:

1. средства полученные — реестр ЮKassa (CSV или ZIP);
2. средства потраченные на Gemini — Google Cloud Billing CSV;
3. остаток кредитов на балансах пользователей + список.

Первый период — август 2026. API ЮKassa/GCP и Telegram Stars в v1 нет.

## Поведение

- Вкладки на `/admin/analytics`: **Обзор** (как раньше + блок кредитов) и **Финансы** (`?tab=finance`).
- p3 не за месяц, а snapshot `landing_users.credits > 0`.
- p1 показывает gross / комиссия+НДС / net. p2 — USD `Subtotal ($)`.
- Повторная загрузка файла за тот же месяц и `kind` **заменяет** импорт в одной транзакции.
- PII плательщика из реестра ЮKassa (ФИО, адрес, ИНН, идентификатор платёжного средства) не сохраняется.
- Реальные выгрузки в git не кладутся.

## Данные

Миграция `sql/184_admin_finance_reporting.sql`:

- `admin_finance_imports` unique `(kind, period_month)`
- `admin_finance_revenue_lines`
- `admin_finance_cogs_lines`
- index `landing_users (credits DESC, id) WHERE credits > 0`
- RPC `admin_finance_replace_import`, `admin_credit_liability_summary`, `admin_credit_liabilities` — только `service_role`

Оценка обязательства в RUB = `credits_total * blended ₽/кредит` по боевым `landing_yookassa_payments` (`succeeded`, `credited_at`, не test). Это оценка, не касса.

## API

Все `requireAnalyticsAdmin`, `Cache-Control: no-store`.

| Route | Назначение |
|-------|------------|
| `GET /api/admin/credits` | summary + cursor-список пользователей с кредитами |
| `GET /api/admin/finance?month=YYYY-MM` | KPI и разбивки импортов месяца |
| `POST /api/admin/finance/import` | multipart `kind`, `period`, `file`, optional `usdRubRate` |

Лимит файла 10 MB. ZIP ЮKassa: ищем CSV внутри; если только XLSX — 400 `yookassa_csv_required`.

## Парсеры

- ЮKassa: шапка «Идентификатор платежа», `;`-CSV, стоп на «Сумма принятых», UTF-8 или windows-1251. Парсер header-driven: августовский zip из Downloads в песочнице не читался, колонки берутся по названиям из [реестра ЮKassa](https://yookassa.ru/docs/support/merchant/payments/reports/reports-old). Если в zip только XLSX — ошибка `yookassa_csv_required`.
- GCP: колонка `Subtotal ($)`, quoted thousands в `Usage amount`.

## Cutover

1. Применить `sql/184_admin_finance_reporting.sql` в целевой Supabase.
2. Задеплоить landing.
3. На `/admin/analytics?tab=finance` загрузить августовский реестр ЮKassa и Billing CSV.

## Tests

- [x] Парсер ЮKassa: title/footer, PII не попадает в строки, duplicate id, empty registry.
- [x] Парсер GCP: quoted usage, Subtotal, family grouping.
- [x] ZIP → CSV; XLSX-only ZIP → ошибка.
- [x] period/kind/rate и credit cursor/limit.
- [ ] Применить SQL `184` в целевой Supabase.
- [ ] Production deploy.
- [ ] Smoke: обзор кредитов, импорт августа, повторный replace-импорт.
