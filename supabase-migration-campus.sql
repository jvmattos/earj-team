-- ═══════════════════════════════════════════════
-- EARJ TEAM SPACE — Migração: Multi-campus + Google Calendar
-- Execute este SQL no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

alter table profiles add column if not exists campus text default 'barra' check (campus in ('barra','gavea','all'));
alter table team_requests add column if not exists campus text default 'barra' check (campus in ('barra','gavea'));
alter table team_tasks add column if not exists campus text default 'barra' check (campus in ('barra','gavea'));
alter table team_pages add column if not exists campus text default 'barra' check (campus in ('barra','gavea'));
alter table team_pages add column if not exists google_calendar_id text;

-- Definir jvmattos@earj.com.br como admin com acesso aos dois campi
update profiles set role = 'admin', campus = 'all' where email = 'jvmattos@earj.com.br';
