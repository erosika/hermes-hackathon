import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout } from "./api";

interface Ctx {
  email: string | null;
  subscribed: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>({ email: null, subscribed: false, login: async () => {}, logout: async () => {}, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const refresh = async () => {
    try {
      const me = await getMe();
      setEmail(me.email);
      setSubscribed(me.subscribed);
    } catch { /* gateway offline */ }
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (e: string) => {
    const me = await apiLogin(e);
    setEmail(me.email);
    setSubscribed(me.subscribed);
  };
  const logout = async () => {
    await apiLogout();
    setEmail(null);
    setSubscribed(false);
  };

  return <AuthCtx.Provider value={{ email, subscribed, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
