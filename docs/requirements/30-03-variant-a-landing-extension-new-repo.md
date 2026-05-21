# План: новый репозиторий — вариант A (весь `landing/` + `extension/`)

> **Дата:** 2026-03-30  
> **Статус:** план миграции (первый импорт выполнен в отдельный репозиторий)  
> **Целевой репозиторий:** [github.com/azarovmaxim/imageprompt](https://github.com/azarovmaxim/imageprompt) — локальная копия: `~/imageprompt` (`/Users/azarovmaxim/imageprompt`).  
> **Связанные документы:** [30-03-imageprompt-tools-domain-requirements.md](./30-03-imageprompt-tools-domain-requirements.md), [architecture/01-landing.md](../architecture/01-landing.md), [.cursor/rules/landing-docker-next-standalone.mdc](../../.cursor/rules/landing-docker-next-standalone.mdc).

---

## 1. Решение

**Вариант A:** в отдельный git-репозиторий переносится **целиком** каталог **`landing/`** и **`extension/`** (без вырезания SEO-листингов и остального Next-приложения PromptShot внутри `landing/`).

**Зачем:** минимум рефакторинга; сохраняются скрипты `build:stv-web` (sibling `../extension/sidepanel`), Docker-контекст `landing/`, зеркало `landing/stv-web-sidepanel/`.

---

## 2. Целевая структура нового репозитория

Рекомендуемый корень репозитория (как сейчас в монорепо относительно этих двух папок):

```text
<new-repo>/
  landing/                 # целиком из aiphoto
  extension/               # целиком из aiphoto
  docs/                    # опционально: см. §4
  README.md                # как собрать, env, деплой
  .gitignore               # объединить правила из корня aiphoto (node, .env) при необходимости
```

**Важно:** в `landing/package.json` скрипт `vendor:extension` пишет в **`../extension/sidepanel/vendor/`** — при структуре выше пути остаются валидными. Скрипт **`build-stv-web.mjs`** сначала ищет **`../extension/sidepanel`**, иначе **`./stv-web-sidepanel`** — локально после клона всё работает, если рядом лежит `extension/`.

---

## 3. Пошаговый чеклист (исполнитель)

### 3.1 Создать репозиторий

1. Создать **пустой** репозиторий на хостинге git (имя на усмотрение, например `imageprompt-web`).
2. Локально:

```bash
mkdir imageprompt-web && cd imageprompt-web
git init
git branch -M main
```

### 3.2 Скопировать деревья

Из корня клона **aiphoto** (пути подставить свои):

```bash
# пример: NEW=~/src/imageprompt-web  OLD=~/src/aiphoto
rsync -a --exclude node_modules --exclude .next "$OLD/landing/" "$NEW/landing/"
rsync -a "$OLD/extension/" "$NEW/extension/"
```

Проверить, что в **`$NEW/landing/stv-web-sidepanel/`** есть актуальное зеркало (или после клонирования один раз выполнить из `landing/`: **`npm run sync:stv-sidepanel`** при наличии соседнего `extension/`).

### 3.3 Документация и правила (опционально)

Скопировать в `<new-repo>/docs/` минимум:

- `docs/requirements/30-03-imageprompt-tools-domain-requirements.md`
- `docs/requirements/30-03-variant-a-landing-extension-new-repo.md` (этот файл)
- `docs/extension-ui-spec.md`, `docs/extension-landing-*.md`, `docs/22-03-stv-single-generation-flow.md` — по необходимости
- фрагмент **`.cursor/rules/landing-docker-next-standalone.mdc`** (или ссылка в README)

### 3.4 Первый коммит в новом репо

```bash
cd "$NEW"
git add landing extension docs README.md .gitignore
git commit -m "Initial import: landing + extension (variant A from aiphoto)"
git remote add origin <git-url>
git push -u origin main
```

### 3.5 Локальная проверка

Из **`landing/`**:

```bash
cd landing
npm install
npm run build:stv-web   # или сразу npm run build
```

Ожидание: успешная сборка `boot.mjs`, затем `next build` без ошибок.

### 3.6 Docker (как сейчас)

См. правило **landing-docker-next-standalone**: контекст **только `landing/`**:

```bash
docker build -f landing/Dockerfile ./landing
```

При необходимости — **`landing/scripts/verify-docker-image.sh`**.

### 3.7 CI / секреты

- Перенести (или создать заново) переменные окружения для **Next** и API (Supabase, Gemini, и т.д.) — **без** копирования реальных значений в git.
- Настроить pipeline: установка зависимостей в **`landing/`**, `npm run build`, публикация образа или деплой на хостинг.

### 3.8 Домен и Supabase

Выполнить требования из [30-03-imageprompt-tools-domain-requirements.md](./30-03-imageprompt-tools-domain-requirements.md): **`NEXT_PUBLIC_SITE_URL`**, Redirect URLs, расширение Chrome.

---

## 4. Репозиторий aiphoto после разделения

Нужно **явно решить** (и задокументировать в aiphoto):

| Стратегия | Смысл |
|-----------|--------|
| **Удалить** `landing/` и `extension/` из aiphoto | Один источник правды — новый репо; в aiphoto убрать скрипты из корневого `package.json`, которые делают `cd landing`. |
| **Оставить копию** на переходный период | Риск расхождения; зафиксировать дату отключения дубля. |
| **Submodule** | Сложнее в DX; имеет смысл только если команда хочет жёстко связать ревизии. |

После удаления из aiphoto: обновить **`docs/architecture/01-landing.md`** и корневой **README**, указав ссылку на новый репозиторий.

---

## 5. История git (опционально)

Если нужна **история коммитов** только по `landing/` и `extension/`:

- инструмент **`git filter-repo`** (или аналог) на клоне aiphoto с путями `landing/` и `extension/` — затем добавить как remote в новый репо и merge.

Иначе достаточно **первого коммита** «Initial import» без истории.

---

## 6. Зависимости от остального aiphoto

Текущий **`landing/`** **не импортирует** TypeScript из **`aiphoto/src/`** (бот). После выноса **не требуется** тащить `payment-bot/`, worker, SQL — пока новый сайт использует **тот же Supabase-проект**.

Скрипты в **корневом** `package.json` aiphoto вида `cd landing && …` после выноса либо удаляются, либо заменяются ссылкой на другой репозиторий.

---

## 7. Чеклист готовности нового репо

- [ ] `cd landing && npm ci && npm run build` — OK
- [ ] `docker build -f landing/Dockerfile ./landing` — OK
- [ ] Env на staging / prod заданы
- [ ] Supabase redirect URLs включают новый домен
- [ ] Расширение собрано с новым API origin (отдельная задача релиза)
- [ ] В старом репо принято решение по §4 и выполнено

---

## 8. Git workflow

Перед первым пушем в прод-ветку согласовать с командой: работа в **`main`** или ветка **`feature/<имя-документа>`** по [.cursor/rules/git-workflow.mdc](../../.cursor/rules/git-workflow.mdc).
