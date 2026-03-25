import React from "react";
import { Bus, CheckCircle, AlertTriangle, Wrench, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

function useBuses() {
  return useQuery({
    queryKey: ["company-buses"],
    queryFn: () => apiFetch<any[]>("/company/buses").catch(() => []),
    refetchInterval: 30000,
  });
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  disponible:     { label: "Disponible",   color: "#059669", bg: "#DCFCE7", icon: <CheckCircle size={14} /> },
  en_route:       { label: "En route",     color: "#2563EB", bg: "#DBEAFE", icon: <Bus size={14} /> },
  en_panne:       { label: "En panne",     color: "#DC2626", bg: "#FEE2E2", icon: <AlertTriangle size={14} /> },
  en_maintenance: { label: "Maintenance",  color: "#7C3AED", bg: "#EDE9FE", icon: <Wrench size={14} /> },
  en_attente:     { label: "En attente",   color: "#D97706", bg: "#FEF9C3", icon: <Clock size={14} /> },
};

export default function SuiviEngins() {
  const { data: buses = [], isLoading } = useBuses();

  const counts = {
    disponible: (buses as any[]).filter((b) => b.logisticStatus === "disponible" || b.status === "available").length,
    en_route:   (buses as any[]).filter((b) => b.logisticStatus === "en_route").length,
    en_panne:   (buses as any[]).filter((b) => b.logisticStatus === "en_panne").length,
    maintenance:(buses as any[]).filter((b) => b.logisticStatus === "en_maintenance").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Suivi Engins</h2>
        <p className="text-sm text-muted-foreground mt-1">État de la flotte de bus</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Disponibles", value: counts.disponible, color: "#059669", bg: "#DCFCE7" },
          { label: "En route",    value: counts.en_route,   color: "#2563EB", bg: "#DBEAFE" },
          { label: "En panne",    value: counts.en_panne,   color: "#DC2626", bg: "#FEE2E2" },
          { label: "Maintenance", value: counts.maintenance, color: "#7C3AED", bg: "#EDE9FE" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Bus size={17} className="text-green-600" />
          <h3 className="font-bold text-foreground text-sm">Flotte ({(buses as any[]).length} engins)</h3>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Chargement de la flotte...</div>
        ) : (buses as any[]).length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Aucun engin enregistré</div>
        ) : (
          <div className="divide-y divide-border">
            {(buses as any[]).map((b: any) => {
              const rawStatus = b.logisticStatus || b.status || "en_attente";
              const s = STATUS_MAP[rawStatus] ?? STATUS_MAP.en_attente;
              return (
                <div key={b.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg, color: s.color }}>
                      <Bus size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{b.busName || b.name || b.id}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.licensePlate || b.immatriculation || "—"} · {b.capacity ?? "—"} places</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
                    {s.icon} {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-700">
        <strong>💡 Note :</strong> Les statuts des engins sont mis à jour par les agents logistique via l'application mobile.
        Les changements apparaissent ici en temps réel (actualisation toutes les 30s).
      </div>
    </div>
  );
}
