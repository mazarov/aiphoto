alter table public.landing_generations
  add column if not exists vibe_id uuid references public.vibes(id) on delete set null;

create index if not exists idx_landing_gen_vibe_id
  on public.landing_generations(vibe_id);
