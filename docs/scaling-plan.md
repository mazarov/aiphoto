# Scaling Plan — Требования к масштабированию

## Текущая архитектура

- **API** (Telegraf + webhook) — обрабатывает входящие сообщения, пишет в Supabase
- **Worker** — polling `jobs` таблицы, выполняет генерацию (1 job за раз)
- **Очередь** — фактически polling по `jobs` в БД
- **Внешние API** — Gemini, Pixian, Telegram

---

## Узкие места

### 1. Worker = узкое горлышко
Сейчас worker берёт **1 job за раз**.

| Одновременных пользователей | Статус | Проблемы |
|-----------------------------|--------|----------|
| 10 | ОК | Небольшие задержки |
| 100 | Проблемы | Очередь на минуты/десятки минут |
| 1000 | Критично | Очередь на часы/сутки |

### 2. Внешние API — лимиты
- **Gemini**: rate limits + latency, throttling/429
- **Pixian**: rate limits + стоимость
- **Telegram**: лимиты на `sendSticker`, `editMessageText`

### 3. Supabase + polling
- Постоянный polling (`jobPollIntervalMs=2000`) = лишняя нагрузка
- При N workers — contention/lock issues

### 4. Хранение / storage
- Нагрузка на Supabase Storage при массовой генерации
- Нужен cleanup/retention для старых файлов

### 5. Стоимость
- Gemini + Pixian на каждый стикер = заметные расходы

---

## Риски

### 1. Потеря контекста при падении worker
Jobs остаются в `processing`, возможны зависшие задачи.

### 2. Проблемы с кредитами
Если worker падает между списанием и update → потери/двойные списания.

### 3. Нет реальной очереди
Нет гарантированной конкуренции, retry, TTL, параллельности.

---

## План улучшений

### Этап 1: MVP (до 50-100 пользователей)
- [ ] Параллельный worker (3-5 инстансов)
- [ ] `SELECT ... FOR UPDATE SKIP LOCKED` для jobs
- [ ] Retry с exponential backoff
- [ ] Timeout для зависших jobs (>5 мин → error)
- [ ] Лимит 1 активный job на пользователя

### Этап 2: Рост (100-500 пользователей)
- [ ] Перейти на очередь (Redis / Supabase Queue / SQS)
- [ ] Rate limiting по пользователю (N генераций/мин)
- [ ] Priority queue (платные пользователи выше)
- [ ] Health checks и алерты
- [ ] Cleanup старых файлов в Storage

### Этап 3: Масштаб (1000+ пользователей)
- [ ] Horizontal scaling workers (auto-scale)
- [ ] CDN для Storage
- [ ] Кэширование стилей/эмоций
- [ ] Fallback при недоступности Gemini/Pixian
- [ ] Мониторинг и метрики (latency, queue depth, errors)
- [ ] Шардирование по регионам (опционально)

---

## Технические изменения

### 1. Параллельный worker

```typescript
// Вместо одного job за раз — несколько параллельно
const WORKER_CONCURRENCY = 3;

async function poll() {
  const activeJobs = new Set();
  
  while (true) {
    if (activeJobs.size >= WORKER_CONCURRENCY) {
      await sleep(500);
      continue;
    }
    
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    
    if (!job) {
      await sleep(config.jobPollIntervalMs);
      continue;
    }
    
    // Atomic claim with SKIP LOCKED
    const { data: claimed } = await supabase.rpc("claim_job", { job_id: job.id });
    if (!claimed) continue;
    
    activeJobs.add(job.id);
    runJob(job)
      .catch(console.error)
      .finally(() => activeJobs.delete(job.id));
  }
}
```

### 2. SQL функция для atomic claim

```sql
CREATE OR REPLACE FUNCTION claim_job(job_id uuid)
RETURNS boolean AS $$
DECLARE
  claimed boolean;
BEGIN
  UPDATE jobs 
  SET status = 'processing', started_at = now()
  WHERE id = job_id AND status = 'queued';
  
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$ LANGUAGE plpgsql;
```

### 3. Timeout для зависших jobs

```sql
-- Cron job или периодическая проверка
UPDATE jobs
SET status = 'error', error = 'Timeout: job exceeded 5 minutes'
WHERE status = 'processing'
  AND started_at < now() - interval '5 minutes';
```

### 4. Rate limiting

```typescript
async function checkRateLimit(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60000).toISOString());
  
  return (count || 0) < MAX_JOBS_PER_MINUTE;
}
```

---

## Метрики для мониторинга

| Метрика | Описание | Алерт |
|---------|----------|-------|
| `queue_depth` | Количество jobs в очереди | > 50 |
| `avg_processing_time` | Среднее время генерации | > 60s |
| `error_rate` | % ошибок | > 5% |
| `api_latency_gemini` | Latency Gemini API | > 30s |
| `api_latency_pixian` | Latency Pixian API | > 10s |
| `storage_size` | Размер Storage | > 10GB |

---

## Приоритеты

1. **Сейчас**: Параллельный worker + timeout + retry
2. **При росте**: Rate limiting + очередь
3. **Масштаб**: Auto-scale + мониторинг

---

## Чеклист реализации (Этап 1)

- [ ] Добавить `started_at` в таблицу `jobs`
- [ ] Создать SQL функцию `claim_job`
- [ ] Реализовать параллельный polling в worker
- [ ] Добавить retry с backoff (max 3 attempts)
- [ ] Добавить timeout для зависших jobs
- [ ] Ограничить 1 активный job на пользователя
- [ ] Тестирование под нагрузкой
