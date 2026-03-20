  alter table public.landing_vibe_saves
    add column if not exists auto_seo_tags jsonb not null default '{}'::jsonb;

  create index if not exists idx_landing_vibe_saves_auto_seo_tags
    on public.landing_vibe_saves using gin(auto_seo_tags);
