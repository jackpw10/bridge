-- =============================================================================
-- Migration: create initial_call_questions table.
-- Run in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- WHAT THIS DOES:
--   * Creates public.initial_call_questions (id, text, type, options, position).
--   * Enables RLS: read-for-all-authenticated, write-for-admin.
--   * Adds the table to the supabase_realtime publication so the client
--     picks up admin edits without a page reload.
--
-- WHAT IS NOT TOUCHED:
--   * No other tables. No data loss anywhere.
-- =============================================================================

create table if not exists public.initial_call_questions (
  id         text primary key,
  text       text not null,
  type       text not null default 'text' check (type in ('yesno','dropdown','text')),
  options    jsonb not null default '[]'::jsonb,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.initial_call_questions enable row level security;

drop policy if exists "icq_read"  on public.initial_call_questions;
drop policy if exists "icq_admin" on public.initial_call_questions;

create policy "icq_read"
  on public.initial_call_questions
  for select
  to authenticated
  using (true);

create policy "icq_admin"
  on public.initial_call_questions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Add to realtime publication (skip cleanly if already added).
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.initial_call_questions';
  exception when duplicate_object then null;
  end;
end $$;
