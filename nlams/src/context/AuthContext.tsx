import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Role = "DOLR_SECRETARY" | "DISTRICT_COLLECTOR" | "LAO" | "STATE_REVENUE";

export const ROLE_LABEL: Record<Role, string> = {
  DOLR_SECRETARY: "DoLR Secretary",
  DISTRICT_COLLECTOR: "District Collector",
  LAO: "Land Acquisition Officer",
  STATE_REVENUE: "State Revenue Dept",
};

/** Only the Land Acquisition Officer persona may execute statutory actions. */
export const ROLE_CAN_ACT: Record<Role, boolean> = {
  DOLR_SECRETARY: false,
  DISTRICT_COLLECTOR: false,
  LAO: true,
  STATE_REVENUE: false,
};

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** null when the account has no BHUMITRA role assigned yet (app_metadata.role unset). */
  role: Role | null;
  /** Empty = national scope. */
  states: string[];
  displayName: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USER: User = {
  id: "default-lao-user-id",
  email: "lao@bhumitra.gov.in",
  app_metadata: { role: "LAO", states: [] },
  user_metadata: { name: "Land Acquisition Officer" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

const MOCK_SESSION: Session = {
  access_token: "bhumitra-guest-access-token",
  token_type: "bearer",
  expires_in: 360000,
  refresh_token: "bhumitra-guest-refresh-token",
  user: MOCK_USER,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState<Session | null>(MOCK_SESSION);
  const [loading] = useState(false);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? MOCK_USER;
    const role: Role = "LAO";
    const states: string[] = [];
    const displayName = "Land Acquisition Officer";

    return {
      loading: false,
      session,
      user,
      role,
      states,
      displayName,
      signOut: async () => {},
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

