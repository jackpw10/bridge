-- =============================================================================
-- BRIDGE — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- It is safe to re-run; everything uses CREATE ... IF NOT EXISTS / CREATE OR
-- REPLACE so you won't lose data on re-runs (but the structural definitions
-- will be re-applied).
-- =============================================================================

-- -------------------------------- PROFILES -----------------------------------
-- One row per auth user. Stores app-level identity (name, role).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  role         text not null default 'user' check (role in ('admin', 'user')),
  created_at   timestamptz not null default now()
);

-- ----------------------------- AUTO-CREATE PROFILE ---------------------------
-- When a new auth user is created (via signup), automatically create a profile
-- row so admins can manage them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------- "is current user an admin?" -------------------------
-- Used by RLS policies. SECURITY DEFINER so it can see profiles.role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------- CONFIG ENTITIES -------------------------------
create table if not exists public.call_types (
  id           text primary key,
  name         text not null,
  letter       text not null default ''
);

create table if not exists public.health_authorities (
  id   text primary key,
  name text not null
);

create table if not exists public.facilities (
  id                         text primary key,
  name                       text not null,
  abbreviation               text not null default '',
  code                       text not null default '',
  health_authority_id        text default '',
  on_site_service_ids        jsonb not null default '[]'::jsonb,
  referral_patterns          jsonb not null default '{}'::jsonb,
  notification_requirements  jsonb not null default '[]'::jsonb,
  service_notifs             jsonb not null default '{}'::jsonb
);

create table if not exists public.specialty_services (
  id                    text primary key,
  name                  text not null,
  number                integer not null default 0,
  templates             jsonb not null default '{}'::jsonb,
  transport_advisor     jsonb not null default '{"enabled":false,"cards":[]}'::jsonb,
  enabled_call_type_ids jsonb not null default '["ct_high_acuity","ct_advice","ct_repate"]'::jsonb
);

-- One row per workflow (paired 1:1 with a call_types row by call_type_id).
-- process_steps is a JSONB array of {id, text} — the flat Action Card.
create table if not exists public.workflows (
  id                 text primary key,
  name               text not null,
  call_type_id       text not null default '',
  questions          jsonb not null default '[]'::jsonb,
  process_steps      jsonb not null default '[]'::jsonb,
  position           integer not null default 0,
  created_at         timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id            text primary key,
  text          text not null,
  notif_enabled boolean not null default false,
  notif_message text not null default ''
);

create table if not exists public.card_overrides (
  id          text primary key,
  facility_id text not null,
  svc_id      text not null,
  parts       jsonb not null default '{}'::jsonb
);

create table if not exists public.override_reasons (
  id   text primary key,
  text text not null
);

create table if not exists public.reference_cards (
  id    text primary key,
  name  text not null,
  code  text,
  body  text,
  steps jsonb not null default '[]'::jsonb
);

-- --------------------- COLUMN PATCHES FOR EXISTING TABLES --------------------
-- `create table if not exists` does NOT add new columns to a table that
-- already exists. These `add column if not exists` statements bring an older
-- database up to the current shape. Keep them in sync with the create blocks
-- above whenever a column is added.
alter table public.call_types         add column if not exists letter            text not null default '';

alter table public.facilities         add column if not exists abbreviation      text not null default '';
alter table public.facilities         add column if not exists code              text not null default '';

alter table public.specialty_services add column if not exists templates             jsonb not null default '{}'::jsonb;
alter table public.specialty_services add column if not exists transport_advisor     jsonb not null default '{"enabled":false,"cards":[]}'::jsonb;
alter table public.specialty_services add column if not exists enabled_call_type_ids jsonb not null default '["ct_high_acuity","ct_advice","ct_repate"]'::jsonb;
alter table public.specialty_services add column if not exists number                integer not null default 0;

alter table public.workflows          add column if not exists call_type_id      text not null default '';
alter table public.workflows          add column if not exists questions         jsonb not null default '[]'::jsonb;
alter table public.workflows          add column if not exists process_steps     jsonb not null default '[]'::jsonb;
alter table public.workflows          add column if not exists position          integer not null default 0;
alter table public.workflows          add column if not exists created_at        timestamptz not null default now();

alter table public.card_overrides     add column if not exists parts             jsonb not null default '{}'::jsonb;

-- ------------------------------ NOTIFICATIONS --------------------------------
create table if not exists public.notifications (
  id            text primary key,
  from_user     uuid not null references auth.users(id) on delete cascade,
  ts            bigint not null,
  title         text not null,
  body          text not null,
  acked_by      jsonb not null default '[]'::jsonb,
  deleted_for   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_ts_idx on public.notifications (ts desc);

-- ============================== RLS POLICIES =================================
alter table public.profiles               enable row level security;
alter table public.health_authorities     enable row level security;
alter table public.facilities             enable row level security;
alter table public.specialty_services     enable row level security;
alter table public.workflows              enable row level security;
alter table public.call_types             enable row level security;
alter table public.diagnoses              enable row level security;
alter table public.card_overrides         enable row level security;
alter table public.override_reasons       enable row level security;
alter table public.reference_cards        enable row level security;
alter table public.notifications          enable row level security;

-- Drop any existing policies so this script is re-runnable
do $$ declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---- profiles ----
-- Authenticated users can read all profiles (so the UI can show names)
create policy "profiles_read_all" on public.profiles
  for select to authenticated using (true);

-- Each user can update their own profile (but cannot change role)
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Admins can do anything on profiles (including role changes)
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- helper to apply standard read-all + admin-write policies on a table ----
-- We do this inline per-table below; postgres doesn't let us templatize.

-- ---- health_authorities ----
create policy "ha_read"  on public.health_authorities for select to authenticated using (true);
create policy "ha_admin" on public.health_authorities for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- facilities ----
create policy "fac_read"  on public.facilities for select to authenticated using (true);
create policy "fac_admin" on public.facilities for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- specialty_services ----
create policy "svc_read"  on public.specialty_services for select to authenticated using (true);
create policy "svc_admin" on public.specialty_services for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- workflows ----
create policy "wfs_read"  on public.workflows for select to authenticated using (true);
create policy "wfs_admin" on public.workflows for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- call_types ----
create policy "ct_read"  on public.call_types for select to authenticated using (true);
create policy "ct_admin" on public.call_types for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- diagnoses ----
create policy "dx_read"  on public.diagnoses for select to authenticated using (true);
create policy "dx_admin" on public.diagnoses for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- card_overrides ----
create policy "co_read"  on public.card_overrides for select to authenticated using (true);
create policy "co_admin" on public.card_overrides for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- override_reasons ----
create policy "or_read"  on public.override_reasons for select to authenticated using (true);
create policy "or_admin" on public.override_reasons for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- reference_cards ----
create policy "rc_read"  on public.reference_cards for select to authenticated using (true);
create policy "rc_admin" on public.reference_cards for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- notifications ----
-- Notifications are shared workspace data:
--  * any signed-in user can read all of them
--  * any signed-in user can insert (so end-of-triage hooks can fire)
--  * any signed-in user can update them (for ack / deleted_for self-hide)
create policy "notif_read"   on public.notifications for select to authenticated using (true);
create policy "notif_insert" on public.notifications for insert to authenticated with check (from_user = auth.uid());
create policy "notif_update" on public.notifications for update to authenticated using (true) with check (true);

-- ============================ REALTIME PUBLICATION ============================
-- Add tables to the realtime publication so the client can subscribe to changes.
do $$
declare
  t record;
  table_list text[] := array[
    'profiles', 'health_authorities', 'facilities', 'specialty_services',
    'workflows', 'call_types', 'diagnoses', 'card_overrides',
    'override_reasons', 'reference_cards', 'notifications'
  ];
begin
  for t in
    select unnest(table_list) as tbl
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t.tbl);
    exception when duplicate_object then
      -- already in publication, skip
      null;
    end;
  end loop;
end $$;
