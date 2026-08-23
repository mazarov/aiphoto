# Яндекс Директ — передача покупок PromptShot

**Дата:** 2026-08-17
**Статус:** Реализовано (веб / YooKassa и Robokassa)
**Ветка:** `feature/17-08-yandex-direct-purchases`

Сохранение UTM на пользователе и покупке — отдельная задача:
[19-08-traffic-source-attribution.md](./19-08-traffic-source-attribution.md).
Импорт расходов и CAC-dashboard:
[19-08-yandex-direct-acquisition.md](./19-08-yandex-direct-acquisition.md).

## Зачем

Директ должен оптимизироваться на **оплаченные пакеты токенов**, а не на клики и не на «начали checkout».

В photo2sticker покупка в Telegram — там только офлайн-CSV + `yclid`. У PromptShot оплата на сайте (YooKassa и Robokassa), поэтому основной путь — **Measurement Protocol** с ClientID того же визита. Офлайн-конверсии не используем.

## Поток

```
Клик Директа → promptshot.ru (счётчик 107703100, yclid в URL)
  → cookie promptshot_yclid (first-touch, 21 день)
  → checkout: ClientID + yclid в landing_yookassa_payments
  → YooKassa
  → webhook / return-poll / cron → reconcile
  → POST mc.yandex.ru/collect (purchase + revenue)
  → (если пользователь вернулся) JS reachGoal('purchase') + dataLayer ecommerce
```

Источник правды по факту оплаты — fulfill/reconcile провайдера (`reconcileYooKassaPayment` / Robokassa ResultURL). JS на возврате — дополнение, тот же `order_id` = id строки ledger.

## Цель для кампании

| Цель | Куда | Для Директа |
|------|------|-------------|
| `purchase` | JS + Measurement Protocol, выручка `amount_rub` | **Да — автостратегия** |
| ecommerce `purchase` | `dataLayer` + MP `pa=purchase` | Да, ценность |
| `yookassa_checkout_started` / `_redirect` / `_payment_succeeded` и аналоги Robokassa | Воронка продукта | Нет |

В кабинете Метрики создать JS-цель с идентификатором **`purchase`**.

## Кабинет — чеклист до запуска кампании

1. Счётчик **107703100** → Безопасность и использование данных → включить **Measurement Protocol** → скопировать токен.
2. Положить токен в env лендинга: `YANDEX_METRIKA_MP_TOKEN` (не в git, не `NEXT_PUBLIC_`).
3. Применить миграцию `sql/191_yookassa_yandex_attribution.sql`.
4. Создать цель «JavaScript-событие» с идентификатором `purchase`.
5. Проверить, что ecommerce включена в настройках счётчика (init уже с `ecommerce:"dataLayer"`).
6. Привязать счётчик к кабинету Директа.
7. В кампании оптимизация на `purchase` (или автоцель ecommerce purchase), не на checkout-цели.
8. UTM Директа стандартные — Метрика сама клеит клик к визиту; нам достаточно ClientID.

## Код

| Файл | Роль |
|------|------|
| `sql/191_yookassa_yandex_attribution.sql` | `ym_client_id`, `yclid`, `yandex_conversion_*` |
| `landing/src/lib/yandex-attribution.ts` | sanitize ClientID / yclid |
| `landing/src/lib/yandex-attribution-browser.ts` | cookie + `getClientID` |
| `landing/src/lib/yandex-metrika-measurement.ts` | MP collect, claim UPDATE только по `id` + `sent_at IS NULL`, cron flush unsent |
| `landing/src/lib/yookassa-payments.ts` | dispatch после fulfill |
| `landing/src/components/pricing/PricingCards.tsx` | отправка атрибуции в create |
| `landing/src/components/YooKassaReturnStatus.tsx` | JS purchase + ecommerce |
| `landing/src/components/YandexMetrikaRouteTracker.tsx` | first-touch `yclid` |

Без токена или без ClientID оплата проходит как обычно; в логах `[metrika] purchase skipped`.

## Вне scope

- Telegram Stars / payment-bot (снова понадобится офлайн + `yclid` в deep link)
- `setUserID` / кросс-девайс
- Отдельная thank-you страница
