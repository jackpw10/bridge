-- =============================================================================
-- Migration: case audit log — public.cases + public.case_events.
-- Idempotent; safe to re-run.
--
-- WHAT THIS DOES:
--   * Creates two new tables:
--       public.cases        — one row per triage case (metadata + lifecycle)
--       public.case_events  — one row per user action inside a case
--   * RLS: admins see everything; regular users see only their own rows.
--     Inserts require actor = auth.uid().
--   * Adds both tables to the realtime publication so admins can watch
--     active cases live.
--
-- NO EXISTING DATA IS TOUCHED.
-- =============================================================================

-- One row per triage case.
create table if not exists public.cases (
  id             text primary key,
  actor          uuid not null references auth.users(id) on delete cascade,
  workflow_id    text,
  workflow_name  text not null default '',
  call_type_id   text,
  call_type_name text not null default '',
  started_at     bigint not null,
  ended_at       bigint,
  created_at     timestamptz not null default now()
);

create index if not exists cases_actor_idx     on public.cases (actor);
create index if not exists cases_started_idx   on public.cases (started_at desc);
create index if not exists cases_active_idx    on public.cases (ended_at) where ended_at is null;

-- One row per user action inside a case.
create table if not exists public.case_events (
  id          text primary key,
  case_id     text not null,
  actor       uuid not null references auth.users(id) on delete cascade,
  ts          bigint not null,
  event_type  text not null,
  summary     text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists case_events_case_ts_idx on public.case_events (case_id, ts);
create index if not exists case_events_ts_idx      on public.case_events (ts desc);

-- ------------------------------ RLS ------------------------------------------
alter table public.cases       enable row level security;
alter table public.case_events enable row level security;

drop policy if exists "cases_read"        on public.cases;
drop policy if exists "cases_insert"      on public.cases;
drop policy if exists "cases_update"      on public.cases;
drop policy if exists "case_events_read"  on public.case_events;
drop policy if exists "case_events_insert" on public.case_events;

-- cases: read your own OR admin. Insert only your own. Update only your own.
create policy "cases_read"
  on public.cases
  for select
  to authenticated
  using (actor = auth.uid() or public.is_admin());

create policy "cases_insert"
  on public.cases
  for insert
  to authenticated
  with check (actor = auth.uid());

create policy "cases_update"
  on public.cases
  for update
  to authenticated
  using (actor = auth.uid())
  with check (actor = auth.uid());

-- case_events: same rules, denormalized `actor` for fast checks.
create policy "case_events_read"
  on public.case_events
  for select
  to authenticated
  using (actor = auth.uid() or public.is_admin());

create policy "case_events_insert"
  on public.case_events
  for insert
  to authenticated
  with check (actor = auth.uid());

-- --------------------------- REALTIME ----------------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.cases';
  exception when duplicate_object then null;
  end;
  begin execute 'alter publication supabase_realtime add table public.case_events';
  exception when duplicate_object then null;
  end;
end $$;
