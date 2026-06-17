import { supabase } from "@/integrations/supabase/client";

const BACKUP_TABLES = [
  "profiles", "team_requests", "team_tasks", "team_task_assignees",
  "team_pages", "team_meetings", "team_checklist_items", "team_announcements",
  "team_contacts", "team_kanban_columns", "team_kanban_cards",
  "team_columns", "team_column_values", "settings", "audit_log",
];

export async function exportDatabaseBackup() {
  const backup: Record<string, any> = { exported_at: new Date().toISOString() };
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    backup[table] = data;
  }
  return backup;
}

export function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: any[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => {
      const v = r[h];
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
