---
name: direct-daily-pnl
description: >-
  Daily PromptShot Yandex Direct search P&L from our ledger, not Direct
  «Доход». Rebuilds the economics canvas: revenue, YooKassa, USN 6%,
  granted credits × 0.5 ₽, ads + VAT 22%. Use when asked for экономика
  Директа, P&L кампаний, сводка за день, daily Direct, канвас оплат,
  @direct-daily-pnl, or /loop 1d on campaign economics.
---

# Direct daily P&L

Роль: тот же отчёт, что канвас `direct-search-real-pnl` — **наши оплаты**, не кабинет.

Один отчёт на календарный день Москва. Если `reports/direct/YYYY-MM-DD-daily.md` уже есть за сегодня — покажи его и канвас, пересчитай только по просьбе.

Читать вместе с `@yandex-direct-search`. Цифры бюджета и `CAC_max` — из `landing/src/lib/yandex-two-cluster-launch.ts`, не из головы.

## Когда вызывать

- «экономика директа», «как кампании», «плюс или минус»
- «сводка за день», daily Direct, P&L
- `@direct-daily-pnl`
- `/loop 1d @direct-daily-pnl`

## Запрещено

- Считать «Доход» / конверсии Директа выручкой.
- Генерацию по списанным кредитам. В P&L — **начисленные** × 0,5 ₽. Остаток на балансе уже внутри.
- Молча подставлять вчерашний расход рекламы как сегодняшний.
- Масштабировать / пополнять, если не закрыт scale gate SSOT.
- Печатать ключи, `yclid`, payment id, email.
- Менять стратегию кампаний из этого скилла.

## Данные

1. Из корня репо:

```bash
node .cursor/skills/direct-daily-pnl/scripts/pull.mjs
```

Env: `landing/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Не писать секреты.

2. Реклама. Кабинет — **без НДС**. В P&L умножить на 1,22.

| Откуда | Когда брать |
|---|---|
| `--ads-media=N` | Явный override |
| `direct_api` | Есть `YANDEX_DIRECT_TOKEN` в `.cursor/yandex-seo.env` |
| `admin_finance_ads_lines` | Импорт, `stale=false` |
| Нет | Спросить кабинет, канвас без рекламы не рисовать |

Если `ads.source=missing` или `stale=true` — сначала спроси «Расход» без НДС по двум живым кампаниям, потом:

```bash
node .cursor/skills/direct-daily-pnl/scripts/pull.mjs --ads-media=2542
```

3. Окно: с `2026-08-23 00:00` Europe/Moscow (старт теста) по сейчас. Это накопительный P&L теста, не «только вчера». Вчера — отдельный срез в JSON.

Direct-оплата: live YooKassa/Robokassa, `succeeded`, `credited_at` не пустой, не test, и (`yclid` или `utm_source=yandex` + `utm_medium=cpc`). Stars вне отчёта.

Кампании:

| id | Метка |
|---|---|
| `713780805` | ГЕНЕРАЦИЯ |
| `713781017` | ПРОМТЫ |
| `999000823` | старый |
| пустой UTM + yclid | `yclid` |

## Формулы

```text
касса     = сумма × 3,5% + НДС 22% с комиссии   (оценка, не реестр)
УСН       = сумма × 6%                          (с выручки)
генерация = начисленные кредиты × 0,5 ₽
реклама   = расход кабинета × 1,22
итог      = выручка − касса − УСН − генерация − реклама
маржа чека = сумма − касса − УСН − начисление    (рекламу на чек не делить)
CAC медиа  = расход без НДС / уникальные плательщики
```

Сверка с кабинетом:

```text
люди с MP sent     ≈ конверсии Директа (last-click, люди)
их платежи         ≥ конверсий (повторы)
наш ledger         = MP-платежи + оплаты без ClientID
```

Директ last-click. Ledger — first-touch UTM + `yclid` на чеке.

## Канвас

Всегда перезапиши:

`/Users/azarovmaxim/.cursor/projects/Users-azarovmaxim-photo2sticker-bot-aiphoto/canvases/direct-search-real-pnl.canvas.tsx`

Сначала прочитай `~/.cursor/skills-cursor/canvas/SKILL.md`. Импорт только `cursor/canvas`. Данные inline, без fetch.

Структура как в текущем канвасе:

1. H1: `Директ по своим оплатам: плюс` / `минус` по знаку `realized`.
2. Callout: итог ₽, правило «1 кредит = 0,5 ₽ с начисления».
3. 4 Stat: выручка, после кассы/налога/начисления, реклама с НДС, итог.
4. Таблица «Куда ушли деньги» — 6 статей + итог. Источник каждой строки в третьей колонке.
5. Horizontal BarChart расходов vs линия выручки.
6. UsageBar кредитов: начислено / списано генерациями / прочее / остаток.
7. Таблица каждой оплаты до рекламы (когда, пакет, кампания, сумма, начисл./осталось, касса, УСН, ген., маржа).
8. Сверка ledger vs Директ (MP / повторы / no_client_id).
9. Card: что оценка (касса, свежесть рекламы).

Пустые блоки не рисовать. Нет оплат — канвас не создавать, сказать это в чате.

В чат — короткий вердикт и что смотреть в канвасе. Таблицу чеков в чат не дублировать.

## После канваса

Сохрани тот же вердикт + итоги в `reports/direct/[today]-daily.md`. Каталог создать при необходимости. Не коммитить, пока не попросили.

Scale gate (SSOT): ≥5 первых плательщиков **и** CAC медиа ≤ `cacMaxRub` **и** mature D30. Иначе в чате: не пополнять, не добавлять ключи.

## Ежедневно

Скилл сам не будит чат. Чтобы приходило каждый день:

```text
/loop 1d @direct-daily-pnl
```

или Cursor Automation с тем же промптом утром по Москве. На тике: скрипт → расход кабинета если пустой → канвас → md.

## Проверка

- Выручка = сумма чеков, не «Доход» Директа.
- Генерация = `creditsGranted × 0.5`, не `creditsSpentGens × 0.5`.
- Реклама в итоге с НДС.
- `CAC_max` и запрет масштаба совпадают с SSOT.
- Секретов в чате, канвасе и md нет.
