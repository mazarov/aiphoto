# OAuth return: сессия видна без F5

Ветка: `feature/23-08-oauth-return-session-hydrate`.
Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md).

## Зачем

После Google/Yandex пользователь возвращается на тот же URL, с которого ушёл. Cookie сессии уже записаны на `/auth/callback`, но `AuthProvider` читал `getUser()` один раз на mount. Браузер часто достаёт исходную страницу из **bfcache** (`pageshow.persisted`): React-state остаётся гостевым, `useEffect` не рестартится. F5 монтирует провайдер заново — «проходит».

Класс: cross-site return → stale client auth, не «OAuth не записал cookie».

## Что сделано

- `finishOAuthCodeExchange` уводит на `next?ps_auth=1` + cookie `ps_auth_done` (60 с), чтобы ключ bfcache не совпал с исходным URL.
- `AuthProvider` — SSOT hydrate: `getSession` (быстрый overlay) → `getUser` (JWT). Сеть к GoTrue упала, cookie живы → UI не гость.
- `pageshow` (`persisted` или живой `ps_auth_done`) и `visibilitychange` при `user === null` перечитывают сессию.
- Маркер сразу снимается `replaceState`. В запомненном `next` `ps_auth` не хранится.

Не в этом заходе: server middleware session refresh, смена ISR листингов, точечные `if` в шапке/доке/ЮKassa.
