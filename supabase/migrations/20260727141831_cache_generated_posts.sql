create extension if not exists pg_cron;

create table public.generated_posts (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  origin text not null check (origin in ('feed', 'manual')),
  story_id text,
  title text not null,
  source_name text not null,
  source_url text,
  image_url text,
  caption text not null,
  draft jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint generated_posts_expiry_after_creation
    check (expires_at >= created_at + interval '30 days')
);

create index generated_posts_created_at_idx
  on public.generated_posts (created_at desc);

create index generated_posts_expires_at_idx
  on public.generated_posts (expires_at);

alter table public.generated_posts enable row level security;

revoke all on table public.generated_posts from anon, authenticated;
grant select, insert, update, delete on table public.generated_posts to service_role;

select cron.schedule(
  'sum-generated-posts-retention',
  '17 3 * * *',
  $$delete from public.generated_posts where expires_at <= now()$$
);
