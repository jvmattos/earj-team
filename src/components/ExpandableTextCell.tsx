import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const URL_REGEX = /^(https?:\/\/|www\.)\S+$/i;
const isLikelyUrl = (text: string) => URL_REGEX.test(text.trim());
const normalizeUrl = (text: string) => {
  const t = text.trim();
  return t.startsWith("http") ? t : `https://${t}`;
};

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
  const [editing, setEditing] = useState(false);

  const openDialog = () => { setVal(value); setEditing(false); setOpen(true); };
  const save = () => { if (val !== value) onSave(val); setOpen(false); };
  const cancel = () => setOpen(false);
  const showAsLink = val.trim() && isLikelyUrl(val) && !editing;

  return (
    <>
      <div
        onClick={openDialog}
        title={value || undefined}
        className={`cursor-pointer min-h-[28px] max-w-[220px] flex items-center px-1 rounded hover:bg-accent/50 text-sm truncate ${className} ${!value ? "text-muted-foreground italic" : ""}`}
      >
        {value || placeholder}
      </div>
      <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {showAsLink ? (
            <a
              href={normalizeUrl(val)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-primary hover:underline break-all min-h-[160px] p-2 border rounded-md"
            >
              {val}
            </a>
          ) : (
            <Textarea
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="min-h-[160px] text-sm"
            />
          )}
          <DialogFooter className="sm:justify-between">
            {showAsLink ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
