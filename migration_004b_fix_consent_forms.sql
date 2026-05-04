-- Migration 004b: Fix consent_forms table
-- Run this in Supabase SQL Editor if consent_forms
-- was created with extra columns by an earlier migration.
-- Safe to run even if column does not exist.
ALTER TABLE consent_forms
  DROP COLUMN IF EXISTS updated_at;
