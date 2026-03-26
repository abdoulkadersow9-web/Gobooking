import React, { useState } from "react";
import { useFinancialDashboard } from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Ticket,
  Package, RefreshCw, ArrowUpRight, ArrowDownRight, Building2,
  CreditCard,
} from "lucide-react";

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "7 derniers jours",
  month: "30 derniers jours",
};

const PIE_COLORS = ["#7C3AED", "#FF6B00", "#0B3C5D", "#10B981", "#F59E0B", "#64748B"];

const METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
  cash: "Espèces",
  other: "Autre",
};

function formatK(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(val);
}

export default function FinancialDashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const { data, isLoading, isError, refetch, isFetching } = useFinancialDashboard(period);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
            <DollarSign size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Dashboard Financier</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Vision globale des revenus et commissions GoBooking</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Period filter */}
          <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-sm">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? "bg-[#7C3AED] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-3 py-2.5 rounded-xl border border-border shadow-sm transition-colors"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={32} className="animate-spin text-[#7C3AED]" />
        </div>
      )}

      {isError && (
        <div className="p-6 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">
          Impossible de charger les données financières. Veuillez réessayer.
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Revenu Total"
              value={formatCurrency(data.totalRevenue)}
              raw={data.totalRevenue}
              icon={<DollarSign size={20} />}
              color="purple"
              sub={`${data.totalTransactions} transaction${data.totalTransactions !== 1 ? "s" : ""}`}
            />
            <KpiCard
              title="Commissions"
              value={formatCurrency(data.totalCommissions)}
              raw={data.totalCommissions}
              icon={<Percent size={20} />}
              color="orange"
              sub="10% sur chaque paiement"
            />
            <KpiCard
              title="Réservations"
              value={data.bookingsCount}
              raw={data.bookingsCount}
              icon={<Ticket size={20} />}
              color="blue"
              sub="billets validés"
            />
            <KpiCard
              title="Colis"
              value={data.parcelsCount}
              raw={data.parcelsCount}
              icon={<Package size={20} />}
              color="green"
              sub="livraisons payées"
            />
          </div>

          {/* Revenue + Commission Area Chart */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">Revenus & Commissions</h3>
                <p className="text-sm text-muted-foreground">Évolution sur la période sélectionnée</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#7C3AED]" />
                  Revenus
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF6B00]" />
                  Commissions
                </span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCommission" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} interval={period === "month" ? 4 : 0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatK} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "Revenus" : "Commissions"]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.12)", fontSize: 13 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2.5} fill="url(#gradRevenue)" />
                  <Area type="monotone" dataKey="commissions" stroke="#FF6B00" strokeWidth={2} fill="url(#gradCommission)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Growth Chart */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-lg font-bold mb-1">Croissance</h3>
              <p className="text-sm text-muted-foreground mb-5">Variation journalière des revenus (%)</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.growthData.slice(-14)} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={6} interval={2} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Croissance"]}
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.12)", fontSize: 12 }}
                    />
                    <Bar
                      dataKey="growth"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={20}
                      fill="#7C3AED"
                    >
                      {data.growthData.slice(-14).map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.growth >= 0 ? "#7C3AED" : "#EF4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods Pie */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-lg font-bold mb-1">Moyens de paiement</h3>
              <p className="text-sm text-muted-foreground mb-3">Répartition par canal</p>
              {data.paymentMethods.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Aucune donnée</div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentMethods}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="amount"
                        nameKey="method"
                      >
                        {data.paymentMethods.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), METHOD_LABELS[name] || name]}
                        contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.12)", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {data.paymentMethods.map((m: any, i: number) => (
                  <span key={m.method} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {METHOD_LABELS[m.method] || m.method}
                  </span>
                ))}
              </div>
            </div>

            {/* Net Revenue Card */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">Résumé Net</h3>
                <p className="text-sm text-muted-foreground mb-6">Après déduction des commissions</p>
              </div>
              <div className="space-y-4">
                <SummaryRow label="Revenu brut" value={formatCurrency(data.totalRevenue)} color="text-foreground" />
                <SummaryRow label="Commissions (10%)" value={`- ${formatCurrency(data.totalCommissions)}`} color="text-[#FF6B00]" />
                <div className="border-t border-border pt-4">
                  <SummaryRow label="Revenu net" value={formatCurrency(data.netRevenue)} color="text-[#7C3AED] font-bold text-lg" bold />
                </div>
                <div className="border-t border-border pt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-[#7C3AED]/5 rounded-xl p-3 border border-[#7C3AED]/10">
                    <div className="text-xl font-bold text-[#7C3AED]">{data.bookingsCount}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Réservations</div>
                  </div>
                  <div className="bg-[#FF6B00]/5 rounded-xl p-3 border border-[#FF6B00]/10">
                    <div className="text-xl font-bold text-[#FF6B00]">{data.parcelsCount}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Colis</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Breakdown */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Building2 size={20} className="text-[#7C3AED]" />
                  Revenus par Compagnie
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{data.companyBreakdown.length} compagnies • {PERIOD_LABELS[period as Period]}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {data.companyBreakdown.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">Aucune compagnie trouvée</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-3 text-left">Compagnie</th>
                      <th className="px-6 py-3 text-right">Revenu</th>
                      <th className="px-6 py-3 text-right">Commission</th>
                      <th className="px-6 py-3 text-center">Réserv.</th>
                      <th className="px-6 py-3 text-center">Colis</th>
                      <th className="px-6 py-3 text-left">Part</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.companyBreakdown.map((c: any, i: number) => {
                      const share = data.totalRevenue > 0 ? Math.round((c.revenue / data.totalRevenue) * 100) : 0;
                      return (
                        <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED] font-bold text-sm shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-foreground">{c.name}</div>
                                {c.city && <div className="text-xs text-muted-foreground">{c.city}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-foreground">{formatCurrency(c.revenue)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-medium text-[#FF6B00]">{formatCurrency(c.commissions)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
                              {c.bookings}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm">
                              {c.parcels}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#7C3AED] transition-all duration-700"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground w-8 text-right">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title, value, raw, icon, color, sub,
}: {
  title: string;
  value: string | number;
  raw: number;
  icon: React.ReactNode;
  color: "purple" | "orange" | "blue" | "green";
  sub?: string;
}) {
  const colors = {
    purple: { bg: "bg-[#7C3AED]/10", text: "text-[#7C3AED]", border: "border-[#7C3AED]/15" },
    orange: { bg: "bg-[#FF6B00]/10", text: "text-[#FF6B00]", border: "border-[#FF6B00]/15" },
    blue:   { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    green:  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  }[color];

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-muted opacity-40 group-hover:scale-110 transition-transform duration-500" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={`p-2 rounded-xl ${colors.bg} ${colors.border} border`}>
            <span className={colors.text}>{icon}</span>
          </div>
        </div>
        <h4 className="text-2xl font-display font-bold text-foreground">{value}</h4>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SummaryRow({
  label, value, color, bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}
