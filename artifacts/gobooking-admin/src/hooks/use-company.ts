import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- DASHBOARD ---
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<any>('/company/dashboard'),
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useScanStats() {
  return useQuery({
    queryKey: ['scan-stats'],
    queryFn: () => apiFetch<any>('/company/scan-stats'),
    refetchInterval: 30000,
  });
}

// --- RESERVATIONS ---
export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: () => apiFetch<any[]>('/company/reservations'),
  });
}

// --- PARCELS ---
export function useParcels() {
  return useQuery({
    queryKey: ['parcels'],
    queryFn: () => apiFetch<any[]>('/company/parcels'),
  });
}

// --- AGENTS ---
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => apiFetch<any[]>('/company/agents'),
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('/company/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useAssignAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => apiFetch(`/company/agents/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
}

// --- TRIPS ---
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => apiFetch<any[]>('/company/trips'),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('/company/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useTripAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string, action: 'start' | 'end' }) => apiFetch(`/company/trips/${id}/${action}`, {
      method: 'POST',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

// --- ANALYTICS ---
export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => apiFetch<any>('/company/analytics'),
  });
}

// --- INVOICES ---
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiFetch<any[]>('/company/invoices'),
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (period?: string) => apiFetch('/company/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({ period }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
