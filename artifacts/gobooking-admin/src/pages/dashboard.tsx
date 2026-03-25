import React from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useDashboard, useScanStats, useCompanyReports, useUpdateReport,
  useSuperAdminStats, useSuperAdminBookingStats, useSuperAdminAnalytics, useSuperAdminCompanies,
} from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Users, Package, MapPin, RefreshCw, Wallet, Bus,
  Building2, AlertTriangle, ClipboardList, CheckCircle, Clock, XCircle,
  Ticket, Activity, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";

/* ═══════════════════════════════════════════════
   KPI CARD COMPONENT
═══════════════════════════════════════════════ */
function KpiCard({
  title, value, icon, trend, color = "#3B82F6", sub,
}: {
  title: string; value: string | number; icon: React.ReactNode;
  trend?: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border relative overflow-hidden group hover:shadow-md transition-shadow">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-110 transition-transform duration-500"
        style={{ backgroundColor: color }}
      />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
          <h4 className="text-2xl font-bold text-foreground">{value}</h4>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl border border-border bg-background shadow-sm" style={{ color }}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 relative z-10">
          <TrendingUp size={12} />
          <span>{trend} vs hier</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   STATUS BADGE
═══════════════════════════════════════════════ */
const REPORT_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  soumis:   { label: "Soumis",    color: "#D97706", bg: "#FEF9C3" },
  lu:       { label: "Lu",        color: "#2563EB", bg: "#DBEAFE" },
  en_cours: { label: "En cours",  color: "#7C3AED", bg: "#EDE9FE" },
  traite:   { label: "Traité ✓",  color: "#059669", bg: "#DCFCE7" },
  rejete:   { label: "Rejeté",    color: "#DC2626", bg: "#FEE2E2" },
};

const REPORT_TYPES: Record<string, string> = {
  incident_voyage:    "🚨 Incident voyage",
  probleme_colis:     "📦 Problème colis",
  probleme_passager:  "👤 Problème passager",
  probleme_vehicule:  "🚌 Panne véhicule",
  fraude:             "⚠️ Fraude",
  retard:             "⏰ Retard",
  suggestion:         "💡 Suggestion",
  autre:              "📝 Autre",
};

function StatutBadge({ statut }: { statut: string }) {
  const s = REPORT_STATUT[statut] ?? REPORT_STATUT.soumis;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════
   AGENT REPORTS MINI-PANEL (shared)
═══════════════════════════════════════════════ */
function AgentReportsPanel() {
  const { data: reports = [], isLoading } = useCompanyReports();
  const updateReport = useUpdateReport();
  const pending = (reports as any[]).filter((r) => r.statut === "soumis" || r.statut === "lu");

  if (isLoading) return <div className="text-center text-muted-foreground py-8 text-sm">Chargement...</div>;

  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground">
          <CheckCircle size={32} className="text-emerald-400" />
          <p className="text-sm font-medium">Tous les rapports sont traités</p>
        </div>
      ) : (
        pending.slice(0, 5).map((r: any) => (
          <div key={r.id} className="bg-background rounded-xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{REPORT_TYPES[r.reportType] ?? r.reportType}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
              </div>
              <StatutBadge statut={r.statut} />
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-muted-foreground">{r.agentName} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
              <div className="flex gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "traite" })}
                  disabled={updateReport.isPending}
                >
                  ✓ Traiter
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "rejete" })}
                  disabled={updateReport.isPending}
                >
                  ✗ Rejeter
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUPER ADMIN DASHBOARD
═══════════════════════════════════════════════ */
function SuperAdminDashboard() {
  const { data: stats, isLoading: loadingStats, refetch, isFetching } = useSuperAdminStats();
  const { data: bkStats } = useSuperAdminBookingStats();
  const { data: analytics } = useSuperAdminAnalytics();
  const { data: companies = [] } = useSuperAdminCompanies();
  const { data: reports = [] } = useCompanyReports();

  if (loadingStats) return (
    <div className="flex h-64 items-center justify-center gap-3">
      <RefreshCw className="animate-spin text-purple-500" size={28} />
      <span className="text-muted-foreground">Chargement du tableau de bord global...</span>
    </div>
  );

  const pendingReports = (reports as any[]).filter((r) => r.statut === "soumis").length;
  const dailyChart = analytics?.daily || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supervision Globale</h2>
          <p className="text-sm text-muted-foreground mt-1">Vue en temps réel de toutes les compagnies</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-card px-4 py-2 rounded-xl border border-border shadow-sm"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Compagnies" value={stats?.totalCompanies ?? 0} icon={<Building2 size={20} />} color="#7C3AED" />
        <KpiCard title="Agents" value={stats?.totalAgents ?? 0} icon={<Users size={20} />} color="#0369A1" />
        <KpiCard title="Total trajets" value={stats?.totalTrips ?? 0} icon={<Bus size={20} />} color="#059669" />
        <KpiCard title="Billets vendus" value={stats?.totalBookings ?? 0} icon={<Ticket size={20} />} color="#D97706" trend="+8%" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Colis en cours" value={stats?.totalParcels ?? 0} icon={<Package size={20} />} color="#EA580C" />
        <KpiCard title="Total utilisateurs" value={stats?.totalUsers ?? 0} icon={<Users size={20} />} color="#2563EB" />
        <KpiCard title="Revenus totaux" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={<Wallet size={20} />} color="#059669" />
        <KpiCard title="Rapports en attente" value={pendingReports} icon={<ClipboardList size={20} />} color="#DC2626" sub="Nécessitent action" />
      </div>

      {/* Charts + Real-time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold flex items-center gap-2">
              <BarChart3 size={18} className="text-purple-500" />
              Revenus 7 derniers jours
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} name="Revenus FCFA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Companies overview */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-purple-500" />
            Compagnies ({(companies as any[]).length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {(companies as any[]).slice(0, 6).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border hover:border-purple-200 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.city || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {c.status === "active" ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Stats + Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking stats */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-base font-bold mb-5 flex items-center gap-2">
            <Activity size={18} className="text-amber-500" />
            Activité réservations
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Confirmées", value: bkStats?.confirmed ?? "—", color: "#059669", bg: "#DCFCE7" },
              { label: "En attente", value: bkStats?.pending ?? "—", color: "#D97706", bg: "#FEF9C3" },
              { label: "Annulées", value: bkStats?.cancelled ?? "—", color: "#DC2626", bg: "#FEE2E2" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: s.bg }}>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 bg-muted/40 text-center">
              <p className="text-xl font-bold text-foreground">{formatCurrency(bkStats?.totalRevenue ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Revenu total</p>
            </div>
            <div className="rounded-xl p-4 bg-muted/40 text-center">
              <p className="text-xl font-bold text-foreground">{bkStats?.today ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Billets aujourd'hui</p>
            </div>
          </div>
        </div>

        {/* Agent reports */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold flex items-center gap-2">
              <ClipboardList size={18} className="text-red-500" />
              Rapports agents en attente
            </h3>
            <a href="/admin/rapports" className="text-xs text-primary font-semibold hover:underline">Voir tout →</a>
          </div>
          <AgentReportsPanel />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   COMPANY DASHBOARD
═══════════════════════════════════════════════ */
function CompanyDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { data: scanData } = useScanStats();
  const { data: reports = [] } = useCompanyReports();

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center gap-3">
      <RefreshCw className="animate-spin text-amber-500" size={28} />
      <span className="text-muted-foreground">Chargement du tableau de bord...</span>
    </div>
  );

  if (isError || !data) return (
    <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200">
      Impossible de charger le tableau de bord. Vérifiez votre connexion.
    </div>
  );

  const { summary, dailyData, bookingStats, activeTrips } = data;
  const scans = scanData?.stats || { passager: 0, colis: 0, bagage: 0 };
  const pendingValidation = summary?.parcelsAwaitingValidation ?? 0;
  const pendingReports = (reports as any[]).filter((r) => r.statut === "soumis").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground mt-1">Vue d'ensemble de votre compagnie</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-card px-4 py-2 rounded-xl border border-border shadow-sm"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Alert if pending validations */}
      {(pendingValidation > 0 || pendingReports > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingValidation > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-3 text-sm font-semibold">
              <Package size={16} className="text-amber-600" />
              <span>{pendingValidation} colis en attente de validation</span>
              <a href="/admin/colis" className="ml-2 underline text-amber-700 text-xs">Voir →</a>
            </div>
          )}
          {pendingReports > 0 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-800 border border-red-200 rounded-xl px-4 py-3 text-sm font-semibold">
              <ClipboardList size={16} className="text-red-600" />
              <span>{pendingReports} rapport(s) agent en attente</span>
              <a href="/admin/rapports" className="ml-2 underline text-red-700 text-xs">Traiter →</a>
            </div>
          )}
        </div>
      )}

      {/* KPIs Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revenus du jour" value={formatCurrency(summary?.totalRevenue || 0)} icon={<Wallet size={20} />} color="#D97706" trend="+12%" />
        <KpiCard title="Réservations" value={summary?.totalBookings || 0} icon={<Ticket size={20} />} color="#2563EB" trend="+5%" />
        <KpiCard title="Bus en route" value={summary?.activeTripsCount || 0} icon={<Bus size={20} />} color="#059669" />
        <KpiCard title="Colis traités" value={summary?.totalParcels || 0} icon={<Package size={20} />} color="#EA580C" />
      </div>

      {/* KPIs Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Guichet vendus" value={bookingStats?.guichet ?? 0} icon={<Users size={20} />} color="#7C3AED" />
        <KpiCard title="En ligne vendus" value={bookingStats?.online ?? 0} icon={<Activity size={20} />} color="#0369A1" />
        <KpiCard
          title="Colis à valider"
          value={pendingValidation}
          icon={<Clock size={20} />}
          color={pendingValidation > 0 ? "#D97706" : "#94A3B8"}
          sub={pendingValidation > 0 ? "Action requise" : "Aucun en attente"}
        />
        <KpiCard
          title="Rapports agents"
          value={pendingReports}
          icon={<ClipboardList size={20} />}
          color={pendingReports > 0 ? "#DC2626" : "#94A3B8"}
          sub={pendingReports > 0 ? "À traiter" : "Tout traité"}
        />
      </div>

      {/* Scans */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          Scans en gare (Aujourd'hui)
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Passagers", value: scans.passager, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Colis", value: scans.colis, color: "#EA580C", bg: "#FFF7ED" },
            { label: "Bagages", value: scans.bagage, color: "#059669", bg: "#F0FDF4" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 flex flex-col items-center" style={{ backgroundColor: s.bg }}>
              <span className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-sm font-medium text-gray-600 mt-1">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Trips + Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-base font-bold mb-5 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" />
            Évolution des revenus (7 jours)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={40} name="Revenus FCFA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active trips */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-base font-bold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Bus size={18} className="text-emerald-500" />Trajets en cours</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full">{activeTrips?.length || 0}</span>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {activeTrips?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun trajet en cours</p>
            ) : (
              activeTrips?.slice(0, 5).map((trip: any) => (
                <div key={trip.id} className="p-3 rounded-xl bg-background border border-border hover:border-emerald-200 transition-colors">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm text-foreground">{trip.from} → {trip.to}</p>
                    <span className="text-xs font-semibold text-emerald-600">{trip.departureTime}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                    <MapPin size={11} />
                    <span>{trip.busName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Colis section + Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colis overview */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-base font-bold mb-5 flex items-center justify-between">
            <span className="flex items-center gap-2"><Package size={18} className="text-orange-500" />État des colis</span>
            <a href="/admin/colis" className="text-xs text-primary font-semibold hover:underline">Gérer →</a>
          </h3>
          <div className="space-y-3">
            {[
              { label: "En attente validation", value: pendingValidation, color: "#D97706", bg: "#FEF9C3", icon: <Clock size={14} /> },
              { label: "En transit", value: summary?.colisEnTransit ?? 0, color: "#2563EB", bg: "#DBEAFE", icon: <MapPin size={14} /> },
              { label: "Livrés / Retirés", value: summary?.colisLivres ?? 0, color: "#059669", bg: "#DCFCE7", icon: <CheckCircle size={14} /> },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: item.bg }}>
                <div className="flex items-center gap-2" style={{ color: item.color }}>
                  {item.icon}
                  <span className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</span>
                </div>
                <span className="text-xl font-bold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reports mini panel */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold flex items-center gap-2">
              <ClipboardList size={18} className="text-red-500" />
              Rapports agents
            </h3>
            <a href="/admin/rapports" className="text-xs text-primary font-semibold hover:underline">Voir tout →</a>
          </div>
          <AgentReportsPanel />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN EXPORT — role adaptive
═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <SuperAdminDashboard /> : <CompanyDashboard />;
}
