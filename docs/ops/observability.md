# Логи и здоровье сервиса

Стек на втором дроплете DigitalOcean (`ubuntu-s-1vcpu-1gb-fra1`, `46.101.248.190`, 1 ГБ / 25 ГБ). Loki хранит логи 30 дней, Grafana показывает дашборд. Prometheus нет: на 1 ГБ он не помещается. Цифры продукта пишет сам лендинг одной JSON-строкой раз в минуту.

## Что поставить на дроплет

Доступ к дроплету — веб-консоль DigitalOcean. Скрипт сам остановится, если на машине уже заняты порты 80, 443, 3100 или есть запущенные контейнеры.

В веб-консоли дроплета:

```bash
curl -fsSL -o setup.sh https://raw.githubusercontent.com/mazarov/aiphoto/main/ops/observability/setup.sh
bash setup.sh
```

Скрипт ставит Docker, swap 2 ГБ, скачивает compose-файлы в `/opt/observability`, поднимает Loki, Grafana и Caddy, включает минутный крон проб и UFW (22, 80, 443).

Grafana открывается по `https://46.101.248.190.sslip.io` (сертификат Let's Encrypt через Caddy, свой DNS не нужен). Пароль — в выводе скрипта и в `/opt/observability/CONNECT.txt` (`chmod 600`). Повторный запуск пароли не меняет.

Другой домен, до запуска:

```bash
export OPS_DOMAIN=ops.promptshot.ru
bash setup.sh
```

## Что прописать на Dockhost

Одинаково для лендинга, `web-generation-worker` и `payment-bot`:

```bash
LOKI_PUSH_URL=https://46.101.248.190.sslip.io/loki/api/v1/push
LOKI_BASIC_AUTH=loki:<пароль из CONNECT.txt>
LOG_ENV=prod
```

Пустой `LOKI_PUSH_URL` ничего не ломает: логи остаются только в stdout. Это инфра, не фичефлаг.

Порядок выката:

1. Применить `sql/257_ops_product_snapshot.sql` на Supabase.
2. Задеплоить лендинг, воркер и payment-bot с тремя переменными выше.
3. Минутный крон `POST /api/cron/yookassa-reconcile` уже пишет снимок продукта. Отдельно дергать ничего не нужно. Ручной вызов: `POST /api/cron/ops-snapshot` с `Authorization: Bearer $CRON_SECRET`.
4. Открыть дашборд PromptShot. В Explore: `{service="web-generation-worker", env="prod"}`.
5. Когда логи видны, вписать в `/opt/observability/.env` `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` и снова запустить `bash /opt/observability/setup.sh`. После этого алерты уходят в Telegram.

## Что видно

Дашборд PromptShot, две секции. Состав панелей и LogQL — `docs/28-09-ops-dashboard-v2.md`.

Тех: uptime сайта за 24 ч, проба за 5 мин, проба Supabase Auth, ошибки upstream Kong за 15 мин, доля успешных генераций, p50/p95 длительности и p95 ожидания в очереди, число живых реплик воркера, pending и возраст очереди, RSS лендинга и воркера, рестарты за час, ошибки по сервису и топ `event`.

Продукт: регистрации, генерации, оплаты и выручка за текущее окно рядом с тем же окном неделю назад; доля новых за 24 ч, у кого есть генерация; оплаты в `created`/`pending` дольше часа; failed без возврата кредитов.

Снимок `event=product_snapshot` пишет минутный крон сверки ЮKassa. Пока миграция `259` не применена, на панелях «неделю назад», активации и зависших оплат пусто, остальные поля `257` на месте. Если функции нет совсем, в логе будет `product_snapshot_failed`.

Воркер раз в минуту пишет `event=heartbeat` (`pending`, `rss`, `failedWithoutRefund`, `workerId`). `rss` появляется после деплоя воркера с этим полем.

## Алерты

Включаются только после токена Telegram.

| Алерт | Когда |
|---|---|
| Landing health is down | `/api/health` не 200 дольше 2 минут |
| Worker heartbeat missing | нет heartbeat воркера 5 минут |
| Payment bot heartbeat missing | нет heartbeat payment-bot 5 минут |
| Generation queue is stuck | pending старше 15 минут и за эти 15 минут ничего не завершилось |
| Generation failure ratio is high | среди завершённых за 15 минут failed больше 30 % и таких джоб хотя бы 10 |
| Observability disk is filling up | диск дроплета больше 80 % |
| Supabase upstream is failing | строка `invalid response was received from the upstream server` больше 3 раз за 15 минут |
| Generation latency is high | p95 `durationMs` выше 60 с дольше 10 минут |
| No payments during the day | днём (09–21 МСК) ноль успешных оплат за 6 часов, поле `alert_no_payments` |

Днём (09–21 МСК) поле `alert_no_registrations=1`, если за 3 часа не было ни одной регистрации — оно в строке снимка, отдельного правила нет. Память и рестарты видны на дашборде, отдельных алертов на RSS нет.

## Чтение из Cursor

Агент читает Loki через read-only MCP `loki` (`loki_status`, `loki_query`). Пароль лежит только в gitignored `.cursor/loki.env` — те же `LOKI_PUSH_URL` и `LOKI_BASIC_AUTH`, что на Dockhost. Шаблон: `.cursor/loki.env.example`.

В Cursor: **Settings → MCP** → включить `loki`. Запросы только на чтение (`query_range`). Запись логов с машины агента не открыта.

## Куда смотреть, когда контейнер уже умер

В Grafana Explore, за нужный час:

```
{service="landing", env="prod", level="error"}
{service="web-generation-worker", env="prod"} |= "shutdown_started"
{service="landing", env="prod"} | json | event=`runtime_memory`
{service="landing", env="prod"} | json | event=`product_snapshot`
```

`process_start` чаще раза в час у одного сервиса — контейнер перезапускается.

Последние секунды перед OOM (SIGKILL) в Loki не попадают: процесс не успевает отправить буфер. Рост RSS на графике виден раньше.

## Пробы

Крон на дроплете раз в минуту вызывает `/opt/observability/probe.py`. По умолчанию проверяется только лендинг. Свой список — `PROBE_URLS` в `.env`, имена через запятую:

```bash
PROBE_URLS=landing=https://promptshot.ru/api/health,supabase_auth=https://bk07-67ud-ea1y.gw-1a.dockhost.net/auth/v1/health
```

После правки `.env` перезапуск Grafana не нужен, крон подхватит файл сам.

## Если дроплет пересоздали

Логи живут в docker volume на этом диске. Новый дроплет — новый пустой Loki. Поднять заново тем же `setup.sh`, пароли создадутся новые: их нужно заново вписать в Dockhost. Дашборды и правила лежат в git и приедут вместе со скриптом.

## Чего этот стек не делает

Логи контейнеров Supabase (Postgres, GoTrue, Storage) с Dockhost сюда сами не приходят. Их здоровье видно косвенно: `/api/health` падает, если база не отвечает, а снимок продукта перестаёт появляться.
