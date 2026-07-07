import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseEnabled, setToken } from "./supabase";
import { getMe } from "./api";

interface Ctx {
  email: string | null;
  subscribed: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  recovery: boolean; // true when the user arrived via a password-recovery link
  clearRecovery: () => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>({
  email: null,
  subscribed: false,
  configured: false,
  signIn: async () => {},
  signUp: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  recovery: false,
  clearRecovery: () => {},
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [recovery, setRecovery] = useState(false);

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
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setToken(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
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
  const resetPassword = async (e: string) => {
    if (!supabase) throw new Error("auth not configured");
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: window.location.origin });
    if (error) throw error;
  };
  const updatePassword = async (password: string) => {
    if (!supabase) throw new Error("auth not configured");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    setToken(null);
    setEmail(null);
    setSubscribed(false);
  };

  return (
    <AuthCtx.Provider value={{ email, subscribed, configured: supabaseEnabled, signIn, signUp, resetPassword, updatePassword, recovery, clearRecovery: () => setRecovery(false), signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
