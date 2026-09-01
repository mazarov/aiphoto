# Robokassa traffic split + unpaid banner

Ветка: `feature/01-09-robokassa-traffic-split`.

## Зачем

Включить Robokassa на долю authenticated checkout без `Math.random()` и без `PAYMENT_PROVIDER=robokassa` на всех. Плашка «Незавершенная оплата» над шапкой должна работать для обеих касс, иначе A/B режет recovery у treatment.

## Решение

- Единица сплита — `auth.users.id` на первом checkout без живого unpaid.
- Control plane: `landing_feature_rollouts.payment_robokassa` (`enabled` + `rollout_bps`, 5000 = 50%) и `landing_generation_config.robokassa_canary_emails`.
- Sticky bucket в `landing_user_feature_assignments`. Смена процента не ремапит старых.
- Живой unpaid (24 ч, `created|pending|canceled`, нет `credited_at`) пинит PSP. Kill switch не рвёт открытый чек.
- `POST /api/payments/create` и оба create-route зовут один `resolvePaymentProvider`. Клиент `provider` не шлёт.
- Плашка: `GET /api/payments/unpaid-banner` — latest unpaid по ЮKassa ∪ Robokassa. «Продолжить» → тот же create: redirect или iframe. Скрыта на `?payment=` и `/payment/*`; после закрытия iframe снова видна.
- INSERT Robokassa ставит те же abandon due `yk_abandon_5m/40m/24h`, что ЮKassa.

## Resolver

```text
живой unpaid → этот PSP
canary email → robokassa
PAYMENT_PROVIDER=robokassa → robokassa (аварийный 100%)
rollout выключен / 0% / нет auth → yookassa
иначе bucket < rollout_bps → robokassa
ошибка чтения → yookassa
```

## Выкат

1. Применить SQL `236`. Default: `enabled=false`, `rollout_bps=0`, canary `azarov.maxim@gmail.com`.
2. Задеплоить лендинг.
3. Свой email → iframe Robokassa и плашка.
4. `UPDATE landing_feature_rollouts SET enabled = true, rollout_bps = 5000, updated_at = now() WHERE feature_key = 'payment_robokassa';`
5. Откат: `enabled=false` или `rollout_bps=0`. Новые checkout — ЮKassa. Живой Robokassa дожимается.

## Не делать

- Сплит по хиту, cookie или `localStorage`.
- Выбор кассы с клиента.
- Второй контур скидки / отдельные письма Robokassa.
- Кеш rollout дольше ~10 с на денежном пути.
