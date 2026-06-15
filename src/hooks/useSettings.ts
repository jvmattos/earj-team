// Valores padrão para o sistema EARJ Team
export const DEFAULT_PRODUCT_AREAS = ["IT", "Redes", "Áudio", "Vídeo", "Energia", "Som", "Projetor", "Ferramentas", "Organização"];
export const DEFAULT_REQUEST_PRIORITIES = ["Alta", "Média", "Baixa"];
export const DEFAULT_REQUEST_STATUSES = ["Novo", "Recompra", "Recusado", "Aprovado", "Em andamento", "Concluído"];
export const DEFAULT_TASK_PRIORITIES = ["Alta", "Média", "Baixa"];
export const DEFAULT_TASK_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluído" },
];

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSetting<T>(key: string, defaultValue: T) {
  const { data, isLoading } = useQuery({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("key", key);
      if (error || !data?.length) return defaultValue;
      return (data[0]?.value ?? defaultValue) as T;
    },
  });
  return { value: data ?? defaultValue, isLoading };
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data } = await supabase.from("settings").select("id").eq("key", key);
      const existing = (data as any)?.[0];
      if (existing?.id) {
        const { error } = await supabase.from("settings").update({ value } as any).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert({ key, value } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["setting", key] });
    },
  });
}
