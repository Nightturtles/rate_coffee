"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
};

const AuthStateContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (configured && typeof window !== "undefined" ? getSupabaseBrowserClient() : null),
    [configured]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
      })
      .finally(() => {
        setLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      void subscription.unsubscribe();
    };
  }, [supabase]);

  const value: Ctx = {
    user: session?.user ?? null,
    session,
    loading,
    configured: Boolean(supabase),
  };

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthStateContext);
  if (v === undefined) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
