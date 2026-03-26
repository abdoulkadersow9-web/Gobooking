import React from "react";
import { useAnalytics } from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const COLORS = ['#0B3C5D', '#FF6B00', '#D97706', '#10B981', '#64748B'];

export default function Analytics() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) return <div className="p-8 text-center">Chargement des données...</div>;
  if (!data) return <div className="p-8 text-center text-destructive">Aucune donnée disponible.</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #0B3C5D, #1E5B8A)" }}>
          <TrendingUp size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Analytiques & Rapports</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">Vision approfondie de vos performances.</p>
        </div>
      </div>

      {/* Main Revenue Chart */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="text-lg font-bold mb-6">Revenus Mensuels (Vue Globale)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10}/>
              <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} tick={{fontSize: 12}}/>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <h3 className="text-lg font-bold mb-6">Trajets les plus rentables</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topRoutes || []} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <YAxis dataKey="route" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--foreground))'}} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: 'hsl(var(--muted))'}} />
                <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col">
          <h3 className="text-lg font-bold mb-6">Répartition par Moyen de Paiement</h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentMethods || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="method"
                  >
                    {(data.paymentMethods || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-3 ml-4">
              {(data.paymentMethods || []).map((entry: any, index: number) => (
                <div key={entry.method} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="capitalize font-medium">{entry.method}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
