import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, TOKEN_KEY } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

export const USER_KEY = "gobooking_admin_user";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(getStoredUser);
  const queryClient = useQueryClient();

  const syncState = useCallback(() => {
    const hasToken = !!localStorage.getItem(TOKEN_KEY);
    setIsAuthenticated(hasToken);
    setUser(hasToken ? getStoredUser() : null);
  }, []);

  useEffect(() => {
    window.addEventListener("auth-change", syncState);
    return () => window.removeEventListener("auth-change", syncState);
  }, [syncState]);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      queryClient.setQueryData(["current-user"], data.user);
      window.dispatchEvent(new Event("auth-change"));
    },
  });

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    queryClient.clear();
    window.dispatchEvent(new Event("auth-change"));
  };

  const isSuperAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isCompany = user?.role === "company";

  return {
    isAuthenticated,
    user,
    isSuperAdmin,
    isCompany,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    error: loginMutation.error,
    logout,
  };
}
