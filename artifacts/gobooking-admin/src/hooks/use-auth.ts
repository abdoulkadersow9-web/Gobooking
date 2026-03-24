import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, TOKEN_KEY } from "@/lib/api";
import { useEffect, useState } from "react";

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

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem(TOKEN_KEY));
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) => 
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      queryClient.setQueryData(['current-user'], data.user);
      window.dispatchEvent(new Event('auth-change'));
    }
  });

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    window.dispatchEvent(new Event('auth-change'));
  };

  // Pseudo query to get current user info if needed. 
  // In a real app we might have a /me endpoint, here we rely on cached data from login or local storage wrapper.
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => {
       // Mock fetch if we had a /me endpoint, returning null if no token
       if (!localStorage.getItem(TOKEN_KEY)) return null;
       return null; // Fallback, normally would fetch /api/auth/me
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  return {
    isAuthenticated,
    user,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    error: loginMutation.error,
    logout
  };
}
