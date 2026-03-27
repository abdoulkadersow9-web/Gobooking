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

export type UserRole = "client" | "user" | "compagnie" | "company_admin" | "agent" | "admin" | "super_admin";
export type AgentRole = "agent_ticket" | "agent_embarquement" | "agent_colis" | "agent_guichet"
  | "embarquement" | "reception_colis" | "vente" | "validation" | "route" | "logistique" | "suivi"
  | "agent_reservation" | "chef_agence"
  | "agent_bagage" | "agent_route" | "validation_depart";

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
  if (agentRole === "agent_bagage")                                            return "/agent/bagage";
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
  return "/client/home"; // client / user
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    const load = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("auth_token");
        if (!storedToken) return;

        // Verify the token is still valid with the server
        try {
          const freshUser = await apiFetch<User>("/auth/me", { token: storedToken });
          if (!freshUser || !freshUser.role) return;

          // Refresh stored user with server data
          await AsyncStorage.setItem("auth_user", JSON.stringify(freshUser));
          setToken(storedToken);
          setUser(freshUser);

          const dashPath = getDashboardPath(freshUser.role, freshUser.agentRole);
          const cur = currentPathRef.current;
          const isClient = freshUser.role === "client" || freshUser.role === "user";
          const alreadyThere =
            cur === dashPath ||
            cur.startsWith(dashPath.replace(/\/[^/]+$/, "") + "/") || // same section
            (isClient && (cur.startsWith("/client/") || cur.startsWith("/(tabs)")));
          if (!alreadyThere) {
            router.replace(dashPath as never);
          }
        } catch {
          // Token is invalid (server restart or expired) — clear stored auth
          await AsyncStorage.removeItem("auth_token");
          await AsyncStorage.removeItem("auth_user");
        }
      } catch {
        // ignore storage errors
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []); // Run once on mount

  const login = useCallback(async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem("auth_token", newToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    /* ── Enregistrement push token ── */
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
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
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
        refreshUser,
        isAdmin: user?.role === "admin" || user?.role === "super_admin",
        isCompanyAdmin: user?.role === "compagnie" || user?.role === "company_admin",
        isAgent: user?.role === "agent",
        isSuperAdmin: user?.role === "admin" || user?.role === "super_admin",
        dashboardPath: user ? getDashboardPath(user.role) : null,
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
