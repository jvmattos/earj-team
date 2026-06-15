import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCampus } from "@/contexts/CampusContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PAGE_TYPES = [
  { value: "notes", label: "📝 Notas", desc: "Texto livre para a equipe" },
  { value: "checklist", label: "✅ Checklist", desc: "Lista de itens com progresso" },
  { value: "calendar", label: "📅 Calendário", desc: "Reuniões e eventos" },
  { value: "mural", label: "📌 Mural", desc: "Avisos e comunicados" },
  { value: "contacts", label: "📞 Contatos", desc: "Agenda de contatos" },
  { value: "kanban", label: "🗂️ Kanban", desc: "Quadro de cards por coluna" },
  { value: "link", label: "🔗 Link externo", desc: "Atalho para URL" },
];

const ICONS = ["FileText", "Calendar", "Clipboard", "ListChecks", "Megaphone", "Phone", "LayoutGrid", "BookOpen", "Star", "Globe", "Folder"];

interface PageData {
  id: string;
  title: string;
  type: string;
  icon: string;
  url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  page?: PageData | null;
}

export default function AddPageDialog({ open, onClose, onCreated, page }: Props) {
  const { campus } = useCampus();
  const isEditing = !!page;
  const [title, setTitle] = useState("");
  const [type, setType] = useState("notes");
  const [icon, setIcon] = useState("FileText");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (page) {
        setTitle(page.title);
        setType(page.type);
        setIcon(page.icon);
        setUrl(page.url || "");
      } else {
        setTitle(""); setType("notes"); setIcon("FileText"); setUrl("");
      }
    }
  }, [open, page]);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Digite um título");
    if (type === "link" && !url.trim()) return toast.error("Digite a URL");
    setLoading(true);
    try {
      if (isEditing && page) {
        const { error } = await supabase.from("team_pages").update({
          title: title.trim(),
          icon,
          url: type === "link" ? url.trim() : null,
        }).eq("id", page.id);
        if (error) throw error;
        toast.success("Página atualizada!");
      } else {
        const { count } = await supabase.from("team_pages").select("*", { count: "exact", head: true }).eq("campus", campus);
        const { error } = await supabase.from("team_pages").insert({
          title: title.trim(),
          type,
          icon,
          url: type === "link" ? url.trim() : null,
          position: (count ?? 0) + 1,
          is_visible: true,
          campus,
        });
        if (error) throw error;
        toast.success("Página criada!");
      }
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar página" : "Nova página"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-9 text-sm"
              placeholder="Ex: Documentação, Reuniões..."
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de página</Label>
            {isEditing && (
              <p className="text-[11px] text-muted-foreground mt-1 mb-1.5">O tipo não pode ser alterado após a criação.</p>
            )}
            <div className="grid grid-cols-1 gap-1.5 mt-1">
              {PAGE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => !isEditing && setType(pt.value)}
                  disabled={isEditing && type !== pt.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                    type === pt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-accent"
                  } ${isEditing && type !== pt.value ? "hidden" : ""}`}
                >
                  <span className="text-base">{pt.label.split(" ")[0]}</span>
                  <div>
                    <div className="font-medium text-xs">{pt.label.split(" ").slice(1).join(" ")}</div>
                    <div className="text-[11px] text-muted-foreground">{pt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Ícone</Label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`px-2.5 py-1.5 rounded-md border text-[11px] transition-all ${
                    icon === ic ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          {type === "link" && (
            <div>
              <Label className="text-xs">URL *</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 h-9 text-sm"
                placeholder="https://..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? "Salvando..." : isEditing ? "Salvar" : "Criar página"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
