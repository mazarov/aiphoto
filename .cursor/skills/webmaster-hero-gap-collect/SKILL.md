---
name: webmaster-hero-gap-collect
description: >-
  Собирает для 77 страниц без hero-карусели два среза Яндекс Вебмастера:
  позиции по URL через API мониторинга запросов и спрос через «Подбор
  запросов и анализ рынка». Use when asked to снять позиции, собрать
  семантику, выгрузку Вебмастера или Wordcraft по страницам без карусели,
  or @webmaster-hero-gap-collect.
---

# Сбор срезов Вебмастера: страницы без hero-карусели

Этот скилл только собирает файлы. Карту слотов и правки страницы не делать.

Идти строго по списку ниже, сверху вниз (трафик ↓). Позиции снимать с этих URL. Если в `inbox/<slug>/` уже лежат оба файла, страницу пропустить.

## Страницы

```
/promty-dlya-foto-malysh
/promty-dlya-semejnogo-foto
/promty-dlya-foto-s-dochkoy
/sobytiya/den-rozhdeniya
/promty-dlya-foto-s-mamoy
/stil/selfi
/promty-dlya-foto-devochka
/stil/cherno-beloe
/promty-dlya-detskih-foto
/stil/multyashnoe
/stil/kollazh
/stil/portret
/stil/studiynoe
/promty-dlya-foto-s-podrugoy
/promty-dlya-foto-pokoleniy
/stil/delovoe
/promty-dlya-foto-malchik
/promty-dlya-foto-vlyublennykh
/promty-dlya-foto-beremennaya
/promty-dlya-foto-s-sestroy
/stil/realistichnoe
/promty-dlya-foto-s-babushkoy
/stil/retro
/sobytiya/1-sentyabrya
/halloween
/promty-dlya-foto-s-papoy
/stil/disney
/stil/love-is
/stil/barbie
/stil/kinematograficheskoe
/stil/y2k
/foto-na-dokumenty
/sobytiya/svadba
/foto-na-rezume
/stil/fashion
/promty-dlya-foto-podrostok
/stil/anime
/stil/gta
/stil/fotorealizm
/promty-dlya-foto-s-drugom
/promty-dlya-foto-s-pitomcem
/promty-dlya-foto-s-bratom
/promty-dlya-foto-s-muzhem
/promty-dlya-foto-s-synom
/stil/3d
/stil/neonovoe
/stil/vysokaya-moda
/stil/sovetskoe
/stil/giperrealistichnoe
/stil/otkrytka
/stil/polaroid
/sobytiya/novyj-god
/stil/romanticheskiy
/sobytiya/maslenica
/stil/ultrarealistichnoe
/stil/fine-art
/stil/etno-stil
/stil/glyanec
/stil/piksar
/stil/impressionizm
/stil/minimalizm
/stil/victorias-secret
/sobytiya/23-fevralya
/stil/produktovaya-fotografiya
/stil/vintazhnoe
/stil/art-deco
/stil/street-style
/sobytiya/8-marta
/sobytiya/rozhdestvo
/promty-dlya-foto-s-parnem
/stil/bokho-stil
/stil/glam
/stil/lifestyle
/sobytiya/14-fevralya
/foto-na-pasport
/foto-na-zagranpasport
/stil/editorial
```

Полный URL для Wordcraft: `https://promptshot.ru` + path. `<slug>` — path без ведущего слэша, со слешами внутри (`stil/selfi`, `sobytiya/den-rozhdeniya`).

Кладём сюда:

`inbox/<slug>/positions.json`
`inbox/<slug>/wordcraft.xlsx`

`inbox/` рядом с этим файлом. Токен в файлы не писать. Это не inbox скилла object-хабов.

## 1. Позиции — API, не MCP-сводка

MCP `search_queries` — топ сайта без URL. MCP `search_urls` — сводка URL без списка запросов. Для полки страницы их не использовать.

`webmaster_status` → `user_id`, `host_id`. Токен тот же, что у MCP. В чат, логи и файлы его не выводить.

```
POST https://api.webmaster.yandex.net/v4/user/{user_id}/hosts/{host_id}/query-analytics/list
Authorization: OAuth <token>
Content-Type: application/json; charset=UTF-8
```

```json
{
  "offset": 0,
  "limit": 100,
  "device_type_indicator": "ALL",
  "search_location": "WEB_LOCATION",
  "text_indicator": "QUERY",
  "filters": {
    "text_filters": [
      {
        "text_indicator": "URL",
        "operation": "TEXT_CONTAINS",
        "value": "/stil/selfi"
      }
    ]
  }
}
```

`value` — path страницы, без домена. Листать `offset`, пока не выбран весь `count`. Окно API — около 14 дней. Если `offset: 0` отклоняется, начать с `1`.

`TEXT_CONTAINS` цепляет дочерние URL (`/stil/selfi/na-krovati`). В файл этой страницы класть только запросы, у которых URL — ровно `https://promptshot.ru` + path, без хвоста.

В `positions.json`: `path`, `fetched_at`, и строки `query`, `shows`, `clicks`, `ctr`, `position`. Позиция — среднее по показам за дни. Запросы с `dzen.ru`, `dtf.ru`, `habr`, `vc.ru`, nano banana, gemini, chatgpt не выкидывать из файла: их отсеет карта слотов.

## 2. Спрос — кабинет Wordcraft

Отдельного API нет. Браузер, сессия пользователя.

1. `https://webmaster.yandex.ru` → сайт `promptshot.ru` → **Подбор запросов и анализ рынка**.
2. Режим **Запрос по группе URL**. До 50 URL за раз, полные `https://promptshot.ru/...`. В группу класть только URL из списка, без дочерних.
3. Скачать XLSX. Лист, у которого первая ячейка `query`: колонки `query`, `cluster`, `clicks`, `demand`, `competitiveness`. Порядок листов плавает, имя `Queries` не гарантировано.
4. Разложить файл в `inbox/<slug>/wordcraft.xlsx` той страницы, чей URL уходил в группу. Если в одной выгрузке несколько URL, разрезать по URL, не класть общий файл во все папки.

Экран логина или капча — остановиться и попросить войти один раз. Пароль не вводить и не спрашивать.

Если по URL пусто, один запасной заход: **Одиночный запрос** из H1 этой страницы, тот же XLSX.

## После прогона

Написать, сколько страниц из 77 закрыто и у кого пустая полка или пустой Wordcraft. Колонку «Готово» не ставить.
