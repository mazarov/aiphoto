# OAuth return: карточка промта остаётся открытой

Ветка: `feature/26-08-auth-return-screen`.
Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md).

## Зачем

После Google/Yandex закрывалась карточка промта и открывался листинг сверху. Первый заход (`24-08`) уводил на listing origin и ждал `AuthReturnScreenRestorer` по cookie/`?ps_auth=1`. Restorer часто не срабатывал:

- GoTrue срывает `redirectTo?next=` и падает на `SITE_URL=/`
- на `/` + `?code=` не было второго `location.replace` с маркером
- overlay жил только в sessionStorage/cookie

Класс: post-OAuth **card overlay must survive**, не «вернуть URL листинга».

## Контракт

- `redirectTo` = `{origin}/auth/callback` без `next` (allowlist-стабильный).
- Destination после PKCE: `path?ps_auth=1&ps_ov=card:<slug>`.
- `/p/slug` без live overlay всё равно overlay `card`. Нет listing origin → остаёмся на `/p/slug`.
- SITE_URL `/?code=` всегда делает `location.replace` с `ps_auth` + `ps_ov`, даже если path уже `/`.
- Restorer читает `ps_ov` из URL первым, потом cookie.

Карточка не дропается ради generate-dock pending.
