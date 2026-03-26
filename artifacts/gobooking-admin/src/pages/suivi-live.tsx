import React from "react";
import { Radio, MapPin, Bus, Navigation, Clock } from "lucide-react";

const mockLiveBuses = [
  { id: "BUS-01", nom: "Transport Express", trajet: "Abidjan → Bouaké", position: "Tiébissou", vitesse: 85, statut: "en_route", maj: "Il y a 2 min" },
  { id: "BUS-02", nom: "Rapid Bus",         trajet: "Bouaké → Abidjan", position: "Didiévi",   vitesse: 90, statut: "en_route", maj: "Il y a 5 min" },
  { id: "BUS-03", nom: "GoTransit",          trajet: "Abidjan → Man",   position: "Issia",      vitesse: 72, statut: "en_route", maj: "Il y a 1 min" },
  { id: "BUS-04", nom: "FastLine",           trajet: "—",                position: "Gare Adjamé", vitesse: 0, statut: "arrete", maj: "Il y a 10 min" },
];

export default function SuiviLive() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #0369A1, #0284C7)" }}>
          <Radio size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Suivi Live GPS</h2>
          <p className="text-sm text-muted-foreground">Positions en temps réel de la flotte</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Bus en route", value: mockLiveBuses.filter(b=>b.statut==="en_route").length, color: "#059669" },
          { label: "Bus à l'arrêt", value: mockLiveBuses.filter(b=>b.statut==="arrete").length, color: "#D97706" },
          { label: "Vitesse moy.", value: "82 km/h", color: "#2563EB" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Carte placeholder */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={17} className="text-green-500" />
            <h3 className="font-bold text-foreground text-sm">Carte en temps réel</h3>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Live
          </span>
        </div>
        <div className="h-64 bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Navigation size={40} className="mx-auto mb-3 text-emerald-400" />
            <p className="font-semibold text-foreground text-sm">Carte GPS interactive</p>
            <p className="text-xs mt-1 text-muted-foreground">Intégration Google Maps / Mapbox disponible</p>
            <p className="text-xs mt-0.5 text-muted-foreground">Positions transmises par l'application mobile des agents</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Bus size={17} className="text-blue-500" />
          <h3 className="font-bold text-foreground text-sm">Liste des engins tracés</h3>
        </div>
        <div className="divide-y divide-border">
          {mockLiveBuses.map((b) => (
            <div key={b.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.statut === "en_route" ? "bg-emerald-100" : "bg-gray-100"}`}>
                  <Bus size={18} className={b.statut === "en_route" ? "text-emerald-600" : "text-gray-400"} />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{b.id} — {b.nom}</p>
                  <p className="text-xs text-muted-foreground">{b.trajet}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <MapPin size={12} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{b.position}</span>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  {b.vitesse > 0 && (
                    <span className="text-xs font-semibold text-blue-600">{b.vitesse} km/h</span>
                  )}
                  <span className="text-xs text-muted-foreground">{b.maj}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
