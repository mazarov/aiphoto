# 27-08 — Seedance 2.5 (OpenRouter) для «Оживить»

> Дата: 2026-08-27
> Статус: реализация (код + тесты + `01-landing.md`; флип `enabled` после смоука)
> Ветка: `feature/27-08-seedance-25-openrouter`

## Цель

Четвёртая video-модель в том же durable job «Оживить». ByteDance Seedance 2.5 через **OpenRouter Video API**, все исходящие вызовы — **только через DO-прокси**.

Не менять дефолт пикера (Veo 3.1 Lite). Не делать Seedance target video-fallback.

---

## 1. Context and assumptions

- Video-пайплайн без изменений: `POST /api/generate?modality=video` → очередь → `processVideoGeneration`.
- Env worker уже есть для Seedream image: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL={GEMINI_PROXY_ORIGIN}/u/openrouter.ai`. Нового env нет.
- Официальный контракт: [Video API](https://openrouter.ai/docs/guides/overview/multimodal/video-generation), модель [`bytedance/seedance-2.5`](https://openrouter.ai/bytedance/seedance-2.5).
- I2V: одно фото как `frame_images[first_frame]`. Text-to-video, last_frame, 480p, 5с и 11–30с — не в релизе.
- Кредиты: **24 / сек** (4=96, 5=120, 6=144, 8=192, 10=240). Пикер остаётся 4/6/8/10.
- Аудио: `generate_audio=true`.
- 1 кр. = 0,5 ₽. COGS OpenRouter ≈ $0.10 / сек; 4с ≈ $0.41 vs 96 кр = 48 ₽.

### Vendor

| Поле | Значение |
|---|---|
| Product id | `seedance-2.5` |
| Vendor | `bytedance/seedance-2.5` |
| Submit | `POST /api/v1/videos` |
| Poll | `GET /api/v1/videos/{id}` |
| Download | `GET /api/v1/videos/{id}/content` |
| Auth | `Authorization: Bearer $OPENROUTER_API_KEY` |
| Режим | **Асинхронный**. Persist id до poll (как Grok video) |
| Кадр | 9:16 / 16:9 |
| Длительность | 4 / 6 / 8 / 10 сек |
| Разрешение | 720p |
| Аудио | да |

Пустой base / нет `/u/` / нет ключа → `config_error`, без прямого `openrouter.ai`.

---

## 2. Target architecture

```
POST /api/generate  modality=video  model=seedance-2.5
  credits = duration × 24
        │
        ▼
processVideoGeneration
  seedance-*  → openrouter-seedance.ts
     POST {OPENROUTER_BASE_URL}/api/v1/videos
     persist provider_operation_id
     poll GET .../videos/{id}
     GET .../videos/{id}/content
  grok / veo / omni — как сейчас
```

| Слой | Что |
|---|---|
| SSOT | `SEEDANCE_25_VIDEO_MODEL`, `SEEDANCE_25_OPENROUTER_MODEL`, `SEEDANCE_25_CREDIT_COST_PER_SECOND = 24` |
| Цена | `calculateVideoCreditCost` для Seedance = `duration × 24` |
| Worker | submit → persist id → poll → download. Resume без второго POST |
| Circuit | отдельный `seedanceVideoCircuit` 20/8/50%/60с (не общий с Seedream image) |
| Config | SQL `220`: append в `video_models`, `enabled:false`, `cost:96` |

Не делать: webhook, text-to-video, video extend, фолбек Seedance↔Grok.

---

## 3. Scaling and bottlenecks

1. **Video-слот** (cap 2 / global 8) на время poll. Не поднимать cap.
2. **Двойной POST** если persist id упал после 202. Порядок как у Grok: POST → сразу RPC → poll.
3. **Чужой CDN в `unsigned_urls`.** Download только `/content` по job id через `/u/openrouter.ai`.

---

## 4. Reliability and SLOs

| Сигнал | Цель |
|---|---|
| Submit → id persist | до poll |
| p95 4с / 10с | < 180 с / < 360 с; hard timeout 480 с |
| 401/402 | `config_error`, без retry |
| 429/5xx/сеть | retryable + circuit |
| safety / expired | terminal + refund |

Логи: `video_submit` / `video_resume` / `video_result_uploaded` / `seedance_circuit_open` + `provider=openrouter`, `proxyHost`. Без prompt/base64/полного URL.

Откат без деплоя: `enabled:false` у `seedance-2.5`.

---

## 5. Security

- Секреты только env.
- Референс кадра — signed Storage URL 15 мин, не `/u/`.
- Download только host `openrouter.ai` через прокси.

---

## 6. Выкат

1. Worker + landing (этот коммит). Env OpenRouter уже должен быть.
2. SQL `220` (`enabled:false`).
3. Смоук allowlist: 4с/10с, 9:16/16:9, resume, 402 без retry.
4. Флип `enabled:true`.

```sql
UPDATE landing_generation_config
SET value = replace(value, '"id":"seedance-2.5","label":"Seedance 2.5","cost":96,"enabled":false',
                           '"id":"seedance-2.5","label":"Seedance 2.5","cost":96,"enabled":true'),
    updated_at = now()
WHERE key = 'video_models';
```

Лучше jsonb-merge, как в `220`, с `'enabled', true`.

### Checklist реализации

- [x] Ветка `feature/27-08-seedance-25-openrouter` от `origin/main`
- [x] SSOT id / 24 кр/сек / `calculateVideoCreditCost`
- [x] `openrouter-seedance.ts` + router в `processVideoGeneration`
- [x] Circuit, persist id, download `/content`
- [x] SQL `220` `enabled:false`
- [x] `01-landing.md` в том же коммите
- [ ] Смоук 4с/10с + resume + 402
- [ ] Флип `enabled:true`
