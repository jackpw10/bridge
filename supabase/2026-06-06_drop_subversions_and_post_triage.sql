-- =============================================================================
-- Migration: drop sub-versions and post-triage from BRIDGE schema.
-- Run ONCE against your Supabase database, after deploying the code that
-- reads/writes the new shape.
--
-- WHAT THIS DOES:
--   * Drops call_types.sub_versions       (per-call-type sub-versions gone)
--   * Drops workflows.sub_version_rules   (no more sub-version resolution)
--   * Drops workflows.post_triage         (post-triage screen removed)
--   * Changes workflows.process_steps default to '[]' (was '{}' with per-
--     sub-version keys). Existing rows are NOT touched — the app-side
--     mapper reads either shape and rewrites on next save.
--   * Leaves specialty_services.templates and card_overrides.parts JSONB
--     columns as-is: the app coerces their old nested shape to the new flat
--     shape on read and overwrites on next save.
--
-- WHAT IS LOST:
--   * The JSON in the three dropped columns is deleted permanently. That
--     data was: sub-version definitions per call type, sub-version rules
--     per workflow, and the post-triage config per workflow. If any of
--     that is still needed, take a backup FIRST.
--
-- WHAT IS PRESERVED:
--   * All other columns and all rows.
--   * Service Process Card content (specialty_services.templates) is
--     preserved but re-interpreted: when a call type had multiple
--     sub-versions, the "default" sub-version's steps take precedence,
--     otherwise the first sub-version's steps. Once you re-save a service
--     in the admin UI, the new flat shape is written back.
--   * Card overrides (card_overrides.parts) are preserved but re-keyed
--     from "callTypeId:subVersionId" to "callTypeId" on read. Overrides
--     from multiple sub-versions of the same call type merge on read.
--     Once you re-save an override in the admin UI, the new flat shape is
--     written back.
-- =============================================================================

begin;

alter table public.call_types drop column if exists sub_versions;

alter table public.workflows drop column if exists sub_version_rules;
alter table public.workflows drop column if exists post_triage;

-- The process_steps default changes from '{}' to '[]'. Existing row values
-- are untouched; the mapper handles both shapes on read.
alter table public.workflows alter column process_steps set default '[]'::jsonb;

commit;
