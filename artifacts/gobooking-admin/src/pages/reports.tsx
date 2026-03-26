import React, { useState } from "react";
import { useCompanyReports, useUpdateReport } from "@/hooks/use-company";
import { ClipboardList, RefreshCw, CheckCircle, XCircle, Clock, Filter, AlertCircle, Package, User, Bus, AlertTriangle, Lightbulb, FileText } from "lucide-react";

const REPORT_TYPES: Record<string, { label: string; color: string }> = {
  incident_voyage:   { label: "Incident voyage",    color: "#DC2626" },
  probleme_colis:    { label: "Problème colis",     color: "#EA580C" },
  probleme_passager: { label: "Problème passager",  color: "#D97706" },
  probleme_vehicule: { label: "Panne véhicule",     color: "#7C3AED" },
  fraude:            { label: "Fraude",             color: "#B91C1C" },
  retard:            { label: "Retard",             color: "#0369A1" },
  suggestion:        { label: "Suggestion",         color: "#059669" },
  autre:             { label: "Autre",              color: "#475569" },
};

const REPORT_ICONS: Record<string, React.FC<{ size?: number }>> = {
  incident_voyage:   AlertCircle,
  probleme_colis:    Package,
  probleme_passager: User,
  probleme_vehicule: Bus,
  fraude:            AlertTriangle,
  retard:            Clock,
  suggestion:        Lightbulb,
  autre:             FileText,
};

function ReportIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = REPORT_ICONS[type] ?? FileText;
  return <Icon size={size} />;
}

const STATUT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  soumis:   { label: "Soumis",    color: "#D97706", bg: "#FEF9C3" },
  lu:       { label: "Lu",        color: "#2563EB", bg: "#DBEAFE" },
  en_cours: { label: "En cours",  color: "#7C3AED", bg: "#EDE9FE" },
  traite:   { label: "Traité ✓",  color: "#059669", bg: "#DCFCE7" },
  rejete:   { label: "Rejeté",    color: "#DC2626", bg: "#FEE2E2" },
};

type StatutFilter = "tous" | "soumis" | "lu" | "en_cours" | "traite" | "rejete";

export default function Reports() {
  const { data: reports = [], isLoading, refetch, isFetching } = useCompanyReports();
  const updateReport = useUpdateReport();
  const [filterStatut, setFilterStatut] = useState<StatutFilter>("tous");
  const [filterType, setFilterType] = useState("tous");

  const allReports = reports as any[];

  const filtered = allReports.filter((r) => {
    if (filterStatut !== "tous" && r.statut !== filterStatut) return false;
    if (filterType !== "tous" && r.reportType !== filterType) return false;
    return true;
  });

  const counts = {
    tous: allReports.length,
    soumis: allReports.filter((r) => r.statut === "soumis").length,
    lu: allReports.filter((r) => r.statut === "lu").length,
    en_cours: allReports.filter((r) => r.statut === "en_cours").length,
    traite: allReports.filter((r) => r.statut === "traite").length,
    rejete: allReports.filter((r) => r.statut === "rejete").length,
  };

  const handleUpdate = async (id: string, statut: string) => {
    await updateReport.mutateAsync({ id, statut });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Rapports Agents</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Incidents, problèmes et suggestions signalés par vos agents</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["tous", "soumis", "en_cours", "traite", "rejete"] as const).map((k) => {
          const s = k === "tous" ? null : STATUT_STYLE[k];
          return (
            <button
              key={k}
              onClick={() => setFilterStatut(k)}
              className={`rounded-xl p-4 text-center border-2 transition-all ${
                filterStatut === k
                  ? "border-current shadow-md"
                  : "border-border hover:border-gray-300"
              } bg-card`}
              style={s ? { borderColor: filterStatut === k ? s.color : undefined } : {}}
            >
              <p className="text-2xl font-bold" style={{ color: s?.color || "#374151" }}>
                {counts[k]}
              </p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">
                {k === "tous" ? "Tous" : s?.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("tous")}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
            filterType === "tous" ? "bg-gray-800 text-white border-gray-800" : "border-border text-muted-foreground hover:border-gray-400"
          }`}
        >
          Tous types
        </button>
        {Object.entries(REPORT_TYPES).map(([key, rt]) => (
          <button
            key={key}
            onClick={() => setFilterType(filterType === key ? "tous" : key)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
              filterType === key ? "text-white border-current" : "border-border text-muted-foreground hover:border-gray-400"
            }`}
            style={filterType === key ? { backgroundColor: rt.color, borderColor: rt.color } : {}}
          >
            <ReportIcon type={key} size={12} /> {rt.label}
          </button>
        ))}
      </div>

      {/* Report list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-red-500" />
          Chargement des rapports...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun rapport trouvé</p>
          <p className="text-sm mt-1">Modifiez les filtres ou revenez plus tard</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report: any) => {
            const rt = REPORT_TYPES[report.reportType] || { label: report.reportType, color: "#475569" };
            const st = STATUT_STYLE[report.statut] || STATUT_STYLE.soumis;
            const date = new Date(report.createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            });
            const isPending = report.statut === "soumis" || report.statut === "lu";

            return (
              <div
                key={report.id}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: rt.color + "18", color: rt.color }}>
                      <ReportIcon type={report.reportType} size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{rt.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.agentName}
                        {report.agentRole && <span className="ml-1 text-purple-500">• {report.agentRole}</span>}
                        {" · "}{date}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ color: st.color, backgroundColor: st.bg }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  <p className="text-sm text-foreground leading-relaxed">{report.description}</p>
                  {report.relatedId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Référence : <span className="font-mono font-semibold">{report.relatedId}</span>
                    </p>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => handleUpdate(report.id, "lu")}
                        disabled={report.statut === "lu" || updateReport.isPending}
                        className="text-xs px-3 py-2 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        👁 Marquer lu
                      </button>
                      <button
                        onClick={() => handleUpdate(report.id, "en_cours")}
                        disabled={updateReport.isPending}
                        className="text-xs px-3 py-2 rounded-lg bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-colors disabled:opacity-50"
                      >
                        ⚙️ En cours
                      </button>
                      <button
                        onClick={() => handleUpdate(report.id, "traite")}
                        disabled={updateReport.isPending}
                        className="text-xs px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={12} className="inline mr-1" />
                        Marquer traité
                      </button>
                      <button
                        onClick={() => handleUpdate(report.id, "rejete")}
                        disabled={updateReport.isPending}
                        className="text-xs px-3 py-2 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={12} className="inline mr-1" />
                        Rejeter
                      </button>
                    </div>
                  )}
                  {!isPending && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => handleUpdate(report.id, "en_cours")}
                        disabled={updateReport.isPending}
                        className="text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground font-semibold hover:bg-muted/70 transition-colors"
                      >
                        Rouvrir le rapport
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
