-- =============================================================================
-- Migration: add `instructions` column to initial_call_questions.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.initial_call_questions
  add column if not exists instructions text;
