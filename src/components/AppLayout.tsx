import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCampus } from "@/contexts/CampusContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardList, CheckSquare, Users, LogOut, Menu, X, Sun, Moon,
  FileText, Calendar, Link2, BookOpen, MessageSquare, Clipboard,
  Star, Globe, Folder, Smile, Bell, ListChecks, Megaphone, Phone,
  LayoutGrid, Home, Plus, Settings, MapPin, Key, Pencil, Trash2, History,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import AddPageDialog from "@/components/AddPageDialog";
import DailyAgendaAlert from "@/components/DailyAgendaAlert";
import { useSetting, useSaveSetting } from "@/hooks/useSettings";

const CAMPUS_LABELS: Record<string, string> = { barra: "Barra", gavea: "Gávea" };

const PAGE_ICON_MAP: Record<string, any> = {
  Calendar, FileText, Link2, BookOpen, MessageSquare,
  Clipboard, Star, Globe, Folder, Smile, Bell, Users,
  ListChecks, Megaphone, Phone, LayoutGrid,
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const { campus, setCampus, canSwitchCampus } = useCampus();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ key: string; current: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { value: requestsLabel } = useSetting("nav_requests_label", "Lista de Pedidos");
  const { value: tasksLabel } = useSetting("nav_tasks_label", "Lista de Tarefas");
  const saveSetting = useSaveSetting();

  const openRename = (key: string, current: string) => {
    setRenameTarget({ key, current });
    setRenameValue(current);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await saveSetting.mutateAsync({ key: renameTarget.key, value: renameValue.trim() });
    toast.success("Nome atualizado!");
    setRenameOpen(false);
  };
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) setPasswordError(error.message);
    else {
      toast.success("Senha atualizada!");
      setPasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeletePage = async (page: any) => {
    if (!window.confirm(`Excluir a página "${page.title}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("team_pages").delete().eq("id", page.id);
    if (error) toast.error(error.message);
    else { toast.success("Página excluída!"); refetchPages(); }
  };

  const { data: teamPages = [], refetch: refetchPages } = useQuery({
    queryKey: ["team_pages", campus],
    queryFn: async () => {
      const { data } = await supabase.from("team_pages").select("*").eq("campus", campus).order("position", { ascending: true });
      return (data || []).filter((p: any) => p.is_visible !== false);
    },
  });

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
      active
        ? "bg-white/20 text-white shadow-sm"
        : "text-white/70 hover:text-white hover:bg-white/10"
    }`;

  const sectionLabel = (label: string) => (
    <div className="mx-1 mb-1 mt-4 first:mt-1 px-2 py-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</span>
    </div>
  );

  const renderNav = (closeMobile?: boolean) => (
    <nav className="flex flex-col gap-0.5 px-2 py-3">
      {/* Início */}
      <Link
        to="/"
        onClick={() => closeMobile && setSidebarOpen(false)}
        className={navLinkClass(isActive("/") && location.pathname === "/")}
      >
        <Home className="h-4 w-4 shrink-0" /> Início
      </Link>

      {/* Equipe */}
      {sectionLabel("Equipe")}
      <div className="flex items-center gap-0.5">
        <Link
          to="/team/requests"
          onClick={() => closeMobile && setSidebarOpen(false)}
          className={navLinkClass(isActive("/team/requests")) + " flex-1 min-w-0"}
        >
          <ClipboardList className="h-4 w-4 shrink-0" /> <span className="truncate">{requestsLabel as string}</span>
        </Link>
        {isAdmin && (
          <button
            onClick={() => openRename("nav_requests_label", requestsLabel as string)}
            title="Renomear"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <Link
          to="/team/tasks"
          onClick={() => closeMobile && setSidebarOpen(false)}
          className={navLinkClass(isActive("/team/tasks")) + " flex-1 min-w-0"}
        >
          <CheckSquare className="h-4 w-4 shrink-0" /> <span className="truncate">{tasksLabel as string}</span>
        </Link>
        {isAdmin && (
          <button
            onClick={() => openRename("nav_tasks_label", tasksLabel as string)}
            title="Renomear"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Páginas dinâmicas */}
      {(teamPages as any[]).map((page: any) => {
        const Icon = PAGE_ICON_MAP[page.icon] || FileText;
        const active = location.pathname === `/team/pages/${page.id}`;
        const link = page.type === "link" && page.url ? (
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass(false) + " flex-1 min-w-0"}
          >
            <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{page.title}</span>
          </a>
        ) : (
          <Link
            to={`/team/pages/${page.id}`}
            onClick={() => closeMobile && setSidebarOpen(false)}
            className={navLinkClass(active) + " flex-1 min-w-0"}
          >
            <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{page.title}</span>
          </Link>
        );
        if (!isAdmin) return <div key={page.id} className="flex">{link}</div>;
        return (
          <div key={page.id} className="flex items-center gap-0.5">
            {link}
            <button
              onClick={() => setEditingPage(page)}
              title="Editar página"
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDeletePage(page)}
              title="Excluir página"
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/10 transition-all shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* Botão adicionar página */}
      <button
        onClick={() => { setAddPageOpen(true); closeMobile && setSidebarOpen(false); }}
        className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
      >
        <Plus className="h-3.5 w-3.5" /> Nova página
      </button>

      {/* Admin */}
      {isAdmin && (
        <>
          {sectionLabel("Administração")}
          <Link
            to="/users"
            onClick={() => closeMobile && setSidebarOpen(false)}
            className={navLinkClass(isActive("/users"))}
          >
            <Users className="h-4 w-4 shrink-0" /> Usuários
          </Link>
          <Link
            to="/log"
            onClick={() => closeMobile && setSidebarOpen(false)}
            className={navLinkClass(isActive("/log"))}
          >
            <History className="h-4 w-4 shrink-0" /> Log de alterações
          </Link>
        </>
      )}
    </nav>
  );

  const Sidebar = ({ closeMobile }: { closeMobile?: boolean }) => (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, #1A3A8C 0%, #111827 100%)" }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="bg-white rounded-md px-1.5 py-1 shrink-0">
            <img src="/logo.png" alt="EARJ" className="h-6 w-auto object-contain" />
          </div>
          <span className="text-white/50 text-[10px] leading-tight tracking-wide">Team Space</span>
        </Link>
        {closeMobile && (
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Campus */}
      <div className="px-3 pt-3">
        {canSwitchCampus ? (
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {(["barra", "gavea"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCampus(c)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  campus === c ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <MapPin className="h-3 w-3" /> {CAMPUS_LABELS[c]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-white/40">
            <MapPin className="h-3 w-3" /> Campus {CAMPUS_LABELS[campus]}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">{renderNav(closeMobile)}</div>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(profile?.full_name || profile?.email || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{profile?.full_name || profile?.email}</div>
            <div className="text-[10px] text-white/50 capitalize">{profile?.role || "operator"}</div>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost" size="sm" onClick={() => setPasswordOpen(true)} title="Trocar senha"
            className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
          >
            <Key className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm" onClick={signOut}
            className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 shrink-0 sticky top-0 h-screen overflow-hidden">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-56 h-full overflow-y-auto">
            <Sidebar closeMobile />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 border-b bg-card/95 backdrop-blur-sm">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1.5 rounded-md hover:bg-accent">
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm font-bold text-primary">EARJ Team</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">{profile?.full_name || profile?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 w-8 p-0">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      <AddPageDialog open={addPageOpen} onClose={() => setAddPageOpen(false)} onCreated={() => refetchPages()} />
      <AddPageDialog open={!!editingPage} onClose={() => setEditingPage(null)} onCreated={() => refetchPages()} page={editingPage} />

      <Dialog open={renameOpen} onOpenChange={(o) => { setRenameOpen(o); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Renomear item do menu</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Nome</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-1 h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || saveSetting.isPending}>
              {saveSetting.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DailyAgendaAlert />

      <Dialog open={passwordOpen} onOpenChange={(o) => { setPasswordOpen(o); if (!o) { setNewPassword(""); setConfirmPassword(""); setPasswordError(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Trocar senha</DialogTitle></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="h-9 text-sm" placeholder="••••••••" required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar nova senha</Label>
              <Input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 text-sm" placeholder="••••••••" required
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
