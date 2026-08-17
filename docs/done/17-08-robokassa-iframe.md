# Robokassa iFrame checkout

> Статус: реализовано в `feature/17-08-robokassa-iframe`

## Выполнено

- [x] Серверный `PAYMENT_PROVIDER=yookassa|robokassa` с безопасным default на YooKassa.
- [x] Официальный Robokassa iFrame `Render` в режиме `modal`, без навигации основной страницы.
- [x] Server-side checkout signature, fiscal receipt и только публичный подписанный payload в браузере.
- [x] Подписанный ResultURL, сверка суммы/`InvId`/`Shp_payment_id`, идемпотентное начисление.
- [x] Owned status polling, обновление баланса и purchase analytics.
- [x] Отдельный Robokassa ledger и объединённая админская история двух провайдеров.
- [x] YooKassa webhook/reconcile/cron сохранены для rollback и старых операций.

## Env

Обязательные server-only переменные:

```text
PAYMENT_PROVIDER=yookassa
ROBOKASSA_CANARY_EMAILS=azarov.maxim@gmail.com
ROBOKASSA_MERCHANT_LOGIN=...
ROBOKASSA_PASSWORD_1=...
ROBOKASSA_PASSWORD_2=...
ROBOKASSA_TEST_PASSWORD_1=...
ROBOKASSA_TEST_PASSWORD_2=...
ROBOKASSA_HASH_ALGORITHM=sha256
ROBOKASSA_TEST_MODE=1
ROBOKASSA_RECEIPT_TAX=none
```

Значение `ROBOKASSA_HASH_ALGORITHM` и код налога должны совпадать с техническими/фискальными настройками магазина. При test mode автоматически используются отдельные тестовые пароли.

## Настройки кабинета Robokassa

- ResultURL, POST: `https://promptshot.ru/api/payments/robokassa/result`
- SuccessURL, GET: `https://promptshot.ru/payment/robokassa/success`
- FailURL, GET: `https://promptshot.ru/payment/robokassa/fail`

## Rollout

1. Применить `sql/194_landing_robokassa_payments.sql`.
2. Добавить Robokassa env, оставить `PAYMENT_PROVIDER=yookassa`.
3. Настроить URL в кабинете и включить `ROBOKASSA_TEST_MODE=1`.
4. Для боевого canary оставить `PAYMENT_PROVIDER=yookassa`, задать `ROBOKASSA_CANARY_EMAILS` и `ROBOKASSA_TEST_MODE=0`; только перечисленные пользователи увидят Robokassa.
5. Выполнить тестовую оплату и проверить `OK{InvId}`, единственное начисление, баланс, Метрику и admin payments.
6. Выключить test mode и провести одну минимальную боевую оплату.
7. Для rollback очистить `ROBOKASSA_CANARY_EMAILS` или вернуть `PAYMENT_PROVIDER=yookassa`; Robokassa ledger и уже подтверждённые платежи сохраняются.

## Наблюдаемость

- create: `[robokassa] create payment failed`
- ResultURL success: `[robokassa] result accepted`
- ResultURL failure: `[robokassa] result failed`
- server-side purchase analytics: `[metrika]`

Не логируются пароли, signature payload или полные credential-bearing URL.
