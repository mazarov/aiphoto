# PromptShot: admin analytics, analyze history, rate limits

> Дата: 2026-08-08  
> Ветка: `feature/08-08-promptshot-admin-analytics`
> Последнее обновление: 2026-08-10

## Цель

Перенести серверный analyze-flow для `/foto-v-promt` на PromptShot и подготовить общую БД для
аналитики, истории успешных распознаваний и admin-очереди публикации. Extension Lite продолжает
использовать `imageprompt.tools`.

## Phase 1 — данные и безопасность

- [x] Одна идемпотентная миграция `175_promptshot_admin_analytics.sql`.
- [x] Переиспользовать существующие `landing_generations.client_source` (168) и durable queue (170).
- [x] Добавить server/client analytics facts и представления только по разрешённым запросам.
- [x] Добавить rate-limit buckets с атомарным reserve → confirm/release и merge IP → shared user.
- [x] Добавить приватную 30-дневную analyze history и связь с `prompt_cards`.
- [x] Добавить RPC admin generation queue без изменения существующих данных.
- [x] Закрыть RPC от `PUBLIC`, `anon`, `authenticated`; разрешить только `service_role`.
- [x] Не создавать DB login/password в миграции; доступ admin UI ограничивается email allowlist.

## Phase 2 — PromptShot analyze API

- [x] `POST /api/extension/analyze`: JSON/data URL/URL validation, MIME sniffing, 10 MB limit.
- [x] Защита URL fetch от localhost/private/link-local/metadata targets и redirect re-validation.
- [x] Gemini proxy/direct routing, timeout, sanitized diagnostics and correlation logs.
- [x] Rate-limit preflight/reserve/confirm/release; failed upstream calls do not spend quota.
- [x] Server analytics event for every rate-limit-resolved outcome.
- [x] On success: inferred image settings and fire-and-forget private analyze history.
- [x] Auth identity maps Supabase `auth.users` to shared `imageprompt_users`.
- [x] PromptShot widget always calls same-origin `/api/extension/analyze`.
- [x] Remix remains external; Extension Lite code and endpoint are unchanged.
- [x] Document required runtime env without secrets.

## Phase 3 — admin analytics и analyze history

- [x] Добавить `/admin/analytics` с server-side Supabase Auth gate и email allowlist из
  `ANALYTICS_ADMIN_EMAILS`.
- [x] Добавить `/admin/analyze-history` с cursor pagination, фильтром `client_source`,
  приватными signed URL и no-store ответами.
- [x] Добавить защищённые `/api/admin/analytics`, `/api/admin/analyze-history` и
  `/api/admin/analyze-history/[id]/publish`.
- [x] Хранить только успешные analyze-результаты в приватном bucket `analyze-history`;
  retention — 30 дней, opportunistic cleanup не блокирует чтение admin UI.
- [x] Публиковать запись истории идемпотентно: private image → public result object →
  draft `prompt_cards` → общий SEO tagging/readiness → `is_published=true`.

## Phase 4 — durable admin generations

- [x] Добавить admin-форму с закреплённым reference photo, prompt, model, aspect ratio,
  image size и batch `1…4`.
- [x] Добавить защищённые `/api/admin/generation-photo`, `/api/admin/generate`,
  `/api/admin/generations`, `/api/admin/generations/[id]` и
  `/api/admin/generations/[id]/publish`.
- [x] Ставить admin jobs в существующую durable worker queue через
  `landing_enqueue_generation`, `client_source='admin'`, idempotency key/fingerprint и
  `credits_spent=0`; HTTP-request не выполняет генерацию синхронно.
- [x] Показывать cursor-paginated очередь и polling статусов `pending` / `processing` /
  `completed` / `failed`.
- [x] Публиковать completed generation через существующий `prompt_cards` и общий SEO
  publish service; повторная публикация возвращает успешный идемпотентный результат.

## Phase 5 — YooKassa operations и генерации пользователей

- [x] Добавить `/admin/payments` и `/api/admin/payments`: cursor-реестр
  `landing_yookassa_payments` с payer auth/billing identity, RUB, plan, local/provider
  status, test flag, ожидаемыми credits и фактическим `credited_at`.
- [x] Не считать `status='succeeded'` достаточным доказательством начисления:
  `credited_at IS NULL` отображается как discrepancy для операционной проверки.
- [x] Добавить вкладку «Генерации других пользователей» для всех
  `landing_generations.client_source != 'admin'` и статусов `pending` / `processing` /
  `completed` / `failed`.
- [x] Выдавать private input previews только через batch signed URL с коротким TTL;
  raw storage paths не возвращать в browser response.
- [x] Разрешить admin-публикацию только completed generation с явным
  `requester_auth_user_id`; исходный пользователь остаётся автором UGC-карточки.
- [x] Миграция `178_admin_payments_user_generations.sql`: service-role-only cursor RPC
  и индексы без изменения существующих payment/generation строк.

## Identity и границы миграции

- Admin pages и все `/api/admin/*` требуют валидную Supabase Auth session и email из
  `ANALYTICS_ADMIN_EMAILS`; пустой allowlist закрывает доступ.
- В общей БД `auth.users.id` — JWT/requester identity и автор публикуемой карточки, а
  `imageprompt_users.id` — shared profile/billing identity для
  `landing_generations.user_id`. Эти UUID могут различаться; admin enqueue резолвит оба
  значения и не подменяет одно другим.
- Сайт `/foto-v-promt` вызывает same-origin `POST /api/extension/analyze`. Route
  атомарно резервирует квоту до upstream-вызова, подтверждает reservation только после
  успеха и освобождает её при timeout/error; поэтому параллельные запросы учитывают
  `count + pending`, а неуспешный upstream не расходует дневной лимит.
- Extension Lite и prompt remix остаются на `imageprompt.tools`; их endpoint и
  клиентский flow этой миграцией не переносились.

## Data flow

```text
/foto-v-promt
  → same-origin POST /api/extension/analyze
  → Supabase Auth (optional) → shared imageprompt_users identity (when authenticated)
  → reserve rate-limit bucket
  → Gemini proxy/direct
  ├─ success → confirm → analytics event → private analyze_history (30 days)
  └─ error   → release → sanitized error analytics

/admin/analyze-history
  → Supabase Auth + ANALYTICS_ADMIN_EMAILS
  → signed private preview
  → publish → prompt_cards draft → SEO tags/readiness → public card

/admin/analytics
  → Supabase Auth + ANALYTICS_ADMIN_EMAILS
  → server-side analytics rollups

/admin/analytics generation modal
  → /api/admin/generate → landing_enqueue_generation
  → durable web-generation-worker → landing_generations
  → /api/admin/generations queue/poll
  → publish → prompt_cards → SEO tags/readiness → public card

/admin/payments
  → admin_yookassa_payments (service role)
  → payer identity + payment state + credited_at

/admin/analyze-history → Генерации других пользователей
  → admin_user_generations_queue (service role)
  → signed private source previews + public result
  → completed publish → original requester author → public card
```

## Cutover и rollback

- Cutover после деплоя: site widget использует только same-origin
  `/api/extension/analyze`; Remix и Extension Lite продолжают обращаться к
  `imageprompt.tools`.
- Rollback без изменения данных: вернуть resolver URL site analyze на
  `NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN` / `imageprompt.tools/api/extension/analyze` и
  передеплоить landing. Таблицы миграции аддитивные; их не нужно удалять для отката
  трафика. Перед переключением проверить CORS на imageprompt origin.
- На момент обновления документа rollback/cutover в production не выполнялся.

## Tests

- [x] 13 targeted tests passed: admin allowlist matching, analyze/admin cursors and
  limits, publication-status resolution, rate-limit IP/day/hash/effective usage,
  admin generation model selection and enqueue idempotency/fingerprints.
- [x] 7 targeted admin read-model tests passed: cursor/limit/publication regression,
  YooKassa status/test filters and credit discrepancy, user-generation
  status/source/publication filters and error sanitization.
- [ ] Применить `sql/175_promptshot_admin_analytics.sql` в целевой Supabase.
- [ ] Применить `sql/178_admin_payments_user_generations.sql` после `176`/`177`.
- [ ] Задать `ANALYTICS_ADMIN_EMAILS` и остальные runtime env в целевом окружении.
- [ ] Выполнить production deploy/cutover.
- [ ] Провести post-deploy smoke `/foto-v-promt`, `/admin/analytics`,
  `/admin/analyze-history`, `/admin/payments`, user-generation publication и admin
  generation publication.

## Acceptance checks

- Invalid/multiple image inputs return 400 before Gemini.
- Private or metadata URL (including redirects) is rejected.
- Concurrent requests cannot exceed `count + pending < max`.
- Success increments `count`; timeout/error releases `pending`.
- Analytics rollups exclude `allowed = false`; outcome view retains rate-limited/error facts.
- Authenticated rows use a FK-valid shared user ID; anonymous rows use daily salted IP hashes.
- Successful response contains `prompt`, optional `imageSettings`, and quota fields.
- Migration is safe to rerun and does not drop tables or data.
