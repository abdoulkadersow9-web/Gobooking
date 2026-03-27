import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, usePathname } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiFetch } from "@/utils/api";
import { registerForPushNotifications } from "@/utils/notifications";
import { queryClient } from "@/utils/queryClient";

export type UserRole = "client" | "user" | "compagnie" | "company_admin" | "agent" | "admin" | "super_admin";
export type AgentRole = "agent_ticket" | "agent_embarquement" | "agent_colis" | "agent_guichet"
  | "embarquement" | "reception_colis" | "vente" | "validation" | "route" | "logistique" | "suivi"
  | "agent_reservation" | "chef_agence"
  | "agent_bagage" | "agent_route" | "validation_depart" | "bagage";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  agentRole?: AgentRole | null;
  extraRoles?: string[];
  busId?: string | null;
  tripId?: string | null;
  companyId?: string | null;
  photoUrl?: string | null;
  referralCode?: string;
  walletBalance?: number;
  totalTrips?: number;
  createdAt: string;
}

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  if (user.agentRole === role) return true;
  if (user.extraRoles?.includes(role)) return true;
  return false;
}

export function getAgentPath(agentRole?: AgentRole | null): string {
  if (agentRole === "chef_agence")                                             return "/agent/chef-home";
  if (agentRole === "agent_ticket" || agentRole === "vente" || agentRole === "agent_guichet") return "/agent/tickets";
  if (agentRole === "agent_embarquement" || agentRole === "embarquement")      return "/agent/embarquement";
  if (agentRole === "agent_colis"  || agentRole === "reception_colis")         return "/agent/colis";
  if (agentRole === "agent_bagage" || agentRole === "bagage")                  return "/agent/bagage";
  if (agentRole === "validation"   || agentRole === "validation_depart")       return "/agent/departure-validation";
  if (agentRole === "route"        || agentRole === "agent_route")             return "/agent/route";
  if (agentRole === "logistique")                                              return "/agent/logistique";
  if (agentRole === "suivi")                                                   return "/agent/suivi";
  if (agentRole === "agent_reservation")                                       return "/agent/reservation";
  return "/agent/home";
}

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  chef_agence:        "Chef d'Agence",
  agent_ticket:       "Agent Guichet",
  agent_guichet:      "Agent Guichet",
  agent_embarquement: "Agent Embarquement",
  agent_colis:        "Agent Colis",
  agent_bagage:       "Agent Bagages",
  bagage:             "Agent Bagages",
  embarquement:       "Agent Embarquement",
  reception_colis:    "Agent Colis",
  vente:              "Agent Guichet",
  validation:         "Agent Validation Départ",
  validation_depart:  "Agent Validation Départ",
  route:              "Agent En Route",
  agent_route:        "Agent En Route",
  logistique:         "Agent Logistique",
  suivi:              "Agent Suivi",
  agent_reservation:  "Agent Réservation",
};

export const AGENT_ROLE_COLORS: Record<AgentRole, { bg: string; text: string }> = {
  chef_agence:        { bg: "#EEF2FF", text: "#3730A3" },
  agent_ticket:       { bg: "#FEF3C7", text: "#D97706" },
  agent_guichet:      { bg: "#FEF3C7", text: "#D97706" },
  agent_embarquement: { bg: "#DCFCE7", text: "#166534" },
  agent_colis:        { bg: "#EDE9FE", text: "#7C3AED" },
  agent_bagage:       { bg: "#FEF9C3", text: "#854D0E" },
  bagage:             { bg: "#FEF9C3", text: "#854D0E" },
  embarquement:       { bg: "#DCFCE7", text: "#166534" },
  reception_colis:    { bg: "#EDE9FE", text: "#7C3AED" },
  vente:              { bg: "#FEF3C7", text: "#D97706" },
  validation:         { bg: "#F3E8FF", text: "#6B21A8" },
  validation_depart:  { bg: "#F3E8FF", text: "#6B21A8" },
  route:              { bg: "#FFE4CC", text: "#9A3412" },
  agent_route:        { bg: "#FFE4CC", text: "#9A3412" },
  logistique:         { bg: "#E0F2FE", text: "#0369A1" },
  suivi:              { bg: "#FFF1F2", text: "#BE123C" },
  agent_reservation:  { bg: "#ECFEFF", text: "#0E7490" },
};

export function getDashboardPath(role: UserRole, agentRole?: AgentRole | null): string {
  if (role === "compagnie" || role === "company_admin") return "/entreprise/dashboard";
  if (role === "agent")                                 return getAgentPath(agentRole);
  if (role === "admin"   || role === "super_admin")     return "/admin/dashboard";
  return "/client/home";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * logoutIfActiveToken — safe logout for 401 handlers in screens.
   *
   * Why not on 403:
   *   401 = token is invalid / expired → the user must re-authenticate.
   *   403 = token is valid, but the user's role was denied for THIS endpoint.
   *         This can happen during navigation transitions when the previous
   *         screen is still mounted and fires an API call with the NEW user's
   *         token against an endpoint the new user's role cannot access.
   *         Logging out on 403 would immediately disconnect the new user.
   *
   * Race-condition guard:
   *   If a new login was established while this request was in-flight,
   *   `failedToken` will no longer match `activeSessionToken.current` and
   *   this function becomes a no-op — protecting the new session.
   *
   * Usage in screens:
   *   catch (e: any) {
   *     if (e?.httpStatus === 401) {   // ← 401 ONLY, never 403
   *       logoutIfActiveToken(authToken);
   *       return;
   *     }
   *   }
   */
  logoutIfActiveToken: (failedToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  isAgent: boolean;
  isSuperAdmin: boolean;
  dashboardPath: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentPath = usePathname();
  const currentPathRef = useRef(currentPath);

  /**
   * activeSessionToken: tracks the CURRENT valid token at any point in time.
   * Used to prevent the background validation from overwriting a newer session.
   *
   * Example race condition it prevents:
   *   T=0  App starts, restores old session (token_A) from cache
   *   T=0  Background validation starts for token_A
   *   T=1  User clicks quick-access → login(token_B, userB)
   *        → activeSessionToken = token_B
   *   T=2  Background validation for token_A returns 403
   *        → sees activeSessionToken !== token_A → does NOT clear session ✓
   */
  const activeSessionToken = useRef<string | null>(null);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    const load = async () => {
      try {
        /* ── Step 1: Read both token + cached user in parallel (~5ms) ── */
        const [storedToken, storedUserJson] = await Promise.all([
          AsyncStorage.getItem("auth_token"),
          AsyncStorage.getItem("auth_user"),
        ]);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        /* Track this as the active session token */
        activeSessionToken.current = storedToken;

        /* ── Step 2: Restore cached user instantly if available ── */
        if (storedUserJson) {
          try {
            const cachedUser = JSON.parse(storedUserJson) as User;
            if (cachedUser?.role) {
              /* Show the app immediately with cached data — no network wait */
              setToken(storedToken);
              setUser(cachedUser);
              setIsLoading(false);

              /* ── Step 3: Validate token in background ── */
              try {
                const freshUser = await apiFetch<User>("/auth/me", {
                  token: storedToken,
                  timeoutMs: 10_000,
                });

                /* ── RACE GUARD: only act if this session is still the active one ── */
                if (activeSessionToken.current !== storedToken) return;

                if (freshUser?.role) {
                  await AsyncStorage.setItem("auth_user", JSON.stringify(freshUser));
                  setUser(freshUser);
                } else {
                  /* Server returned unexpected data — clear session */
                  await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
                  activeSessionToken.current = null;
                  setToken(null);
                  setUser(null);
                }
              } catch (e: any) {
                /* ── RACE GUARD ── */
                if (activeSessionToken.current !== storedToken) return;

                /* 401/403 = token genuinely invalid — clear session */
                if (e?.httpStatus === 401 || e?.httpStatus === 403) {
                  await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
                  activeSessionToken.current = null;
                  setToken(null);
                  setUser(null);
                  router.replace("/(auth)/login");
                }
                /* Network error / timeout → keep cached session (offline-friendly) */
              }
              return;
            }
          } catch {
            /* Corrupt cache — fall through to server validation */
          }
        }

        /* ── Fallback: no usable cache — validate with server ── */
        try {
          const freshUser = await apiFetch<User>("/auth/me", {
            token: storedToken,
            timeoutMs: 10_000,
          });

          if (activeSessionToken.current !== storedToken) return;

          if (!freshUser?.role) throw new Error("invalid user");

          await AsyncStorage.setItem("auth_user", JSON.stringify(freshUser));
          setToken(storedToken);
          setUser(freshUser);
        } catch {
          if (activeSessionToken.current !== storedToken) return;
          await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
          activeSessionToken.current = null;
        }
      } catch {
        /* Storage error — ignore */
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []); // Run once on mount

  const login = useCallback(async (newToken: string, newUser: User) => {
    /* 1. If a previous session exists, invalidate it server-side before switching.
          Fire-and-forget: do not block login on this. */
    const prevToken = activeSessionToken.current;
    if (prevToken && prevToken !== newToken) {
      apiFetch("/auth/logout", { method: "POST", token: prevToken }).catch(() => {});
    }

    /* 2. Mark new session FIRST — prevents any race with background validation */
    activeSessionToken.current = newToken;

    /* 3. Wipe the React Query cache so the new user never sees stale data
          from the previous session. Must happen BEFORE state update so screens
          that mount after setUser() start with a clean cache. */
    queryClient.clear();

    /* 4. Update React state IMMEDIATELY so AuthGuard and screens react instantly */
    setToken(newToken);
    setUser(newUser);

    /* 5. Persist to AsyncStorage — awaited so storage is consistent before returning.
          State was already updated (step 4), so this does not block the UI. */
    try {
      await AsyncStorage.multiSet([
        ["auth_token", newToken],
        ["auth_user", JSON.stringify(newUser)],
      ]);
    } catch {
      /* Storage failure is non-fatal — session is already active in memory */
    }

    /* 6. Push token registration — fire and forget */
    registerForPushNotifications().then(async (pushToken) => {
      if (!pushToken) return;
      try {
        await apiFetch("/auth/push-token", {
          method: "POST",
          token: newToken,
          body: JSON.stringify({ pushToken }),
        });
      } catch {
      }
    }).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    const currentToken = activeSessionToken.current;
    /* 1. Mark session as cleared immediately */
    activeSessionToken.current = null;

    /* 2. Wipe React Query cache — prevent old session data from leaking */
    queryClient.clear();

    /* 3. Clear local state immediately so AuthGuard navigates to login */
    setToken(null);
    setUser(null);

    /* 4. Clear AsyncStorage (fire and forget is OK — UI is already updating) */
    AsyncStorage.multiRemove(["auth_token", "auth_user"]).catch(() => {});

    /* 5. Invalidate token on server so the session is truly gone (fire and forget) */
    if (currentToken) {
      apiFetch("/auth/logout", {
        method: "POST",
        token: currentToken,
      }).catch(() => {});
    }

    /* 6. Navigate to login — belt-and-suspenders alongside AuthGuard */
    router.replace("/(auth)/login");
  }, []);

  /**
   * Safe logout for screen 403 handlers.
   * Only clears the session if `failedToken` is still the active session token.
   * If the user already re-authenticated since this request was sent, this is a no-op.
   */
  const logoutIfActiveToken = useCallback(async (failedToken: string) => {
    if (!failedToken) return;
    if (activeSessionToken.current !== failedToken) return; /* New session already active — no-op */
    activeSessionToken.current = null;

    /* Wipe React Query cache — prevent old session data from leaking */
    queryClient.clear();

    /* Clear state immediately */
    setToken(null);
    setUser(null);

    /* Clear storage and invalidate server token (fire and forget) */
    AsyncStorage.multiRemove(["auth_token", "auth_user"]).catch(() => {});
    apiFetch("/auth/logout", {
      method: "POST",
      token: failedToken,
    }).catch(() => {});

    router.replace("/(auth)/login");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      if (!storedToken) return;
      const freshUser = await apiFetch<User>("/auth/me", { token: storedToken });
      if (freshUser?.role) {
        await AsyncStorage.setItem("auth_user", JSON.stringify(freshUser));
        setUser(freshUser);
      }
    } catch {
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        logoutIfActiveToken,
        refreshUser,
        isAdmin: user?.role === "admin" || user?.role === "super_admin",
        isCompanyAdmin: user?.role === "compagnie" || user?.role === "company_admin",
        isAgent: user?.role === "agent",
        isSuperAdmin: user?.role === "admin" || user?.role === "super_admin",
        dashboardPath: user ? getDashboardPath(user.role, user.agentRole) : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
