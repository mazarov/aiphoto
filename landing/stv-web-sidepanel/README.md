# Зеркало `extension/sidepanel` для сборки лендинга

Каталог нужен, когда Docker (Dockhost и т.п.) собирает образ с **контекстом только `landing/`** — родительского `extension/` в контексте нет.

Источник правды по коду панели: **`extension/sidepanel/`** в корне репо.

После правок в `extension/sidepanel/` обнови зеркало из каталога `landing/`:

```bash
npm run sync:stv-sidepanel
```

Затем закоммить изменения в `landing/stv-web-sidepanel/` вместе с правками в `extension/sidepanel/`, если менялось поведение веб-embed.
