import React from "react";
import { History, Package, CheckCircle, MapPin, Clock, Search } from "lucide-react";
import { useParcels } from "@/hooks/use-company";
import { formatCurrency } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  cree:     { label: "Créé",        color: "#D97706", bg: "#FEF9C3" },
  en_gare:  { label: "En gare",     color: "#2563EB", bg: "#DBEAFE" },
  charge:   { label: "Chargé",      color: "#7C3AED", bg: "#EDE9FE" },
  en_route: { label: "En route",    color: "#0369A1", bg: "#E0F2FE" },
  arrive:   { label: "Arrivé",      color: "#059669", bg: "#DCFCE7" },
  livre:    { label: "Livré ✓",     color: "#059669", bg: "#DCFCE7" },
  retire:   { label: "Retiré ✓",    color: "#059669", bg: "#DCFCE7" },
  annule:   { label: "Annulé",      color: "#DC2626", bg: "#FEE2E2" },
};

export default function ColisHistorique() {
  const { data: parcels = [], isLoading } = useParcels();
  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("all");

  const filtered = (parcels as any[]).filter((p) => {
    const matchSearch = !search || [p.trackingCode, p.senderName, p.receiverName, p.description]
      .some((v) => (v || "").toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statuses = ["all", "cree", "en_gare", "charge", "en_route", "arrive", "livre", "retire", "annule"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Historique Colis</h2>
        <p className="text-sm text-muted-foreground mt-1">Tous les colis traités par votre compagnie</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total colis", value: (parcels as any[]).length, color: "#7C3AED" },
          { label: "Livrés", value: (parcels as any[]).filter((p) => p.status === "livre" || p.status === "retire").length, color: "#059669" },
          { label: "En transit", value: (parcels as any[]).filter((p) => ["en_gare","charge","en_route"].includes(p.status)).length, color: "#2563EB" },
          { label: "Annulés", value: (parcels as any[]).filter((p) => p.status === "annule").length, color: "#DC2626" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <History size={17} className="text-violet-500" />
              <h3 className="font-bold text-foreground text-sm">Tous les colis ({filtered.length})</h3>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Code, expéditeur..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-300 w-48" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statuses.map((st) => (
              <button key={st} onClick={() => setFilterStatus(st)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  filterStatus === st ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground hover:bg-violet-100"
                }`}>
                {st === "all" ? "Tous" : (STATUS_MAP[st]?.label || st)}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Aucun colis trouvé</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.slice(0, 30).map((p: any) => {
              const s = STATUS_MAP[p.status] ?? { label: p.status, color: "#475569", bg: "#F1F5F9" };
              return (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-sm">{p.trackingCode || p.id}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.senderName || "—"} → {p.receiverName || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.fromCity || "—"} → {p.toCity || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-violet-600 text-sm">{formatCurrency(p.price || p.amount || 0)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.createdAt || Date.now()).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
