-- Analyze quota: 10 free successful analyses per UTC day per identity,
-- then 1 landing_users credit for authenticated users only.
-- Does not edit 175 reserve/confirm/release used by other callers.

create table if not exists public.aiid_app_config (
  key   text primary key,
  value text not null
);

insert into public.aiid_app_config (key, value)
values
  ('analyze_free_per_day', '10'),
  ('analyze_credit_cost', '1')
on conflict (key) do nothing;

create table if not exists public.analyze_quota_holds (
  id               uuid primary key default gen_random_uuid(),
  bucket_key       text not null,
  window_start     timestamptz not null,
  user_id          uuid references public.landing_users (id) on delete set null,
  mode             text not null check (mode in ('free', 'paid')),
  credits_charged  integer not null default 0,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'released')),
  credits_refunded boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists analyze_quota_holds_bucket_idx
  on public.analyze_quota_holds (bucket_key, window_start);

create index if not exists analyze_quota_holds_pending_idx
  on public.analyze_quota_holds (status)
  where status = 'pending';

alter table public.analyze_history
  add column if not exists credits_spent integer not null default 0;

alter table public.analyze_history
  add column if not exists quota_mode text;

alter table public.extension_analyze_events
  add column if not exists quota_mode text;

alter table public.analyze_quota_holds enable row level security;

revoke all on table public.analyze_quota_holds from public, anon, authenticated;
grant select, insert, update, delete on table public.analyze_quota_holds to service_role;

create or replace function public.analyze_quota_reserve(
  p_bucket_key text,
  p_window_start timestamptz,
  p_authenticated boolean,
  p_user_id uuid,
  p_free_per_day integer,
  p_credit_cost integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_pending integer;
  v_window timestamptz;
  v_usage integer;
  v_free integer := greatest(coalesce(p_free_per_day, 10), 1);
  v_cost integer := greatest(coalesce(p_credit_cost, 1), 1);
  v_credits_left integer;
  v_hold_id uuid;
  v_mode text;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) = 0 then
    return jsonb_build_object('allowed', false, 'error', 'invalid_bucket');
  end if;

  insert into public.extension_rate_limit (ip_hash, window_start, count, pending)
  values (p_bucket_key, p_window_start, 0, 0)
  on conflict (ip_hash) do nothing;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = p_bucket_key
  for update;

  if v_window < p_window_start then
    update public.extension_rate_limit
    set window_start = p_window_start, count = 0, pending = 0
    where ip_hash = p_bucket_key;
    v_count := 0;
    v_pending := 0;
  end if;

  v_usage := coalesce(v_count, 0) + coalesce(v_pending, 0);

  if v_usage < v_free then
    v_mode := 'free';
    update public.extension_rate_limit
    set pending = pending + 1
    where ip_hash = p_bucket_key
    returning count, pending into v_count, v_pending;

    insert into public.analyze_quota_holds (
      bucket_key, window_start, user_id, mode, credits_charged, status
    ) values (
      p_bucket_key, p_window_start, p_user_id, 'free', 0, 'pending'
    ) returning id into v_hold_id;

    return jsonb_build_object(
      'allowed', true,
      'mode', v_mode,
      'hold_id', v_hold_id,
      'count', v_count,
      'pending', v_pending,
      'remaining_free', greatest(v_free - (v_count + v_pending), 0),
      'credits_charged', 0,
      'credits_left', null,
      'authenticated', coalesce(p_authenticated, false)
    );
  end if;

  if not coalesce(p_authenticated, false) or p_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'error', 'auth_required',
      'mode', 'auth_required',
      'count', v_count,
      'pending', v_pending,
      'remaining_free', 0,
      'credits_charged', 0,
      'authenticated', false
    );
  end if;

  v_credits_left := public.landing_deduct_credits(p_user_id, v_cost);
  if v_credits_left < 0 then
    return jsonb_build_object(
      'allowed', false,
      'error', 'no_credits',
      'mode', 'no_credits',
      'count', v_count,
      'pending', v_pending,
      'remaining_free', 0,
      'credits_charged', 0,
      'credits_left', 0,
      'authenticated', true
    );
  end if;

  v_mode := 'paid';
  update public.extension_rate_limit
  set pending = pending + 1
  where ip_hash = p_bucket_key
  returning count, pending into v_count, v_pending;

  insert into public.analyze_quota_holds (
    bucket_key, window_start, user_id, mode, credits_charged, status
  ) values (
    p_bucket_key, p_window_start, p_user_id, 'paid', v_cost, 'pending'
  ) returning id into v_hold_id;

  return jsonb_build_object(
    'allowed', true,
    'mode', v_mode,
    'hold_id', v_hold_id,
    'count', v_count,
    'pending', v_pending,
    'remaining_free', 0,
    'credits_charged', v_cost,
    'credits_left', v_credits_left,
    'authenticated', true
  );
end;
$$;

create or replace function public.analyze_quota_confirm(
  p_hold_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.analyze_quota_holds%rowtype;
  v_count integer;
  v_pending integer;
  v_window timestamptz;
begin
  if p_hold_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_hold');
  end if;

  select * into v_hold
  from public.analyze_quota_holds
  where id = p_hold_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'hold_not_found');
  end if;

  if v_hold.status = 'confirmed' then
    select count, pending into v_count, v_pending
    from public.extension_rate_limit
    where ip_hash = v_hold.bucket_key;
    return jsonb_build_object(
      'ok', true,
      'mode', v_hold.mode,
      'credits_charged', v_hold.credits_charged,
      'count', coalesce(v_count, 0),
      'pending', coalesce(v_pending, 0)
    );
  end if;

  if v_hold.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'hold_not_pending', 'status', v_hold.status);
  end if;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = v_hold.bucket_key
  for update;

  if found and v_window = v_hold.window_start and v_pending > 0 then
    update public.extension_rate_limit
    set pending = pending - 1, count = count + 1
    where ip_hash = v_hold.bucket_key
    returning count, pending into v_count, v_pending;
  end if;

  update public.analyze_quota_holds
  set status = 'confirmed'
  where id = p_hold_id;

  return jsonb_build_object(
    'ok', true,
    'mode', v_hold.mode,
    'credits_charged', v_hold.credits_charged,
    'count', coalesce(v_count, 0),
    'pending', coalesce(v_pending, 0)
  );
end;
$$;

create or replace function public.analyze_quota_release(
  p_hold_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.analyze_quota_holds%rowtype;
  v_count integer;
  v_pending integer;
  v_window timestamptz;
  v_credits_left integer;
  v_refunded boolean := false;
begin
  if p_hold_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_hold');
  end if;

  select * into v_hold
  from public.analyze_quota_holds
  where id = p_hold_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'hold_not_found');
  end if;

  if v_hold.status = 'released' then
    return jsonb_build_object(
      'ok', true,
      'credits_refunded', v_hold.credits_refunded,
      'mode', v_hold.mode
    );
  end if;

  if v_hold.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'hold_not_pending', 'status', v_hold.status);
  end if;

  select count, pending, window_start
    into v_count, v_pending, v_window
  from public.extension_rate_limit
  where ip_hash = v_hold.bucket_key
  for update;

  if found and v_window = v_hold.window_start and v_pending > 0 then
    update public.extension_rate_limit
    set pending = pending - 1
    where ip_hash = v_hold.bucket_key;
  end if;

  if v_hold.credits_charged > 0
     and v_hold.user_id is not null
     and not v_hold.credits_refunded then
    v_credits_left := public.landing_add_credits(v_hold.user_id, v_hold.credits_charged);
    v_refunded := v_credits_left >= 0;
  end if;

  update public.analyze_quota_holds
  set status = 'released',
      credits_refunded = credits_refunded or v_refunded
  where id = p_hold_id;

  return jsonb_build_object(
    'ok', true,
    'credits_refunded', v_refunded,
    'mode', v_hold.mode
  );
end;
$$;

revoke all on function public.analyze_quota_reserve(text, timestamptz, boolean, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.analyze_quota_confirm(uuid)
  from public, anon, authenticated;
revoke all on function public.analyze_quota_release(uuid)
  from public, anon, authenticated;

grant execute on function public.analyze_quota_reserve(text, timestamptz, boolean, uuid, integer, integer)
  to service_role;
grant execute on function public.analyze_quota_confirm(uuid)
  to service_role;
grant execute on function public.analyze_quota_release(uuid)
  to service_role;

comment on table public.analyze_quota_holds is
  'Per-request analyze quota hold: free slot or paid credit, confirmed or released+refunded.';
comment on function public.analyze_quota_reserve(text, timestamptz, boolean, uuid, integer, integer) is
  'Atomic analyze reserve: free pending, auth_required, no_credits, or paid deduct+hold.';
