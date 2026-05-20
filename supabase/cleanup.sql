-- =============================================================================
-- BRIDGE — One-time cleanup for existing databases.
-- Drops legacy tables and columns that are no longer referenced by the app.
-- Safe to re-run: every statement uses IF EXISTS.
-- Run this AFTER applying schema.sql.
-- =============================================================================

-- ---- Legacy singleton "workflow" table (pre-multi-workflow schema) ----
-- The app's seedIfEmpty fallback for this was removed.
drop table if exists public.workflow cascade;

-- ---- Legacy singleton "process_steps" table ----
-- Replaced by workflows.process_steps (JSONB keyed by sub-version / PTN).
drop table if exists public.process_steps cascade;

-- ---- Dead columns on workflows ----
alter table public.workflows
  drop column if exists sub_version_resolver;

-- ---- Dead columns on card_overrides ----
-- Old per-sub-version JSONB columns replaced by `parts` (record keyed by
-- "${callTypeId}:${subVersionId}").
alter table public.card_overrides
  drop column if exists llto,
  drop column if exists hloc;

-- ---- Dead column on specialty_services ----
-- Old singular `template` replaced by `templates` (record keyed by callTypeId).
alter table public.specialty_services
  drop column if exists template;

-- ---- Sanity: make sure transport_advisor has a sensible default. ----
-- Older databases may have created this column as NOT NULL with no default,
-- which causes inserts that don't explicitly set it to fail.
alter table public.specialty_services
  alter column transport_advisor set default '{"enabled":false,"cards":[]}'::jsonb;
update public.specialty_services
  set transport_advisor = '{"enabled":false,"cards":[]}'::jsonb
  where transport_advisor is null;

-- ---- Verify ----
-- Nothing to verify programmatically; run `\d public.workflows` etc. in the
-- SQL editor to confirm the legacy columns are gone.
