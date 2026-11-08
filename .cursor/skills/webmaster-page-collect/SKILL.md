---
name: webmaster-page-collect
description: >-
  Собирает для 94 страниц из списка в этом скилле два среза
  Яндекс Вебмастера: позиции по URL через API мониторинга запросов и спрос
  через «Подбор запросов и анализ рынка». Use when asked to снять позиции,
  собрать семантику, выгрузку Вебмастера или Wordcraft по очереди хабов,
  or @webmaster-page-collect.
---

# Сбор срезов Вебмастера по очереди

Этот скилл только собирает файлы. Карту слотов и правки страницы делает `@cluster-hub-page`.

Идти строго по списку ниже, сверху вниз. Позиции снимать с этих URL, не с будущего `/promty-dlya-foto/...`. Если в `inbox/<slug>/` уже лежат оба файла, страницу пропустить.

## Страницы

```
/s-mashinoy
/foto-na-avatarku
/na-more
/v-mashine
/s-shampanskim
/v-zerkale
/v-sportale
/mototsikl
/s-tortom
/s-loshadyu
/v-lesu
/v-gorah
/v-kostyume
/s-cvetami
/na-krovati
/s-pitomcem
/leto
/s-medvedem
/dozhd
/so-svechami
/s-kotom
/s-girlyandami
/v-vannoy
/na-yahte
/v-basseyne
/na-chernom-fone
/pod-vodoy
/s-kofe
/s-ochkami
/v-platye
/zakat
/s-sobakoj
/v-pole
/s-bokalom
/v-lifte
/kuhnya
/na-ulice
/iphone
/velosiped
/na-krasnom-fone
/v-parke
/na-belom-fone
/v-profil
/v-pustyne
/s-knigoy
/v-restorane
/na-lestnice
/s-tykvoy
/so-znamenitostyu
/na-okne
/zima
/noch
/s-gitaroy
/s-koronoy
/s-pionami
/s-maskoy
/na-balkone
/s-serdechkami
/s-sharami
/v-gorode
/v-polnyy-rost
/na-stole
/s-zontom
/v-interere
/s-cheburashkoy
/s-konfetami
/v-metroe
/v-sadu
/v-studii
/s-igrushkoy
/s-lentami
/s-mandarinami
/v-spalne
/zolotoy-chas
/na-kryshe
/na-naberezhnoj
/s-naushnikami
/s-shokoladkoy
/s-shuboj
/tuman
/vintazhnyy-avtomobil
/na-rozovom-fone
/s-detskim-foto
/s-elkoj
/s-otkrytkami
/s-podarkami
/s-samovarom
/s-shuboy
/s-tulpanami
/s-valentinkami
/s-zhurnalom
/sneg
/so-lvom
/vesna
```

Полный URL для Wordcraft: `https://promptshot.ru` + path. `<slug>` — path без ведущего слэша.

Кладём сюда, по одному каталогу на path без ведущего слэша (`s-mashinoy`):

`inbox/<slug>/positions.json`
`inbox/<slug>/wordcraft.xlsx`

`inbox/` рядом с этим файлом. Токен в файлы не писать.

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
        "value": "/s-mashinoy"
      }
    ]
  }
}
```

`value` — path страницы, без домена. Листать `offset`, пока не выбран весь `count`. Окно API — около 14 дней. Если `offset: 0` отклоняется, начать с `1`.

В `positions.json`: `path`, `fetched_at`, и строки `query`, `shows`, `clicks`, `ctr`, `position`. Позиция — среднее по показам за дни. Запросы с `dzen.ru`, `dtf.ru`, `habr`, `vc.ru`, nano banana, gemini, chatgpt не выкидывать из файла: их отсеет карта слотов.

## 2. Спрос — кабинет Wordcraft

Отдельного API нет. Браузер, сессия пользователя.

1. `https://webmaster.yandex.ru` → сайт `promptshot.ru` → **Подбор запросов и анализ рынка**.
2. Режим **Запрос по группе URL**. До 50 URL за раз, полные `https://promptshot.ru/...`.
3. Скачать XLSX. Лист `Queries`: `query`, `cluster`, `clicks`, `demand`, `competitiveness`.
4. Разложить файл в `inbox/<slug>/wordcraft.xlsx` той страницы, чей URL уходил в группу.

Экран логина или капча — остановиться и попросить войти один раз. Пароль не вводить и не спрашивать.

Если по URL пусто, один запасной заход: **Одиночный запрос** из H1 этой страницы, тот же XLSX.

## После прогона

Написать, сколько страниц закрыто и у кого пустая полка или пустой Wordcraft. Колонку «Готово» в очереди не ставить: она ставится после выката хаба.
