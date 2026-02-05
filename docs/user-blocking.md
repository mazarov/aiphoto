# Блокировка пользователей

## Цель

Возможность блокировать пользователей за подозрительную активность (фрод, злоупотребление).

## База данных

### Миграция

```sql
-- sql/029_user_blocking.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked) WHERE is_blocked = true;
```

### Блокировка пользователя

```sql
UPDATE users 
SET is_blocked = true, 
    blocked_at = now(), 
    block_reason = 'Причина блокировки'
WHERE username = 'username_here';
-- или WHERE telegram_id = 123456789;
```

### Разблокировка

```sql
UPDATE users 
SET is_blocked = false, 
    blocked_at = null, 
    block_reason = null
WHERE username = 'username_here';
```

## Код

### Проверка в index.ts

Добавить проверку после `getUser()`:

```typescript
// После получения user
if (user?.is_blocked) {
  await ctx.reply("⛔ Ваш аккаунт заблокирован. Обратитесь в поддержку: /support");
  return;
}
```

### Места для проверки

1. `/start` — при старте бота
2. Обработчик фото — при отправке фото на генерацию
3. `pre_checkout_query` — при попытке оплаты (опционально)

## Логирование

При блокировке отправлять алерт:

```typescript
await sendAlert({
  type: "user_blocked",
  message: `User blocked: @${username}`,
  details: { userId, reason }
});
```

## Чеклист

- [ ] Выполнить миграцию `sql/029_user_blocking.sql`
- [ ] Добавить проверку `is_blocked` в `/start`
- [ ] Добавить проверку `is_blocked` в обработчик фото
- [ ] Задеплоить бота
- [ ] Заблокировать подозрительного пользователя

## Подозрительный кейс

**Пользователь:** AlsoPfizikDoter  
**Проблема:** 3 кредита при 1 транзакции на 1 кредит  
**Статус:** Требует расследования

```sql
-- Заблокировать
UPDATE users 
SET is_blocked = true, 
    blocked_at = now(), 
    block_reason = 'Suspicious credits: 3 credits with 1 transaction for 1 credit'
WHERE username = 'AlsoPfizikDoter';
```
