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

export type UserRole = "client" | "user" | "compagnie" | "company_admin" | "agent" | "admin" | "super_admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export function getDashboardPath(role: UserRole): string | null {
  if (role === "compagnie" || role === "company_admin") return "/dashboard/company";
  if (role === "agent") return "/dashboard/agent";
  if (role === "admin" || role === "super_admin") return "/dashboard/super-admin";
  return null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
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
  // Capture path at mount time (like DOMContentLoaded — fires once, reads current path)
  const currentPathRef = useRef(currentPath);

  useEffect(() => {
    const load = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("auth_token");
        const storedUser = await AsyncStorage.getItem("auth_user");
        const lsUser = await AsyncStorage.getItem("user");

        const rawUser = storedUser
          ? (JSON.parse(storedUser) as User)
          : lsUser
          ? (JSON.parse(lsUser) as Partial<User>)
          : null;

        if (!rawUser || !rawUser.role) return;

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(rawUser as User);
        }

        // Mirrors: if (role === "agent" && currentPath !== "/agent-dashboard") → redirect
        //          elif (role === "compagnie" && currentPath !== "/company-dashboard") → redirect
        //          elif (role === "admin" && currentPath !== "/admin-dashboard") → redirect
        const dashPath = getDashboardPath(rawUser.role);
        if (dashPath && currentPathRef.current !== dashPath) {
          router.replace(dashPath as never);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []); // Run once on mount — mirrors DOMContentLoaded

  const login = useCallback(async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem("auth_token", newToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
    router.replace("/(auth)/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
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
