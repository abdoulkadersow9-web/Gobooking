import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/* ═══════════════════════════════════
   COMPANY HOOKS
═══════════════════════════════════ */

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<any>("/company/dashboard"),
    refetchInterval: 30000,
  });
}

export function useScanStats() {
  return useQuery({
    queryKey: ["scan-stats"],
    queryFn: () => apiFetch<any>("/company/scan-stats"),
    refetchInterval: 30000,
  });
}

export function useReservations() {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: () => apiFetch<any[]>("/company/reservations"),
  });
}

export function useParcels() {
  return useQuery({
    queryKey: ["parcels"],
    queryFn: () => apiFetch<any[]>("/company/parcels"),
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => apiFetch<any[]>("/company/agents"),
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/company/agents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useAssignAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/company/agents/${id}/assign`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useTrips() {
  return useQuery({
    queryKey: ["trips"],
    queryFn: () => apiFetch<any[]>("/company/trips"),
  });
}

export function useTripAgents(tripId: string | null) {
  return useQuery({
    queryKey: ["trip-agents", tripId],
    queryFn: () => apiFetch<any[]>(`/company/trips/${tripId}/agents`),
    enabled: !!tripId,
  });
}

export function useBuses() {
  return useQuery({
    queryKey: ["buses"],
    queryFn: () => apiFetch<any[]>("/company/buses"),
  });
}

export function usePriceGrid() {
  return useQuery({
    queryKey: ["price-grid"],
    queryFn: () => apiFetch<{ grid: Record<string, Record<string, number>>; cities: string[] }>("/trips/price-grid"),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/company/trips", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useTripAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "end" }) =>
      apiFetch(`/company/trips/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<any>("/company/analytics"),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<any[]>("/company/invoices"),
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (period?: string) =>
      apiFetch("/company/invoices/generate", { method: "POST", body: JSON.stringify({ period }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

/* Company agent reports */
export function useCompanyReports() {
  return useQuery({
    queryKey: ["company-reports"],
    queryFn: () => apiFetch<any[]>("/company/reports"),
    refetchInterval: 30000,
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) =>
      apiFetch(`/company/reports/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-reports"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
  });
}

/* ═══════════════════════════════════
   SUPERADMIN HOOKS
═══════════════════════════════════ */

export function useSuperAdminStats() {
  return useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: () => apiFetch<any>("/superadmin/stats"),
    refetchInterval: 30000,
  });
}

export function useSuperAdminCompanies() {
  return useQuery({
    queryKey: ["superadmin-companies"],
    queryFn: () => apiFetch<any[]>("/superadmin/companies"),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/superadmin/companies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] }),
  });
}

export function useSuperAdminUsers() {
  return useQuery({
    queryKey: ["superadmin-users"],
    queryFn: () => apiFetch<any[]>("/superadmin/users"),
  });
}

export function useSuperAdminBookings() {
  return useQuery({
    queryKey: ["superadmin-bookings"],
    queryFn: () => apiFetch<any[]>("/superadmin/bookings"),
  });
}

export function useSuperAdminBookingStats() {
  return useQuery({
    queryKey: ["superadmin-booking-stats"],
    queryFn: () => apiFetch<any>("/superadmin/bookings/stats"),
    refetchInterval: 60000,
  });
}

export function useSuperAdminParcels() {
  return useQuery({
    queryKey: ["superadmin-parcels"],
    queryFn: () => apiFetch<any[]>("/superadmin/parcels"),
  });
}

export function useSuperAdminTrips() {
  return useQuery({
    queryKey: ["superadmin-trips"],
    queryFn: () => apiFetch<any[]>("/superadmin/trips"),
  });
}

export function useSuperAdminAnalytics() {
  return useQuery({
    queryKey: ["superadmin-analytics"],
    queryFn: () => apiFetch<any>("/superadmin/analytics"),
    refetchInterval: 60000,
  });
}

export function useSuperAdminAuditLogs() {
  return useQuery({
    queryKey: ["superadmin-audit-logs"],
    queryFn: () => apiFetch<any>("/superadmin/audit-logs"),
  });
}

export function useFinancialDashboard(period: string = "month") {
  return useQuery({
    queryKey: ["financial-dashboard", period],
    queryFn: () => apiFetch<any>(`/superadmin/financial?period=${period}`),
    refetchInterval: 60000,
  });
}

export function useCompanyAlerts() {
  return useQuery({
    queryKey: ["company-alertes"],
    queryFn: () => apiFetch<any[]>("/company/alertes").catch(() => []),
    refetchInterval: 30000,
  });
}

export function useAllAgences() {
  return useQuery({
    queryKey: ["admin-agences"],
    queryFn: () => apiFetch<any[]>("/superadmin/agences"),
    refetchInterval: 60000,
  });
}

export function useCreateAdminAgence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; city: string; address?: string; phone?: string; companyId: string }) =>
      apiFetch("/superadmin/agences", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-agences"] }),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: () => apiFetch<any>("/superadmin/recent-activity"),
    refetchInterval: 30000,
  });
}

export function useCompanyAgences() {
  return useQuery({
    queryKey: ["company-agences"],
    queryFn: () => apiFetch<any[]>("/company/agences"),
    refetchInterval: 60000,
  });
}

export function useCreateCompanyAgence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; city: string; address?: string; phone?: string }) =>
      apiFetch("/company/agences", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-agences"] }),
  });
}
