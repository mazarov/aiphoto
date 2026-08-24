# OAuth return: тот же листинг / карточка / экран

Ветка: `feature/24-08-auth-return-screen`.
Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md).

## Зачем

После Google/Yandex на desktop/mobile пользователь оказывался на `/`. Два класса:

1. **Потерянный `next`.** `ps_auth_next` писали, но не читали. sessionStorage часто пуст после cross-site IdP (Safari / ITP). GoTrue тогда падает на `SITE_URL` = `/`.
2. **Оверлей ≠ страница.** Карточка / pricing / foto-v-promt живут как `pushState` над листингом. `window.location` уже `/p/slug`. Hard `location.replace(/p/slug)` снимает листинг; закрытие карточки уводит на главную.

Класс: post-OAuth return screen, не «OAuth не записал cookie».

## Контракт

SSOT — экран, не только URL:

| Было | `path` (`?next=` + cookie) | overlay (`ps_auth_ov`) |
|---|---|---|
| Листинг | тот же listing + query | нет |
| Карточка поверх листинга | listing origin | `card:<slug>` |
| Hard `/p/slug` | `/p/slug` | нет |
| Pricing / foto-v-promt overlay | listing origin | `pricing` / `foto-v-promt` |
| Generate с карточки | listing origin | нет (dock pending) |

После PKCE: `location.replace(path?ps_auth=1)` → `AuthReturnScreenRestorer` открывает overlay. Скролл листинга не сбрасывается в 0.

Не в этом заходе: persist страниц infinite scroll (после глубокого load-more первая страница может быть ниже сохранённого Y).
