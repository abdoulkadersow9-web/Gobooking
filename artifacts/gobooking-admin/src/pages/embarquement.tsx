import React from "react";
import { UserCheck, QrCode, Bus, Users, CheckCircle, Clock } from "lucide-react";

const mockBoarding = [
  { id: 1, trajet: "Abidjan → Bouaké", bus: "ABC-123", depart: "08:00", passagers: 32, scannes: 28, statut: "en_cours" },
  { id: 2, trajet: "Abidjan → Yamoussoukro", bus: "DEF-456", depart: "09:00", passagers: 44, scannes: 44, statut: "complet" },
  { id: 3, trajet: "Bouaké → Man", bus: "GHI-789", depart: "10:30", passagers: 38, scannes: 0, statut: "en_attente" },
];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_cours:   { label: "En cours",   color: "#2563EB", bg: "#DBEAFE" },
  complet:    { label: "Complet ✓",  color: "#059669", bg: "#DCFCE7" },
  en_attente: { label: "En attente", color: "#D97706", bg: "#FEF9C3" },
};

export default function Embarquement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Embarquement</h2>
        <p className="text-sm text-muted-foreground mt-1">Suivi du scan passagers par trajet</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Trajets actifs", value: 3, color: "#2563EB", bg: "#EFF6FF", icon: <Bus size={20} /> },
          { label: "Passagers scannés", value: 72, color: "#059669", bg: "#F0FDF4", icon: <CheckCircle size={20} /> },
          { label: "En attente scan", value: 10, color: "#D97706", bg: "#FEF9C3", icon: <Clock size={20} /> },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <UserCheck size={17} className="text-blue-500" />
          <h3 className="font-bold text-foreground text-sm">Liste des trajets — embarquement</h3>
        </div>
        <div className="divide-y divide-border">
          {mockBoarding.map((t) => {
            const s = STATUS_LABELS[t.statut];
            const pct = Math.round((t.scannes / t.passagers) * 100);
            return (
              <div key={t.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{t.trajet}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.bus} · Départ {t.depart}</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">{t.scannes} / {t.passagers}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
        <QrCode size={20} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Scanner QR Code</p>
          <p className="text-xs text-blue-600 mt-1">
            L'embarquement via QR code est géré directement par l'agent embarquement depuis l'application mobile GoBooking.
            Cette page affiche la supervision en temps réel.
          </p>
        </div>
      </div>
    </div>
  );
}
