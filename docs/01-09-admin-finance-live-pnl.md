# PromptShot: live P&L на /admin/finance

> Дата: 2026-09-01
> Ветка: `feature/01-09-admin-finance-live-pnl`

## Цель

`/admin/finance` считает месяц без обязательных CSV:

1. выручка — live `landing_yookassa_payments` (succeeded + `credited_at`, не test);
2. AI COGS — completed `landing_generations` × `finance_model_unit_costs` (Grok: факт `cost_in_usd_ticks`);
3. Директ — Yandex Direct Reports API → `admin_finance_ads_lines`.

Два уровня: **операционная маржа** (без рекламы) и **итог после Директа** (кабинет × 1,22).

CSV ЮKassa / GCP / Direct — opt-in override (переключатель «Тянуть данные из CSV»).

## Поведение

- `GET /api/admin/finance` не зовёт вендор-API.
- По умолчанию `csv=0`: live ledger + оценка комиссии 3,5% + НДС 22% с комиссии; COGS — оценка по генерациям (`provider_cost_usd` перекрывает прайс); Директ — только импорт `direct_api`.
- `csv=1`: загруженные реестры перекрывают live за месяц.
- Директ: cron раз в сутки + кнопка «Обновить». Нет токена → 200, ads stale.
- Robokassa и Stars вне кассы v1.
- Не в COGS v1: planner photoshoot, analyze/remix/embeddings, failed после списания у провайдера.

## Формулы

```text
fee        = gross × 0.035
vat        = fee × 0.22
operating  = gross − fee − vat − USN 6% − aiCogsRub
afterAds   = operating − adsCabinetRub × 1.22
aiCogsRub  = Σ USD × 90
```

`netIncomeRub` = `operatingRub` (график дней без рекламы).

## Данные

Миграция `sql/237_admin_finance_live_pnl.sql`:

- `landing_generations.provider_cost_usd` / `provider_cost_source` (`xai_ticks` | `estimate`)
- `landing_generation_config.finance_model_unit_costs`
- RPC `admin_finance_live_revenue_month`, `admin_finance_live_cogs_month`
- индекс completed_at

Прайс правится в БД без редеплоя.

## API

| Route | Назначение |
|-------|------------|
| `GET /api/admin/finance?month=YYYY-MM&csv=0\|1` | KPI: default live; `csv=1` — uploaded override |
| `POST /api/admin/finance/sync` | Direct replace за месяц |
| `POST /api/cron/finance-sync` | Bearer `CRON_SECRET`, текущий месяц |

## Cutover

1. Применить `sql/237` в целевой Supabase.
2. `YANDEX_DIRECT_TOKEN` (+ optional `YANDEX_DIRECT_CLIENT_LOGIN`) в env лендинга.
3. Cron `POST /api/cron/finance-sync` раз в сутки.
4. Сверить 3–5 строк `finance_model_unit_costs` с кабинетами.

## Tests

- [x] fee 3,5%+НДС, operating vs afterAds
- [x] unit-cost по size/duration, family/provider
- [x] xAI ticks → USD
- [x] Direct mapper
- [x] CSV перекрывает live
- [ ] SQL 237 на целевой Supabase
- [ ] Production deploy + env + cron
