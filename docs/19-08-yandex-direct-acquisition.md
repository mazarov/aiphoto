# Яндекс Директ — расходы и когортная экономика

**Дата:** 2026-08-19
**Статус:** Реализовано; DB migration и обратимый ads replace smoke пройдены
**Ветка:** `feature/19-08-paid-acquisition-analytics`
**Зависит от:** [19-08-traffic-source-attribution.md](./19-08-traffic-source-attribution.md)

## Scope

v1 добавляет:

- ручной CSV-импорт расходов Директа в `/admin/finance`;
- идемпотентный replace месяца;
- delivery и acquisition-cohort отчёты;
- CAC, CPA aha, gross ROAS/ROMI, LTV D0/D7/D30;
- data-quality и launch scorecard.

API Директа, multitouch, cross-device и точная аллокация Gemini COGS на
кампанию не входят.

## CSV и данные

Новый `admin_finance_imports.kind = ads`. Ads не смешивается с `cogs` и не
меняет текущий `netIncomeRub`.

`admin_finance_ads_lines`:

- `spend_date` (календарь Europe/Moscow);
- `campaign_id`, `campaign_name`;
- nullable `ad_group_id`, `ad_id`, `criterion_id`;
- `impressions`, `clicks`, `cost_rub`;
- `currency = RUB`.

Unique grain:

```text
(import_id, spend_date, campaign_id, ad_id, criterion_id)
```

Дубли grain суммируются до RPC. Повторный import `(ads, period_month)` полностью
заменяет строки месяца. Пустой валидный CSV очищает месяц.

Парсер:

- CSV only; ZIP/XLSX rejected;
- max 10 MB / 20 000 normalized rows;
- UTF-8 и Windows-1251;
- `;` или `,`;
- RU/EN headers Date, CampaignId/Name, AdId, CriterionId, Impressions, Clicks, Cost;
- `DD.MM.YYYY` → date;
- footer `Итого`, пустой campaign и строки вне месяца пропускаются;
- non-RUB fail-closed;
- raw CSV и PII не сохраняются.

Totals: `costRub`, `clicks`, `impressions`, `count`, `currency`, `vatMode`,
`droppedOutsideMonth`, `grain`.

## Revenue

В отчёт входят YooKassa и Robokassa:

```text
status = succeeded
credited_at IS NOT NULL
test IS NOT TRUE
```

Stars, pending/canceled, test и credit refund failed generation исключаются.
Refund платежа пока не смоделирован, поэтому метрики называются **gross**.

## Отчёты

Timezone: `Europe/Moscow`.

Delivery calendar:

- spend, impressions, clicks, CTR, CPC;
- live payments / gross revenue по payment date.

Acquisition cohort:

- cohort date = visitor `first_seen_at`;
- source → campaign → ad → landing path;
- visitors, aha, signup, first payers, repeat payments;
- cumulative revenue D0/D7/D30;
- D1/D7 repeat aha;
- maturity flags для незрелых D7/D30.

Формулы:

```text
CTR = clicks / impressions
CPC = spend / clicks
ActivationRate = aha_visitors / visitors
SignupRate = signup_users / visitors
PayerConversion = first_payers / visitors
CPA_Aha = spend / aha_visitors
CAC = spend / first_payers
GrossROAS_Dn = cumulative_revenue_Dn / spend
GrossROMI_Dn = (cumulative_revenue_Dn - spend) / spend
LTV_Dn = cumulative_revenue_Dn / first_payers
```

Нулевой denominator → `null`.

## Data quality

- Direct visits с yclid;
- Direct visits с numeric campaign id;
- funnel facts с visitor id;
- OAuth users с visitor link;
- live payments с acquisition snapshot;
- guest-owner facts, ошибочно попавшие в unique users;
- MP sent / MP error;
- duplicate visitor/session/landing_view;
- spend campaigns без attributed traffic.

## Launch scorecard

До масштаба заполнить фактами:

- organic/direct activation;
- time-to-first-aha;
- analyze/generation success;
- D1/D7 return;
- payer conversion;
- mature gross LTV;
- max acceptable CAC;
- дневной бюджет, learning window, stop-loss.

Не масштабировать по CTR или signup без aha/purchase, по immature D7/D30 и при
существенно худшей paid activation относительно сопоставимого organic intent.

Текущее состояние перед web deploy:

- локальный UTM/visitor/session smoke: passed;
- targeted tests: 54/54 passed;
- migrations `196` → `197` → `198`: applied;
- обратимые visitor/link, payment/admin, client-event и ads replace DB smoke: passed,
  тестовые записи удалены;
- временный max CAC, бюджет и stop-loss зафиксированы в
  [19-08-yandex-two-cluster-launch.md](./19-08-yandex-two-cluster-launch.md);
- mature D30 LTV и окончательный scale gate: после накопления production cohort.

## Acceptance

- CSV месяца загружается и повторный upload заменяет его;
- campaign id join-ится с `utm_campaign`, yclid не используется как campaign id;
- оба payment provider включены, test/Stars исключены;
- Moscow date не смешивается с UTC analytics;
- D0/D7/D30 имеют maturity;
- ads не меняет старый P&L;
- `/admin/finance` показывает spend, cohort metrics и data quality.
