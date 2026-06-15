import { useCallback, useEffect, useState } from "react";

const SCOPE = "https://www.googleapis.com/auth/calendar";
const STORAGE_KEY = "earj_gcal_token";

type StoredToken = { accessToken: string; expiresAt: number };

function readStoredToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.accessToken || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadGisScript(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("gis-client-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-client-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function useGoogleCalendarAuth(clientId: string | undefined) {
  const [token, setToken] = useState<StoredToken | null>(() => readStoredToken());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (clientId) loadGisScript().catch(() => {});
  }, [clientId]);

  const connect = useCallback(async () => {
    if (!clientId) {
      throw new Error("Configure o OAuth Client ID em \"Conectar Google Calendar\"");
    }
    setConnecting(true);
    try {
      await loadGisScript();
      await new Promise<void>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            const stored: StoredToken = {
              accessToken: response.access_token,
              expiresAt: Date.now() + (Number(response.expires_in || 3600) - 60) * 1000,
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
            setToken(stored);
            resolve();
          },
        });
        tokenClient.requestAccessToken();
      });
    } finally {
      setConnecting(false);
    }
  }, [clientId]);

  const getValidToken = useCallback(() => {
    const current = readStoredToken();
    if (!current && token) setToken(null);
    return current?.accessToken ?? null;
  }, [token]);

  return {
    connected: !!token,
    connecting,
    connect,
    getValidToken,
  };
}
