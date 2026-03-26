import React from "react";
import { Users, Bus, UserCheck, Map, Plus, Edit, AlertTriangle } from "lucide-react";
import { useAgents, useTrips } from "@/hooks/use-company";

export default function Affectation() {
  const { data: agents = [], isLoading: loadingAgents } = useAgents();
  const { data: trips = [], isLoading: loadingTrips } = useTrips();

  const chauffeurs = (agents as any[]).filter((a) => a.agentRole === "chauffeur" || a.role === "chauffeur");
  const routeAgents = (agents as any[]).filter((a) => a.agentRole === "agent_route" || a.role === "route");
  const activeTrips = (trips as any[]).filter((t) => t.status === "active" || t.status === "scheduled").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Affectation</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestion chauffeurs & agents de route</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Chauffeurs", value: chauffeurs.length, color: "#2563EB", bg: "#EFF6FF", icon: <Bus size={20} /> },
          { label: "Agents route", value: routeAgents.length, color: "#059669", bg: "#F0FDF4", icon: <UserCheck size={20} /> },
          { label: "Trajets prévus", value: activeTrips.length, color: "#D97706", bg: "#FEF9C3", icon: <Map size={20} /> },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Bus size={17} className="text-blue-500" />
            <h3 className="font-bold text-foreground text-sm">Trajets à affecter</h3>
          </div>
          <div className="divide-y divide-border">
            {loadingTrips ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">Chargement...</div>
            ) : activeTrips.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">Aucun trajet programmé</div>
            ) : (
              activeTrips.map((t: any) => (
                <div key={t.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{t.fromCity || t.from} → {t.toCity || t.to}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.date} · {t.departureTime}</p>
                    <div className="flex gap-2 mt-2">
                      {t.chauffeurNom ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          <UserCheck size={11} /> {t.chauffeurNom}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          <AlertTriangle size={11} /> Pas de chauffeur
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                    <Edit size={12} /> Affecter
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Users size={17} className="text-green-600" />
            <h3 className="font-bold text-foreground text-sm">Personnel disponible</h3>
          </div>
          <div className="divide-y divide-border">
            {loadingAgents ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">Chargement...</div>
            ) : (agents as any[]).length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">Aucun agent enregistré</div>
            ) : (
              (agents as any[]).slice(0, 8).map((a: any) => (
                <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-foreground text-sm">
                    {(a.name || a.agentCode || "A")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.name || a.agentCode || "Agent"}</p>
                    <p className="text-xs text-muted-foreground">{a.agentRole || a.role || "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    a.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {a.status === "active" ? "Disponible" : "Inactif"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
