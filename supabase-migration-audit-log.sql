-- ═══════════════════════════════════════════════
-- EARJ TEAM SPACE — Migração: Log de alterações
-- Execute este SQL no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('create','update','delete')),
  description text not null,
  user_id uuid references auth.users(id),
  user_name text,
  created_at timestamptz default now()
);

alter table audit_log enable row level security;
create policy "auth_all" on audit_log for all to authenticated using (true) with check (true);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
