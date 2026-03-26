import React, { useState } from "react";
import { useDashboard, useSuperAdminStats, useSuperAdminTrips } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, RefreshCw, Bus, Package, Clock, CheckCircle, XCircle, Zap } from "lucide-react";

/* ── Types ── */
interface AlertItem {
  id: string;
  type: "bus_panne" | "colis_non_retire" | "retard" | "alerte_agent" | "anomalie";
  title: string;
  description: string;
  severity: "critique" | "warning" | "info";
  time: string;
  resolved?: boolean;
}

const SEVERITY_STYLE = {
  critique: { color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5", badge: "CRITIQUE" },
  warning:  { color: "#D97706", bg: "#FEF9C3", border: "#FCD34D", badge: "ATTENTION" },
  info:     { color: "#2563EB", bg: "#DBEAFE", border: "#93C5FD", badge: "INFO" },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  bus_panne:       <Bus size={18} />,
  colis_non_retire:<Package size={18} />,
  retard:          <Clock size={18} />,
  alerte_agent:    <AlertTriangle size={18} />,
  anomalie:        <Zap size={18} />,
};

function buildAlertsFromData(companyData: any, superData: any, trips: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Bus en panne (from trips with status)
  if (trips) {
    trips.filter((t: any) => t.status === "en_panne" || t.busStatus === "en_panne").forEach((t: any) => {
      alerts.push({
        id: `bus_${t.id}`,
        type: "bus_panne",
        title: `Bus en panne — ${t.busName || "N/A"}`,
        description: `Trajet ${t.from || "?"} → ${t.to || "?"} bloqué. Bus: ${t.busName}`,
        severity: "critique",
        time: now,
      });
    });
  }

  // Colis non retirés (> 24h in "arrivé" status)
  const colisNonRetires = companyData?.summary?.colisNonRetires ?? superData?.colisNonRetires ?? 0;
  if (colisNonRetires > 0) {
    alerts.push({
      id: "colis_nr",
      type: "colis_non_retire",
      title: `${colisNonRetires} colis non retirés depuis +24h`,
      description: "Des colis arrivés à destination attendent depuis plus de 24h. Contactez les destinataires.",
      severity: "warning",
      time: now,
    });
  }

  // Colis en attente validation
  const colisValidation = companyData?.summary?.parcelsAwaitingValidation ?? 0;
  if (colisValidation > 0) {
    alerts.push({
      id: "colis_val",
      type: "colis_non_retire",
      title: `${colisValidation} colis à distance en attente de validation`,
      description: "Des clients ont déposé des demandes de colis à distance nécessitant votre validation.",
      severity: "warning",
      time: now,
    });
  }

  // Reservation anomalies (overbooking)
  const overbooking = companyData?.summary?.overbookingCount ?? 0;
  if (overbooking > 0) {
    alerts.push({
      id: "overbooking",
      type: "anomalie",
      title: `${overbooking} réservation(s) en surbooking détectée(s)`,
      description: "Certains trajets ont plus de réservations que de places disponibles.",
      severity: "critique",
      time: now,
    });
  }

  // No alerts
  if (alerts.length === 0) {
    alerts.push({
      id: "all_good",
      type: "anomalie",
      title: "Aucune alerte active",
      description: "Tous les systèmes fonctionnent normalement.",
      severity: "info",
      time: now,
    });
  }

  return alerts;
}

export default function AlertsPage() {
  const { isSuperAdmin } = useAuth();
  const { data: companyData, isLoading: loadingCompany, refetch: refetchCompany, isFetching: fetchingCompany } = useDashboard();
  const { data: superStats, isLoading: loadingSuper, refetch: refetchSuper, isFetching: fetchingSuper } = useSuperAdminStats();
  const { data: trips = [] } = useSuperAdminTrips();

  const [dismissed, setDismissed] = useState<string[]>([]);

  const isLoading = isSuperAdmin ? loadingSuper : loadingCompany;
  const isFetching = isSuperAdmin ? fetchingSuper : fetchingCompany;
  const refetch = isSuperAdmin ? refetchSuper : refetchCompany;

  const rawAlerts = buildAlertsFromData(companyData, superStats, trips as any[]);
  const alerts = rawAlerts.filter((a) => !dismissed.includes(a.id));

  const critiques = alerts.filter((a) => a.severity === "critique").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}>
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Alertes & Anomalies</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Surveillance en temps réel des incidents</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-4 py-2.5 rounded-xl border border-border shadow-sm"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-semibold">
          <AlertTriangle size={15} className="text-red-500" />
          {critiques} critique{critiques !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Clock size={15} className="text-amber-500" />
          {warnings} attention{warnings !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-semibold">
          <CheckCircle size={15} className="text-emerald-500" />
          {alerts.length === 1 && alerts[0].id === "all_good" ? "Tout est normal" : `${dismissed.length} résolue(s)`}
        </div>
      </div>

      {/* Alert cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-red-500" />
          Vérification des alertes...
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            const isAllGood = alert.id === "all_good";
            return (
              <div
                key={alert.id}
                className="bg-card rounded-2xl border-2 shadow-sm overflow-hidden"
                style={{ borderColor: style.border }}
              >
                <div className="flex items-start gap-4 p-5">
                  <div
                    className="p-2.5 rounded-xl shrink-0 mt-0.5"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    {isAllGood ? <CheckCircle size={18} /> : TYPE_ICONS[alert.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ color: style.color, backgroundColor: style.bg }}
                          >
                            {style.badge}
                          </span>
                          <span className="text-xs text-muted-foreground">{alert.time}</span>
                        </div>
                        <h3 className="font-semibold text-foreground">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                      </div>
                      {!isAllGood && (
                        <button
                          onClick={() => setDismissed((d) => [...d, alert.id])}
                          className="shrink-0 text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground font-semibold hover:bg-muted/70 transition-colors flex items-center gap-1"
                        >
                          <XCircle size={12} />
                          Rejeter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dismissed section */}
      {dismissed.length > 0 && (
        <div className="bg-muted/30 rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Alertes rejetées ({dismissed.length})
            </h3>
            <button
              onClick={() => setDismissed([])}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Tout restaurer
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ces alertes ont été marquées comme résolues. Actualisez pour vérifier s'il en existe de nouvelles.
          </p>
        </div>
      )}
    </div>
  );
}
