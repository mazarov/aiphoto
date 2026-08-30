# Плашка незавершенной оплаты ЮKassa

Ветка: `feature/30-08-yk-unpaid-banner`.

## Зачем

Пользователь ушёл на hosted ЮKassa и вернулся без `credited_at`. Нужен site-wide бар над навбаром на 24 часа, без второго платёжного контура.

## Часы — как в письме

| | Письмо `yk_abandon_5m` | Плашка |
|---|---|---|
| Триггер | due `created_at + 5 мин` | latest YK create, нет `credited_at` |
| Скидка 25% | грант TTL **60 мин** с момента письма | тот же грант, UI с **15-й минуты** |
| «1 час» | «Ссылка действует 1 час» | «Оплати в течение 60 минут…» + countdown до `expires_at` |
| Стоп скидки | `expires_at` гранта (`created_at + 65 мин`) | тот же `expires_at` |
| Жизнь плашки | — | `created_at + 24 ч` |

Не заводим второй 60-минутный таймер. На 15-й минуте в countdown ~50:00 — остаток гранта, не новые 60 минут.

10/20% с 40m/24h на плашку не выводим.

## Решение

- `GET /api/payments/yookassa/unpaid-banner` — latest row по `auth_user_id`. Без reconcile.
- Видимость и фаза — `resolveUnpaidBanner` (клиент).
- CTA «Продолжить»: `POST /api/payments/create` на тот же `plan_id` → `location.assign(confirmation_url)` ЮKassa. Старую hosted-ссылку не открываем: TTL кассы и скидка 25% применяются только на новом create. Письмо по-прежнему `/pricing?plan=`.
- Крестик: `localStorage` на `payment_id`.
- Пока `?payment=` в URL — скрыть (идёт return poll).

## Не делать

- Вешать выборку на `GET /api/me`
- Сканер всех payments каждый тик
- Env-гейт
- Новый SMTP / промокод
