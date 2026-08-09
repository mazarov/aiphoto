-- PromptShot analyze analytics, quota reservations, history, and admin queues.
-- Consolidates the relevant imageprompt 14-01..14-12 schema for the shared DB.
-- Idempotent/additive: migrations 168 (client_source) and 170 (generation queue)
-- already own those base columns and are intentionally not duplicated here.

-- ---------------------------------------------------------------------------
-- Analyze/remix rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.extension_rate_limit (
  ip_hash       text primary key,
  window_start  timestamptz not null,
  count         integer not null default 0,
  pending       integer not null default 0
);

alter table public.extension_rate_limit
  add column if not exists pending integer not null default 0;

create index if not exists extension_rate_limit_window_idx
  on public.extension_rate_limit (window_start);

create table if not exists public.extension_rate_limit_identity_merge (
  user_id       uuid not null references public.imageprompt_users (id) on delete cascade,
  ip_hash       text not null,
  window_start  timestamptz not null,
  merged_count  integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, ip_hash, window_start)
);

create index if not exists extension_rate_limit_identity_merge_window_idx
  on public.extension_rate_limit_identity_merge (window_start);

-- Kept for compatibility with older callers; the new analyze route uses
-- reserve/confirm/release below.
create or replace function public.extension_rate_limit_increment_if_allowed(
  p_ip_hash text,
  p_window_start timestamptz,
  p_max_count integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window timestamptz;
begin
  insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
  values (p_ip_hash, p_window_start, 0, 0)
  on conflict (ip_hash) do nothing;

  select count, window_start into v_count, v_window
  from public.extension_rate_limit
  where ip_hash = p_ip_hash
  for update;

  if v_window < p_window_start then
    update public.extension_rate_limit
    set window_start = p_window_start, count = 1, pending = 0
    where ip_hash = p_ip_hash;
    return jsonb_build_object('allowed', true, 'count', 1);
  end if;

  if v_count >= greatest(p_max_count, 1) then
    return jsonb_build_object('allowed', false, 'count', v_count);
  end if;

  update public.extension_rate_limit
  set count = count + 1
  where ip_hash = p_ip_hash
  returning count into v_count;

  return jsonb_build_object('allowed', true, 'count', v_count);
end;
$$;

create or replace function public.extension_rate_limit_check_and_increment(
  p_ip_hash text,
  p_window_start timestamptz,
  p_max_count integer default 30
) returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.extension_rate_limit_increment_if_allowed(
    p_ip_hash, p_window_start, p_max_count
  );
$$;

create or replace function public.extension_rate_limit_merge_ip_to_user(
  p_user_id uuid,
  p_ip_hash text,
  p_window_start timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_bucket text := 'user:' || p_user_id::text;
  v_ip_count integer := 0;
  v_prev_merged integer := 0;
  v_delta integer := 0;
  v_user_count integer := 0;
begin
  insert into public.extension_rate_limit_identity_merge (
    user_id, ip_hash, window_start, merged_count
  ) values (p_user_id, p_ip_hash, p_window_start, 0)
  on conflict (user_id, ip_hash, window_start) do nothing;

  select merged_count into v_prev_merged
  from public.extension_rate_limit_identity_merge
  where user_id = p_user_id
    and ip_hash = p_ip_hash
    and window_start = p_window_start
  for update;

  select count into v_ip_count
  from public.extension_rate_limit
  where ip_hash = p_ip_hash
    and window_start = p_window_start;

  v_ip_count := coalesce(v_ip_count, 0);
  v_prev_merged := coalesce(v_prev_merged, 0);
  v_delta := greatest(v_ip_count - v_prev_merged, 0);

  if v_delta > 0 then
    insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
    values (v_user_bucket, p_window_start, v_delta, 0)
    on conflict (ip_hash) do update
      set count = case
            when extension_rate_limit.window_start < p_window_start then v_delta
            else extension_rate_limit.count + v_delta
          end,
          pending = case
            when extension_rate_limit.window_start < p_window_start then 0
            else extension_rate_limit.pending
          end,
          window_start = greatest(extension_rate_limit.window_start, p_window_start);
  end if;

  update public.extension_rate_limit_identity_merge
  set merged_count = greatest(merged_count, v_ip_count),
      updated_at = now()
  where user_id = p_user_id
    and ip_hash = p_ip_hash
    and window_start = p_window_start;

  select count into v_user_count
  from public.extension_rate_limit
  where ip_hash = v_user_bucket
    and window_start = p_window_start;

  return jsonb_build_object(
    'merged_delta', v_delta,
    'ip_count', v_ip_count,
    'user_count', coalesce(v_user_count, 0)
  );
end;
$$;

create or replace function public.extension_rate_limit_reserve_if_allowed(
  p_ip_hash text,
  p_window_start timestamptz,
  p_max_count integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_pending integer;
  v_window timestamptz;
begin
  insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
  values (p_ip_hash, p_window_start, 0, 0)
  on conflict (ip_hash) do nothing;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = p_ip_hash
  for update;

  if v_window < p_window_start then
    update public.extension_rate_limit
    set window_start = p_window_start, count = 0, pending = 1
    where ip_hash = p_ip_hash;
    return jsonb_build_object('allowed', true, 'count', 0, 'pending', 1);
  end if;

  if v_count + v_pending >= greatest(p_max_count, 1) then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'pending', v_pending
    );
  end if;

  update public.extension_rate_limit
  set pending = pending + 1
  where ip_hash = p_ip_hash
  returning count, pending into v_count, v_pending;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'pending', v_pending
  );
end;
$$;

create or replace function public.extension_rate_limit_confirm_reservation(
  p_ip_hash text,
  p_window_start timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_pending integer;
  v_window timestamptz;
begin
  insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
  values (p_ip_hash, p_window_start, 0, 0)
  on conflict (ip_hash) do nothing;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = p_ip_hash
  for update;

  if v_window < p_window_start or v_pending <= 0 then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'pending', v_pending
    );
  end if;

  update public.extension_rate_limit
  set pending = pending - 1, count = count + 1
  where ip_hash = p_ip_hash
  returning count, pending into v_count, v_pending;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'pending', v_pending
  );
end;
$$;

create or replace function public.extension_rate_limit_release_reservation(
  p_ip_hash text,
  p_window_start timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_pending integer;
  v_window timestamptz;
begin
  insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
  values (p_ip_hash, p_window_start, 0, 0)
  on conflict (ip_hash) do nothing;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = p_ip_hash
  for update;

  if v_window < p_window_start or v_pending <= 0 then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'pending', v_pending
    );
  end if;

  update public.extension_rate_limit
  set pending = pending - 1
  where ip_hash = p_ip_hash
  returning count, pending into v_count, v_pending;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'pending', v_pending
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Server and client analytics facts
-- ---------------------------------------------------------------------------

create table if not exists public.extension_analyze_events (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  endpoint         text not null,
  client_source    text,
  ip_hash          text,
  user_id          uuid references public.imageprompt_users (id) on delete set null,
  allowed          boolean not null default true,
  request_origin   text,
  correlation_id   text,
  outcome          text,
  error_code       text,
  finish_reason    text,
  truncated        boolean default false,
  http_status      integer,
  latency_ms       integer,
  locale           text,
  style            text,
  model            text,
  missing_sections integer
);

alter table public.extension_analyze_events
  add column if not exists request_origin text,
  add column if not exists correlation_id text,
  add column if not exists outcome text,
  add column if not exists error_code text,
  add column if not exists finish_reason text,
  add column if not exists truncated boolean default false,
  add column if not exists http_status integer,
  add column if not exists latency_ms integer,
  add column if not exists locale text,
  add column if not exists style text,
  add column if not exists model text,
  add column if not exists missing_sections integer;

create index if not exists extension_analyze_events_created_at_idx
  on public.extension_analyze_events (created_at);
create index if not exists extension_analyze_events_client_idx
  on public.extension_analyze_events (client_source);
create index if not exists extension_analyze_events_user_idx
  on public.extension_analyze_events (user_id);
create index if not exists extension_analyze_events_outcome_idx
  on public.extension_analyze_events (outcome);
create index if not exists extension_analyze_events_correlation_idx
  on public.extension_analyze_events (correlation_id);

create table if not exists public.extension_client_events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_ts      timestamptz,
  event          text not null,
  mode           text,
  trigger        text,
  correlation_id text,
  session_id     text,
  client_source  text,
  ip_hash        text,
  user_id        uuid references public.imageprompt_users (id) on delete set null,
  locale         text,
  platform       text,
  browser        text,
  ext_version    text,
  style          text,
  surface        text,
  error_code     text,
  detail         jsonb
);

create index if not exists extension_client_events_created_idx
  on public.extension_client_events (created_at);
create index if not exists extension_client_events_event_idx
  on public.extension_client_events (event);
create index if not exists extension_client_events_correlation_idx
  on public.extension_client_events (correlation_id);
create index if not exists extension_client_events_user_idx
  on public.extension_client_events (user_id);

-- ---------------------------------------------------------------------------
-- Successful analyze history (private storage)
-- ---------------------------------------------------------------------------

create table if not exists public.analyze_history (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_source  text not null,
  image_path     text,
  image_mime     text,
  prompt         text not null,
  style          text,
  locale         text,
  model          text,
  user_id        uuid references public.imageprompt_users (id) on delete set null,
  ip_hash        text,
  correlation_id text,
  ugc_card_id    uuid references public.prompt_cards (id) on delete set null
);

alter table public.analyze_history
  add column if not exists ugc_card_id uuid
  references public.prompt_cards (id) on delete set null;

create index if not exists analyze_history_created_at_idx
  on public.analyze_history (created_at desc);
create index if not exists analyze_history_client_source_idx
  on public.analyze_history (client_source, created_at desc);
create index if not exists analyze_history_ugc_card_id_idx
  on public.analyze_history (ugc_card_id)
  where ugc_card_id is not null;

insert into storage.buckets (id, name, public)
values ('analyze-history', 'analyze-history', false)
on conflict (id) do update set public = false;

alter table public.extension_rate_limit enable row level security;
alter table public.extension_rate_limit_identity_merge enable row level security;
alter table public.extension_analyze_events enable row level security;
alter table public.extension_client_events enable row level security;
alter table public.analyze_history enable row level security;

-- ---------------------------------------------------------------------------
-- Analytics views. Main request/activity views intentionally contain only
-- rate-limit-allowed requests; the outcome view retains denied/error facts.
-- ---------------------------------------------------------------------------

create or replace view public.analytics_requests as
  select
    g.id::text as event_id,
    'generation'::text as kind,
    g.created_at as event_time,
    g.user_id::text as user_id,
    null::text as ip_hash,
    coalesce(g.client_source, 'unknown') as client_source,
    true as allowed,
    null::text as request_origin
  from public.landing_generations g
  union all
  select
    e.id::text,
    e.endpoint,
    e.created_at,
    e.user_id::text,
    e.ip_hash,
    coalesce(e.client_source, 'unknown'),
    e.allowed,
    e.request_origin
  from public.extension_analyze_events e
  where e.allowed = true;

create or replace view public.analytics_user_activity as
  select
    u.id::text as user_id,
    u.email,
    u.created_at as user_created_at,
    count(r.event_id) as total_requests,
    count(r.event_id) filter (where r.kind = 'generation') as generations,
    count(r.event_id) filter (where r.kind = 'analyze') as analyzes,
    min(r.event_time) as first_seen,
    max(r.event_time) as last_seen
  from public.imageprompt_users u
  left join public.analytics_requests r on r.user_id = u.id::text
  group by u.id, u.email, u.created_at;

create or replace view public.analytics_clients_daily as
  select
    date_trunc('day', event_time) as day,
    client_source,
    kind,
    count(*) as requests,
    count(distinct coalesce(user_id, ip_hash)) as unique_actors
  from public.analytics_requests
  where allowed = true
  group by 1, 2, 3;

create or replace view public.analytics_extension_funnel as
  select
    date_trunc('day', created_at) as day,
    coalesce(mode, 'unknown') as mode,
    coalesce(client_source, 'unknown') as client_source,
    coalesce(locale, 'unknown') as locale,
    coalesce(platform, 'unknown') as platform,
    coalesce(browser, 'unknown') as browser,
    count(*) filter (where event = 'mode_click') as clicks,
    count(*) filter (where event = 'request_start_ok') as starts_ok,
    count(*) filter (where event = 'request_start_error') as starts_err,
    count(*) filter (where event = 'result_shown') as results_shown,
    count(*) filter (where event = 'error_shown') as errors_shown,
    count(*) filter (where event = 'copy_prompt') as copies,
    count(distinct coalesce(user_id::text, ip_hash))
      filter (where event = 'mode_click') as unique_users_clicked
  from public.extension_client_events
  group by 1, 2, 3, 4, 5, 6;

create or replace view public.analytics_extension_outcomes_daily as
  select
    date_trunc('day', created_at) as day,
    endpoint,
    coalesce(client_source, 'unknown') as client_source,
    coalesce(locale, 'unknown') as locale,
    coalesce(style, 'unknown') as style,
    count(*) as requests,
    count(*) filter (where outcome = 'success') as success,
    count(*) filter (where truncated) as truncated,
    count(*) filter (where outcome = 'rate_limited') as rate_limited,
    count(*) filter (where outcome = 'upstream_error') as upstream_error,
    count(*) filter (where outcome = 'empty_response') as empty_response,
    count(distinct coalesce(user_id::text, ip_hash)) as unique_actors
  from public.extension_analyze_events
  group by 1, 2, 3, 4, 5;

-- ---------------------------------------------------------------------------
-- Existing durable generation table as an admin publication queue.
-- ---------------------------------------------------------------------------

create index if not exists landing_generations_admin_queue_idx
  on public.landing_generations (created_at desc, id desc)
  where client_source = 'admin' and status = 'completed';

create or replace function public.admin_generations_queue(
  p_status text default 'unpublished',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
) returns table (
  id uuid,
  created_at timestamptz,
  generation_completed_at timestamptz,
  prompt_text text,
  model text,
  aspect_ratio text,
  image_size text,
  result_storage_bucket text,
  result_storage_path text,
  ugc_card_id uuid,
  card_exists boolean,
  is_published boolean,
  source_channel text,
  card_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.created_at,
    g.generation_completed_at,
    g.prompt_text,
    g.model,
    g.aspect_ratio,
    g.image_size,
    g.result_storage_bucket,
    g.result_storage_path,
    g.ugc_card_id,
    (c.id is not null),
    coalesce(c.is_published, false),
    c.source_channel,
    c.slug
  from public.landing_generations g
  left join public.prompt_cards c on c.id = g.ugc_card_id
  where g.client_source = 'admin'
    and g.status = 'completed'
    and case lower(coalesce(p_status, 'unpublished'))
      when 'published' then c.id is not null and c.is_published = true
      when 'all' then true
      else g.ugc_card_id is null or c.id is null or c.is_published = false
    end
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or g.created_at < p_cursor_created_at
      or (g.created_at = p_cursor_created_at and g.id < p_cursor_id)
    )
  order by g.created_at desc, g.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100)) + 1;
$$;

create or replace function public.admin_unpublished_generations(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
) returns table (
  id uuid,
  created_at timestamptz,
  generation_completed_at timestamptz,
  prompt_text text,
  model text,
  aspect_ratio text,
  image_size text,
  result_storage_bucket text,
  result_storage_path text,
  ugc_card_id uuid,
  card_exists boolean,
  is_published boolean,
  source_channel text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, created_at, generation_completed_at, prompt_text, model, aspect_ratio,
    image_size, result_storage_bucket, result_storage_path, ugc_card_id,
    card_exists, is_published, source_channel
  from public.admin_generations_queue(
    'unpublished', p_cursor_created_at, p_cursor_id, p_limit
  );
$$;

-- Tables are service-side facts; views and RPCs are not exposed through anon APIs.
revoke all on table public.extension_rate_limit from public, anon, authenticated;
revoke all on table public.extension_rate_limit_identity_merge from public, anon, authenticated;
revoke all on table public.extension_analyze_events from public, anon, authenticated;
revoke all on table public.extension_client_events from public, anon, authenticated;
revoke all on table public.analyze_history from public, anon, authenticated;
revoke all on public.analytics_requests from public, anon, authenticated;
revoke all on public.analytics_user_activity from public, anon, authenticated;
revoke all on public.analytics_clients_daily from public, anon, authenticated;
revoke all on public.analytics_extension_funnel from public, anon, authenticated;
revoke all on public.analytics_extension_outcomes_daily from public, anon, authenticated;

grant select, insert, update, delete on table public.extension_rate_limit
  to service_role;
grant select, insert, update, delete on table public.extension_rate_limit_identity_merge
  to service_role;
grant select, insert, update, delete on table public.extension_analyze_events
  to service_role;
grant select, insert, update, delete on table public.extension_client_events
  to service_role;
grant select, insert, update, delete on table public.analyze_history
  to service_role;
grant select on public.analytics_requests to service_role;
grant select on public.analytics_user_activity to service_role;
grant select on public.analytics_clients_daily to service_role;
grant select on public.analytics_extension_funnel to service_role;
grant select on public.analytics_extension_outcomes_daily to service_role;

revoke all on function public.extension_rate_limit_merge_ip_to_user(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.extension_rate_limit_increment_if_allowed(text, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.extension_rate_limit_check_and_increment(text, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.extension_rate_limit_reserve_if_allowed(text, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.extension_rate_limit_confirm_reservation(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.extension_rate_limit_release_reservation(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.admin_generations_queue(text, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.admin_unpublished_generations(timestamptz, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.extension_rate_limit_merge_ip_to_user(uuid, text, timestamptz)
  to service_role;
grant execute on function public.extension_rate_limit_increment_if_allowed(text, timestamptz, integer)
  to service_role;
grant execute on function public.extension_rate_limit_check_and_increment(text, timestamptz, integer)
  to service_role;
grant execute on function public.extension_rate_limit_reserve_if_allowed(text, timestamptz, integer)
  to service_role;
grant execute on function public.extension_rate_limit_confirm_reservation(text, timestamptz)
  to service_role;
grant execute on function public.extension_rate_limit_release_reservation(text, timestamptz)
  to service_role;
grant execute on function public.admin_generations_queue(text, timestamptz, uuid, integer)
  to service_role;
grant execute on function public.admin_unpublished_generations(timestamptz, uuid, integer)
  to service_role;

comment on table public.extension_analyze_events is
  'Per-request server analytics for PromptShot/imageprompt analyze and remix flows.';
comment on table public.analyze_history is
  'Successful analyze images and prompts; application retention is 30 days.';
comment on view public.analytics_requests is
  'Unified allowed generation/analyze/remix request facts.';
