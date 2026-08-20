# 20-08 — Grok Imagine Video 1.5

> Дата: 2026-08-20
> Статус: код готов; выкат: DO `/u/` + worker env → worker → landing → SQL 201
> Ветка: `feature/20-08-grok-imagine-video`

## Цель

Вторую video-модель в том же durable job «Оживить». Дефолт — Grok 1.5, Veo Omni Flash остаётся в пикере.

## Контракт

| Параметр | Значение |
|---|---|
| Модель API | `grok-imagine-video-1.5` |
| UI | Grok 1.5 (дефолт), Veo Omni Flash |
| Кадр | 9:16 / 16:9 |
| Длительность | 4 / 6 / 8 / 10 сек |
| Разрешение | 720p |
| Кредиты | база 30 + 0/10/20/30, как у Omni |
| Источник | одно фото (parent image XOR upload) |
| Провайдер | xAI `POST /v1/videos/generations` → poll `GET /v1/videos/{id}` |

`GEMINI_PROXY_BASE_URL` не подменять и не слать на xAI. Пустой `XAI_BASE_URL` — `config_error`, без fallback на `api.x.ai`.

Себестоимость xAI: **$0.080 / сек** ([pricing](https://docs.x.ai/developers/pricing)).

## Прокси (тот же Gemini-vhost)

`location /` не трогаем — Gemini как был. На том же сертификате добавляем allowlist-шлюз:

```text
https://<GEMINI_PROXY_HOST>/u/api.x.ai/v1/videos/generations
  → https://api.x.ai/v1/videos/generations
```

Allowlist: `api.x.ai`, `api.openai.com`, `generativelanguage.googleapis.com`, `oauth2.googleapis.com`, `bigquery.googleapis.com`. Чужой host под `/u/` → 403. `resolver … ipv6=off` обязателен.

Env worker (origin = тот же, что у `GEMINI_PROXY_BASE_URL`):

```text
XAI_API_KEY=...
XAI_BASE_URL=https://<GEMINI_PROXY_HOST>/u/api.x.ai
```

Новый поддомен `xai-proxy.*` не нужен.

## Выкат

1. Вставить `location /u/` на существующий gemini-proxy, `nginx -t && reload`
2. `XAI_*` на worker, рестарт. `GEMINI_PROXY_BASE_URL` не менять
3. Worker + landing
4. SQL `201` (после прокси и worker env, иначе дефолт Grok упадёт)
5. Смоук allowlist: 4с/10с, 9:16/16:9, resume, fail/refund

Откат: `default_video_model` → `gemini-omni-flash-preview` и/или `enabled:false` у Grok.

## Не в релизе

1080p, 15 сек, text-to-video, video extend.
