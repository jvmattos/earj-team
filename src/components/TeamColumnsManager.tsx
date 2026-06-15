import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Trash2, Settings2, X, ChevronDown } from "lucide-react";

export const COLORS = [
  { value: "bg-blue-500",   label: "Azul" },
  { value: "bg-green-500",  label: "Verde" },
  { value: "bg-yellow-500", label: "Amarelo" },
  { value: "bg-red-500",    label: "Vermelho" },
  { value: "bg-purple-500", label: "Roxo" },
  { value: "bg-pink-500",   label: "Rosa" },
  { value: "bg-orange-500", label: "Laranja" },
  { value: "bg-cyan-500",   label: "Ciano" },
  { value: "bg-gray-500",   label: "Cinza" },
];

export type ColType = "text" | "number" | "date" | "select" | "multi";
export type ColOption = { label: string; color: string };

export type CustomColumn = {
  id: string;
  table_name: "tasks" | "requests";
  name: string;
  type: ColType;
  options: ColOption[];
  position: number;
};

export function useCustomColumns(table: "tasks" | "requests") {
  return useQuery({
    queryKey: ["team_columns", table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_columns").select("*")
        .eq("table_name", table).order("position");
      if (error) throw error;
      return (data || []) as unknown as CustomColumn[];
    },
  });
}

export function useColumnValues(rowIds: string[]) {
  return useQuery({
    enabled: rowIds.length > 0,
    queryKey: ["team_column_values", rowIds.sort().join(",")],
    queryFn: async () => {
      if (!rowIds.length) return {};
      const { data, error } = await supabase
        .from("team_column_values").select("*").in("row_id", rowIds);
      if (error) throw error;
      const map: Record<string, Record<string, any>> = {};
      (data || []).forEach((v: any) => {
        if (!map[v.row_id]) map[v.row_id] = {};
        map[v.row_id][v.column_id] = v.value;
      });
      return map;
    },
  });
}

// ── Quick add column button (for table header "+") ──────────
export function QuickAddColumn({ table, existingCols }: { table: "tasks" | "requests"; existingCols: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColType>("text");
  const qc = useQueryClient();

  const create = async () => {
    if (!name.trim()) return;
    const max = Math.max(0, ...existingCols.map((c) => c.position));
    const { error } = await supabase.from("team_columns").insert({
      table_name: table, name: name.trim(), type, options: [], position: max + 1,
    } as any);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["team_columns", table] });
    setName(""); setType("text"); setOpen(false);
    toast.success("Coluna criada!");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-center w-8 h-full text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors" title="Adicionar coluna">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" align="start">
        <p className="text-xs font-semibold">Nova coluna</p>
        <Input autoFocus placeholder="Nome da coluna" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          className="h-8 text-xs" />
        <Select value={type} onValueChange={(v) => setType(v as ColType)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="number">Número</SelectItem>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="select">Seleção única</SelectItem>
            <SelectItem value="multi">Multi-seleção</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="w-full h-8 text-xs" onClick={create} disabled={!name.trim()}>
          Criar coluna
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ── Column header with inline Notion-like editing ───────────
export function ColumnHeader({ column, table }: { column: CustomColumn; table: "tasks" | "requests" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [optLabel, setOptLabel] = useState("");
  const [optColor, setOptColor] = useState(COLORS[0].value);

  const update = useMutation({
    mutationFn: async (data: Partial<CustomColumn>) => {
      const { error } = await supabase.from("team_columns").update(data as any).eq("id", column.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_columns", table] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_columns").delete().eq("id", column.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team_columns", table] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveName = () => {
    if (name.trim() && name.trim() !== column.name) update.mutate({ name: name.trim() });
  };

  const addOption = () => {
    if (!optLabel.trim()) return;
    update.mutate({ options: [...column.options, { label: optLabel.trim(), color: optColor }] as any });
    setOptLabel("");
  };

  const removeOption = (i: number) => {
    update.mutate({ options: column.options.filter((_, j) => j !== i) as any });
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(column.name); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 w-full text-left hover:text-primary transition-colors group">
          <span className="truncate text-xs font-medium">{column.name}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start">
        {/* Name */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Nome da coluna</p>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") { saveName(); } }}
            className="h-7 text-xs" />
        </div>

        {/* Type (read-only) */}
        <div>
          <p className="text-[10px] text-muted-foreground">
            Tipo: <span className="font-medium text-foreground capitalize">{
              { text: "Texto", number: "Número", date: "Data", select: "Seleção", multi: "Multi-seleção" }[column.type]
            }</span>
          </p>
        </div>

        {/* Options editor for select/multi */}
        {(column.type === "select" || column.type === "multi") && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Opções</p>
            {column.options.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">Nenhuma opção ainda</p>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {column.options.map((o, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded text-white flex-1 truncate ${o.color}`}>{o.label}</span>
                  <button onClick={() => removeOption(i)}
                    className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <Input placeholder="Nova opção" value={optLabel}
                onChange={(e) => setOptLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addOption(); }}
                className="h-7 text-xs flex-1" />
              <Select value={optColor} onValueChange={setOptColor}>
                <SelectTrigger className="h-7 w-9 px-1.5 shrink-0">
                  <span className={`h-3 w-3 rounded-full ${optColor}`} />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${c.value}`} /> {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 px-2 shrink-0" onClick={addOption} disabled={!optLabel.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="pt-2 border-t">
          <button
            onClick={() => { if (confirm(`Excluir coluna "${column.name}" e todos os seus valores?`)) remove.mutate(); }}
            className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 w-full py-0.5"
          >
            <Trash2 className="h-3 w-3" /> Excluir coluna
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Built-in column header (rename via localStorage) ─────────
export function BuiltInColumnHeader({ field, defaultLabel, type, table }: {
  field: string; defaultLabel: string; type: string; table: string;
}) {
  const storageKey = `stokit_col_labels_${table}`;

  const getLabel = () => {
    try { const s = localStorage.getItem(storageKey); if (s) return JSON.parse(s)[field] || defaultLabel; } catch {}
    return defaultLabel;
  };

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(getLabel);
  const [val, setVal] = useState(label);

  const save = () => {
    const trimmed = val.trim() || defaultLabel;
    setLabel(trimmed);
    try {
      const s = localStorage.getItem(storageKey);
      const labels = s ? JSON.parse(s) : {};
      if (trimmed === defaultLabel) delete labels[field]; else labels[field] = trimmed;
      localStorage.setItem(storageKey, JSON.stringify(labels));
    } catch {}
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setVal(label); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 w-full text-left hover:text-primary transition-colors group">
          <span className="truncate text-xs font-medium">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3 space-y-3" align="start">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Nome da coluna</p>
          <Input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
            className="h-7 text-xs" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Tipo: <span className="font-medium text-foreground">{type}</span>
        </p>
        {label !== defaultLabel && (
          <button onClick={() => { setVal(defaultLabel); setTimeout(save, 0); }}
            className="text-[11px] text-muted-foreground hover:text-foreground">
            Restaurar padrão
          </button>
        )}
        <Button size="sm" className="w-full h-7 text-xs" onClick={save}>Salvar</Button>
      </PopoverContent>
    </Popover>
  );
}

// ── Settings dialog (existing) ───────────────────────────────
export default function TeamColumnsManager({ table }: { table: "tasks" | "requests" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColType>("text");
  const [options, setOptions] = useState<ColOption[]>([]);
  const [optLabel, setOptLabel] = useState("");
  const [optColor, setOptColor] = useState(COLORS[0].value);

  const { data: cols = [] } = useCustomColumns(table);

  const create = useMutation({
    mutationFn: async () => {
      const max = Math.max(0, ...cols.map((c) => c.position));
      const { error } = await supabase.from("team_columns").insert({
        table_name: table, name, type, options: options as any, position: max + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_columns", table] });
      toast.success("Coluna criada");
      setOpen(false); setName(""); setType("text"); setOptions([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Settings2 className="h-3.5 w-3.5" /> Colunas ({cols.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Colunas customizadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {cols.length > 0 && (
            <div className="border rounded-lg divide-y">
              {cols.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{c.type}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.options?.length > 0 && `${c.options.length} opções`}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="text-xs font-semibold">Nova coluna</div>
            <Input placeholder="Nome da coluna" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            <Select value={type} onValueChange={(v) => setType(v as ColType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="select">Seleção única</SelectItem>
                <SelectItem value="multi">Multi-seleção</SelectItem>
              </SelectContent>
            </Select>
            {(type === "select" || type === "multi") && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Opções</div>
                <div className="flex flex-wrap gap-1">
                  {options.map((o, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded text-white ${o.color} flex items-center gap-1`}>
                      {o.label}
                      <button onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input placeholder="Opção" value={optLabel} onChange={(e) => setOptLabel(e.target.value)} className="h-7 text-xs" />
                  <Select value={optColor} onValueChange={setOptColor}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLORS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className={`h-3 w-3 rounded ${c.value}`} /> {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7" onClick={() => {
                    if (!optLabel.trim()) return;
                    setOptions([...options, { label: optLabel.trim(), color: optColor }]);
                    setOptLabel("");
                  }}>+</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => name.trim() && create.mutate()} disabled={!name.trim()} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Criar coluna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cell renderer ────────────────────────────────────────────
export function CustomColumnCell({ column, value, onSave }: {
  column: CustomColumn; value: any; onSave: (v: any) => void;
}) {
  if (column.type === "text") {
    return (
      <input defaultValue={value || ""} onBlur={(e) => e.target.value !== (value || "") && onSave(e.target.value)}
        className="w-full h-7 text-xs bg-transparent hover:bg-accent/50 rounded px-1 outline-none focus:bg-accent/50" />
    );
  }
  if (column.type === "number") {
    return (
      <input type="number" defaultValue={value ?? ""} onBlur={(e) => {
        const n = e.target.value === "" ? null : Number(e.target.value);
        if (n !== value) onSave(n);
      }} className="w-full h-7 text-xs bg-transparent hover:bg-accent/50 rounded px-1 outline-none focus:bg-accent/50" />
    );
  }
  if (column.type === "date") {
    return (
      <input type="date" defaultValue={value || ""} onChange={(e) => onSave(e.target.value || null)}
        className="w-full h-7 text-xs bg-transparent hover:bg-accent/50 rounded px-1 outline-none" />
    );
  }
  if (column.type === "select") {
    return (
      <Select value={value || undefined} onValueChange={(v) => onSave(v || null)}>
        <SelectTrigger className="h-7 text-xs border-none bg-transparent">
          {value ? (
            <span className={`text-[11px] px-2 py-0.5 rounded text-white ${column.options.find((o) => o.label === value)?.color || "bg-gray-500"}`}>
              {value}
            </span>
          ) : <span className="text-muted-foreground italic text-xs">Selecionar</span>}
        </SelectTrigger>
        <SelectContent>
          {column.options.filter(o => o.label).map((o) => (
            <SelectItem key={o.label} value={o.label}>
              <span className={`text-[11px] px-2 py-0.5 rounded text-white ${o.color}`}>{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // multi
  const vals: string[] = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-wrap gap-1 min-h-[28px] items-center px-1">
      {column.options.map((o) => {
        const active = vals.includes(o.label);
        return (
          <button key={o.label}
            onClick={() => onSave(active ? vals.filter((v) => v !== o.label) : [...vals, o.label])}
            className={`text-[11px] px-2 py-0.5 rounded text-white transition-opacity ${o.color} ${active ? "" : "opacity-30"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
