import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSetting, useSaveSetting } from "@/hooks/useSettings";
import { useGoogleCalendarAuth } from "@/hooks/useGoogleCalendarAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Clock, Users, Calendar, Save, ExternalLink, Phone, Mail, Pin, X, Check, Link2 } from "lucide-react";
import { format, parseISO, isAfter, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ────────────────────────────────────────────────────
type TeamPage = {
  id: string; title: string; type: string; icon: string;
  url?: string; content?: string; google_calendar_id?: string;
};

type Meeting = {
  id: string; page_id: string; title: string;
  description?: string; location?: string;
  start_date: string; start_time?: string; end_time?: string;
  participants?: string; created_by_name?: string; created_at: string;
  google_event_id?: string;
};

// ── Google Calendar event helpers ───────────────────────────────
function toGoogleEvent(form: { title: string; description: string; location: string; start_date: string; start_time: string; end_time: string }) {
  const summary = form.title.trim();
  const description = form.description || undefined;
  const location = form.location || undefined;
  if (form.start_time) {
    let endTime = form.end_time;
    if (!endTime) {
      const [h, m] = form.start_time.split(":").map(Number);
      const d = new Date(0, 0, 0, h, m);
      d.setHours(d.getHours() + 1);
      endTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return {
      summary, description, location,
      start: { dateTime: `${form.start_date}T${form.start_time}:00-03:00` },
      end: { dateTime: `${form.start_date}T${endTime}:00-03:00` },
    };
  }
  const endDate = format(addDays(parseISO(form.start_date), 1), "yyyy-MM-dd");
  return { summary, description, location, start: { date: form.start_date }, end: { date: endDate } };
}

async function googleEventsCall(method: "POST" | "PUT" | "DELETE", calendarId: string, token: string, eventId?: string, body?: any) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const url = eventId ? `${base}/${eventId}` : base;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Erro do Google Calendar (${res.status})`);
  }
  return method === "DELETE" ? null : res.json();
}

// ── Calendar Page ────────────────────────────────────────────
function CalendarPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [gcalOpen, setGcalOpen] = useState(false);
  const [gcalRefresh, setGcalRefresh] = useState(0);
  const [form, setForm] = useState({
    title: "", description: "", location: "",
    start_date: "", start_time: "", end_time: "", participants: "",
  });

  const { value: apiKey } = useSetting<string>("google_calendar_api_key", "");
  const { value: oauthClientId } = useSetting<string>("google_oauth_client_id", "");
  const saveSetting = useSaveSetting();
  const [gcalForm, setGcalForm] = useState({ calendarId: page.google_calendar_id || "", apiKey: "", oauthClientId: "" });

  const gAuth = useGoogleCalendarAuth(page.google_calendar_id ? oauthClientId : undefined);

  const openGcalDialog = () => {
    setGcalForm({ calendarId: page.google_calendar_id || "", apiKey: apiKey || "", oauthClientId: oauthClientId || "" });
    setGcalOpen(true);
  };

  const saveGcal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_pages")
        .update({ google_calendar_id: gcalForm.calendarId.trim() || null } as any)
        .eq("id", page.id);
      if (error) throw error;
      if (gcalForm.apiKey.trim()) {
        await saveSetting.mutateAsync({ key: "google_calendar_api_key", value: gcalForm.apiKey.trim() });
      }
      if (gcalForm.oauthClientId.trim()) {
        await saveSetting.mutateAsync({ key: "google_oauth_client_id", value: gcalForm.oauthClientId.trim() });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_page", page.id] });
      setGcalOpen(false);
      toast.success("Google Calendar configurado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["team_meetings", page.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_meetings").select("*").eq("page_id", page.id).order("start_date", { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["team_meetings", page.id] });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.start_date) throw new Error("Título e data são obrigatórios");
      const payload = {
        page_id: page.id, title: form.title.trim(),
        description: form.description || null, location: form.location || null,
        start_date: form.start_date, start_time: form.start_time || null,
        end_time: form.end_time || null, participants: form.participants || null,
        created_by_name: profile?.full_name || profile?.email || "—",
      };
      let meetingId: string;
      if (editing) {
        const { error } = await supabase.from("team_meetings").update(payload).eq("id", editing.id);
        if (error) throw error;
        meetingId = editing.id;
      } else {
        const { data, error } = await supabase.from("team_meetings").insert(payload).select().single();
        if (error) throw error;
        meetingId = (data as any).id;
      }

      if (page.google_calendar_id) {
        const token = gAuth.getValidToken();
        if (token) {
          try {
            const eventPayload = toGoogleEvent(form);
            const existingEventId = editing?.google_event_id;
            const result = await googleEventsCall(existingEventId ? "PUT" : "POST", page.google_calendar_id, token, existingEventId, eventPayload);
            if (result?.id && result.id !== existingEventId) {
              await supabase.from("team_meetings").update({ google_event_id: result.id } as any).eq("id", meetingId);
            }
          } catch (e: any) {
            toast.error(`Reunião salva, mas falhou ao sincronizar com o Google Calendar: ${e.message}`);
          }
        }
      }
    },
    onSuccess: () => { invalidate(); setOpen(false); toast.success(editing ? "Atualizado!" : "Reunião criada!"); setGcalRefresh((v) => v + 1); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (m: Meeting) => {
      if (page.google_calendar_id && m.google_event_id) {
        const token = gAuth.getValidToken();
        if (token) {
          try {
            await googleEventsCall("DELETE", page.google_calendar_id, token, m.google_event_id);
          } catch {
            // best-effort, ignora falha
          }
        }
      }
      const { error } = await supabase.from("team_meetings").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setGcalRefresh((v) => v + 1); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", location: "", start_date: "", start_time: "", end_time: "", participants: "" });
    setOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setForm({
      title: m.title, description: m.description || "", location: m.location || "",
      start_date: m.start_date, start_time: m.start_time || "", end_time: m.end_time || "",
      participants: m.participants || "",
    });
    setOpen(true);
  };

  const today = startOfDay(new Date());
  const upcoming = meetings.filter((m) => !isAfter(today, parseISO(m.start_date)));
  const past = meetings.filter((m) => isAfter(today, parseISO(m.start_date)));

  const MeetingCard = ({ m }: { m: Meeting }) => (
    <div className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{m.title}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Calendar className="h-3 w-3 shrink-0" />
            {format(parseISO(m.start_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {m.start_time && (
              <>
                <span>·</span>
                <Clock className="h-3 w-3 shrink-0" />
                {m.start_time}{m.end_time ? ` – ${m.end_time}` : ""}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => { if (confirm(`Excluir "${m.title}"?`)) remove.mutate(m); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {m.location && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {m.location}
        </div>
      )}
      {m.participants && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" /> {m.participants}
        </div>
      )}
      {m.description && (
        <p className="text-xs text-muted-foreground border-t pt-2 mt-1">{m.description}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{upcoming.length} próxima{upcoming.length !== 1 ? "s" : ""} reunião{upcoming.length !== 1 ? "ões" : ""}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {page.google_calendar_id && (
            gAuth.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Conectado ao Google
              </span>
            ) : (
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs"
                disabled={gAuth.connecting}
                onClick={() => gAuth.connect().catch((e: any) => toast.error(e.message))}
              >
                <Link2 className="h-3.5 w-3.5" /> {gAuth.connecting ? "Conectando..." : "Conectar Google"}
              </Button>
            )
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openGcalDialog}>
              <Link2 className="h-3.5 w-3.5" /> Conectar Google Calendar
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Nova reunião
          </Button>
        </div>
      </div>

      {page.google_calendar_id && (
        <>
          <p className="text-xs text-muted-foreground">
            O calendário abaixo é apenas para visualização. Para criar, editar ou excluir reuniões, use o botão "Nova reunião" acima.
          </p>
          <div className="rounded-xl border overflow-hidden">
            <iframe
              key={gcalRefresh}
              src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(page.google_calendar_id)}&ctz=America/Sao_Paulo&_r=${gcalRefresh}`}
              style={{ border: 0 }}
              width="100%"
              height="500"
              title="Google Calendar"
            />
          </div>
        </>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : upcoming.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma reunião agendada. Clique em "Nova reunião" para adicionar.
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button onClick={() => setShowPast((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            {showPast ? "▾" : "▸"} {past.length} reunião{past.length !== 1 ? "ões" : ""} passada{past.length !== 1 ? "s" : ""}
          </button>
          {showPast && (
            <div className="mt-2 space-y-2 opacity-60">
              {past.map((m) => <MeetingCard key={m.id} m={m} />)}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar reunião" : "Nova reunião"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Ex: Reunião de alinhamento" />
            </div>
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Local / Link</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Ex: Sala 2 ou https://meet.google.com/..." />
            </div>
            <div>
              <Label className="text-xs">Participantes</Label>
              <Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Ex: João, Maria, Carlos" />
            </div>
            <div>
              <Label className="text-xs">Descrição / Pauta</Label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Pontos da pauta, objetivo da reunião..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.start_date} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gcalOpen} onOpenChange={setGcalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Google Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">ID do Google Calendar</Label>
              <Input
                value={gcalForm.calendarId}
                onChange={(e) => setGcalForm({ ...gcalForm, calendarId: e.target.value })}
                className="mt-1 h-9 text-sm"
                placeholder="ex: seuemail@gmail.com ou xxxx@group.calendar.google.com"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Disponível em Configurações do Google Calendar → Integrar calendário → ID do calendário. O calendário precisa estar marcado como público.
              </p>
            </div>
            <div>
              <Label className="text-xs">API Key do Google</Label>
              <Input
                value={gcalForm.apiKey}
                onChange={(e) => setGcalForm({ ...gcalForm, apiKey: e.target.value })}
                className="mt-1 h-9 text-sm"
                placeholder="Chave de API do Google Cloud (Calendar API)"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Usada para buscar os eventos de hoje no alerta de agenda. Compartilhada entre todas as páginas de calendário.
              </p>
            </div>
            <div>
              <Label className="text-xs">OAuth Client ID do Google</Label>
              <Input
                value={gcalForm.oauthClientId}
                onChange={(e) => setGcalForm({ ...gcalForm, oauthClientId: e.target.value })}
                className="mt-1 h-9 text-sm"
                placeholder="xxxx.apps.googleusercontent.com"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Permite que cada usuário conecte sua conta Google (botão "Conectar Google") para que reuniões criadas aqui também sejam adicionadas ao Google Calendar. Compartilhado entre todas as páginas de calendário.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGcalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveGcal.mutate()} disabled={saveGcal.isPending} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Notes Page ───────────────────────────────────────────────
function NotesPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const [content, setContent] = useState(page.content || "");
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_pages").update({ content }).eq("id", page.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team_page", page.id] }); setDirty(false); toast.success("Notas salvas!"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{page.title}</h1>
        <Button size="sm" className="gap-1.5 text-xs" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          className="w-full min-h-[60vh] text-sm bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50"
          placeholder="Escreva aqui as notas da equipe..."
        />
      </div>
    </div>
  );
}

// ── Checklist Page ───────────────────────────────────────────
function ChecklistPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  type CheckItem = { id: string; title: string; is_done: boolean; position: number };
  const inv = () => qc.invalidateQueries({ queryKey: ["team_checklist", page.id] });

  const { data: items = [] } = useQuery({
    queryKey: ["team_checklist", page.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_checklist_items").select("*").eq("page_id", page.id).order("position", { ascending: true });
      if (error) throw error;
      return data as CheckItem[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const max = Math.max(0, ...items.map((i) => i.position));
      const { error } = await supabase.from("team_checklist_items").insert({ page_id: page.id, title: newTitle.trim(), position: max + 1 });
      if (error) throw error;
    },
    onSuccess: () => { inv(); setNewTitle(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("team_checklist_items").update({ is_done: done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const done = items.filter((i) => i.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{done}/{items.length} concluídos · {pct}%</p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="rounded-xl border bg-card divide-y">
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-muted-foreground">Nenhum item ainda.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3 group">
            <input type="checkbox" checked={item.is_done}
              onChange={(e) => toggle.mutate({ id: item.id, done: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer" />
            <span className={`flex-1 text-sm ${item.is_done ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
              onClick={() => remove.mutate(item.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Novo item..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) add.mutate(); }}
          className="h-9 text-sm" />
        <Button size="sm" className="gap-1.5" disabled={!newTitle.trim()} onClick={() => add.mutate()}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

// ── Mural Page ───────────────────────────────────────────────
function MuralPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", is_pinned: false });

  type Announcement = { id: string; title: string; content?: string; is_pinned: boolean; created_by_name?: string; created_at: string };
  const inv = () => qc.invalidateQueries({ queryKey: ["team_announcements", page.id] });

  const { data: posts = [] } = useQuery({
    queryKey: ["team_announcements", page.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_announcements").select("*").eq("page_id", page.id).order("is_pinned", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título obrigatório");
      const payload = { page_id: page.id, title: form.title.trim(), content: form.content || null, is_pinned: form.is_pinned, created_by_name: profile?.full_name || profile?.email || "—" };
      if (editing) {
        const { error } = await supabase.from("team_announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { inv(); setOpen(false); toast.success(editing ? "Atualizado!" : "Aviso publicado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("team_announcements").delete().eq("id", id); if (error) throw error; },
    onSuccess: inv,
  });

  const openNew = () => { setEditing(null); setForm({ title: "", content: "", is_pinned: false }); setOpen(true); };
  const openEdit = (p: Announcement) => { setEditing(p); setForm({ title: p.title, content: p.content || "", is_pinned: p.is_pinned }); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{posts.length} aviso{posts.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Novo aviso</Button>
      </div>
      {posts.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum aviso publicado.</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className={`rounded-xl border bg-card p-4 ${p.is_pinned ? "border-primary/30 bg-primary/5" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {p.is_pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className="font-medium text-sm">{p.title}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Excluir "${p.title}"?`)) remove.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {p.content && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{p.content}</p>}
              <div className="text-[11px] text-muted-foreground mt-2">
                {p.created_by_name} · {format(new Date(p.created_at), "d MMM yyyy", { locale: ptBR })}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Título do aviso" />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="mt-1 w-full min-h-[100px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Detalhes do aviso..." />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} className="accent-primary" />
              <span className="text-sm">Fixar no topo</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {editing ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Contacts Page ────────────────────────────────────────────
function ContactsPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", role: "", phone: "", email: "", notes: "" });

  type Contact = { id: string; name: string; role?: string; phone?: string; email?: string; notes?: string; position: number };
  const inv = () => qc.invalidateQueries({ queryKey: ["team_contacts", page.id] });

  const { data: contacts = [] } = useQuery({
    queryKey: ["team_contacts", page.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_contacts").select("*").eq("page_id", page.id).order("position", { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome obrigatório");
      const max = Math.max(0, ...contacts.map((c) => c.position));
      const payload = { page_id: page.id, name: form.name.trim(), role: form.role || null, phone: form.phone || null, email: form.email || null, notes: form.notes || null, position: editing ? editing.position : max + 1 };
      if (editing) {
        const { error } = await supabase.from("team_contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { inv(); setOpen(false); toast.success(editing ? "Atualizado!" : "Contato adicionado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("team_contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: inv,
  });

  const openNew = () => { setEditing(null); setForm({ name: "", role: "", phone: "", email: "", notes: "" }); setOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setForm({ name: c.name, role: c.role || "", phone: c.phone || "", email: c.email || "", notes: c.notes || "" }); setOpen(true); };

  const filtered = contacts.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.role?.toLowerCase().includes(search.toLowerCase()));

  const copyText = (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text); }
      else { const el = document.createElement("textarea"); el.value = text; el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0"; document.body.appendChild(el); el.focus(); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
      toast.success("Copiado!");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} contato{contacts.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Novo contato</Button>
      </div>
      <Input placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-sm" />
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{search ? "Nenhum resultado." : "Nenhum contato cadastrado."}</div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3 group">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.name}</div>
                {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {c.phone && (
                    <button onClick={() => copyText(c.phone!)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </button>
                  )}
                  {c.email && (
                    <button onClick={() => copyText(c.email!)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="h-3 w-3" /> {c.email}
                    </button>
                  )}
                </div>
                {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Excluir "${c.name}"?`)) remove.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Nome completo" /></div>
            <div><Label className="text-xs">Cargo / Função</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Ex: Suporte TI, Fornecedor" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-9 text-sm" placeholder="(11) 99999-9999" /></div>
              <div><Label className="text-xs">E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9 text-sm" placeholder="email@exemplo.com" /></div>
            </div>
            <div><Label className="text-xs">Observações</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-9 text-sm" placeholder="Ramal, horário de atendimento..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Kanban Page ──────────────────────────────────────────────
const COLUMN_COLORS = [
  { value: "bg-slate-500", label: "Cinza" },
  { value: "bg-blue-500", label: "Azul" },
  { value: "bg-green-500", label: "Verde" },
  { value: "bg-yellow-500", label: "Amarelo" },
  { value: "bg-red-500", label: "Vermelho" },
  { value: "bg-purple-500", label: "Roxo" },
  { value: "bg-orange-500", label: "Laranja" },
];

function KanbanPage({ page }: { page: TeamPage }) {
  const qc = useQueryClient();
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [addColOpen, setAddColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState("bg-slate-500");
  const [cardForms, setCardForms] = useState<Record<string, string>>({});
  const [editCard, setEditCard] = useState<any>(null);
  const [editCardForm, setEditCardForm] = useState({ title: "", description: "" });

  type KanbanCol = { id: string; title: string; color: string; position: number };
  type KanbanCard = { id: string; column_id: string; title: string; description?: string; position: number };

  const invCols = () => qc.invalidateQueries({ queryKey: ["kanban_cols", page.id] });
  const invCards = () => qc.invalidateQueries({ queryKey: ["kanban_cards", page.id] });

  const { data: columns = [] } = useQuery({
    queryKey: ["kanban_cols", page.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_kanban_columns").select("*").eq("page_id", page.id).order("position", { ascending: true });
      if (error) throw error;
      const cols = data as KanbanCol[];
      // seed default columns on first open
      if (cols.length === 0) {
        const defaults = [
          { page_id: page.id, title: "A fazer", color: "bg-slate-500", position: 0 },
          { page_id: page.id, title: "Em andamento", color: "bg-blue-500", position: 1 },
          { page_id: page.id, title: "Concluído", color: "bg-green-500", position: 2 },
        ];
        await supabase.from("team_kanban_columns").insert(defaults);
        const { data: d2 } = await supabase.from("team_kanban_columns").select("*").eq("page_id", page.id).order("position", { ascending: true });
        return (d2 || []) as KanbanCol[];
      }
      return cols;
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["kanban_cards", page.id],
    queryFn: async () => {
      if (!columns.length) return [];
      const ids = columns.map((c) => c.id);
      const { data, error } = await supabase.from("team_kanban_cards").select("*").in("column_id", ids).order("position", { ascending: true });
      if (error) throw error;
      return data as KanbanCard[];
    },
    enabled: columns.length > 0,
  });

  const addColumn = useMutation({
    mutationFn: async () => {
      if (!newColTitle.trim()) return;
      const max = Math.max(-1, ...columns.map((c) => c.position));
      const { error } = await supabase.from("team_kanban_columns").insert({ page_id: page.id, title: newColTitle.trim(), color: newColColor, position: max + 1 });
      if (error) throw error;
    },
    onSuccess: () => { invCols(); setNewColTitle(""); setAddColOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_kanban_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invCols(); invCards(); },
  });

  const addCard = useMutation({
    mutationFn: async (colId: string) => {
      const title = cardForms[colId]?.trim();
      if (!title) return;
      const colCards = cards.filter((c) => c.column_id === colId);
      const max = Math.max(-1, ...colCards.map((c) => c.position));
      const { error } = await supabase.from("team_kanban_cards").insert({ column_id: colId, title, position: max + 1 });
      if (error) throw error;
    },
    onSuccess: (_, colId) => { invCards(); setCardForms((prev) => ({ ...prev, [colId]: "" })); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<KanbanCard> }) => {
      const { error } = await supabase.from("team_kanban_cards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invCards,
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_kanban_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invCards,
  });

  const onDrop = (colId: string) => {
    if (!dragCardId) return;
    const card = cards.find((c) => c.id === dragCardId);
    if (card && card.column_id !== colId) {
      updateCard.mutate({ id: dragCardId, patch: { column_id: colId } });
    }
    setDragCardId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{page.title}</h1>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddColOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Coluna
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.column_id === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-64 flex flex-col gap-2"
              onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(col.id)}>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold flex-1">{col.title}</span>
                <span className="text-xs text-muted-foreground">{colCards.length}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => { if (confirm(`Excluir coluna "${col.title}" e todos os cards?`)) deleteColumn.mutate(col.id); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2 min-h-[40px]">
                {colCards.map((card) => (
                  <div key={card.id} draggable
                    onDragStart={() => setDragCardId(card.id)}
                    onDragEnd={() => setDragCardId(null)}
                    className="rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{card.title}</p>
                        {card.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                        <button onClick={() => { setEditCard(card); setEditCardForm({ title: card.title, description: card.description || "" }); }}
                          className="p-1 rounded hover:bg-accent"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => deleteCard.mutate(card.id)}
                          className="p-1 rounded hover:bg-accent text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5">
                <Input placeholder="Novo card..." value={cardForms[col.id] || ""} className="h-8 text-xs"
                  onChange={(e) => setCardForms((prev) => ({ ...prev, [col.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addCard.mutate(col.id); }} />
                <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={() => addCard.mutate(col.id)} disabled={!cardForms[col.id]?.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {addColOpen && (
          <div className="flex-shrink-0 w-64 space-y-2">
            <Input placeholder="Nome da coluna..." value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addColumn.mutate(); if (e.key === "Escape") setAddColOpen(false); }}
              className="h-8 text-sm" autoFocus />
            <div className="flex gap-1 flex-wrap">
              {COLUMN_COLORS.map((c) => (
                <button key={c.value} onClick={() => setNewColColor(c.value)}
                  className={`h-5 w-5 rounded-full ${c.value} ${newColColor === c.value ? "ring-2 ring-offset-1 ring-primary" : ""}`} title={c.label} />
              ))}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => addColumn.mutate()} disabled={!newColTitle.trim()}>
                <Check className="h-3 w-3" /> Criar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddColOpen(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editCard} onOpenChange={() => setEditCard(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar card</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Título</Label><Input value={editCardForm.title} onChange={(e) => setEditCardForm({ ...editCardForm, title: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Descrição</Label>
              <textarea value={editCardForm.description} onChange={(e) => setEditCardForm({ ...editCardForm, description: e.target.value })}
                className="mt-1 w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCard(null)}>Cancelar</Button>
            <Button onClick={() => { updateCard.mutate({ id: editCard.id, patch: { title: editCardForm.title, description: editCardForm.description || undefined } }); setEditCard(null); }}
              disabled={!editCardForm.title.trim()} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Link Page ────────────────────────────────────────────────
function LinkPage({ page }: { page: TeamPage }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <ExternalLink className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">{page.title}</p>
        <p className="text-sm text-muted-foreground mt-1">{page.url}</p>
      </div>
      <Button onClick={() => window.open(page.url, "_blank")} className="gap-2">
        <ExternalLink className="h-4 w-4" /> Abrir link
      </Button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function TeamPageView() {
  const { id } = useParams<{ id: string }>();

  const { data: page, isLoading } = useQuery({
    queryKey: ["team_page", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_pages").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as TeamPage;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!page) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Página não encontrada.</div>;
  }

  if (page.type === "calendar") return <CalendarPage page={page} />;
  if (page.type === "checklist") return <ChecklistPage page={page} />;
  if (page.type === "mural") return <MuralPage page={page} />;
  if (page.type === "contacts") return <ContactsPage page={page} />;
  if (page.type === "kanban") return <KanbanPage page={page} />;
  if (page.type === "notes") return <NotesPage page={page} />;
  if (page.type === "link") return <LinkPage page={page} />;

  return <div className="py-20 text-center text-sm text-muted-foreground">Tipo de página desconhecido.</div>;
}
