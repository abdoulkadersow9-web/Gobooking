import React from "react";
import { FileText, Ticket, Users, TrendingUp, Search } from "lucide-react";
import { useReservations } from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";

export default function Billets() {
  const { data: reservations = [], isLoading } = useReservations();
  const [search, setSearch] = React.useState("");

  const guichetBookings = (reservations as any[]).filter(
    (r) => r.source === "guichet" || r.type === "guichet" || r.channel === "guichet"
  );
  const allBookings = search
    ? (reservations as any[]).filter((r) =>
        (r.passengerName || r.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.from || r.fromCity || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.to || r.toCity || "").toLowerCase().includes(search.toLowerCase())
      )
    : (reservations as any[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}>
          <Ticket size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Billets Guichet</h2>
          <p className="text-sm text-muted-foreground">Ventes émises par les agents guichet</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total billets",  value: (reservations as any[]).length, color: "#2563EB", bg: "#EFF6FF", icon: <Ticket size={20} /> },
          { label: "Ventes guichet", value: guichetBookings.length,          color: "#D97706", bg: "#FEF9C3", icon: <Users size={20} /> },
          { label: "Revenu total",   value: formatCurrency((reservations as any[]).reduce((s, r) => s + (r.price || r.amount || 0), 0)), color: "#059669", bg: "#DCFCE7", icon: <TrendingUp size={20} /> },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText size={17} className="text-amber-500" />
            <h3 className="font-bold text-foreground text-sm">Billets émis</h3>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-amber-300 w-48"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : allBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Aucun billet trouvé</div>
        ) : (
          <div className="divide-y divide-border">
            {allBookings.slice(0, 20).map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">{r.passengerName || r.name || "Passager"}</p>
                  <p className="text-xs text-muted-foreground">{r.from || r.fromCity || "—"} → {r.to || r.toCity || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-600 text-sm">{formatCurrency(r.price || r.amount || 0)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.source === "guichet" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {r.source === "guichet" ? "Guichet" : "En ligne"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
