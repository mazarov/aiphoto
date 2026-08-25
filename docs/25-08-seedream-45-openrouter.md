# 25-08 — Seedream 4.5 (OpenRouter) для генерации фото

> Дата: 2026-08-25  
> Статус: реализация (код + тесты + `01-landing.md`; флип `enabled` после прокси)  
> Ветка: `feature/25-08-seedream-45-openrouter`  
> Сменяет: `docs/25-08-seedream-45-replicate.md`

## Цель

Тот же пункт пикера **Seedream 4.5**. Worker гоняет ByteDance Seedream 4.5 через **OpenRouter Image API**, все исходящие вызовы — **только через DO-прокси**.

Не путать с Seedream 5.0. Не возвращаться на Replicate в этом релизе.

---

## 1. Context and assumptions

- Image-пайплайн без изменений: `POST /api/generate` → очередь → `processGeneration`.
- Каталог / кредиты / SQL `215` (`seedream-4.5`, cost 10, `enabled:false`) — как есть.
- Gemini→Grok fallback **не меняем**. Seedream не target фолбека.
- Worker в РФ: прямой `openrouter.ai` запрещён.
- Официальный контракт: [Image API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation), модель [`bytedance-seed/seedream-4.5`](https://openrouter.ai/bytedance-seed/seedream-4.5).

### Vendor

| Поле | Значение |
|---|---|
| Model | `bytedance-seed/seedream-4.5` |
| Submit | `POST /api/v1/images` |
| Auth | `Authorization: Bearer $OPENROUTER_API_KEY` |
| Режим | **Синхронный**. Нет job id / poll (в отличие от Replicate и OpenRouter Video) |
| Output | `data[].b64_json` (предпочтительно); `url` только host `openrouter.ai` |
| `n` | всегда `1` |
| `output_format` | `png` |
| `resolution` | `2K` \| `4K` (1K клампим в 2K) |
| `aspect_ratio` | наш allowlist |
| `input_references` | signed HTTP URL, не data URI, не `/u/` |
| Цена | **$0.04 / image** (list). Конкретный upstream у OpenRouter может отличаться |

Продукт: UI, 10 кредитов, дефолт пикера, 4K разрешён — без изменений.

### NFR (как у Replicate-спеки)

Image RPS ≪ 1; `WORKER_CONCURRENCY=10` не поднимаем; p95 2K < 90 с, 4K < 150 с; hard cap POST **180 с**.

---

## 2. Прокси DigitalOcean

```text
OPENROUTER_API_KEY=...          # только env
OPENROUTER_BASE_URL={GEMINI_PROXY_ORIGIN}/u/openrouter.ai
```

`GEMINI_PROXY_BASE_URL` не подменять.

```text
{OPENROUTER_BASE_URL}/api/v1/images
  → https://openrouter.ai/api/v1/images
```

Allowlist `/u/`: добавить **`openrouter.ai`**. `proxy_read_timeout` / `proxy_send_timeout` для этого host **≥ 180s** — иначе nginx оборвёт sync generation.

Референсы **не** через `/u/`: OpenRouter качает signed Storage URL из US.

Пустой base / нет `/u/` / нет ключа → `config_error`, без прямого `openrouter.ai`.

Старые host Replicate в nginx можно оставить — продукту больше не нужны.

---

## 3. Target architecture

```
processGeneration
  grok-imagine-image*  → xai-image
  seedream-*           → openrouter-seedream.ts
  иначе                → Gemini → eligible fail → Grok
```

SSOT: `SEEDREAM_45_IMAGE_MODEL = "seedream-4.5"`, `SEEDREAM_45_OPENROUTER_MODEL = "bytedance-seed/seedream-4.5"`.

1. Промпт — те же `assembleSeedreamImage*`, clamp 4000.
2. Size: `1K→2K` + лог `seedream_size_clamped`.
3. Референсы: signed URL 15 мин, clamp 10.
4. Один sync POST, timeout 180 с. Heartbeat lease каждые 25 с, пока висит POST.
5. 401/402 → `config_error` (ключ / баланс OpenRouter), без retry.
6. 429/5xx/524/сеть → retryable, circuit как Grok image.
7. Safety → `safety_block`.
8. `provider_operation_id` пишется **после** успеха (`openrouter:{created}`) только для аудита. Persist fail **не** валит job и **не** ретраит POST.
9. Resume: Image API не отдаёт poll. Рестарт mid-POST = новый POST (как Grok image). OpenRouter: failed/cancelled generation клиенту не биллится; completed — целиком.

Не делать: webhook, Idempotency-Key (у Image API нет), pin `provider.only`, второй микросервис.

---

## 4. Scaling / reliability / security

Первым ломается слот image-воркера на 4K (слот до 180 с) и nginx timeout. Двойной POST при рестарте mid-request — тот же класс, что у Grok, не P0 Replicate-poll.

Circuit open → job `provider_error`, без тихой подмены на Gemini/Grok.

Секреты только env. В логах `proxyHost`, не Bearer и не signed URL. SSRF: качать URL только `openrouter.ai` через `/u/`. Иной host → не fetch.

---

## 5. Выкат

1. DO: allowlist `openrouter.ai`, timeout ≥ 180s, `nginx -t && reload`.
2. Worker env: `OPENROUTER_*`. `REPLICATE_*` больше не читаются.
3. Код + тесты + `01-landing.md` — один delivery unit.
4. SQL `215` уже `enabled:false`. Не править.
5. Смоук: text-only 2K; 1 фото 9:16; 4K; prefs 1K → 2K; 402 без retry.
6. Флип `enabled:true` после зелёного смоука.

Смоук прокси с DO:

```bash
curl -sS -o /dev/null -w "%{http_code}" \
  "$OPENROUTER_BASE_URL/api/v1/images/models"
```

Ожидаем не 403 и не таймаут в обход `/u/`.

Откат: `enabled:false` у `seedream-4.5`.
