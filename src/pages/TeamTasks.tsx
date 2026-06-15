import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampus } from "@/contexts/CampusContext";
import { supabase } from "@/integrations/supabase/client";
import { useSetting, DEFAULT_TASK_PRIORITIES, DEFAULT_TASK_STATUSES } from "@/hooks/useSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Trash2, Search, X } from "lucide-react";
import TeamColumnsManager, { CustomColumnCell, useCustomColumns, useColumnValues, ColumnHeader, QuickAddColumn, BuiltInColumnHeader } from "@/components/TeamColumnsManager";



// Inline editable cell
function EditableCell({ value, onSave, className = "", autoFocus = false }: { value: string; onSave: (v: string) => void; className?: string; autoFocus?: boolean }) {
  const [editing, setEditing] = useState(autoFocus);
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => { setEditing(false); if (val !== value) onSave(val); };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
        className={`h-7 text-xs border-primary/50 ${className}`}
      />
    );
  }

  return (
    <div onClick={() => setEditing(true)} className={`cursor-text min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 text-sm ${className} ${!value ? "text-muted-foreground italic" : ""}`}>
      {value || "Clique para editar"}
    </div>
  );
}

// Inline select
function InlineSelect({ value, options, onSelect, colorMap, placeholder = "Selecionar" }: {
  value: string; options: { value: string; label: string }[]; onSelect: (v: string) => void; colorMap?: Record<string, string>; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 cursor-pointer w-full">
          {current ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${colorMap?.[value] || "bg-muted text-foreground"}`}>
              {current.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onSelect(opt.value); setOpen(false); }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
          >
            <span className={`px-2 py-0.5 rounded font-medium ${colorMap?.[opt.value] || "bg-muted"}`}>
              {opt.label}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Priority select (string-based)
function PrioritySelect({ value, onSelect, priorities, colorMap }: {
  value: string; onSelect: (v: string) => void; priorities: string[]; colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 cursor-pointer w-full">
          {value ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${colorMap[value] || "bg-muted"}`}>{value}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Selecionar</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {priorities.map((p) => (
          <button key={p} onClick={() => { onSelect(p); setOpen(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left">
            <span className={`px-2 py-0.5 rounded font-medium ${colorMap[p] || "bg-muted"}`}>{p}</span>
          </button>
        ))}
        {value && (
          <button onClick={() => { onSelect(""); setOpen(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left text-muted-foreground">
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// User multi-select dropdown
function UserMultiSelect({ values, profiles, onSave }: {
  values: string[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  onSave: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getName = (p: { full_name: string | null; email: string | null }) => p.full_name || p.email || "Sem nome";

  const toggle = (uid: string) => {
    const next = values.includes(uid) ? values.filter((v) => v !== uid) : [...values, uid];
    onSave(next);
  };

  const filteredProfiles = profiles.filter((p) =>
    getName(p).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[28px] flex items-center gap-1 flex-wrap px-1 rounded hover:bg-accent/50 cursor-pointer w-full">
          {values.length > 0 ? (
            <div className="flex -space-x-1">
              {values.map((uid) => {
                const p = profiles.find((pr) => pr.id === uid);
                const name = p ? getName(p) : uid.slice(0, 4);
                return (
                  <div key={uid} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-semibold text-primary" title={name}>
                    {name[0]?.toUpperCase()}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Atribuir</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="px-1 pb-1">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuário..."
            className="h-7 text-xs"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filteredProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left ${values.includes(p.id) ? "bg-accent" : ""}`}
            >
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                {getName(p)[0]?.toUpperCase()}
              </div>
              <span className="truncate">{getName(p)}</span>
              {values.includes(p.id) && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Inline date picker
function InlineDateInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <Input
      type="date"
      value={value || ""}
      onChange={(e) => onSave(e.target.value)}
      className="h-7 text-xs border-none bg-transparent hover:bg-accent/50 cursor-pointer w-full"
    />
  );
}

export default function TeamTasks() {
  const { user, profile, isAdmin } = useAuth();
  const { campus } = useCampus();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newRowId, setNewRowId] = useState<string | null>(null);

  const PRIORITIES = ["Alta", "Média", "Baixa"];
  const TASK_STATUSES = DEFAULT_TASK_STATUSES;
  const priorityColor: Record<string, string> = {
    Alta: "bg-red-500/20 text-red-700 border-red-300",
    Média: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
    Baixa: "bg-blue-500/20 text-blue-700 border-blue-300",
  };
  const taskStatusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["team_tasks", campus],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_tasks").select("*").eq("campus", campus).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assigneesMap = {} } = useQuery({
    queryKey: ["team_task_assignees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_task_assignees").select("*");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      data.forEach((a) => { if (!map[a.task_id]) map[a.task_id] = []; map[a.task_id].push(a.user_id); });
      return map;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: customCols = [] } = useCustomColumns("tasks");
  const taskIds = tasks.map((t: any) => t.id);
  const { data: colValues = {} } = useColumnValues(taskIds);

  const upsertColValue = useMutation({
    mutationFn: async ({ rowId, columnId, value }: { rowId: string; columnId: string; value: any }) => {
      const { error } = await supabase.from("team_column_values")
        .upsert({ row_id: rowId, column_id: columnId, value }, { onConflict: "column_id,row_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team_column_values"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("team_tasks").update({ [field]: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team_tasks", campus] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateAssignees = useMutation({
    mutationFn: async ({ taskId, assignees }: { taskId: string; assignees: string[] }) => {
      await supabase.from("team_task_assignees").delete().eq("task_id", taskId);
      if (assignees.length > 0) {
        const { error } = await supabase.from("team_task_assignees").insert(
          assignees.map((uid) => ({ task_id: taskId, user_id: uid }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team_task_assignees"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("team_tasks").insert({
        title: "",
        status: "pending",
        created_by: user!.id,
        created_by_name: profile?.full_name || profile?.email || "",
        campus,
      }).select().single();
      if (error) throw error;
      return (data as any)?.id as string | undefined;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["team_tasks", campus] });
      if (id) setNewRowId(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_tasks", campus] });
      toast.success("Tarefa excluída!");
    },
  });

  const toggleDone = (id: string, currentStatus: string) => {
    updateField.mutate({ id, field: "status", value: currentStatus === "done" ? "pending" : "done" });
  };

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Lista de Tarefas</h1>
        <p className="text-sm text-muted-foreground">Gerencie tarefas e atribua responsáveis</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {isAdmin && <TeamColumnsManager table="tasks" />}
          <Button onClick={() => addRow.mutate()} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Nova Linha
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10" />
              <TableHead className="min-w-[250px]"><BuiltInColumnHeader field="title" defaultLabel="Tarefa" type="Texto" table="tasks" /></TableHead>
              <TableHead className="min-w-[120px]"><BuiltInColumnHeader field="description" defaultLabel="Descrição" type="Texto" table="tasks" /></TableHead>
              <TableHead className="min-w-[100px]"><BuiltInColumnHeader field="priority" defaultLabel="Prioridade" type="Seleção" table="tasks" /></TableHead>
              <TableHead className="min-w-[140px]"><BuiltInColumnHeader field="assignees" defaultLabel="Responsáveis" type="Pessoas" table="tasks" /></TableHead>
              <TableHead className="min-w-[120px]"><BuiltInColumnHeader field="due_date" defaultLabel="Prazo" type="Data" table="tasks" /></TableHead>
              <TableHead className="min-w-[120px]"><BuiltInColumnHeader field="status" defaultLabel="Status" type="Seleção" table="tasks" /></TableHead>
              {customCols.map((c) => (
                <TableHead key={c.id} className="min-w-[140px]">
                  <ColumnHeader column={c} table="tasks" />
                </TableHead>
              ))}
              <TableHead className="w-8 p-0">
                <QuickAddColumn table="tasks" existingCols={customCols} />
              </TableHead>
              <TableHead className="min-w-[120px]">Criado por</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada</TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className={`group ${t.status === "done" ? "opacity-60" : ""}`}>
                  <TableCell className="p-1 text-center">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={() => toggleDone(t.id, t.status)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      value={t.title}
                      autoFocus={t.id === newRowId}
                      onSave={(v) => { updateField.mutate({ id: t.id, field: "title", value: v }); setNewRowId(null); }}
                      className={`font-medium ${t.status === "done" ? "line-through" : ""}`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      value={t.description || ""}
                      onSave={(v) => updateField.mutate({ id: t.id, field: "description", value: v })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <PrioritySelect
                      value={t.priority || ""}
                      onSelect={(v) => updateField.mutate({ id: t.id, field: "priority", value: v || null })}
                      priorities={PRIORITIES}
                      colorMap={priorityColor}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <UserMultiSelect
                      values={assigneesMap[t.id] || []}
                      profiles={profiles}
                      onSave={(v) => updateAssignees.mutate({ taskId: t.id, assignees: v })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <InlineDateInput
                      value={t.due_date || ""}
                      onSave={(v) => updateField.mutate({ id: t.id, field: "due_date", value: v || null })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <InlineSelect
                      value={t.status}
                      options={TASK_STATUSES}
                      onSelect={(v) => updateField.mutate({ id: t.id, field: "status", value: v })}
                      colorMap={taskStatusColor}
                    />
                  </TableCell>
                  {customCols.map((c) => (
                    <TableCell key={c.id} className="p-1">
                      <CustomColumnCell
                        column={c}
                        value={colValues[t.id]?.[c.id]}
                        onSave={(v) => upsertColValue.mutate({ rowId: t.id, columnId: c.id, value: v })}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="p-0 w-8" />
                  <TableCell className="p-1 text-sm px-2">{t.created_by_name}</TableCell>
                  {isAdmin && (
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteRow.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <button
        onClick={() => addRow.mutate()}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded hover:bg-accent/50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar linha
      </button>
    </div>
  );
}
