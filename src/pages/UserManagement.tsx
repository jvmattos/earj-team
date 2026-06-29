import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, KeyRound, Lock, Ban, RotateCcw } from "lucide-react";

async function callAdminUsers(body: { action: string; user_id: string; password?: string }) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function UserManagement() {
  const { isAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "operator", password: "", campus: "barra" });
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "" });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<any>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      // Use a secondary client with persistSession:false so the admin session is untouched
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name } },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Usuário não criado");

      // Profile row is created by Supabase trigger; update role/campus via admin session
      await new Promise((r) => setTimeout(r, 800));
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: form.role, campus: form.campus, full_name: form.full_name || null } as any)
        .eq("id", signUpData.user.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuário criado!");
      setOpen(false);
      setForm({ email: "", full_name: "", role: "operator", password: "", campus: "barra" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Função atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCampus = useMutation({
    mutationFn: async ({ id, campus }: { id: string; campus: string }) => {
      const { error } = await supabase.from("profiles").update({ campus } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Campus atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles")
        .update({ full_name: editForm.full_name.trim() || null } as any)
        .eq("id", editingUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Perfil atualizado!");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => callAdminUsers({ action: "delete", user_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuário excluído permanentemente!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDisabled = useMutation({
    mutationFn: async (u: any) => callAdminUsers({ action: u.disabled ? "unban" : "ban", user_id: u.id }),
    onSuccess: (_data, u) => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(u.disabled ? "Usuário reativado!" : "Usuário desativado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setUserPassword = useMutation({
    mutationFn: async () => callAdminUsers({ action: "set_password", user_id: passwordTarget.id, password: newPasswordValue }),
    onSuccess: () => {
      toast.success("Senha definida!");
      setPasswordOpen(false);
      setNewPasswordValue("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendPasswordReset = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Link de redefinição enviado por email!"),
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditForm({ full_name: u.full_name || "" });
    setEditOpen(true);
  };

  const openSetPassword = (u: any) => {
    setPasswordTarget(u);
    setNewPasswordValue("");
    setPasswordOpen(true);
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      Acesso restrito a administradores.
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao sistema</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Campus</TableHead>
              <TableHead className="w-44">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : (users as any[]).map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {(u.full_name || u.email || "U")[0].toUpperCase()}
                    </div>
                    {u.full_name || "—"}
                    {u.disabled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Desativado</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role || "operator"}
                    onValueChange={(v) => updateRole.mutate({ id: u.id, role: v })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.campus || "barra"}
                    onValueChange={(v) => updateCampus.mutate({ id: u.id, campus: v })}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="barra">Barra</SelectItem>
                      <SelectItem value="gavea">Gávea</SelectItem>
                      <SelectItem value="all">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)} title="Editar perfil">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Definir senha (sem enviar email)"
                      onClick={() => openSetPassword(u)}
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Enviar link de redefinição de senha por email"
                      disabled={sendPasswordReset.isPending}
                      onClick={() => { if (confirm(`Enviar email de redefinição de senha para "${u.email}"?`)) sendPasswordReset.mutate(u.email); }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      disabled={u.id === currentUser?.id || toggleDisabled.isPending}
                      title={u.id === currentUser?.id ? "Você não pode desativar seu próprio usuário" : u.disabled ? "Reativar usuário" : "Desativar usuário"}
                      onClick={() => { if (confirm(`${u.disabled ? "Reativar" : "Desativar"} o acesso de "${u.full_name || u.email}"?`)) toggleDisabled.mutate(u); }}
                    >
                      {u.disabled ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      disabled={u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? "Você não pode excluir seu próprio usuário" : "Excluir usuário permanentemente"}
                      onClick={() => { if (confirm(`Excluir "${u.full_name || u.email}" permanentemente? Isso remove a conta de login e o perfil — não pode ser desfeito.`)) deleteUser.mutate(u.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Senha provisória *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Campus</Label>
              <Select value={form.campus} onValueChange={(v) => setForm({ ...form, campus: v })}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="barra">Barra</SelectItem>
                  <SelectItem value="gavea">Gávea</SelectItem>
                  <SelectItem value="all">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createUser.mutate()} disabled={!form.email || !form.password || createUser.isPending}>
              {createUser.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={editingUser?.email || ""} disabled className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={(o) => !o && setPasswordOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Definir senha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Defina uma nova senha para <strong>{passwordTarget?.full_name || passwordTarget?.email}</strong>. Nenhum email é enviado — combine a senha diretamente com a pessoa.
            </p>
            <div>
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => setUserPassword.mutate()}
              disabled={newPasswordValue.length < 6 || setUserPassword.isPending}
              className="gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> {setUserPassword.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
