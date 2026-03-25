import React from "react";
import { MessageSquare, Send, Users, TrendingUp, Plus, Clock } from "lucide-react";

const mockCampagnes = [
  { id: 1, nom: "Promo Fête de l'Indépendance", cible: "Tous les clients", envoyes: 1250, ouverts: 980, statut: "envoye", date: "2026-03-10" },
  { id: 2, nom: "Rappel réservation week-end",  cible: "Réservations actives", envoyes: 340, ouverts: 310, statut: "envoye", date: "2026-03-18" },
  { id: 3, nom: "Offre client fidèle -10%",      cible: "Clients fidèles",   envoyes: 0, ouverts: 0, statut: "planifie", date: "2026-03-28" },
];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  envoye:   { label: "Envoyé ✓",  color: "#059669", bg: "#DCFCE7" },
  planifie: { label: "Planifié",  color: "#D97706", bg: "#FEF9C3" },
  brouillon:{ label: "Brouillon", color: "#475569", bg: "#F1F5F9" },
};

export default function SmsMarketing() {
  const [message, setMessage] = React.useState("");
  const [cible, setCible] = React.useState("tous");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">SMS Marketing</h2>
          <p className="text-sm text-muted-foreground mt-1">Campagnes SMS et notifications clients</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Campagnes envoyées", value: mockCampagnes.filter(c=>c.statut==="envoye").length, color: "#059669" },
          { label: "Total SMS envoyés",  value: "1 590", color: "#2563EB" },
          { label: "Taux d'ouverture",   value: "81%", color: "#D97706" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Send size={17} className="text-blue-500" />
          Composer un SMS
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Cible</label>
            <select value={cible} onChange={(e) => setCible(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="tous">Tous les clients</option>
              <option value="actifs">Réservations actives</option>
              <option value="fideles">Clients fidèles</option>
              <option value="inactifs">Clients inactifs (30j+)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date d'envoi</label>
            <input type="datetime-local"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Message ({message.length}/160)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 160))}
            placeholder="Bonjour ! Profitez de nos offres spéciales..."
            rows={3}
            className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Send size={15} /> Envoyer le SMS
        </button>
      </div>

      {/* Historique campagnes */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Clock size={17} className="text-muted-foreground" />
          <h3 className="font-bold text-foreground text-sm">Campagnes récentes</h3>
        </div>
        <div className="divide-y divide-border">
          {mockCampagnes.map((c) => {
            const s = STATUS[c.statut] ?? STATUS.brouillon;
            const taux = c.envoyes > 0 ? Math.round((c.ouverts / c.envoyes) * 100) : 0;
            return (
              <div key={c.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">{c.cible} · {c.date}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ color: s.color, backgroundColor: s.bg }}>
                    {s.label}
                  </span>
                </div>
                {c.envoyes > 0 && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{c.envoyes}</strong> envoyés</span>
                    <span><strong className="text-foreground">{c.ouverts}</strong> ouverts</span>
                    <span className="font-semibold text-blue-600">{taux}% ouverture</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
