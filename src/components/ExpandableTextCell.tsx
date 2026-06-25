import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ExpandableTextCell({
  value,
  onSave,
  className = "",
  placeholder = "Clique para editar",
  title = "Editar texto",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value);

  const openDialog = () => { setVal(value); setOpen(true); };
  const save = () => { if (val !== value) onSave(val); setOpen(false); };
  const cancel = () => setOpen(false);

  return (
    <>
      <div
        onClick={openDialog}
        title={value || undefined}
        className={`cursor-pointer min-h-[28px] flex items-center px-1 rounded hover:bg-accent/50 text-sm truncate ${className} ${!value ? "text-muted-foreground italic" : ""}`}
      >
        {value || placeholder}
      </div>
      <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <Textarea
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="min-h-[160px] text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={cancel}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
