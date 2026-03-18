# Пользовательский слой — Требования

**Дата:** 2026-03-13
**Статус:** Реализация — этап 1 (frontend + SQL миграции)

---

## 1. Контекст

Лендинг (`landing/`) — Next.js 15 App Router + Supabase. Сейчас авторизации нет, все данные серверные через service role. Нужно ввести пользовательский слой: авторизация, лайки/дизлайки карточек, избранное.

---

## 2. Авторизация через соцсети

### 2.1 Провайдеры

| Провайдер | Приоритет | Комментарий |
|-----------|-----------|-------------|
| Google | P0 | Основной, максимальный охват |
| Telegram | P0 | Целевая аудитория бота |
| Yandex | P0 | Рынок СНГ |

### 2.2 Flow авторизации

```
[Кнопка "Войти"] → Модалка с провайдерами → OAuth redirect → callback → session
```

- Используем **Supabase Auth** (встроенный OAuth)
- Создаём **browser-side Supabase client** (сейчас только server-side с service role)
- После авторизации: JWT-сессия в cookie (SSR-совместимо)
- Refresh token обновляется автоматически (Supabase SDK)

### 2.3 Реализация провайдеров

| Провайдер | Supabase поддержка | Реализация |
|-----------|-------------------|------------|
| Google | Встроенный | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Telegram | Нет встроенного | Telegram Login Widget → верификация на сервере → custom sign-in |
| Yandex | Нет встроенного | Custom OAuth: redirect → code → token → userinfo → custom sign-in |

Для Yandex и Telegram — custom OAuth flow с серверным API-роутом.

### 2.4 Данные пользователя

**Таблица `landing_users`** (расширение `auth.users`):

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | uuid PK | = `auth.users.id` |
| `display_name` | text | Имя из провайдера |
| `avatar_url` | text | Аватар из провайдера |
| `provider` | text | `google`, `telegram`, `yandex` |
| `created_at` | timestamptz | Дата регистрации |
| `updated_at` | timestamptz | Последнее обновление |

Заполняется через **database trigger** на `auth.users` INSERT.

### 2.5 UI авторизации

- **Header**: кнопка "Войти" (неавторизован) → аватар + имя + dropdown (авторизован)
- **Dropdown меню**: Избранное, Выйти
- **Модалка авторизации**: 3 кнопки провайдеров (Google, Telegram, Yandex)
- Авторизация для SEO закрыта — только модалка, отдельной страницы `/login` нет
- Авторизация **НЕ блокирует** просмотр контента — сайт полностью доступен без логина

### 2.6 Когда показывать модалку

- Клик на "Войти" в шапке
- Попытка поставить лайк/дизлайк без авторизации
- Попытка добавить в избранное без авторизации
- **НЕ** показывать автоматически / принудительно

---

## 3. Лайк / Дизлайк карточек

### 3.1 Бизнес-правила

| Правило | Описание |
|---------|----------|
| 1 реакция на карточку | Пользователь может поставить **либо** лайк, **либо** дизлайк на одну карточку |
| Переключение | Лайк → клик на дизлайк = лайк снимается, ставится дизлайк (и наоборот) |
| Отмена | Повторный клик на текущую реакцию — снимает её (toggle) |
| Без авторизации | Показать модалку авторизации |
| Отображение | Лайки и дизлайки — **два раздельных счётчика** |

### 3.2 Таблица `card_reactions`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → `auth.users(id)` | Пользователь |
| `card_id` | uuid FK → `prompt_cards(id)` | Карточка |
| `reaction` | text CHECK (`'like'`, `'dislike'`) | Тип реакции |
| `created_at` | timestamptz | Когда поставлена |
| `updated_at` | timestamptz | Когда изменена |

**Constraints:**
- `UNIQUE(user_id, card_id)` — одна реакция на карточку на пользователя
- ON DELETE CASCADE по обоим FK

### 3.3 RLS (Row Level Security)

```sql
-- Читать реакции могут все (для подсчёта)
CREATE POLICY "Anyone can read reactions"
  ON card_reactions FOR SELECT USING (true);

-- Создавать/менять/удалять — только свои
CREATE POLICY "Users manage own reactions"
  ON card_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3.4 Денормализация счётчиков

Добавить в `prompt_cards`:

| Колонка | Тип | Описание |
|---------|-----|----------|
| `likes_count` | integer DEFAULT 0 | Количество лайков |
| `dislikes_count` | integer DEFAULT 0 | Количество дизлайков |

Обновляются через **database trigger** на `card_reactions` (INSERT / UPDATE / DELETE).

### 3.5 API

Напрямую через Supabase client с RLS (без отдельных API-роутов):

```typescript
// Поставить / переключить
supabase.from('card_reactions')
  .upsert({ user_id, card_id, reaction }, { onConflict: 'user_id,card_id' })

// Снять
supabase.from('card_reactions')
  .delete().match({ user_id, card_id })

// Мои реакции для видимых карточек (batch)
supabase.from('card_reactions')
  .select('card_id, reaction')
  .eq('user_id', myId)
  .in('card_id', visibleCardIds)
```

### 3.6 UI

- На каждой `PromptCard`: кнопки 👍 + число / 👎 + число (раздельно)
- Активная реакция: заполненная иконка + акцентный цвет
- Неактивная: outline-иконка, нейтральный цвет
- На странице карточки (`/p/[slug]`): те же кнопки, крупнее
- **Optimistic update**: UI обновляется мгновенно, синхронизация с сервером в фоне

---

## 4. Избранное

### 4.1 Бизнес-правила

| Правило | Описание |
|---------|----------|
| Добавление | Клик на иконку закладки — карточка в избранном |
| Удаление | Повторный клик — убрать из избранного (toggle) |
| Просмотр | Страница `/favorites` со всеми избранными |
| Без авторизации | Показать модалку авторизации |
| Лимит | Без лимита |

### 4.2 Таблица `card_favorites`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → `auth.users(id)` | Пользователь |
| `card_id` | uuid FK → `prompt_cards(id)` | Карточка |
| `created_at` | timestamptz | Когда добавлена |

**Constraints:**
- `UNIQUE(user_id, card_id)` — одна запись на пару
- ON DELETE CASCADE по обоим FK

### 4.3 RLS

```sql
-- Читать только свои
CREATE POLICY "Users read own favorites"
  ON card_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Создавать/удалять только свои
CREATE POLICY "Users manage own favorites"
  ON card_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 4.4 API

Напрямую через Supabase client с RLS:

```typescript
// Добавить
supabase.from('card_favorites').insert({ user_id, card_id })

// Убрать
supabase.from('card_favorites').delete().match({ user_id, card_id })

// Мой список (с пагинацией)
supabase.from('card_favorites')
  .select('card_id, created_at')
  .eq('user_id', myId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1)

// Проверить статус для видимых карточек (batch)
supabase.from('card_favorites')
  .select('card_id')
  .eq('user_id', myId)
  .in('card_id', visibleCardIds)
```

### 4.5 UI

- На каждой `PromptCard`: иконка закладки (bookmark)
- Заполненная = в избранном, пустая = нет
- **Страница `/favorites`**: grid избранных карточек (тот же `PromptCard`)
- Пустое состояние: "У вас пока нет избранных промптов" + CTA к каталогу
- Ссылка на `/favorites` в dropdown авторизованного пользователя
- **Optimistic update**

---

## 5. Технические решения

### 5.1 Новый browser-side Supabase клиент

```typescript
// landing/src/lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Новая env-переменная: **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**

### 5.2 Middleware (сессия)

Next.js middleware для обновления JWT-сессии на каждый запрос (стандартный Supabase SSR pattern).

### 5.3 Batch-загрузка состояний

При рендере списка карточек — один запрос на все видимые `card_ids`:

```typescript
const { data: reactions } = await supabase
  .from('card_reactions')
  .select('card_id, reaction')
  .in('card_id', visibleCardIds)

const { data: favorites } = await supabase
  .from('card_favorites')
  .select('card_id')
  .in('card_id', visibleCardIds)
```

### 5.4 Разделение SSR и клиентских данных

- Карточки, каталог, SEO — рендерятся на сервере (SSR/ISR как сейчас)
- Реакции, избранное, статус авторизации — загружаются на клиенте после гидрации
- SSR-страницы не ломаются и не замедляются

---

## 6. Миграции (SQL)

| № | Файл | Содержимое |
|---|------|-----------|
| 121 | `121_landing_users.sql` | Таблица `landing_users` + trigger на `auth.users` |
| 122 | `122_card_reactions.sql` | Таблица `card_reactions` + RLS + trigger для counts + колонки `likes_count`/`dislikes_count` в `prompt_cards` |
| 123 | `123_card_favorites.sql` | Таблица `card_favorites` + RLS |

---

## 7. Этапы реализации

| Этап | Что делаем | Результат |
|------|-----------|-----------|
| **1** | Supabase Auth + browser client + middleware + Google OAuth | Кнопка "Войти" через Google работает |
| **2** | Таблицы `card_reactions` + `card_favorites` + RLS + triggers | БД готова |
| **3** | UI лайк/дизлайк на `PromptCard` + `CardPageClient` | Раздельные счётчики лайков/дизлайков |
| **4** | UI избранное + страница `/favorites` | Закладки работают |
| **5** | Telegram Login Widget + custom OAuth flow | Вход через Telegram |
| **6** | Yandex OAuth (custom flow) | Вход через Yandex |

---

## 8. Что НЕ делаем

- Связку `landing_users` ↔ `photo_users` (бот) — пока два раздельных контура
- Сортировку по лайкам на листинге — в будущем, будет не единственный признак ранжирования
- Отдельную страницу `/login` — только модалка (SEO-закрыта)
- Rate limiting на реакции — constraint `UNIQUE(user_id, card_id)` достаточен
- Apple OAuth
