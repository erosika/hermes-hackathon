import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseEnabled, setToken } from "./supabase";
import { getMe } from "./api";

interface Ctx {
  email: string | null;
  subscribed: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>({
  email: null,
  subscribed: false,
  configured: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const refresh = async () => {
    try {
      const me = await getMe(); // server verifies the JWT and returns subscription status
      setEmail(me.email);
      setSubscribed(me.subscribed);
    } catch { /* gateway offline */ }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      if (data.session) void refresh();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
      if (session) void refresh();
      else setSubscribed(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (e: string, password: string) => {
    if (!supabase) throw new Error("auth not configured");
    const { error } = await supabase.auth.signInWithPassword({ email: e, password });
    if (error) throw error;
  };
  const signUp = async (e: string, password: string) => {
    if (!supabase) throw new Error("auth not configured");
    const { error } = await supabase.auth.signUp({ email: e, password });
    if (error) throw error;
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    setToken(null);
    setEmail(null);
    setSubscribed(false);
  };

  return (
    <AuthCtx.Provider value={{ email, subscribed, configured: supabaseEnabled, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
