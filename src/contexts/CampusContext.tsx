import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type Campus = "barra" | "gavea";

const STORAGE_KEY = "earj_active_campus";

interface CampusContextType {
  campus: Campus;
  setCampus: (campus: Campus) => void;
  canSwitchCampus: boolean;
}

const CampusContext = createContext<CampusContextType | undefined>(undefined);

export function CampusProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const canSwitchCampus = profile?.campus === "all";

  const [activeCampus, setActiveCampus] = useState<Campus>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "gavea" ? "gavea" : "barra";
  });

  const setCampus = (campus: Campus) => {
    setActiveCampus(campus);
    localStorage.setItem(STORAGE_KEY, campus);
  };

  const campus: Campus = canSwitchCampus
    ? activeCampus
    : (profile?.campus === "gavea" ? "gavea" : "barra");

  return (
    <CampusContext.Provider value={{ campus, setCampus, canSwitchCampus }}>
      {children}
    </CampusContext.Provider>
  );
}

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error("useCampus must be used within CampusProvider");
  return ctx;
}
