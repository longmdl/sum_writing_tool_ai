create table public.generation_rate_limit_events (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint generation_rate_limit_expiry_after_creation
    check (expires_at > created_at)
);

create index generation_rate_limit_ip_created_idx
  on public.generation_rate_limit_events (ip_hash, created_at);

create index generation_rate_limit_expires_idx
  on public.generation_rate_limit_events (expires_at);

alter table public.generation_rate_limit_events enable row level security;

revoke all on table public.generation_rate_limit_events
  from public, anon, authenticated;
grant select, insert, delete on table public.generation_rate_limit_events
  to service_role;
grant usage, select on sequence public.generation_rate_limit_events_id_seq
  to service_role;

create function public.consume_generation_rate_limit(
  p_ip_hash text,
  p_limit integer default 10,
  p_window_seconds integer default 3600
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window interval;
  v_count integer;
  v_oldest timestamptz;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid IP hash';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid generation limit';
  end if;
  if p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid generation window';
  end if;

  v_window := pg_catalog.make_interval(secs => p_window_seconds);

  -- Serialize requests for this hash so concurrent Vercel invocations cannot
  -- both observe the same remaining slot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('sum-generation-rate-limit'),
    pg_catalog.hashtext(p_ip_hash)
  );

  select count(*)::integer, min(events.created_at)
    into v_count, v_oldest
  from public.generation_rate_limit_events as events
  where events.ip_hash = p_ip_hash
    and events.created_at > v_now - v_window;

  if v_count >= p_limit then
    return query
      select false, 0, v_oldest + v_window;
    return;
  end if;

  insert into public.generation_rate_limit_events (
    ip_hash,
    created_at,
    expires_at
  ) values (
    p_ip_hash,
    v_now,
    v_now + v_window
  );

  return query
    select
      true,
      p_limit - v_count - 1,
      coalesce(v_oldest, v_now) + v_window;
end;
$$;

revoke execute on function public.consume_generation_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_generation_rate_limit(text, integer, integer)
  to service_role;

select cron.schedule(
  'sum-generation-rate-limit-retention',
  '41 * * * *',
  $$delete from public.generation_rate_limit_events where expires_at <= now()$$
);
