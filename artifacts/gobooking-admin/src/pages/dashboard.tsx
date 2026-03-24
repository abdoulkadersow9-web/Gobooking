import React from "react";
import { useDashboard, useScanStats } from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import { 
  TrendingUp, 
  Users, 
  Package, 
  MapPin, 
  RefreshCw,
  Wallet,
  Bus
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Badge } from "@/components/ui/Badge";

export default function Dashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { data: scanData } = useScanStats();

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><RefreshCw className="animate-spin text-primary" size={32} /></div>;
  }

  if (isError || !data) {
    return <div className="p-6 bg-destructive/10 text-destructive rounded-xl">Impossible de charger le tableau de bord.</div>;
  }

  const { summary, dailyData, bookingStats, activeTrips } = data;
  const scans = scanData?.stats || { passager: 0, colis: 0, bagage: 0 };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-end">
        <button 
          onClick={() => refetch()} 
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-card px-4 py-2 rounded-lg border border-border shadow-sm"
        >
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Revenus du jour" 
          value={formatCurrency(summary?.totalRevenue || 0)} 
          icon={<Wallet className="text-secondary" />} 
          trend="+12%" 
        />
        <KpiCard 
          title="Réservations" 
          value={summary?.totalBookings || 0} 
          icon={<Users className="text-primary" />} 
          trend="+5%" 
        />
        <KpiCard 
          title="Colis traités" 
          value={summary?.totalParcels || 0} 
          icon={<Package className="text-accent" />} 
        />
        <KpiCard 
          title="Bus en route" 
          value={summary?.activeTripsCount || 0} 
          icon={<Bus className="text-emerald-500" />} 
        />
      </div>

      {/* Scans Overview */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-display font-bold mb-4">Scans en gare (Aujourd'hui)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-primary/5 rounded-xl p-4 flex flex-col items-center justify-center border border-primary/10">
            <span className="text-3xl font-bold text-primary">{scans.passager}</span>
            <span className="text-sm font-medium text-muted-foreground mt-1">Passagers</span>
          </div>
          <div className="bg-accent/5 rounded-xl p-4 flex flex-col items-center justify-center border border-accent/10">
            <span className="text-3xl font-bold text-accent">{scans.colis}</span>
            <span className="text-sm font-medium text-muted-foreground mt-1">Colis</span>
          </div>
          <div className="bg-secondary/5 rounded-xl p-4 flex flex-col items-center justify-center border border-secondary/10">
            <span className="text-3xl font-bold text-secondary">{scans.bagage}</span>
            <span className="text-sm font-medium text-muted-foreground mt-1">Bagages</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-lg font-display font-bold mb-6">Évolution des revenus (7 derniers jours)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                />
                <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Trips */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-lg font-display font-bold mb-4 flex items-center justify-between">
            <span>Trajets en cours</span>
            <Badge variant="success">{activeTrips?.length || 0}</Badge>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {activeTrips?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun trajet en cours</p>
            ) : (
              activeTrips?.slice(0, 5).map((trip: any) => (
                <div key={trip.id} className="p-4 rounded-xl bg-background border border-border hover:border-primary/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-sm text-foreground">{trip.from} → {trip.to}</div>
                    <span className="text-xs font-semibold text-primary">{trip.departureTime}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-1">
                    <MapPin size={12} />
                    <span>{trip.busName} • {trip.status === 'en_route' ? 'En transit' : 'Embarquement'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-muted rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h4 className="text-2xl font-display font-bold text-foreground">{value}</h4>
        </div>
        <div className="p-3 bg-background rounded-xl border border-border shadow-sm">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-emerald-600 relative z-10">
          <TrendingUp size={14} />
          <span>{trend} par rapport à hier</span>
        </div>
      )}
    </div>
  );
}
