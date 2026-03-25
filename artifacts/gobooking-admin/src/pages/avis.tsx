import React from "react";
import { Star, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";

const mockAvis = [
  { id: 1, nom: "Kofi Asante",   note: 5, commentaire: "Service excellent, bus confortable et ponctuel !", trajet: "Abidjan → Bouaké", date: "2026-03-24" },
  { id: 2, nom: "Fatima Coulibaly", note: 4, commentaire: "Bon voyage, personnel sympathique.", trajet: "Bouaké → Abidjan", date: "2026-03-23" },
  { id: 3, nom: "Aminata Traoré", note: 2, commentaire: "Retard de 2h à l'arrivée, pas d'explication.", trajet: "Abidjan → Man", date: "2026-03-22" },
  { id: 4, nom: "Jean-Claude Bamba", note: 5, commentaire: "Parfait comme toujours, je recommande !", trajet: "Abidjan → Yamoussoukro", date: "2026-03-21" },
  { id: 5, nom: "Mariam Diallo",  note: 3, commentaire: "Bus propre mais AC ne fonctionnait pas.", trajet: "Abidjan → Bouaké", date: "2026-03-20" },
];

function Stars({ note }: { note: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} fill={s <= note ? "#F59E0B" : "none"} stroke={s <= note ? "#F59E0B" : "#D1D5DB"} />
      ))}
    </div>
  );
}

export default function Avis() {
  const avg = (mockAvis.reduce((s, a) => s + a.note, 0) / mockAvis.length).toFixed(1);
  const positifs = mockAvis.filter((a) => a.note >= 4).length;
  const negatifs = mockAvis.filter((a) => a.note <= 2).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Avis clients</h2>
        <p className="text-sm text-muted-foreground mt-1">Feedback et satisfaction des passagers</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Note moyenne", value: `${avg}/5 ⭐`, color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Avis positifs (4-5★)", value: positifs, color: "#059669", bg: "#DCFCE7" },
          { label: "Avis négatifs (1-2★)", value: negatifs, color: "#DC2626", bg: "#FEE2E2" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Star size={17} className="text-yellow-500" />
          <h3 className="font-bold text-foreground text-sm">Derniers avis ({mockAvis.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {mockAvis.map((a) => (
            <div key={a.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-foreground text-sm">{a.nom}</p>
                  <p className="text-xs text-muted-foreground">{a.trajet} · {a.date}</p>
                </div>
                <Stars note={a.note} />
              </div>
              <p className="text-sm text-muted-foreground italic">"{a.commentaire}"</p>
              <div className="flex gap-2 mt-3">
                <button className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors font-medium">
                  <ThumbsUp size={12} /> Répondre
                </button>
                <button className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium">
                  <ThumbsDown size={12} /> Signaler
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
