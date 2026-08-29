# ЮKassa abandon +5 мин, скидка 25% на 1 час

Ветка: `feature/29-08-yk-abandon-5m`.
Не новый транспорт: тот же due → catalog → грант → outbox → Postbox, что в [`docs/22-08-lifecycle-mail.md`](22-08-lifecycle-mail.md).

## Зачем

Чекаут ЮKassa часто бросают за минуты. Письмо через 40 мин уже после импульса. Если за 5 минут нет `credited_at` — одно tx-письмо со скидкой 25% на тот же аккаунт, грант живёт 1 час.

## Решение

| | |
|---|---|
| Кому | Любой live ЮKassa create, не только Директ |
| Когда | `created_at + 5 minutes` |
| Стоп | любой `credited_at` |
| Скидка | **25%**, TTL **60 минут** |
| CTA | `https://promptshot.ru/pricing?plan={plan_id}` — не `confirmation_url` |
| Ключ | `yk_abandon_5m:{payment_id}` |
| Флаг | `landing_generation_config.yk_abandon_5m_enabled`, default `false` |

`confirmation_url` в письме нет: префетч почтовика, чужой TTL ЮKassa, 3DS. Скидка только у того же `shared_user_id` после входа.

Флэш-грант 25% — **отдельная** незакрытая строка. Не затирает живые 10/20% на 7 дней. Касса берёт `max(percent)` среди живых. После часа 25% сгорает, 7-дневный грант остаётся.

40m / 24h не отменяем: запасной контур, если час прошёл.

## Не делать

- Сканер users × payments каждый тик
- Отдельный SMTP / MCP `support_ru`
- Промокод
- Письмо без записанного гранта
- Env-гейт продукта

## Выкат

1. Миграция `sql/229` + код, флаг `false`
2. Cron due уже раз в минуту — окно письма 5–7 мин
3. `UPDATE landing_generation_config SET value = 'true' WHERE key = 'yk_abandon_5m_enabled'`
