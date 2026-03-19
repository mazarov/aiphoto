-- Stores extracted visual style descriptors for "Steal this vibe".
create table if not exists public.vibes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_image_url text not null,
  style jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists vibes_user_id_idx on public.vibes(user_id);
create index if not exists vibes_created_at_idx on public.vibes(created_at desc);

alter table public.vibes enable row level security;

drop policy if exists "vibes_select_own" on public.vibes;
create policy "vibes_select_own"
  on public.vibes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "vibes_insert_own" on public.vibes;
create policy "vibes_insert_own"
  on public.vibes
  for insert
  to authenticated
  with check (auth.uid() = user_id);
