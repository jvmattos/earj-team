-- ═══════════════════════════════════════════════
-- EARJ TEAM SPACE — Migração: sincronização de reuniões com Google Calendar
-- Execute este SQL no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

alter table team_meetings add column if not exists google_event_id text;
