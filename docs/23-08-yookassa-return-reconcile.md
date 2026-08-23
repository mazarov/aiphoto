# YooKassa: крон 1 мин + reconcile при возврате на сайт

Ветка: `feature/23-08-yookassa-return-reconcile`.
Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md).

## Зачем

Инцидент 23.08 (`321c704d…`): вебхук в контейнер не пришёл; return-poll живёт только от `?payment=`; пользователь вернулся и открыл второй checkout; крон с порогом 5 мин + слот `*/5` не трогал платёж до 05:45. Админка начислила в 05:44:58.

Класс: оплатил в банке / закрыл ЮKassa / зашёл на сайт без query — токены ждут до 10 мин.

Не в этом заходе: починка доставки вебхука, `www` 301 на POST `/api/*`, колонка Метрики `yandex_conversion_claimed_at`, Robokassa.

## Что сделано

- `reconcileOpenYooKassaPaymentsForAuthUser` — только свои `created|pending` с `yookassa_payment_id`, limit 5, тот же `reconcileYooKassaPayment`.
- `POST /api/payments/yookassa/open-reconcile` (auth, не GET).
- `YooKassaReturnStatus`: без `?payment=` один POST на auth + `visibilitychange` visible, debounce 30 с (`sessionStorage`).
- Create: перед новым checkout сверка; тот же `plan_id` только что `credited` → `{ alreadyCredited: true }`, без `confirmation_url`.
- Cron default `olderThanMinutes = 1`. Роут cron не менялся.

## Ops после выката

Код с порогом 1 мин при расписании `*/5` даёт worst case ~6 мин. Сменить job на каждую минуту:

```sql
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'yookassa-reconcile';

SELECT cron.schedule(
  'yookassa-reconcile',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://promptshot.ru/api/cron/yookassa-reconcile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ВСТАВЬ_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

Проверка:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'yookassa-reconcile';
```

В логах лендинга: `[yookassa] stale_reconcile` раз в минуту; при возврате — `[yookassa] open_reconcile` `source=open|create`.

## Checklist

- [x] Хелпер + тесты, крон default 1 мин
- [x] POST open-reconcile + alreadyCredited в create
- [x] Return toast на auth/visible; PricingCards alreadyCredited
- [ ] После merge: pg_cron / Dockhost `* * * * *`
- [ ] Проверить лог тика и начисление без `?payment=`
