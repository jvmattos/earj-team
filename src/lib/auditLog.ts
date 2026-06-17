import { supabase } from "@/integrations/supabase/client";

export async function logAudit(entry: {
  table_name: string;
  record_id?: string | null;
  action: "create" | "update" | "delete";
  description: string;
  user_id?: string | null;
  user_name?: string | null;
}) {
  try {
    await supabase.from("audit_log").insert(entry as any);
  } catch {
    // Logging failures should never block the main action
  }
}

export function formatLogValue(v: any): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(vazio)";
  return String(v);
}
