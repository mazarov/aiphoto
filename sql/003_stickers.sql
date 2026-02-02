create table if not exists stickers (
  id uuid primary key default gen_random_uuid(),
  sticker_set_id uuid not null,
  telegram_file_id text,
  file_url text,
  created_at timestamp with time zone default now()
);

create index if not exists stickers_set_idx on stickers (sticker_set_id);
