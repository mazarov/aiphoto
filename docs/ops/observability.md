# Логи и здоровье сервиса

Стек на втором дроплете DigitalOcean (`ubuntu-s-1vcpu-1gb-fra1`, `46.101.248.190`, 1 ГБ / 25 ГБ). Loki хранит логи 30 дней, Grafana показывает дашборд. Prometheus нет: на 1 ГБ он не помещается. Цифры продукта пишет сам лендинг одной JSON-строкой раз в минуту.

## Что поставить на дроплет

Доступ к дроплету — веб-консоль DigitalOcean. Скрипт сам остановится, если на машине уже заняты порты 80, 443, 3100 или есть запущенные контейнеры.

После того как ветка `feature/27-09-observability-loki-grafana` есть на GitHub:

```bash
curl -fsSL -o setup.sh https://raw.githubusercontent.com/mazarov/aiphoto/feature/27-09-observability-loki-grafana/ops/observability/setup.sh
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

Дашборд PromptShot, последние 6 часов:

- регистрации, генерации, failed и выручка за сутки (ЮKassa + Robokassa, без тестовых платежей; Stars считаются отдельно в той же строке);
- очередь: pending, processing, возраст старейшего pending;
- RSS лендинга;
- проба `GET https://promptshot.ru/api/health` (красная, пока роут не задеплоен);
- лента `level=error`.

Снимок `event=product_snapshot` пишется существующим минутным кроном сверки ЮKassa. Пока миграция `257` не применена, крон сверки жив, а в логе будет `product_snapshot_failed`.

Воркер раз в минуту пишет `event=heartbeat` с глубиной очереди. По этой строке видно, что реплика жива, даже если сайт открывается.

## Алерты

Включаются только после токена Telegram.

| Алерт | Когда |
|---|---|
| Landing health is down | `/api/health` не 200 дольше 2 минут |
| Worker heartbeat missing | нет heartbeat воркера 5 минут |
| Payment bot heartbeat missing | нет heartbeat payment-bot 5 минут |
| Product snapshot missing | нет снимка продукта 5 минут |
| Generation queue is stuck | pending старше 15 минут и за эти 15 минут ничего не завершилось |
| Generation failure ratio is high | среди завершённых за 15 минут failed больше 30 % и таких джоб хотя бы 10 |
| Landing RSS is high | RSS лендинга выше 1.6 ГиБ |
| Observability disk is filling up | диск дроплета больше 80 % |

Про регистраций ночью алерта нет. Днём (09–21 МСК) поле `alert_no_registrations=1`, если за 3 часа не было ни одной регистрации — его видно в строке снимка, отдельное правило можно добавить в UI.

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
PROBE_URLS=landing=https://promptshot.ru/api/health,auth=https://<project>.supabase.co/auth/v1/health
```

После правки `.env` перезапуск Grafana не нужен, крон подхватит файл сам.

## Если дроплет пересоздали

Логи живут в docker volume на этом диске. Новый дроплет — новый пустой Loki. Поднять заново тем же `setup.sh`, пароли создадутся новые: их нужно заново вписать в Dockhost. Дашборды и правила лежат в git и приедут вместе со скриптом.

## Чего этот стек не делает

Логи контейнеров Supabase (Postgres, GoTrue, Storage) с Dockhost сюда сами не приходят. Их здоровье видно косвенно: `/api/health` падает, если база не отвечает, а снимок продукта перестаёт появляться.
