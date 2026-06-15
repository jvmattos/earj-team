import { useAuth } from "@/contexts/AuthContext";
import { useCampus } from "@/contexts/CampusContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ClipboardList, CheckSquare, Users, FileText, Calendar } from "lucide-react";

export default function Home() {
  const { profile, isAdmin } = useAuth();
  const { campus } = useCampus();

  const { data: requestCount = 0 } = useQuery({
    queryKey: ["home_request_count", campus],
    queryFn: async () => {
      const { count } = await supabase.from("team_requests").select("*", { count: "exact", head: true }).eq("campus", campus);
      return count ?? 0;
    },
  });

  const { data: taskCount = 0 } = useQuery({
    queryKey: ["home_task_count", campus],
    queryFn: async () => {
      const { count } = await supabase.from("team_tasks").select("*", { count: "exact", head: true }).eq("campus", campus).neq("status", "done");
      return count ?? 0;
    },
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["team_pages", campus],
    queryFn: async () => {
      const { data } = await supabase.from("team_pages").select("*").eq("campus", campus).order("position", { ascending: true });
      return data || [];
    },
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "usuário";

  const cards = [
    {
      to: "/team/requests",
      icon: ClipboardList,
      label: "Lista de Pedidos",
      desc: `${requestCount} pedido${requestCount !== 1 ? "s" : ""} registrado${requestCount !== 1 ? "s" : ""}`,
      color: "bg-blue-50 border-blue-200 text-blue-700",
      iconColor: "text-blue-600",
    },
    {
      to: "/team/tasks",
      icon: CheckSquare,
      label: "Lista de Tarefas",
      desc: `${taskCount} tarefa${taskCount !== 1 ? "s" : ""} em aberto`,
      color: "bg-green-50 border-green-200 text-green-700",
      iconColor: "text-green-600",
    },
    ...(isAdmin ? [{
      to: "/users",
      icon: Users,
      label: "Usuários",
      desc: "Gerenciar acesso ao sistema",
      color: "bg-purple-50 border-purple-200 text-purple-700",
      iconColor: "text-purple-600",
    }] : []),
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{greeting}, {firstName}! 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Bem-vindo ao espaço da equipe de TI da EARJ.</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`flex items-center gap-4 p-5 rounded-xl border ${card.color} hover:shadow-md transition-all`}
          >
            <card.icon className={`h-8 w-8 shrink-0 ${card.iconColor}`} />
            <div>
              <div className="font-semibold text-sm">{card.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{card.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Páginas dinâmicas */}
      {pages.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Páginas da Equipe</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(pages as any[]).map((page: any) => (
              <Link
                key={page.id}
                to={page.type === "link" && page.url ? page.url : `/team/pages/${page.id}`}
                target={page.type === "link" ? "_blank" : undefined}
                rel={page.type === "link" ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-all"
              >
                <span className="text-xl">{page.icon ? "📄" : "📄"}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{page.title}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{page.type}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
