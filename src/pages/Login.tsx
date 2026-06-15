import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Email ou senha incorretos.");
    else navigate("/", { replace: true });
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else setResetSent(true);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden w-[52%] p-12"
        style={{ background: "linear-gradient(150deg, #111827 0%, #1A3A8C 60%, #1e4db7 100%)" }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(26,58,140,0.6) 0%, transparent 70%)",
        }} />

        {/* Brand */}
        <div className="relative z-10">
          <div className="bg-white rounded-xl px-3 py-2 inline-flex items-center">
            <img src="/logo.png" alt="EARJ - Escola Americana do Rio de Janeiro" className="h-9 w-auto object-contain" />
          </div>
        </div>

        {/* Center illustration */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 text-center">
          {/* Floating cards */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {[
              { icon: "📋", label: "Pedidos", color: "bg-blue-500/20 border-blue-400/30" },
              { icon: "✅", label: "Tarefas", color: "bg-green-500/20 border-green-400/30" },
              { icon: "📅", label: "Reuniões", color: "bg-amber-500/20 border-amber-400/30" },
              { icon: "📌", label: "Avisos", color: "bg-red-500/20 border-red-400/30" },
              { icon: "🗂️", label: "Kanban", color: "bg-purple-500/20 border-purple-400/30" },
              { icon: "📞", label: "Contatos", color: "bg-cyan-500/20 border-cyan-400/30" },
            ].map((item) => (
              <div
                key={item.label}
                className={`${item.color} border rounded-xl p-3 flex items-center gap-2.5 backdrop-blur-sm`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-white/80 text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">Team Space · IT Department · EARJ</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="bg-white rounded-xl px-2.5 py-1.5 border inline-flex items-center">
              <img src="/logo.png" alt="EARJ - Escola Americana do Rio de Janeiro" className="h-8 w-auto object-contain" />
            </div>
            <div className="font-bold text-primary text-sm leading-tight">Team Space</div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">{forgotMode ? "Redefinir senha" : "Entrar"}</h1>
            <p className="text-sm text-muted-foreground">
              {forgotMode ? "Informe seu email para receber um link de redefinição" : "Acesse o espaço da equipe de TI"}
            </p>
          </div>

          {forgotMode ? (
            resetSent ? (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  Se houver uma conta com o email <strong>{email}</strong>, enviamos um link para redefinir a senha. Verifique sua caixa de entrada (e o spam).
                </p>
                <Button variant="outline" className="w-full" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seuemail@earj.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !email}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : "Enviar link de redefinição"}
                </Button>
                <button type="button" onClick={() => setForgotMode(false)} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Voltar para o login
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seuemail@earj.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                    <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-primary hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : "Entrar"}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                Problemas para acessar? Fale com o admin de TI.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
