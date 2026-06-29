-- ═══════════════════════════════════════════════
-- EARJ TEAM SPACE — Migração: status de usuário (desabilitado)
-- Execute este SQL no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

alter table profiles add column if not exists disabled boolean default false;
