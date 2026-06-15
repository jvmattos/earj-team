import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampus } from "@/contexts/CampusContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaItem = {
  title: string;
  time?: string;
  location?: string;
  source: "internal" | "google";
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyAgendaAlert() {
  const { user } = useAuth();
  const { campus } = useCampus();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AgendaItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const today = todayStr();
    const seenKey = `earj_agenda_seen_${user.id}_${today}`;
    if (localStorage.getItem(seenKey)) return;

    let cancelled = false;

    (async () => {
      const result: AgendaItem[] = [];

      const { data: pages } = await supabase
        .from("team_pages")
        .select("id, google_calendar_id")
        .eq("campus", campus)
        .eq("type", "calendar");

      const pageIds = (pages || []).map((p: any) => p.id);

      if (pageIds.length > 0) {
        const { data: meetings } = await supabase
          .from("team_meetings")
          .select("title, start_time, end_time, location")
          .in("page_id", pageIds)
          .eq("start_date", today);

        (meetings || []).forEach((m: any) => {
          result.push({
            title: m.title,
            time: m.start_time ? `${m.start_time}${m.end_time ? ` – ${m.end_time}` : ""}` : undefined,
            location: m.location || undefined,
            source: "internal",
          });
        });
      }

      const calendarIds = (pages || []).map((p: any) => p.google_calendar_id).filter(Boolean);

      if (calendarIds.length > 0) {
        const { data: settingRows } = await supabase.from("settings").select("value").eq("key", "google_calendar_api_key");
        const apiKey = settingRows?.[0]?.value as string | undefined;

        if (apiKey) {
          const timeMin = `${today}T00:00:00Z`;
          const timeMax = `${today}T23:59:59Z`;

          for (const calId of calendarIds) {
            try {
              const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
              const res = await fetch(url);
              if (!res.ok) continue;
              const json = await res.json();
              (json.items || []).forEach((ev: any) => {
                const start = ev.start?.dateTime ? format(new Date(ev.start.dateTime), "HH:mm") : undefined;
                const end = ev.end?.dateTime ? format(new Date(ev.end.dateTime), "HH:mm") : undefined;
                result.push({
                  title: ev.summary || "Sem título",
                  time: start ? `${start}${end ? ` – ${end}` : ""}` : undefined,
                  location: ev.location || undefined,
                  source: "google",
                });
              });
            } catch {
              // ignore failures from individual calendars
            }
          }
        }
      }

      if (cancelled) return;
      localStorage.setItem(seenKey, "1");
      if (result.length > 0) {
        result.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        setItems(result);
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, campus]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Agenda de hoje
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="font-medium text-sm">{item.title}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {item.time && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.time}</span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.location}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
