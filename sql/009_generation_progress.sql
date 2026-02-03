-- Generation progress message tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS progress_message_id bigint;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS progress_chat_id bigint;

-- Progress texts
INSERT INTO bot_texts_new (lang, key, text) VALUES
  ('ru', 'progress.generating_image', '✨ Генерирую изображение... (1/3)'),
  ('en', 'progress.generating_image', '✨ Generating image... (1/3)'),
  ('ru', 'progress.removing_bg', '🎨 Удаляю фон... (2/3)'),
  ('en', 'progress.removing_bg', '🎨 Removing background... (2/3)'),
  ('ru', 'progress.preparing', '📦 Подготавливаю стикер... (3/3)'),
  ('en', 'progress.preparing', '📦 Preparing sticker... (3/3)')
ON CONFLICT (lang, key) DO UPDATE SET
  text = EXCLUDED.text,
  updated_at = now();
