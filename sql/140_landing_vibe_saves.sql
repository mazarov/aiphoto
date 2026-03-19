create table if not exists public.landing_vibe_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vibe_id uuid references public.vibes(id) on delete set null,
  generation_id uuid not null unique references public.landing_generations(id) on delete cascade,
  prompt_text text not null,
  accent text not null check (accent in ('lighting', 'mood', 'composition')),
  card_id uuid references public.prompt_cards(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_landing_vibe_saves_user_id
  on public.landing_vibe_saves(user_id, created_at desc);

create index if not exists idx_landing_vibe_saves_vibe_id
  on public.landing_vibe_saves(vibe_id);

alter table public.landing_vibe_saves enable row level security;

drop policy if exists "landing_vibe_saves_select_own" on public.landing_vibe_saves;
create policy "landing_vibe_saves_select_own"
  on public.landing_vibe_saves
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "landing_vibe_saves_insert_own" on public.landing_vibe_saves;
create policy "landing_vibe_saves_insert_own"
  on public.landing_vibe_saves
  for insert
  to authenticated
  with check (auth.uid() = user_id);
