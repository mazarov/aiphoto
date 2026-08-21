# MCP: Яндекс Вебмастер и Метрика

Два read-only stdio MCP для SEO в Cursor. Секреты только в gitignored `.cursor/yandex-seo.env`.

## Почему не `${workspaceFolder}` в user MCP

User-level `~/.cursor/mcp.json` **не раскрывает** `${workspaceFolder}`. Cursor тогда ищет

`/Users/azarovmaxim/${workspaceFolder}/src/standalone/mcp-yandex-webmaster.mjs`

и падает с `MODULE_NOT_FOUND`. В user-конфиге нужны абсолютные пути. В проектном [`.cursor/mcp.json`](../../.cursor/mcp.json) плейсхолдер работает.

Если серверы появятся дважды (project + user) — оставьте один набор.

## Разовая настройка

1. OAuth-приложение: [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)  
   платформа «Веб-сервисы», redirect `https://oauth.yandex.ru/verification_code`.  
   Доступы: `metrika:read`, `webmaster:hostinfo`, `webmaster:verify`. Без `metrika:write`.
2. Токен (под аккаунтом с доступом к `promptshot.ru` и счётчику `107703100`):

```
https://oauth.yandex.ru/authorize?response_type=token&client_id=CLIENT_ID
```

3. Env:

```bash
cp .cursor/yandex-seo.env.example .cursor/yandex-seo.env
```

В `.cursor/yandex-seo.env` указать `YANDEX_SEO_TOKEN`. Не коммитить.

4. Cursor: **Settings → MCP** → включить `yandex-webmaster` и `yandex-metrica` → Restart.

## Инструменты

### yandex-webmaster

| Tool | Что делает |
|---|---|
| `webmaster_status` | Токен задан, host резолвится. Токен не печатает. |
| `list_hosts` | Сайты на токене. |
| `search_queries` | Топ запросов: показы, клики, CTR, позиция. По умолчанию 28 дней. |
| `search_urls` | Аналитика по URL (окно API ≈ 14 дней). |
| `indexing_summary` | Хост + sitemap. Без recrawl. |

### yandex-metrica

| Tool | Что делает |
|---|---|
| `metrica_status` | Токен и счётчик видны. Токен не печатает. |
| `organic_landings` | Органика по посадочным. |
| `organic_sources` | Органика по поисковикам. |
| `report` | Узкий отчёт, только allowlist metrics/dimensions. |

Квоты Метрики: 5000 запросов/сутки, 200 отчётов / 5 минут, 3 параллельных. При 429 — стоп, не крутить retry.
