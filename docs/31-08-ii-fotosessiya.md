# 31-08 Хаб «ИИ фотосессия» → `/ii-fotosessiya`

> **Дата:** 2026-08-31
> **Статус:** в коде
> **Ветка:** `feature/31-08-ii-fotosessiya`
> **Роль:** `@senior-seo-strategist-ru`

Хаб серии переехал с `/promty-dlya-ii-fotosessii` на `/ii-fotosessiya` и держит коммерческий кластер Wordcraft «ии фотосессия / по фото», не «промты для ии фотосессии». Промт-кластер с 31.08 снова на `/` и L1 — `docs/31-08-homepage-promty-fotosessii.md`.

---

## 1. Один URL — один ключ

| URL | Тип | Ключ | Не берёт |
|---|---|---|---|
| `/ii-fotosessiya` | хаб серии по фото | ии фотосессия; ии фотосессия по фото | промты для фото; сделать фото ИИ |
| `/ii-fotosessiya/zhenskie` | L2 | женская фотосессия ии | промты для фото девушки |
| `/ii-fotosessiya/pary` | L2 | парная ии фотосессия | промты для фото пар |
| `/ii-fotosessiya/muzhskie` | L2 | мужская фотосессия ии | промты для фото мужчины |
| `/ii-fotosessiya/semeynye` | L2 | семейная фотосессия ии | промты для семейного фото |
| `/generaciya-foto` | глагол 1 кадра | сделать фото ИИ | ии фотосессия |
| `/` | каталог 1 кадра | промты для фото | ии фотосессия в Title/H1 |

Остальные L2 — тот же шаблон (зима, новый год, беременность, деловой стиль, …).

---

## 2. 301

- `/promty-dlya-fotosessii` → `/ii-fotosessiya`
- `/promty-dlya-ii-fotosessii` → `/ii-fotosessiya`
- `/promty-dlya-ii-fotosessii/:slug` → `/ii-fotosessiya/:slug`

---

## 3. Хаб

| Поле | Текст |
|---|---|
| Title | `ИИ фотосессия по фото онлайн \| PromptShot` |
| H1 | `ИИ фотосессия по фото` |
| Description | серия из одного фото, один стиль, онлайн; без «бесплатно» |
| HowTo | загрузить фото → собрать несколько кадров; не «купи кредиты» первым шагом |
| CTA | «Собрать фотосессию» |

---

## 4. Код

`landing/src/app/ii-fotosessiya/`, `promty-dlya-ii-fotosessii-cluster.ts`, `promty-dlya-ii-fotosessii-seo-copy.ts`.

---

## 5. Generate dock — мгновенное открытие инструмента

Требования к UX «сразу Фотосессия / Промт по фото» (lazy-load, hydrate, optimistic UI): **`docs/31-08-generate-dock-instant-compose.md`**.
