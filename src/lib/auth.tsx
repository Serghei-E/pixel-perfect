import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "staff";

export type Profile = {
  id: string;
  user_id: string | null;
  business_id: string | null;
  location_id: string | null;
  full_name: string;
  email: string | null;
  staff_role: string;
  hourly_cost: number;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe(userId: string) {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    setProfile((p as Profile) ?? null);
    setRole(((r?.role as AppRole) ?? "manager") as AppRole);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        setTimeout(() => void loadMe(next.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadMe(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadMe(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const DEMO_ACCOUNTS: { role: AppRole; email: string; name: string; label: string }[] = [
  { role: "owner", email: "owner@cafeflow.demo", name: "Eve Rósa", label: "Café owner" },
  { role: "manager", email: "manager@cafeflow.demo", name: "Marta Kask", label: "Café manager" },
  { role: "staff", email: "staff@cafeflow.demo", name: "Jonas Rebane", label: "Staff member" },
];

export const DEMO_PASSWORD = "cafeflow-demo";

export async function signInDemo(role: AppRole) {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;
  const attempt = await supabase.auth.signInWithPassword({
    email: account.email,
    password: DEMO_PASSWORD,
  });
  if (!attempt.error) return;

  const created = await supabase.auth.signUp({
    email: account.email,
    password: DEMO_PASSWORD,
    options: { data: { role: account.role, full_name: account.name } },
  });
  if (created.error) throw created.error;
  if (!created.data.session) {
    const retry = await supabase.auth.signInWithPassword({
      email: account.email,
      password: DEMO_PASSWORD,
    });
    if (retry.error) throw retry.error;
  }
}
