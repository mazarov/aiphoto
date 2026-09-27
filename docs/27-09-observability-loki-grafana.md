# 27-09 — логи и здоровье сервиса

Код на `main`.

Как поднять дроплет и что вписать в Dockhost: `docs/ops/observability.md`.

## Зачем

Stdout на Dockhost пропадает при рестарте контейнера. Отдельного сборщика на хост поставить нельзя, поэтому процессы сами пушат логи в Loki на втором дроплете (1 ГБ). Регистрации, генерации, очередь и выручка уже есть в Postgres — лендинг раз в минуту пишет их одной строкой, Grafana рисует дашборд из Loki. Prometheus не ставим.

## Сделано в коде

- [x] `ops/observability/` — compose Loki + Grafana + Caddy, дашборд, правила алертов, `setup.sh`, минутная проба
- [x] Транспорт push в Loki: landing (`console.*`), worker (`logger.ts` + heartbeat), payment-bot
- [x] `GET /api/health`
- [x] `sql/257_ops_product_snapshot.sql` и строка `product_snapshot` из минутного крона сверки ЮKassa
- [x] `docs/ops/observability.md`, секция в `docs/architecture/01-landing.md`

## Осталось на машинах

- [ ] Выполнить `setup.sh` в веб-консоли дроплета `46.101.248.190`
- [ ] Применить миграцию `257`
- [ ] Прописать `LOKI_PUSH_URL`, `LOKI_BASIC_AUTH`, `LOG_ENV=prod` на трёх сервисах Dockhost и задеплоить
- [ ] Убедиться, что в Grafana есть `product_snapshot`, `heartbeat` и `runtime_memory`
- [ ] Вписать Telegram в `/opt/observability/.env` и перезапустить `setup.sh`
