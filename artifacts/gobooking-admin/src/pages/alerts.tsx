import React, { useState } from "react";
import { useDashboard, useSuperAdminStats, useSuperAdminTrips, useSuperAdminAlerts } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, RefreshCw, Bus, Package, Clock, CheckCircle, XCircle, Zap, Wifi, Activity, Gauge } from "lucide-react";

/* ── Types ── */
interface AlertItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "critique" | "warning" | "info";
  time: string;
  companyName?: string | null;
  busName?: string | null;
  isSystem?: boolean;
  isReal?: boolean;
  resolveId?: string;
}

const SEVERITY_STYLE = {
  critique: { color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5", badge: "CRITIQUE" },
  warning:  { color: "#D97706", bg: "#FEF9C3", border: "#FCD34D", badge: "ATTENTION" },
  info:     { color: "#2563EB", bg: "#DBEAFE", border: "#93C5FD", badge: "INFO" },
};

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; severity: "critique" | "warning" | "info" }> = {
  bus_offline:      { icon: <Wifi size={18} />,          label: "Hors ligne",     severity: "critique" },
  bus_arret:        { icon: <Bus size={18} />,           label: "Arrêt anormal",  severity: "warning"  },
  vitesse_anormale: { icon: <Gauge size={18} />,         label: "Excès vitesse",  severity: "critique" },
  alerte:           { icon: <AlertTriangle size={18} />, label: "Alerte",         severity: "critique" },
  urgence:          { icon: <AlertTriangle size={18} />, label: "Urgence",        severity: "critique" },
  panne:            { icon: <Bus size={18} />,           label: "Panne",          severity: "critique" },
  controle:         { icon: <Activity size={18} />,      label: "Contrôle",       severity: "warning"  },
  sos:              { icon: <AlertTriangle size={18} />, label: "SOS",            severity: "critique" },
  bus_panne:        { icon: <Bus size={18} />,           label: "Bus en panne",   severity: "critique" },
  colis_non_retire: { icon: <Package size={18} />,       label: "Colis",          severity: "warning"  },
  retard:           { icon: <Clock size={18} />,         label: "Retard",         severity: "warning"  },
  anomalie:         { icon: <Zap size={18} />,           label: "Anomalie",       severity: "info"     },
};

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

function buildComputedAlerts(companyData: any, superData: any, trips: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (trips) {
    trips.filter((t: any) => t.status === "en_panne" || t.busStatus === "en_panne").forEach((t: any) => {
      alerts.push({
        id: `computed_bus_${t.id}`,
        type: "bus_panne",
        title: `Bus en panne — ${t.busName || "N/A"}`,
        description: `Trajet ${t.from || "?"} → ${t.to || "?"} bloqué.`,
        severity: "critique",
        time: now,
      });
    });
  }

  const colisNonRetires = companyData?.summary?.colisNonRetires ?? superData?.colisNonRetires ?? 0;
  if (colisNonRetires > 0) {
    alerts.push({
      id: "computed_colis_nr",
      type: "colis_non_retire",
      title: `${colisNonRetires} colis non retirés depuis +24h`,
      description: "Des colis arrivés à destination attendent depuis plus de 24h.",
      severity: "warning",
      time: now,
    });
  }

  const colisValidation = companyData?.summary?.parcelsAwaitingValidation ?? 0;
  if (colisValidation > 0) {
    alerts.push({
      id: "computed_colis_val",
      type: "colis_non_retire",
      title: `${colisValidation} colis à distance en attente`,
      description: "Des demandes de colis nécessitent votre validation.",
      severity: "warning",
      time: now,
    });
  }

  const overbooking = companyData?.summary?.overbookingCount ?? 0;
  if (overbooking > 0) {
    alerts.push({
      id: "computed_overbooking",
      type: "anomalie",
      title: `${overbooking} réservation(s) en surbooking`,
      description: "Certains trajets ont plus de réservations que de places disponibles.",
      severity: "critique",
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
  const { data: dbAlerts = [], isLoading: loadingDbAlerts, refetch: refetchDbAlerts } = useSuperAdminAlerts("active");

  const [dismissed, setDismissed] = useState<string[]>([]);

  const isLoading  = isSuperAdmin ? (loadingSuper || loadingDbAlerts) : loadingCompany;
  const isFetching = isSuperAdmin ? fetchingSuper : fetchingCompany;

  const refetch = () => {
    if (isSuperAdmin) { refetchSuper(); refetchDbAlerts(); } else { refetchCompany(); }
  };

  /* Alertes réelles depuis agent_alerts */
  const realAlerts: AlertItem[] = (dbAlerts as any[]).map((a: any) => {
    const meta = TYPE_META[a.type?.toLowerCase()] ?? TYPE_META.anomalie;
    return {
      id:          a.id,
      type:        a.type,
      title:       `${a.busName ?? "Bus"} — ${TYPE_META[a.type?.toLowerCase()]?.label ?? a.type}`,
      description: a.message ?? "",
      severity:    meta.severity,
      time:        timeAgo(a.createdAt),
      companyName: a.companyName ?? null,
      busName:     a.busName ?? null,
      isSystem:    a.isSystem,
      isReal:      true,
      resolveId:   a.id,
    };
  });

  /* Alertes calculées (overbooking, colis, etc.) */
  const computedAlerts = buildComputedAlerts(companyData, superStats, trips as any[]);

  /* Fusion : réelles en premier, calculées après, pas de doublons */
  const allAlerts = [...realAlerts, ...computedAlerts].filter(a => !dismissed.includes(a.id));

  const critiques = allAlerts.filter(a => a.severity === "critique").length;
  const warnings  = allAlerts.filter(a => a.severity === "warning").length;
  const hasAlerts = allAlerts.length > 0;

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
            <p className="text-sm text-muted-foreground mt-0.5">
              Surveillance en temps réel — {(dbAlerts as any[]).length} alerte{(dbAlerts as any[]).length !== 1 ? "s" : ""} active{(dbAlerts as any[]).length !== 1 ? "s" : ""} en base
            </p>
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
          {dismissed.length > 0 ? `${dismissed.length} rejeté(e)s` : "Suivi actif"}
        </div>
      </div>

      {/* Alert cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-red-500" />
          Vérification des alertes...
        </div>
      ) : !hasAlerts ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground text-lg">Aucune alerte active</h3>
            <p className="text-sm text-muted-foreground mt-1">Tous les systèmes fonctionnent normalement</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {allAlerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            const meta  = TYPE_META[alert.type?.toLowerCase()] ?? TYPE_META.anomalie;
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
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ color: style.color, backgroundColor: style.bg }}
                          >
                            {style.badge}
                          </span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                            style={{ color: style.color, borderColor: style.border, background: "transparent" }}
                          >
                            {meta.label}
                          </span>
                          {alert.isSystem && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              Système auto
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{alert.time}</span>
                        </div>
                        <h3 className="font-semibold text-foreground truncate">{alert.title}</h3>
                        {alert.description && (
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{alert.description}</p>
                        )}
                        {alert.companyName && (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            Compagnie : {alert.companyName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setDismissed(d => [...d, alert.id])}
                        className="shrink-0 text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground font-semibold hover:bg-muted/70 transition-colors flex items-center gap-1"
                      >
                        <XCircle size={12} />
                        Rejeter
                      </button>
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
              Rejetées ({dismissed.length})
            </h3>
            <button
              onClick={() => setDismissed([])}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Restaurer tout
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Alertes masquées pour cette session. Actualisez pour recharger.
          </p>
        </div>
      )}
    </div>
  );
}
