import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampus } from "@/contexts/CampusContext";
import { supabase } from "@/integrations/supabase/client";
import { useSetting, DEFAULT_PRODUCT_AREAS, DEFAULT_REQUEST_PRIORITIES as DEFAULT_PRIORITIES, DEFAULT_REQUEST_STATUSES as DEFAULT_STATUSES } from "@/hooks/useSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Trash2, Search, X, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TeamColumnsManager, { CustomColumnCell, useCustomColumns, useColumnValues, useColumnPrefs, ColumnHeader, QuickAddColumn, BuiltInColumnHeader } from "@/components/TeamColumnsManager";
import { logAudit, formatLogValue } from "@/lib/auditLog";

const REQUEST_FIELD_LABELS: Record<string, string> = {
  name: "Nome da solicitação",
  product_area: "Área de produto",
  description: "Descrição",
  priority: "Prioridade",
  status: "Status",
};

const REQUEST_BUILTIN_FIELDS = [
  { field: "name", label: "Nome da solicitação" },
  { field: "product_area", label: "Área de produto" },
  { field: "description", label: "Descrição" },
  { field: "priority", label: "Prioridade" },
  { field: "created_at", label: "Data solicitada" },
  { field: "requested_by_name", label: "Solicitado por" },
  { field: "status", label: "Status" },
];


const priorityColor: Record<string, string> = {
  Alta: "bg-red-500/20 text-red-400 border-red-500/30",
  Média: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Baixa: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusColor: Record<string, string> = {
  Novo: "bg-blue-600 text-white",
  Recompra: "bg-orange-500 text-white",
  Recusado: "bg-red-600 text-white",
  Aprovado: "bg-green-600 text-white",
  "Em andamento": "bg-yellow-500 text-white",
  "Concluído": "bg-emerald-600 text-white",
};

const areaColors: Record<string, string> = {
  IT: "bg-violet-600",
  Redes: "bg-teal-600",
  Áudio: "bg-pink-600",
  Vídeo: "bg-purple-600",
  Energia: "bg-amber-600",
  Som: "bg-rose-600",
  Projetor: "bg-red-500",
  Ferramentas: "bg-cyan-600",
  Organização: "bg-lime-600",
};

// Inline editable cell
function EditableCell({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (val !== value) onSave(val);
  };

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
    <div
      onClick={() => setEditing(true)}
      className={`cursor-text min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 text-sm ${className} ${!value ? "text-muted-foreground italic" : ""}`}
    >
      {value || "Clique para editar"}
    </div>
  );
}

// Dropdown select with create option
function InlineSelect({
  value,
  options,
  onSelect,
  onCreate,
  colorMap,
  placeholder = "Selecionar",
}: {
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  onCreate?: (v: string) => void;
  colorMap?: Record<string, string>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newVal, setNewVal] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 cursor-pointer w-full">
          {value ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${colorMap?.[value] || "bg-muted text-foreground"}`}>
              {value}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="text-[10px] text-muted-foreground px-2 py-1">Selecione uma opção ou crie uma</div>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => { onSelect(opt); setOpen(false); }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40" />
            <span className={`px-2 py-0.5 rounded font-medium ${colorMap?.[opt] || "bg-muted"}`}>
              {opt}
            </span>
          </button>
        ))}
        {value && (
          <button
            onClick={() => { onSelect(""); setOpen(false); }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left text-muted-foreground"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
        {onCreate && (
          <div className="border-t mt-1 pt-1 px-1">
            <div className="flex gap-1">
              <Input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="Criar novo..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newVal.trim()) {
                    onCreate(newVal.trim());
                    onSelect(newVal.trim());
                    setNewVal("");
                    setOpen(false);
                  }
                }}
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Multi-select tags
function InlineMultiSelect({
  values,
  options,
  onSave,
  onCreate,
  colorMap,
}: {
  values: string[];
  options: string[];
  onSave: (v: string[]) => void;
  onCreate?: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [newVal, setNewVal] = useState("");

  const toggle = (opt: string) => {
    const next = values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt];
    onSave(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[28px] flex items-center gap-1 flex-wrap px-1 rounded hover:bg-accent/50 cursor-pointer w-full">
          {values.length > 0 ? values.map((v) => (
            <span key={v} className={`text-[11px] px-2 py-0.5 rounded text-white font-medium ${colorMap?.[v] || "bg-gray-500"}`}>
              {v}
            </span>
          )) : (
            <span className="text-xs text-muted-foreground italic">Selecionar</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left ${values.includes(opt) ? "bg-accent" : ""}`}
          >
            <span className={`text-[11px] px-2 py-0.5 rounded text-white font-medium ${colorMap?.[opt] || "bg-gray-500"}`}>
              {opt}
            </span>
          </button>
        ))}
        {onCreate && (
          <div className="border-t mt-1 pt-1 px-1">
            <Input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              placeholder="Criar novo..."
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newVal.trim()) {
                  onCreate(newVal.trim());
                  toggle(newVal.trim());
                  setNewVal("");
                }
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function TeamRequests() {
  const { user, profile, isAdmin } = useAuth();
  const canEdit = isAdmin || profile?.role === "operator";
  const { campus } = useCampus();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { value: areasRaw } = useSetting("product_areas", DEFAULT_PRODUCT_AREAS);
  const { value: prioritiesRaw } = useSetting("request_priorities", DEFAULT_PRIORITIES);
  const { value: statusesRaw } = useSetting("request_statuses", DEFAULT_STATUSES);

  const allAreas = (areasRaw as string[]) || DEFAULT_PRODUCT_AREAS;
  const allPriorities = (prioritiesRaw as string[]) || DEFAULT_PRIORITIES;
  const allStatuses = (statusesRaw as string[]) || DEFAULT_STATUSES;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["team_requests", campus],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_requests")
        .select("*")
        .eq("campus", campus)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customCols = [] } = useCustomColumns("requests");
  const rowIds = requests.map((r: any) => r.id);
  const { data: colValues = {} } = useColumnValues(rowIds);
  const { prefs } = useColumnPrefs("requests");
  const visibleBuiltIn = REQUEST_BUILTIN_FIELDS.filter((f) => !prefs[f.field]?.hidden).map((f) => f.field);
  const isVisible = (field: string) => visibleBuiltIn.includes(field);
  const totalCols = visibleBuiltIn.length + customCols.length + 1 + (canEdit ? 1 : 0);

  const log = (action: "create" | "update" | "delete", description: string, record_id?: string) =>
    logAudit({ table_name: "team_requests", record_id, action, description, user_id: user?.id, user_name: profile?.full_name || profile?.email || "" });

  const upsertColValue = useMutation({
    mutationFn: async ({ rowId, columnId, value }: { rowId: string; columnId: string; value: any }) => {
      const { error } = await supabase.from("team_column_values")
        .upsert({ row_id: rowId, column_id: columnId, value }, { onConflict: "column_id,row_id" });
      if (error) throw error;
      const row = requests.find((r: any) => r.id === rowId);
      const col = customCols.find((c) => c.id === columnId);
      log("update", `Editou "${col?.name || "coluna"}" para "${formatLogValue(value)}" em "${row?.name || rowId}"`, rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team_column_values"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const row = requests.find((r: any) => r.id === id);
      const { error } = await supabase.from("team_requests").update({ [field]: value } as any).eq("id", id);
      if (error) throw error;
      log("update", `Editou "${REQUEST_FIELD_LABELS[field] || field}" para "${formatLogValue(value)}" em "${row?.name || id}"`, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team_requests", campus] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_requests").insert({
        name: "Nova solicitação",
        status: "Novo",
        requested_by: user!.id,
        requested_by_name: profile?.full_name || profile?.email || "",
        campus,
      });
      if (error) throw error;
      log("create", `Criou o pedido "Nova solicitação"`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_requests", campus] });
      toast.success("Linha adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const row = requests.find((r: any) => r.id === id);
      const { error } = await supabase.from("team_requests").delete().eq("id", id);
      if (error) throw error;
      log("delete", `Excluiu o pedido "${row?.name || id}"`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_requests", campus] });
      toast.success("Linha excluída!");
    },
  });

  const filtered = requests.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Lista de Pedidos</h1>
        <p className="text-sm text-muted-foreground">Gerencie solicitações da equipe</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pedidos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {canEdit && <TeamColumnsManager table="requests" builtInFields={REQUEST_BUILTIN_FIELDS} />}
          <Button onClick={() => addRow.mutate()} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Nova Linha
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {isVisible("name") && <TableHead className="min-w-[250px]"><BuiltInColumnHeader field="name" defaultLabel="Nome da solicitação" type="Texto" table="requests" /></TableHead>}
              {isVisible("product_area") && <TableHead className="min-w-[150px]"><BuiltInColumnHeader field="product_area" defaultLabel="Área de produto" type="Multi-seleção" table="requests" /></TableHead>}
              {isVisible("description") && <TableHead className="min-w-[150px]"><BuiltInColumnHeader field="description" defaultLabel="Descrição" type="Texto" table="requests" /></TableHead>}
              {isVisible("priority") && <TableHead className="min-w-[100px]"><BuiltInColumnHeader field="priority" defaultLabel="Prioridade" type="Seleção" table="requests" /></TableHead>}
              {isVisible("created_at") && <TableHead className="min-w-[160px]"><BuiltInColumnHeader field="created_at" defaultLabel="Data solicitada" type="Data" table="requests" /></TableHead>}
              {isVisible("requested_by_name") && <TableHead className="min-w-[140px]"><BuiltInColumnHeader field="requested_by_name" defaultLabel="Solicitado por" type="Texto" table="requests" /></TableHead>}
              {isVisible("status") && <TableHead className="min-w-[120px]"><BuiltInColumnHeader field="status" defaultLabel="Status" type="Seleção" table="requests" /></TableHead>}
              {customCols.map((c) => (
                <TableHead key={c.id} className="min-w-[140px]">
                  <ColumnHeader column={c} table="requests" />
                </TableHead>
              ))}
              <TableHead className="w-8 p-0">
                <QuickAddColumn table="requests" existingCols={customCols} />
              </TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={totalCols} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalCols} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="group">
                  {isVisible("name") && (
                    <TableCell className="p-1">
                      <EditableCell
                        value={r.name}
                        onSave={(v) => updateField.mutate({ id: r.id, field: "name", value: v })}
                        className="font-medium"
                      />
                    </TableCell>
                  )}
                  {isVisible("product_area") && (
                    <TableCell className="p-1">
                      <InlineMultiSelect
                        values={(r.product_area as string[]) || []}
                        options={allAreas}
                        onSave={(v) => updateField.mutate({ id: r.id, field: "product_area", value: v })}
                        onCreate={undefined}
                        colorMap={areaColors}
                      />
                    </TableCell>
                  )}
                  {isVisible("description") && (
                    <TableCell className="p-1">
                      <EditableCell
                        value={r.description || ""}
                        onSave={(v) => updateField.mutate({ id: r.id, field: "description", value: v })}
                      />
                    </TableCell>
                  )}
                  {isVisible("priority") && (
                    <TableCell className="p-1">
                      <InlineSelect
                        value={r.priority || ""}
                        options={allPriorities}
                        onSelect={(v) => updateField.mutate({ id: r.id, field: "priority", value: v || null })}
                        onCreate={undefined}
                        colorMap={priorityColor}
                      />
                    </TableCell>
                  )}
                  {isVisible("created_at") && (
                    <TableCell className="p-1 text-sm text-muted-foreground whitespace-nowrap px-2">
                      {r.created_at && format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  )}
                  {isVisible("requested_by_name") && <TableCell className="p-1 text-sm px-2">{r.requested_by_name}</TableCell>}
                  {isVisible("status") && (
                    <TableCell className="p-1">
                      <InlineSelect
                        value={r.status}
                        options={allStatuses}
                        onSelect={(v) => v && updateField.mutate({ id: r.id, field: "status", value: v })}
                        onCreate={undefined}
                        colorMap={statusColor}
                      />
                    </TableCell>
                  )}
                  {customCols.map((c) => (
                    <TableCell key={c.id} className="p-1">
                      <CustomColumnCell
                        column={c}
                        value={colValues[r.id]?.[c.id]}
                        onSave={(v) => upsertColValue.mutate({ rowId: r.id, columnId: c.id, value: v })}
                      />
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteRow.mutate(r.id)}
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

      {/* Add row button at bottom */}
      <button
        onClick={() => addRow.mutate()}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded hover:bg-accent/50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar linha
      </button>
    </div>
  );
}
