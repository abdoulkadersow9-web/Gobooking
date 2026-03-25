import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useDashboard, useScanStats, useCompanyReports, useUpdateReport,
  useSuperAdminStats, useSuperAdminBookingStats, useSuperAdminAnalytics, useSuperAdminCompanies,
} from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Users, Package, MapPin, RefreshCw, Wallet, Bus,
  Building2, AlertTriangle, ClipboardList, CheckCircle, Clock, XCircle,
  Ticket, Activity, BarChart3, Map, UserCheck, Radio, Wrench,
  ChevronRight, Zap, Star, MessageSquare, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";

/* ═══════════════════════════════════════════════
   KPI CARD
═══════════════════════════════════════════════ */
function KpiCard({
  title, value, icon, sub, color = "#3B82F6", trend, href,
}: {
  title: string; value: string | number; icon: React.ReactNode;
  sub?: string; color?: string; trend?: string; href?: string;
}) {
  const inner = (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border relative overflow-hidden group hover:shadow-md transition-all duration-200 hover:scale-[1.01]">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-125 transition-transform duration-500"
        style={{ backgroundColor: color }} />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
          <h4 className="text-2xl font-bold text-foreground">{value}</h4>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl border border-border bg-background shadow-sm" style={{ color }}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 relative z-10">
          <TrendingUp size={11} />
          <span>{trend} vs hier</span>
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ═══════════════════════════════════════════════
   ALERTS BANNER
═══════════════════════════════════════════════ */
function AlertsBanner({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-bold text-red-700">{alerts.length} Alerte{alerts.length > 1 ? "s" : ""} active{alerts.length > 1 ? "s" : ""}</span>
        </div>
        <Link href="/admin/alertes" className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1">
          Voir tout <ChevronRight size={12} />
        </Link>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 3).map((a: any, i: number) => (
          <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">{a.type || a.title || "Alerte"}</p>
                {a.trajet && <p className="text-xs text-red-500">{a.trajet} · {a.heure || ""}</p>}
              </div>
            </div>
            <Link href="/admin/alertes">
              <button className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                Traiter
              </button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   QUICK ACCESS
═══════════════════════════════════════════════ */
function QuickAccess({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const items = isSuperAdmin ? [
    { label: "Trajets", icon: Map, href: "/admin/trajets", color: "#2563EB" },
    { label: "Réservations", icon: Ticket, href: "/admin/reservations", color: "#D97706" },
    { label: "Colis", icon: Package, href: "/admin/colis", color: "#7C3AED" },
    { label: "Alertes", icon: AlertTriangle, href: "/admin/alertes", color: "#DC2626" },
    { label: "Compagnies", icon: Building2, href: "/admin/companies", color: "#059669" },
    { label: "Analytiques", icon: BarChart3, href: "/admin/analytics", color: "#475569" },
  ] : [
    { label: "Trajets", icon: Map, href: "/admin/trajets", color: "#2563EB" },
    { label: "Réservations", icon: Ticket, href: "/admin/reservations", color: "#D97706" },
    { label: "Colis", icon: Package, href: "/admin/colis", color: "#7C3AED" },
    { label: "Alertes", icon: AlertTriangle, href: "/admin/alertes", color: "#DC2626" },
    { label: "Suivi Live", icon: Radio, href: "/admin/suivi-live", color: "#059669" },
    { label: "SMS Marketing", icon: MessageSquare, href: "/admin/sms-marketing", color: "#0369A1" },
  ];
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Zap size={16} className="text-amber-500" />
        Accès rapide
      </h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-transparent hover:shadow-md transition-all group cursor-pointer"
                style={{ backgroundColor: item.color + "10" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: item.color + "20" }}>
                  <Icon size={20} style={{ color: item.color }} />
                </div>
                <span className="text-[11px] font-semibold text-center text-foreground leading-tight">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   REPORT STATUS BADGE
═══════════════════════════════════════════════ */
const REPORT_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  soumis:   { label: "Soumis",   color: "#D97706", bg: "#FEF9C3" },
  lu:       { label: "Lu",       color: "#2563EB", bg: "#DBEAFE" },
  en_cours: { label: "En cours", color: "#7C3AED", bg: "#EDE9FE" },
  traite:   { label: "Traité ✓", color: "#059669", bg: "#DCFCE7" },
  rejete:   { label: "Rejeté",   color: "#DC2626", bg: "#FEE2E2" },
};
const REPORT_TYPES: Record<string, string> = {
  incident_voyage:   "🚨 Incident voyage",
  probleme_colis:    "📦 Problème colis",
  probleme_passager: "👤 Problème passager",
  probleme_vehicule: "🚌 Panne véhicule",
  fraude:            "⚠️ Fraude",
  retard:            "⏰ Retard",
  suggestion:        "💡 Suggestion",
  autre:             "📝 Autre",
};

function StatutBadge({ statut }: { statut: string }) {
  const s = REPORT_STATUT[statut] ?? REPORT_STATUT.soumis;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

function AgentReportsPanel() {
  const { data: reports = [], isLoading } = useCompanyReports();
  const updateReport = useUpdateReport();
  const pending = (reports as any[]).filter((r) => r.statut === "soumis" || r.statut === "lu");
  if (isLoading) return <div className="text-center text-muted-foreground py-8 text-sm">Chargement...</div>;
  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground">
          <CheckCircle size={28} className="text-emerald-400" />
          <p className="text-sm font-medium">Tous les rapports sont traités</p>
        </div>
      ) : (
        pending.slice(0, 4).map((r: any) => (
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
                <button className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "traite" })} disabled={updateReport.isPending}>
                  ✓ Traiter
                </button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "rejete" })} disabled={updateReport.isPending}>
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
   SECTION CARD WRAPPER
═══════════════════════════════════════════════ */
function SectionCard({ title, icon, color, children, href }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode; href?: string;
}) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <span style={{ color }}>{icon}</span>
          {title}
        </h3>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color }}>
            Voir tout <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUPER ADMIN DASHBOARD
═══════════════════════════════════════════════ */
function SuperAdminDashboard() {
  const { data: stats, isLoading, refetch, isFetching } = useSuperAdminStats();
  const { data: bkStats } = useSuperAdminBookingStats();
  const { data: analytics } = useSuperAdminAnalytics();
  const { data: companies = [] } = useSuperAdminCompanies();
  const { data: reports = [] } = useCompanyReports();

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center gap-3">
      <RefreshCw className="animate-spin text-purple-500" size={24} />
      <span className="text-muted-foreground text-sm">Chargement du tableau de bord global...</span>
    </div>
  );

  const pendingReports = (reports as any[]).filter((r) => r.statut === "soumis").length;
  const dailyChart = analytics?.daily || [];

  const mockAlerts = pendingReports > 0 ? [
    { type: "Rapports agents en attente", trajet: `${pendingReports} rapport(s)`, heure: "Action requise" }
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Supervision Globale</h2>
          <p className="text-sm text-muted-foreground">Toutes compagnies · Temps réel</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm transition-colors">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Alerts banner */}
      <AlertsBanner alerts={mockAlerts} />

      {/* KPIs Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revenus totaux" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={<Wallet size={19} />} color="#059669" trend="+8%" />
        <KpiCard title="Trajets actifs" value={stats?.totalTrips ?? 0} icon={<Map size={19} />} color="#2563EB" href="/admin/trajets" />
        <KpiCard title="Compagnies" value={stats?.totalCompanies ?? 0} icon={<Building2 size={19} />} color="#7C3AED" href="/admin/companies" />
        <KpiCard title="Bus actifs" value={stats?.totalAgents ?? 0} icon={<Bus size={19} />} color="#D97706" />
      </div>

      {/* KPIs Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Réservations du jour" value={bkStats?.today ?? 0} icon={<Ticket size={19} />} color="#EA580C" href="/admin/reservations" />
        <KpiCard title="Colis en cours" value={stats?.totalParcels ?? 0} icon={<Package size={19} />} color="#7C3AED" href="/admin/colis" />
        <KpiCard title="Total agents" value={stats?.totalAgents ?? 0} icon={<Users size={19} />} color="#0369A1" />
        <KpiCard title="Alertes actives" value={pendingReports} icon={<AlertTriangle size={19} />} color="#DC2626" sub={pendingReports > 0 ? "Action requise" : "Tout est calme"} href="/admin/alertes" />
      </div>

      {/* Quick Access */}
      <QuickAccess isSuperAdmin />

      {/* Charts + Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Revenus 7 derniers jours" icon={<BarChart3 size={16} />} color="#7C3AED" href="/admin/analytics">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={36} name="Revenus FCFA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={`Compagnies (${(companies as any[]).length})`} icon={<Building2 size={16} />} color="#7C3AED" href="/admin/companies">
          <div className="space-y-2">
            {(companies as any[]).slice(0, 5).map((c: any) => (
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
        </SectionCard>

        <SectionCard title="Réservations — statuts" icon={<Activity size={16} />} color="#D97706" href="/admin/reservations">
          <div className="space-y-3">
            {[
              { label: "Confirmées", value: bkStats?.confirmed ?? "—", color: "#059669", bg: "#DCFCE7" },
              { label: "En attente",  value: bkStats?.pending ?? "—",   color: "#D97706", bg: "#FEF9C3" },
              { label: "Annulées",   value: bkStats?.cancelled ?? "—", color: "#DC2626", bg: "#FEE2E2" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: s.bg }}>
                <span className="text-sm font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
            <div className="rounded-xl p-3 bg-muted/40 flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Revenu total</span>
              <span className="font-bold text-foreground">{formatCurrency(bkStats?.totalRevenue ?? 0)}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Reports */}
      <SectionCard title="Rapports agents en attente" icon={<ClipboardList size={16} />} color="#DC2626" href="/admin/rapports">
        <AgentReportsPanel />
      </SectionCard>
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
      <RefreshCw className="animate-spin text-amber-500" size={24} />
      <span className="text-muted-foreground text-sm">Chargement du tableau de bord...</span>
    </div>
  );
  if (isError || !data) return (
    <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">
      Impossible de charger le tableau de bord. Vérifiez votre connexion.
    </div>
  );

  const { summary, dailyData, bookingStats, activeTrips } = data;
  const scans = scanData?.stats || { passager: 0, colis: 0, bagage: 0 };
  const pendingValidation = summary?.parcelsAwaitingValidation ?? 0;
  const pendingReports = (reports as any[]).filter((r) => r.statut === "soumis").length;

  const activeAlerts = [
    ...(pendingValidation > 0 ? [{ type: `${pendingValidation} colis en attente de validation`, trajet: "Section Colis", heure: "Action requise" }] : []),
    ...(pendingReports > 0 ? [{ type: `${pendingReports} rapport(s) agent non traité(s)`, trajet: "Section Rapports", heure: "À traiter" }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de votre compagnie</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm transition-colors">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* === ALERTES — PRIORITÉ === */}
      <AlertsBanner alerts={activeAlerts} />

      {/* === SECTION EXPLOITATION — KPIs === */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-blue-500" />
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Exploitation</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Trajets actifs" value={summary?.activeTripsCount || 0} icon={<Map size={19} />} color="#2563EB" href="/admin/trajets" trend="+2%" />
          <KpiCard title="Bus en route" value={summary?.activeTripsCount || 0} icon={<Bus size={19} />} color="#059669" />
          <KpiCard title="Réservations du jour" value={summary?.totalBookings || 0} icon={<Ticket size={19} />} color="#D97706" trend="+5%" href="/admin/reservations" />
          <KpiCard title="Guichet / En ligne" value={`${bookingStats?.guichet ?? 0} / ${bookingStats?.online ?? 0}`} icon={<Users size={19} />} color="#7C3AED" />
        </div>
      </div>

      {/* === SECTION COMMERCIAL & COLIS === */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-violet-500" />
          <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Commercial & Colis</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Revenus du jour" value={formatCurrency(summary?.totalRevenue || 0)} icon={<Wallet size={19} />} color="#D97706" trend="+12%" />
          <KpiCard title="Colis traités" value={summary?.totalParcels || 0} icon={<Package size={19} />} color="#EA580C" href="/admin/colis" />
          <KpiCard title="Colis à valider" value={pendingValidation} icon={<Clock size={19} />}
            color={pendingValidation > 0 ? "#D97706" : "#94A3B8"}
            sub={pendingValidation > 0 ? "Action requise" : "Aucun en attente"} href="/admin/colis" />
          <KpiCard title="Rapports agents" value={pendingReports} icon={<ClipboardList size={19} />}
            color={pendingReports > 0 ? "#DC2626" : "#94A3B8"}
            sub={pendingReports > 0 ? "À traiter" : "Tout traité"} href="/admin/rapports" />
        </div>
      </div>

      {/* Quick Access */}
      <QuickAccess isSuperAdmin={false} />

      {/* Scans en gare */}
      <SectionCard title="Scans en gare — Aujourd'hui" icon={<Activity size={16} />} color="#2563EB">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Passagers", value: scans.passager, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Colis",     value: scans.colis,    color: "#EA580C", bg: "#FFF7ED" },
            { label: "Bagages",   value: scans.bagage,   color: "#059669", bg: "#F0FDF4" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-5 flex flex-col items-center gap-1" style={{ backgroundColor: s.bg }}>
              <span className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-sm font-medium text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Chart + Active trips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <SectionCard title="Évolution des revenus (7 jours)" icon={<TrendingUp size={16} />} color="#D97706" href="/admin/financier">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={36} name="Revenus FCFA" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Trajets en cours" icon={<Bus size={16} />} color="#059669" href="/admin/trajets">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {!activeTrips?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun trajet en cours</p>
            ) : (
              activeTrips.slice(0, 6).map((trip: any) => (
                <div key={trip.id} className="p-3 rounded-xl bg-background border border-border hover:border-emerald-200 transition-colors">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm text-foreground">{trip.from} → {trip.to}</p>
                    <span className="text-xs font-semibold text-emerald-600">{trip.departureTime}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                    <MapPin size={10} />
                    <span>{trip.busName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* Colis + Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="État des colis" icon={<Package size={16} />} color="#7C3AED" href="/admin/colis">
          <div className="space-y-3">
            {[
              { label: "En attente validation", value: pendingValidation, color: "#D97706", bg: "#FEF9C3", icon: <Clock size={13} /> },
              { label: "En transit",           value: summary?.colisEnTransit ?? 0, color: "#2563EB", bg: "#DBEAFE", icon: <MapPin size={13} /> },
              { label: "Livrés / Retirés",    value: summary?.colisLivres ?? 0, color: "#059669", bg: "#DCFCE7", icon: <CheckCircle size={13} /> },
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
        </SectionCard>

        <SectionCard title="Rapports agents" icon={<ClipboardList size={16} />} color="#DC2626" href="/admin/rapports">
          <AgentReportsPanel />
        </SectionCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EXPORT PRINCIPAL — adaptatif selon rôle
═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <SuperAdminDashboard /> : <CompanyDashboard />;
}
