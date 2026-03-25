import React from "react";
import { Wrench, AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";

const mockMaintenance = [
  { id: 1, bus: "ABC-123 — Transport Express", type: "Vidange + filtres", date: "2026-03-20", statut: "termine", cout: 45000 },
  { id: 2, bus: "DEF-456 — Rapid Bus", type: "Réparation freins", date: "2026-03-22", statut: "en_cours", cout: 120000 },
  { id: 3, bus: "GHI-789 — GoTransit", type: "Changement pneus (x4)", date: "2026-03-24", statut: "planifie", cout: 200000 },
  { id: 4, bus: "JKL-012 — FastLine", type: "Révision générale", date: "2026-03-26", statut: "planifie", cout: 350000 },
];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  termine:  { label: "Terminé ✓",  color: "#059669", bg: "#DCFCE7" },
  en_cours: { label: "En cours",   color: "#2563EB", bg: "#DBEAFE" },
  planifie: { label: "Planifié",   color: "#D97706", bg: "#FEF9C3" },
  urgent:   { label: "Urgent ⚠️",  color: "#DC2626", bg: "#FEE2E2" },
};

export default function Maintenance() {
  const total = mockMaintenance.reduce((s, m) => s + m.cout, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Maintenance</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi des interventions sur la flotte</p>
        </div>
        <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm">
          <Plus size={16} /> Nouvelle intervention
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Terminées", value: mockMaintenance.filter(m=>m.statut==="termine").length, color: "#059669" },
          { label: "En cours",  value: mockMaintenance.filter(m=>m.statut==="en_cours").length, color: "#2563EB" },
          { label: "Planifiées",value: mockMaintenance.filter(m=>m.statut==="planifie").length, color: "#D97706" },
          { label: "Coût total (FCFA)", value: total.toLocaleString("fr-FR"), color: "#DC2626" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Wrench size={17} className="text-violet-500" />
          <h3 className="font-bold text-foreground text-sm">Interventions récentes / planifiées</h3>
        </div>
        <div className="divide-y divide-border">
          {mockMaintenance.map((m) => {
            const s = STATUS[m.statut] ?? STATUS.planifie;
            return (
              <div key={m.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground text-sm">{m.bus}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.type} · {m.date}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-foreground">{m.cout.toLocaleString("fr-FR")} FCFA</span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
