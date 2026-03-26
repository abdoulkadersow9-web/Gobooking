import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useDashboard, useScanStats, useCompanyReports, useUpdateReport, useCompanyAlerts,
  useSuperAdminStats, useSuperAdminBookingStats, useSuperAdminAnalytics, useSuperAdminCompanies,
  useRecentActivity, useCompanyAgences,
} from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Users, User, Package, MapPin, RefreshCw, Wallet, Bus,
  Building2, AlertTriangle, ClipboardList, CheckCircle, Clock,
  Ticket, Activity, BarChart3, Map, ArrowUpRight, Zap, ChevronRight,
  Navigation, Package2, UserCheck, Settings, Check, X,
  LayoutDashboard, ShieldCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ══════════════════════════════════════════
   COMPANY DASHBOARD — Tableau de bord Compagnie
══════════════════════════════════════════ */

/* KPI Card compact */
function StatCard({
  label, value, icon, color, sub, href,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  color: string; sub?: string; href?: string;
}) {
  const inner = (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all active:scale-95">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-8 group-hover:scale-125 transition-transform duration-500"
        style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-60" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: color + "15", color }}>
          {icon}
        </div>
      </div>
      {href && <div className="absolute right-3.5 bottom-3.5" style={{ color }}><ArrowUpRight size={12} /></div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* Section header */
function SectionTitle({ icon, title, href, color }: {
  icon: React.ReactNode; title: string; href?: string; color: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "15", color }}>
          {icon}
        </div>
        <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-semibold hover:underline transition-colors" style={{ color }}>
          Voir tout <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

/* ── SECTION TRAJETS ── */
function TrajetsSection({ activeTrips, summary, dailyData }: any) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      <SectionTitle icon={<Bus size={14} />} title="Trajets" href="/admin/trajets" color="#2563EB" />

      {/* Stats rapides trajets */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Actifs maintenant", value: summary?.activeTripsCount ?? 0, color: "#059669", bg: "#DCFCE7" },
          { label: "Total programmés", value: summary?.totalTrips ?? 0, color: "#2563EB", bg: "#DBEAFE" },
          { label: "Bus en service",   value: summary?.activeBuses ?? 0,  color: "#D97706", bg: "#FEF9C3" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-semibold text-gray-600 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trajets actifs en cours */}
      {activeTrips?.length > 0 ? (
        <div className="space-y-2">
          {activeTrips.slice(0, 4).map((t: any) => (
            <div key={t.id} className="bg-card rounded-xl border border-emerald-200 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Bus size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.from} → {t.to}</p>
                  <p className="text-xs text-muted-foreground">{t.busName} · {t.departureTime}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                En route
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/40 py-6 text-center text-sm text-muted-foreground">
          Aucun trajet actif en ce moment
        </div>
      )}

      {/* Graphe revenus 7j */}
      {dailyData?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Réservations (7 derniers jours)</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} dy={6}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: 11 }}
                  formatter={(v: any) => [v, "Réservations"]}
                />
                <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={28} name="Réservations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SECTION COLIS ── */
function ColisSection({ parcelStats }: { parcelStats: any }) {
  if (!parcelStats) return null;

  const pipeline = [
    { label: "Créés",    value: parcelStats.créé ?? 0,       color: "#94A3B8", bg: "#F1F5F9" },
    { label: "En gare",  value: parcelStats.en_gare ?? 0,    color: "#2563EB", bg: "#DBEAFE" },
    { label: "Chargés",  value: parcelStats.chargé_bus ?? 0, color: "#7C3AED", bg: "#EDE9FE" },
    { label: "Transit",  value: parcelStats.en_transit ?? 0, color: "#D97706", bg: "#FEF9C3" },
    { label: "Arrivés",  value: parcelStats.arrivé ?? 0,     color: "#0369A1", bg: "#E0F2FE" },
    { label: "Livrés",   value: parcelStats.livré ?? 0,      color: "#059669", bg: "#DCFCE7" },
  ];

  return (
    <div className="space-y-3">
      <SectionTitle icon={<Package size={14} />} title="Colis" href="/admin/colis" color="#7C3AED" />

      {/* Pipeline horizontal */}
      <div className="grid grid-cols-3 gap-2">
        {pipeline.map((p) => (
          <div key={p.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: p.bg }}>
            <p className="text-lg font-bold" style={{ color: p.color }}>{p.value}</p>
            <p className="text-[10px] font-semibold text-gray-600 mt-0.5">{p.label}</p>
          </div>
        ))}
      </div>

      {/* Total + annulés */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-muted/40 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Total colis</span>
          <span className="font-bold text-foreground">{parcelStats.total ?? 0}</span>
        </div>
        {(parcelStats.annulé ?? 0) > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-center gap-2">
            <span className="text-xs text-red-600 font-semibold">{parcelStats.annulé} annulé(s)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SECTION AGENCES ── */
const ROLE_LABEL: Record<string, string> = {
  agent_guichet:      "Guichet",
  agent_ticket:       "Guichet",
  agent_embarquement: "Embarquement",
  agent_colis:        "Colis",
  agent_reservation:  "Réservation",
  agent_route:        "En route",
  logistique:         "Logistique",
  suivi:              "Suivi",
  validation:         "Validation",
};
const ROLE_COLOR: Record<string, string> = {
  agent_guichet:      "#2563EB",
  agent_ticket:       "#2563EB",
  agent_embarquement: "#D97706",
  agent_colis:        "#7C3AED",
  agent_reservation:  "#059669",
  agent_route:        "#DC2626",
  logistique:         "#0369A1",
  suivi:              "#6B7280",
  validation:         "#059669",
};

function AgencesSection() {
  const { data: agences = [], isLoading } = useCompanyAgences();

  if (isLoading) return null;
  const withAgents = agences.filter((a: any) => (a.agents ?? []).length > 0);
  const vides = agences.filter((a: any) => (a.agents ?? []).length === 0);

  return (
    <div className="space-y-3">
      <SectionTitle icon={<Building2 size={14} />} title="Agences" href="/admin/agences" color="#D97706" />

      {agences.length === 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-sm text-amber-700 font-medium">Aucune agence enregistrée.</p>
          <Link href="/admin/agences" className="text-xs text-amber-600 font-semibold underline mt-1 inline-block">
            Créer une agence
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {withAgents.map((agence: any) => {
            const agents: any[] = agence.agents ?? [];
            const roleGroups: Record<string, number> = {};
            agents.forEach((ag: any) => {
              const r = ag.agentRole ?? "autre";
              roleGroups[r] = (roleGroups[r] ?? 0) + 1;
            });
            return (
              <div key={agence.id} className="bg-card rounded-xl border border-amber-200 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{agence.name}</p>
                      <p className="text-[11px] text-muted-foreground">{agence.city}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                    {agents.length} agent{agents.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(roleGroups).map(([role, count]) => (
                    <span
                      key={role}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: (ROLE_COLOR[role] ?? "#6B7280") + "20",
                        color: ROLE_COLOR[role] ?? "#6B7280",
                      }}
                    >
                      {count}× {ROLE_LABEL[role] ?? role.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {vides.length > 0 && (
            <div className="rounded-xl bg-muted/40 border border-dashed border-border p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {vides.length} agence{vides.length > 1 ? "s" : ""} sans agent
                {vides.length <= 2 && ` (${vides.map((a: any) => a.name).join(", ")})`}
              </p>
              <Link href="/admin/agents" className="text-[11px] text-amber-600 font-semibold underline">
                Affecter
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SECTION AGENTS ── */
function AgentsSection({ reports }: { reports: any[] }) {
  const pending = reports.filter((r) => r.statut === "soumis" || r.statut === "lu");
  const updateReport = useUpdateReport();

  return (
    <div className="space-y-3">
      <SectionTitle icon={<Users size={14} />} title="Agents & Rapports" href="/admin/agents" color="#059669" />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/agents">
          <div className="bg-card rounded-xl border border-border p-4 hover:border-emerald-300 transition-colors cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors">
              <Users size={18} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Gérer agents</p>
            <p className="text-xs text-muted-foreground mt-0.5">Guichet, embarquement, colis</p>
          </div>
        </Link>
        <Link href="/admin/affectation">
          <div className="bg-card rounded-xl border border-border p-4 hover:border-blue-300 transition-colors cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
              <UserCheck size={18} className="text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Affectation</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chauffeurs & routes</p>
          </div>
        </Link>
      </div>

      {/* Rapports en attente inline */}
      {pending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
            <ClipboardList size={13} />
            {pending.length} rapport(s) en attente de traitement
          </p>
          {pending.slice(0, 2).map((r: any) => (
            <div key={r.id} className="bg-white rounded-lg px-3 py-2 border border-red-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{r.reportType?.replace(/_/g, " ") || "Rapport"}</p>
                <p className="text-[10px] text-muted-foreground">{r.agentName || "Agent"}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold flex items-center gap-1"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "traite" })}>
                  <Check size={10} />
                </button>
                <button className="text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded font-semibold flex items-center gap-1"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "rejete" })}>
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
          {pending.length > 2 && (
            <Link href="/admin/rapports" className="text-xs text-red-600 font-semibold flex items-center gap-1">
              Voir {pending.length - 2} autres <ChevronRight size={11} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SECTION ALERTES ── */
function AlertesSection({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="space-y-2">
        <SectionTitle icon={<AlertTriangle size={14} />} title="Alertes" href="/admin/alertes" color="#DC2626" />
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 font-medium">Tout est normal — aucune alerte active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionTitle icon={<AlertTriangle size={14} />} title={`Alertes (${alerts.length})`} href="/admin/alertes" color="#DC2626" />
      <div className="space-y-2">
        {alerts.slice(0, 4).map((a: any, i: number) => {
          const isUrgent = a.type === "bus_panne";
          return (
            <div key={i} className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${
              isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
            }`}>
              <AlertTriangle size={16} className={isUrgent ? "text-red-500 mt-0.5 shrink-0" : "text-amber-500 mt-0.5 shrink-0"} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isUrgent ? "text-red-800" : "text-amber-800"}`}>
                  {a.message || a.type?.replace(/_/g, " ") || "Alerte"}
                </p>
                {(a.from || a.to) && (
                  <p className={`text-xs mt-0.5 ${isUrgent ? "text-red-600" : "text-amber-600"}`}>
                    {[a.from, a.to].filter(Boolean).join(" → ")}
                    {a.date && ` · ${a.date}`}
                  </p>
                )}
                {a.fill !== undefined && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-amber-200 rounded-full">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(a.fill * 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-amber-700">{Math.round(a.fill * 100)}% rempli</span>
                  </div>
                )}
              </div>
              <Link href="/admin/alertes">
                <button className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 ${
                  isUrgent ? "bg-red-600 text-white" : "bg-amber-500 text-white"
                }`}>
                  Traiter
                </button>
              </Link>
            </div>
          );
        })}
        {alerts.length > 4 && (
          <Link href="/admin/alertes" className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-600 py-2">
            Voir {alerts.length - 4} autres alertes <ChevronRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── QUICK ACTIONS ── */
function QuickActions() {
  const actions = [
    { label: "Trajets",       icon: Map,        href: "/admin/trajets",      color: "#2563EB", bg: "#EFF6FF" },
    { label: "Réservations",  icon: Ticket,     href: "/admin/reservations", color: "#D97706", bg: "#FEF9C3" },
    { label: "Colis",         icon: Package2,   href: "/admin/colis",        color: "#7C3AED", bg: "#EDE9FE" },
    { label: "Alertes",       icon: AlertTriangle,href: "/admin/alertes",    color: "#DC2626", bg: "#FEE2E2" },
    { label: "Suivi live",    icon: Navigation, href: "/admin/suivi-live",   color: "#059669", bg: "#F0FDF4" },
    { label: "SMS",           icon: Zap,        href: "/admin/sms-marketing",color: "#0369A1", bg: "#E0F2FE" },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚡</span>
        <h3 className="text-sm font-bold text-foreground">Actions rapides</h3>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}>
              <div className="rounded-xl border border-border p-3 flex flex-col items-center gap-2 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                style={{ backgroundColor: a.bg }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: a.color + "20" }}>
                  <Icon size={20} style={{ color: a.color }} />
                </div>
                <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{a.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPANY DASHBOARD MAIN
══════════════════════════════════════════ */
function CompanyDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { data: reports = [] } = useCompanyReports();
  const { data: alerts = [] } = useCompanyAlerts();

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center gap-3">
      <RefreshCw className="animate-spin text-amber-500" size={22} />
      <span className="text-muted-foreground text-sm">Chargement...</span>
    </div>
  );
  if (isError || !data) return (
    <div className="p-5 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">
      Impossible de charger le tableau de bord. Vérifiez votre connexion.
    </div>
  );

  const { summary, dailyData, bookingStats, activeTrips, parcelStats, revenue } = data;

  return (
    <div className="space-y-6 pb-6">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}>
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Tableau de bord</h2>
            <p className="text-xs text-muted-foreground">Vue d'ensemble de votre compagnie</p>
          </div>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card px-3 py-2 rounded-xl border border-border shadow-sm transition-colors">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* ── STATISTIQUES ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
            <BarChart3 size={14} />
          </div>
          <h3 className="text-sm font-bold text-foreground">Statistiques</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Revenus totaux"
            value={formatCurrency(revenue?.totalRevenue ?? summary?.totalRevenue ?? 0)}
            icon={<Wallet size={17} />}
            color="#D97706"
            sub="Billets + Colis"
          />
          <StatCard
            label="Réservations"
            value={bookingStats?.total ?? summary?.totalBookings ?? 0}
            icon={<Ticket size={17} />}
            color="#2563EB"
            sub={`${bookingStats?.confirmed ?? 0} confirmées`}
            href="/admin/reservations"
          />
          <StatCard
            label="Colis total"
            value={parcelStats?.total ?? summary?.totalParcels ?? 0}
            icon={<Package size={17} />}
            color="#7C3AED"
            sub={`${parcelStats?.livré ?? 0} livrés`}
            href="/admin/colis"
          />
          <StatCard
            label="Billets en ligne"
            value={bookingStats?.paid ?? 0}
            icon={<Activity size={17} />}
            color="#059669"
            sub={`${bookingStats?.boarded ?? 0} embarqués`}
          />
        </div>
      </div>

      {/* ── ALERTES (priorité) ── */}
      <AlertesSection alerts={alerts as any[]} />

      {/* ── TRAJETS ── */}
      <TrajetsSection activeTrips={activeTrips} summary={summary} dailyData={dailyData} />

      {/* ── COLIS ── */}
      <ColisSection parcelStats={parcelStats} />

      {/* ── AGENCES ── */}
      <AgencesSection />

      {/* ── AGENTS ── */}
      <AgentsSection reports={reports as any[]} />

      {/* ── ⚡ ACTIONS RAPIDES ── */}
      <QuickActions />

      {/* ── ⚙️ PARAMÈTRES quick link ── */}
      <Link href="/admin/parametres">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-muted-foreground/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <Settings size={17} className="text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Paramètres</p>
            <p className="text-xs text-muted-foreground">Profil, agences, configuration</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>
      </Link>
    </div>
  );
}

/* ══════════════════════════════════════════
   SUPER ADMIN DASHBOARD (inchangé)
══════════════════════════════════════════ */

function KpiCard({
  title, value, icon, sub, color = "#3B82F6", trend, href,
}: {
  title: string; value: string | number; icon: React.ReactNode;
  sub?: string; color?: string; trend?: string; href?: string;
}) {
  const inner = (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border relative overflow-hidden group hover:shadow-md transition-all duration-200">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-8 group-hover:scale-125 transition-transform duration-500" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-60" style={{ backgroundColor: color }} />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{title}</p>
          <h4 className="text-2xl font-bold text-foreground">{value}</h4>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: color + "15", color }}>
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

const REPORT_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  soumis:   { label: "Soumis",   color: "#D97706", bg: "#FEF9C3" },
  lu:       { label: "Lu",       color: "#2563EB", bg: "#DBEAFE" },
  en_cours: { label: "En cours", color: "#7C3AED", bg: "#EDE9FE" },
  traite:   { label: "Traité ✓", color: "#059669", bg: "#DCFCE7" },
  rejete:   { label: "Rejeté",   color: "#DC2626", bg: "#FEE2E2" },
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
                <p className="text-sm font-semibold text-foreground">{r.reportType?.replace(/_/g, " ") || r.reportType}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
              </div>
              <StatutBadge statut={r.statut} />
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-muted-foreground">{r.agentName} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors flex items-center gap-1.5"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "traite" })} disabled={updateReport.isPending}>
                  <Check size={12} /> Traiter
                </button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors flex items-center gap-1.5"
                  onClick={() => updateReport.mutate({ id: r.id, statut: "rejete" })} disabled={updateReport.isPending}>
                  <X size={12} /> Rejeter
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RecentActivityPanel() {
  const { data } = useRecentActivity();
  const recent = [
    ...((data?.recentBookings || []).map((b: any) => ({
      type: "reservation",
      label: `Réservation #${b.id?.slice(-6)}`,
      sub: b.totalAmount ? `${Number(b.totalAmount).toLocaleString()} FCFA` : b.status,
      date: b.createdAt,
      color: "#D97706",
      bg: "#FEF9C3",
    }))),
    ...((data?.recentParcels || []).map((p: any) => ({
      type: "colis",
      label: `Colis ${p.trackingRef || p.id?.slice(-6)}`,
      sub: `${p.fromCity || "?"} → ${p.toCity || "?"}`,
      date: p.createdAt,
      color: "#7C3AED",
      bg: "#EDE9FE",
    }))),
    ...((data?.recentUsers || []).map((u: any) => ({
      type: "user",
      label: u.name || "Nouvel utilisateur",
      sub: u.role || u.email,
      date: u.createdAt,
      color: "#2563EB",
      bg: "#DBEAFE",
    }))),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 8);

  if (recent.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      Aucune activité récente
    </div>
  );

  return (
    <div className="space-y-2">
      {recent.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: item.bg, color: item.color }}>
            {item.type === "reservation" ? <Ticket size={14} /> : item.type === "colis" ? <Package size={14} /> : <User size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
            <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
          </div>
          {item.date && (
            <p className="text-[10px] text-muted-foreground shrink-0">
              {new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Supervision Globale</h2>
            <p className="text-sm text-muted-foreground">Toutes compagnies · Temps réel</p>
          </div>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm transition-colors">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revenus totaux"   value={formatCurrency(stats?.totalRevenue ?? 0)} icon={<Wallet size={19} />} color="#059669" trend="+8%" />
        <KpiCard title="Compagnies"       value={stats?.totalCompanies ?? 0}               icon={<Building2 size={19} />} color="#7C3AED" href="/admin/companies" />
        <KpiCard title="Réservations"     value={bkStats?.today ?? 0}                      icon={<Ticket size={19} />} color="#D97706" sub="Aujourd'hui" href="/admin/reservations" />
        <KpiCard title="Alertes actives"  value={pendingReports}                            icon={<AlertTriangle size={19} />} color="#DC2626" sub={pendingReports > 0 ? "Action requise" : "Tout est calme"} href="/admin/alertes" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total trajets"  value={stats?.totalTrips ?? 0}    icon={<Map size={19} />} color="#2563EB" href="/admin/trajets" />
        <KpiCard title="Colis en cours" value={stats?.totalParcels ?? 0}  icon={<Package size={19} />} color="#7C3AED" href="/admin/colis" />
        <KpiCard title="Total agents"   value={stats?.totalAgents ?? 0}   icon={<Users size={19} />} color="#0369A1" />
        <KpiCard title="Total billets"  value={stats?.totalBookings ?? 0} icon={<Ticket size={19} />} color="#059669" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card rounded-2xl p-5 shadow-sm border border-border">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 tracking-tight">
            <div className="w-1 h-4 rounded-full bg-purple-500 mr-0.5" />
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
              <BarChart3 size={13} />
            </div>
            Revenus 7 derniers jours
          </h3>
          <div className="h-52">
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
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight">
              <div className="w-1 h-4 rounded-full bg-purple-500" />
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
                <Building2 size={13} />
              </div>
              Compagnies ({(companies as any[]).length})
            </h3>
            <Link href="/admin/companies" className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-1">
              Gérer <ChevronRight size={11} />
            </Link>
          </div>
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

      {/* Recent activity */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 tracking-tight">
          <div className="w-1 h-4 rounded-full bg-blue-500" />
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
            <Clock size={13} />
          </div>
          Dernières activités
          <span className="text-xs font-normal text-muted-foreground ml-1">(réservations, colis, inscriptions)</span>
        </h3>
        <RecentActivityPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 tracking-tight">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-500">
              <Activity size={13} />
            </div>
            Activité réservations
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Confirmées", value: bkStats?.confirmed ?? "—", color: "#059669", bg: "#DCFCE7" },
              { label: "En attente", value: bkStats?.pending ?? "—",   color: "#D97706", bg: "#FEF9C3" },
              { label: "Annulées",   value: bkStats?.cancelled ?? "—", color: "#DC2626", bg: "#FEE2E2" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-semibold text-gray-600 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl p-3 bg-muted/40 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Revenu total</span>
            <span className="font-bold text-foreground">{formatCurrency(bkStats?.totalRevenue ?? 0)}</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight">
              <div className="w-1 h-4 rounded-full bg-red-500" />
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500">
                <ClipboardList size={13} />
              </div>
              Rapports agents en attente
            </h3>
            <Link href="/admin/rapports" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={11} />
            </Link>
          </div>
          <AgentReportsPanel />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   EXPORT — adaptatif selon rôle
══════════════════════════════════════════ */
export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <SuperAdminDashboard /> : <CompanyDashboard />;
}
