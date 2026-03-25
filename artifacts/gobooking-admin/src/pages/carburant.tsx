import React from "react";
import { Fuel, TrendingDown, TrendingUp, Bus, Plus } from "lucide-react";

const mockFuel = [
  { id: 1, bus: "ABC-123", date: "2026-03-25", litres: 120, prixUnitaire: 750, total: 90000, km: 1200 },
  { id: 2, bus: "DEF-456", date: "2026-03-24", litres: 95, prixUnitaire: 750, total: 71250, km: 980 },
  { id: 3, bus: "GHI-789", date: "2026-03-23", litres: 140, prixUnitaire: 750, total: 105000, km: 1450 },
  { id: 4, bus: "JKL-012", date: "2026-03-22", litres: 110, prixUnitaire: 750, total: 82500, km: 1100 },
];

export default function Carburant() {
  const totalLitres = mockFuel.reduce((s, f) => s + f.litres, 0);
  const totalCout = mockFuel.reduce((s, f) => s + f.total, 0);
  const totalKm = mockFuel.reduce((s, f) => s + f.km, 0);
  const conso = (totalLitres / totalKm * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Carburant</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi consommation & coûts carburant</p>
        </div>
        <button className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-700 transition-colors shadow-sm">
          <Plus size={16} /> Enregistrer plein
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total litres (7j)", value: `${totalLitres} L`, color: "#D97706", bg: "#FEF9C3" },
          { label: "Coût total (FCFA)",  value: totalCout.toLocaleString("fr-FR"), color: "#DC2626", bg: "#FEE2E2" },
          { label: "Km parcourus",       value: `${totalKm.toLocaleString("fr-FR")} km`, color: "#2563EB", bg: "#DBEAFE" },
          { label: "Consommation moy.",  value: `${conso} L/100km`, color: "#059669", bg: "#DCFCE7" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Fuel size={17} className="text-orange-500" />
          <h3 className="font-bold text-foreground text-sm">Historique des pleins</h3>
        </div>
        <div className="divide-y divide-border">
          {mockFuel.map((f) => (
            <div key={f.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Bus size={18} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Bus {f.bus}</p>
                  <p className="text-xs text-muted-foreground">{f.date} · {f.km} km</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">{f.total.toLocaleString("fr-FR")} FCFA</p>
                <p className="text-xs text-muted-foreground">{f.litres} L · {f.prixUnitaire} FCFA/L</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
