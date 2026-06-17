import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TABLE_LABELS: Record<string, string> = {
  team_requests: "Pedidos",
  team_tasks: "Tarefas",
};

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  create: { label: "Criação", className: "bg-green-100 text-green-800" },
  update: { label: "Edição", className: "bg-blue-100 text-blue-800" },
  delete: { label: "Exclusão", className: "bg-red-100 text-red-800" },
};

export default function AuditLog() {
  const { isAdmin } = useAuth();
  const [tableFilter, setTableFilter] = useState<string>("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      Acesso restrito a administradores.
    </div>
  );

  const filtered = tableFilter === "all" ? entries : entries.filter((e: any) => e.table_name === tableFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Log de alterações</h1>
          <p className="text-sm text-muted-foreground">Quem criou, editou ou excluiu o quê</p>
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tudo</SelectItem>
            <SelectItem value="team_requests">Pedidos</SelectItem>
            <SelectItem value="team_tasks">Tarefas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[160px]">Data/Hora</TableHead>
              <TableHead className="min-w-[140px]">Usuário</TableHead>
              <TableHead className="w-24">Área</TableHead>
              <TableHead className="w-24">Ação</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
            ) : (
              filtered.map((e: any) => {
                const action = ACTION_LABELS[e.action] || { label: e.action, className: "bg-muted" };
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {e.created_at && format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.user_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{TABLE_LABELS[e.table_name] || e.table_name}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${action.className}`}>{action.label}</span>
                    </TableCell>
                    <TableCell className="text-sm">{e.description}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
