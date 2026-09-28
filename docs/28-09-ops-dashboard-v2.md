# Дашборд PromptShot v2: тех-стабильность и продукт

> Ветка: `feature/28-09-ops-dashboard-v2` от `origin/main`. Не трогать рабочее дерево `feature/storage-render-src-budget` и его незакоммиченные файлы.
> Исполнитель: агент. Правила проекта обязательны: `git-workflow.mdc`, `migrations.mdc`, `no-secrets-in-code.mdc`, `update-architecture-docs.mdc`, `shell-safety.mdc`.

## Зачем

Текущий дашборд `promptshot-ops` показывает скользящие счётчики «за 1 ч» без базы для сравнения и ленту `level=error`, забитую одной картинкой. За 28.09 в Loki видны два падения `/api/health`, пять `claim_failed` из-за Supabase REST, `statement timeout` и `failedWithoutRefund: 24` — ничего из этого на дашборде нет.

Принцип: одна панель — один вопрос. Ничего сверх таблиц ниже не добавлять.

## Что уже есть в Loki (менять не нужно)

| Поток | Селектор | Поля |
|---|---|---|
| Снимок продукта, раз в минуту | `{service="landing",env="prod"} \| json \| event=\`product_snapshot\`` | `registrations_1h/3h/24h`, `generations_1h`, `generations_completed_1h`, `generations_failed_1h`, `queue_pending`, `queue_processing`, `oldest_pending_age_seconds`, `revenue_rub_24h`, `payments_succeeded_24h`, `alert_*` |
| Heartbeat воркера, раз в минуту с каждой реплики | `{service="web-generation-worker",env="prod"} \| json \| event=\`heartbeat\`` | `workerId`, `inFlight`, `pending`, `processing`, `stale`, `failedWithoutRefund`, `oldestPendingAgeSeconds` |
| Завершённая генерация | `… \| event=\`generation_completed\`` | `durationMs`, `queueWaitMs`, `enqueueToDoneMs`, `executedModel`, `fallbackUsed`, `attempt` |
| Память лендинга | `{service="landing",env="prod"} \| json \| event=\`runtime_memory\`` | `rss`, `instance` |
| Старт процесса | `event=\`process_start\`` (landing, payment-bot), `event=\`worker_started\`` (worker) | — |
| Проба с дроплета, раз в минуту | `{service="probe",env="prod"} \| json \| event=\`probe\`` | `target`, `status`, `ok` |
| Диск дроплета | `{service="probe"} \| json \| event=\`disk\`` | `pct` |

Ошибка Supabase через Kong во всех сервисах одна и та же строка: `An invalid response was received from the upstream server`.

Payment-bot в Loki не пишет: у контейнера нет `LOKI_*` env. Это ручной шаг пользователя (п. 5), код готов.

## Шаг 1. SQL `sql/259_ops_product_snapshot_v2.sql`

Новая миграция, `CREATE OR REPLACE FUNCTION public.ops_product_snapshot()` целиком (скопировать тело из `257`, добавить поля). `257` не редактировать. Сохранить `SECURITY DEFINER`, `SET search_path = public, auth`, `statement_timeout = '3s'`, `REVOKE … FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE … TO service_role`.

Новые ключи в `jsonb_build_object`:

| Ключ | Что | SQL |
|---|---|---|
| `registrations_1h_wk_ago` | Тот же час неделю назад | `count(*) FROM auth.users WHERE created_at > now() - interval '7 days 1 hour' AND created_at <= now() - interval '7 days'` |
| `generations_1h_wk_ago` | Тот же час неделю назад | то же по `landing_generations.created_at` |
| `revenue_rub_24h_wk_ago` | Сутки неделю назад | тот же `UNION ALL` из `257` с окном `now() - interval '8 days' … now() - interval '7 days'`, `status = 'succeeded'`, `test = false` |
| `payments_succeeded_24h_wk_ago` | count того же окна | из того же подзапроса |
| `payments_pending_1h` | Оплаты, зависшие в `created`/`pending` дольше часа за последние сутки | `count(*)` по `landing_yookassa_payments` + `landing_robokassa_payments` где `status IN ('created','pending') AND created_at BETWEEN now() - interval '24 hours' AND now() - interval '1 hour'` |
| `activation_24h_pct` | Доля зарегистрированных за 24 ч с ≥ 1 генерацией | `auth.users u` за 24 ч; `EXISTS (SELECT 1 FROM landing_generations g WHERE g.user_id = u.id)`; результат `round(100.0 * with_gen / nullif(total, 0))::int`, при `total = 0` → `0` |

`landing_generations.user_id` — FK на `auth.users.id` (`sql/131`). `requester_auth_user_id` из `170` не использовать.

Один проход по `auth.users` и один по `landing_generations` с `FILTER`, как в `257`. Не заводить новые сканы на каждое поле. Проверить на локальной копии, что функция укладывается в 3 с. Лендинг код не меняется: `logProductSnapshot` пишет JSON насквозь.

## Шаг 2. Воркер: `rss` в heartbeat

`web-generation-worker/src/index.ts`, функция `writeHeartbeat`: в `fields` добавить `rss: process.memoryUsage().rss`. Больше ничего. Тест на heartbeat не нужен.

## Шаг 3. Дашборд `ops/observability/grafana/provisioning/dashboards/json/promptshot.json`

Переписать целиком. `uid: promptshot-ops`, `title: PromptShot`, переменная `env` как сейчас. Refresh 1m. Две row-секции. Все `expr` ниже — готовые к вставке; `${env}` подставляется Grafana.

Сокращения: `SNAP` = `{service="landing",env="${env}"} | json | event=\`product_snapshot\``, `HB` = `{service="web-generation-worker",env="${env}"} | json | event=\`heartbeat\``, `DONE` = `{service="web-generation-worker",env="${env}"} | json | event=\`generation_completed\``.

### Row «Тех»

| # | Панель | Тип | expr | Пороги |
|---|---|---|---|---|
| T1 | Сайт: uptime 24 ч | stat, unit `percentunit` | `avg_over_time({service="probe",env="${env}"} \| json \| event=\`probe\` \| target=\`landing\` \| unwrap ok [24h])` | red < 0.995 |
| T2 | Сайт: ok за 5 мин | timeseries, min 0 max 1 | `avg_over_time({service="probe",env="${env}"} \| json \| event=\`probe\` \| target=\`landing\` \| unwrap ok [5m])` | — |
| T3 | Supabase: ошибок upstream за 15 мин | bar/timeseries stacked | `sum by (service) (count_over_time({env="${env}"} \|= "invalid response was received from the upstream server" [15m]))` | red > 3 |
| T4 | Supabase auth проба | timeseries 0..1 | `avg_over_time({service="probe",env="${env}"} \| json \| event=\`probe\` \| target=\`supabase_auth\` \| unwrap ok [5m])` | появится после п. 5 |
| T5 | Генерации: success rate 1 ч | stat `percentunit` | `last_over_time(SNAP \| unwrap generations_completed_1h [5m]) / (last_over_time(SNAP \| unwrap generations_completed_1h [5m]) + last_over_time(SNAP \| unwrap generations_failed_1h [5m]))` | red < 0.8 |
| T6 | Генерации: p50 / p95 длительность, 15 мин | timeseries, unit `ms` | `quantile_over_time(0.5, DONE \| unwrap durationMs [15m])` и `quantile_over_time(0.95, DONE \| unwrap durationMs [15m])` | p95 red > 60000 |
| T7 | Генерации: p95 ожидание в очереди | timeseries `ms` | `quantile_over_time(0.95, DONE \| unwrap queueWaitMs [15m])` | red > 30000 |
| T8 | Воркер: живых реплик | stat | `count(sum by (workerId) (count_over_time(HB [2m])))` | red < 1 |
| T9 | Очередь: pending и возраст старейшего | timeseries | `max(last_over_time(HB \| unwrap pending [2m]))`, `max(last_over_time(HB \| unwrap oldestPendingAgeSeconds [2m]))` | возраст red > 900 |
| T10 | Память | timeseries `bytes` | `max by (instance) (max_over_time({service="landing",env="${env}"} \| json \| event=\`runtime_memory\` \| unwrap rss [5m]))`, `max by (workerId) (max_over_time(HB \| unwrap rss [5m]))` | red > 1.6 GiB |
| T11 | Рестарты за час | bar | `sum by (service) (count_over_time({env="${env}"} \| json \| event=~\`process_start\|worker_started\` [1h]))` | red > 2 |
| T12 | Ошибки за 15 мин по сервису | bar stacked | `sum by (service) (count_over_time({env="${env}", level="error"} [15m]))` | — |
| T13 | Топ ошибок за час | bar gauge / table | `topk(5, sum by (event) (count_over_time({env="${env}", level="error"} \| json \| __error__="" \| label_format event=\`{{ if .event }}{{ .event }}{{ else }}other{{ end }}\` [1h])))` | — |

Панель «Ошибки» с сырыми логами убрать. Панель диска убрать: остаётся только алерт.

### Row «Продукт»

Каждая stat-панель показывает текущее значение, а рядом вторым target — значение неделю назад с `legendFormat: "неделю назад"`. В stat это две цифры в одной панели (`textMode: value_and_name`).

| # | Панель | expr текущее | expr база |
|---|---|---|---|
| P1 | Регистрации за час | `last_over_time(SNAP \| unwrap registrations_1h [5m])` | `… unwrap registrations_1h_wk_ago …` |
| P2 | Активация 24 ч, % новых с генерацией | `last_over_time(SNAP \| unwrap activation_24h_pct [5m])` | — (порог red < 20) |
| P3 | Генерации за час | `… unwrap generations_1h …` | `… unwrap generations_1h_wk_ago …` |
| P4 | Выручка 24 ч, ₽ | `… unwrap revenue_rub_24h …` | `… unwrap revenue_rub_24h_wk_ago …` |
| P5 | Оплаты 24 ч | `… unwrap payments_succeeded_24h …` | `… unwrap payments_succeeded_24h_wk_ago …` |
| P6 | Оплаты зависли > 1 ч | `… unwrap payments_pending_1h …` | red > 0 |
| P7 | Failed без возврата кредитов | `max(last_over_time(HB \| unwrap failedWithoutRefund [2m]))` | red > 0 |
| P8 | Регистрации и генерации, 24 ч | timeseries: `registrations_1h`, `generations_1h`, `generations_failed_1h` — три линии | — |

Итого 21 панель. Больше не добавлять.

Проверка JSON: `python3 -c 'import json;json.load(open("ops/observability/grafana/provisioning/dashboards/json/promptshot.json"))'`.

## Шаг 4. Алерты `ops/observability/grafana/provisioning/alerting/rules.yml`

Итог — 9 правил. Формат — как у существующих (`relativeTimeRange`, `__expr__` threshold, `noDataState`).

| uid | Действие | expr / условие |
|---|---|---|
| `ps-landing-health` | оставить | как есть |
| `ps-worker-heartbeat` | оставить | как есть |
| `ps-payment-heartbeat` | оставить | как есть |
| `ps-queue-stuck` | оставить | как есть |
| `ps-failed-ratio` | оставить | как есть |
| `ps-supabase-upstream` | **новый** | `sum(count_over_time({env="prod"} \|= "invalid response was received from the upstream server" [15m])) > 3`, `for: 5m`, `noDataState: OK`, severity `critical` |
| `ps-generation-p95` | **новый** | `quantile_over_time(0.95, {service="web-generation-worker",env="prod"} \| json \| event=\`generation_completed\` \| unwrap durationMs [15m]) > 60000`, `for: 10m`, `noDataState: OK`, severity `warning` |
| `ps-no-payments-daytime` | **новый** | `last_over_time(SNAP \| unwrap payments_succeeded_24h [5m]) == 0` **и** снимок содержит `alert_no_registrations`-подобную логику по часу: проще добавить в SQL `259` ключ `alert_no_payments` = 1, если МСК час 9–21 и `payments_succeeded_6h = 0` (добавить и `payments_succeeded_6h`). Алерт: `last_over_time(SNAP \| unwrap alert_no_payments [5m]) >= 1`, `for: 15m`, severity `warning` |

`ps-disk` оставить как есть — без него диск дроплета никто не увидит.

Удалить два: `ps-snapshot-missing` (крон живёт на том же лендинге, его падение ловит `ps-landing-health`) и `ps-landing-rss` (память видна на T10, смерть по OOM ловят `ps-landing-health` и T11).

Остаются `ps-landing-health`, `ps-worker-heartbeat`, `ps-payment-heartbeat`, `ps-queue-stuck`, `ps-failed-ratio`, `ps-disk` + `ps-supabase-upstream`, `ps-generation-p95`, `ps-no-payments-daytime` = **9 правил**. Ровно 9 `uid:` в файле.

Правила применяются только при заданных `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` на дроплете (`setup.sh` копирует в `generated/alerting`). Не менять эту логику.

## Шаг 5. Ручные шаги пользователя (в конце спеки, не делать за него)

1. Применить `sql/259_ops_product_snapshot_v2.sql` в Supabase SQL Editor.
2. На дроплете в `/opt/observability/.env` добавить пробу Supabase auth:
   `PROBE_URLS=landing=https://promptshot.ru/api/health,supabase_auth=https://bk07-67ud-ea1y.gw-1a.dockhost.net/auth/v1/health`
   Перезапуск не нужен — крон читает файл каждую минуту.
3. На дроплете обновить провижининг: `curl -fsSL -o /opt/observability/grafana/provisioning/dashboards/json/promptshot.json https://raw.githubusercontent.com/mazarov/aiphoto/main/ops/observability/grafana/provisioning/dashboards/json/promptshot.json` и то же для `rules.yml`, затем `cd /opt/observability && docker compose restart grafana`. Если Telegram уже настроен — заново `bash setup.sh` вместо curl.
4. Задеплоить воркер (heartbeat `rss`).
5. На Dockhost у `payment-bot` добавить `LOKI_PUSH_URL`, `LOKI_BASIC_AUTH`, `LOG_ENV=prod` — те же значения, что у лендинга. Перезапустить.

## Документация (в том же коммите)

- `docs/ops/observability.md`: раздел «Что видно» переписать по таблицам T1–T13, P1–P8; раздел «Алерты» — 9 строк; в «Пробы» добавить `supabase_auth`.
- `docs/architecture/01-landing.md`: новая строка `> Последнее обновление: 2026-09-28 (**дашборд v2:** …)` вверху; в разделе Observability упомянуть `ops_product_snapshot` v2 (SQL `259`) и `rss` в heartbeat.
- `docs/27-09-observability-loki-grafana.md`: не трогать.

## Проверка перед коммитом

1. JSON дашборда парсится (команда в шаге 3).
2. `rules.yml` парсится: `python3 -c 'import yaml,sys;yaml.safe_load(open("ops/observability/grafana/provisioning/alerting/rules.yml"))'` (если нет `pyyaml` — визуально, ровно 9 `uid:`).
3. Каждый LogQL из таблиц прогнать через MCP `loki_query` с `minutes: 60` (для metric-запросов достаточно убедиться, что Loki не возвращает `parse error`). Поля `*_wk_ago`, `activation_24h_pct`, `payments_pending_1h`, `rss` в heartbeat появятся только после шагов 5.1 и 5.4 — для них проверить только синтаксис.
4. `web-generation-worker`: `npx tsc --noEmit -p tsconfig.json` даёт только известную ошибку в `index.ts(282)` (`photoshootTilesForComplete`), новых нет.
5. В diff нет `LOKI_BASIC_AUTH` со значением и нет пароля `.cursor/loki.env`.

## Не делать

- Не добавлять Prometheus, экспортеры, трейсинг, CPU-панели, per-route latency, воронку по шагам, панели Метрики.
- Не менять `loki-transport.ts` (три копии синхронны), `probe.py`, `setup.sh`, `docker-compose.yml`.
- Не менять `257`. Не трогать другие миграции.
- Не коммитить и не пушить `main` без явной команды пользователя. Работа — на ветке `feature/28-09-ops-dashboard-v2`.
