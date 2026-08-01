-- Client attribution for web image generations (PromptShot site-only for now).
-- Apply in Supabase SQL Editor before deploying code that writes client_source.
alter table public.landing_generations
  add column if not exists client_source text;

comment on column public.landing_generations.client_source is
  'Normalized client. Currently always site for PromptShot paid generate.';

create index if not exists landing_generations_client_source_idx
  on public.landing_generations (client_source);

create index if not exists landing_generations_created_at_idx
  on public.landing_generations (created_at);
