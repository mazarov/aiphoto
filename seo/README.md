# SEO — журнал улучшений лендинга

Каталог для документирования SEO-работ по programmatic-страницам [promptshot.ru](https://promptshot.ru).

## Структура

```
seo/
├── README.md
├── knowledge/           # база знаний по продвижению: yandex.md, google.md (читает @senior-seo-strategist-ru)
└── <url-slug>/          # последний сегмент path, напр. s-mashinoy для /s-mashinoy/
    └── YYYY-MM-DD-*.md   # один файл на итерацию изменений (дата внесения + краткое имя)
```

## База знаний

[knowledge/README.md](knowledge/README.md) — правила ведения. Факты по Яндексу — `knowledge/yandex.md`, по Google — `knowledge/google.md`. **Эти файлы локальные и в git не попадают** (`.gitignore`): база собрана из закрытых материалов. Страничные данные (позиции, спрос) сюда не пишутся.

## Страницы

| URL | Папка | Последнее изменение |
|-----|-------|---------------------|
| [/s-mashinoy/](https://promptshot.ru/s-mashinoy/) | [s-mashinoy/](s-mashinoy/) | 2026-06-05 |
| [/promty-dlya-foto-devushki/](https://promptshot.ru/promty-dlya-foto-devushki/) | [promty-dlya-foto-devushki/](promty-dlya-foto-devushki/) | 2026-06-11 |

## Где в коде

Тексты L1-тегов: [`landing/src/lib/seo-content.ts`](../landing/src/lib/seo-content.ts).  
Архитектура: [`docs/architecture/01-landing.md`](../docs/architecture/01-landing.md).
