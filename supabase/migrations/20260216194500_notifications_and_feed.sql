-- Notifications + event feed (minimal schema)
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  league_id uuid null,
  type text not null,
  title text not null,
  body text not null,
  notify_date date not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create unique index if not exists user_notifications_unique_daily
on public.user_notifications (user_id, type, notify_date);

create table if not exists public.league_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  season_id uuid null,
  week_id uuid null,
  actor_user_id uuid not null,
  event_type text not null,
  title text not null,
  body text null,
  metadata jsonb not null default '{}'::jsonb,
  media_url text null,
  created_at timestamptz not null default now()
);

-- basic RLS enable (policies should be tightened later)
alter table public.user_notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_notifications' and policyname='user_notifications_owner_rw') then
    create policy user_notifications_owner_rw on public.user_notifications
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

alter table public.league_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='league_events' and policyname='league_events_league_member_read') then
    create policy league_events_league_member_read on public.league_events
      for select
      using (exists (
        select 1 from public.league_members lm
        where lm.league_id = league_events.league_id
          and lm.user_id = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='league_events' and policyname='league_events_league_member_insert') then
    create policy league_events_league_member_insert on public.league_events
      for insert
      with check (exists (
        select 1 from public.league_members lm
        where lm.league_id = league_events.league_id
          and lm.user_id = auth.uid()
      ));
  end if;
end$$;
