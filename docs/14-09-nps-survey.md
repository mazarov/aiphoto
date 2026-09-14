# PromptShot: NPS после 2 генераций и после нуля кредитов

> Дата: 2026-09-14
> Ветка: `feature/14-09-nps-survey`

## Цель

Два разовых письма с оценкой 1–10 («насколько готовы порекомендовать друзьям») и свободным комментарием. Оценки в разрезе пользователя, динамика на `/admin/analytics?tab=nps`.

## Письма

| id | Когда | Стоп |
|---|---|---|
| `nps_after_2` | 2-я `landing_generations.status=completed` с `credits_spent > 0` и не `admin` | уже sent; нет email; флаг выкл |
| `nps_credits_empty` | +24 ч после `credits >0 → 0`, если `after_2` уже ушёл *или* на 2-й completed баланс уже 0 | нет sent after_2 (тогда +1 ч); credits > 0; уже sent empty |

Маркетинговое `credits_empty` не трогаем. Транспорт — тот же Postbox / due / outbox. Kind: transactional.

Без бэкофила. У кого на включении флага уже ≥3 генерации, письмо «после 2» не придёт.

## Флаг

`landing_generation_config.nps_survey_enabled`, default `false`.

```sql
UPDATE landing_generation_config SET value = 'true' WHERE key = 'nps_survey_enabled';
```

## Сбор

Публичная `/ocenka?t=TOKEN&s=1…10`, noindex. HMAC `MAIL_UNSUBSCRIBE_SECRET`, payload `nps:v1:{surveyId}`. `POST /api/nps` пишет `landing_nps_surveys` (повтор обновляет строку). Комментарий ≤ 2000.

## Админка

`/admin/analytics` вкладки Обзор | Оценки. `?tab=nps` не редиректит. `GET /api/admin/nps?days=1|7|30|90`.

## SQL

`sql/255_landing_nps_survey.sql`: таблица, триггеры, outbox CHECK, RPC `admin_nps_*`, `landing_nps_submit`.
