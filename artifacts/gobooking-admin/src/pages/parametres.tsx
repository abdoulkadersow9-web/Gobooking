import React from "react";
import { Settings, Building2, Bell, Shield, Globe, Smartphone, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Parametres() {
  const { user } = useAuth();
  const [nom, setNom] = React.useState(user?.name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [notifications, setNotifications] = React.useState(true);
  const [notifAlerte, setNotifAlerte] = React.useState(true);
  const [notifColis, setNotifColis] = React.useState(true);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #475569, #334155)" }}>
          <Settings size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Paramètres</h2>
          <p className="text-sm text-muted-foreground">Configuration de votre espace compagnie</p>
        </div>
      </div>

      {/* Profil */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2 mb-2">
          <Building2 size={17} className="text-amber-500" />
          Informations de la compagnie
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Téléphone</label>
            <input placeholder="+225 07 XX XX XX XX"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Ville</label>
            <input placeholder="Abidjan"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
        </div>
        <button className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
          <Save size={15} /> Enregistrer
        </button>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Bell size={17} className="text-blue-500" />
          Notifications
        </h3>
        {[
          { label: "Notifications générales", sub: "Alertes et mises à jour système", val: notifications, set: setNotifications },
          { label: "Alertes critiques", sub: "Pannes bus, incidents, urgences", val: notifAlerte, set: setNotifAlerte },
          { label: "Notifications colis", sub: "Nouveaux colis, validations requises", val: notifColis, set: setNotifColis },
        ].map((n) => (
          <div key={n.label} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{n.label}</p>
              <p className="text-xs text-muted-foreground">{n.sub}</p>
            </div>
            <button onClick={() => n.set(!n.val)}
              className={`w-12 h-6 rounded-full transition-colors relative ${n.val ? "bg-blue-500" : "bg-muted"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${n.val ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Sécurité */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Shield size={17} className="text-violet-500" />
          Sécurité
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Ancien mot de passe</label>
            <input type="password" placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nouveau mot de passe</label>
            <input type="password" placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
        </div>
        <button className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Shield size={15} /> Changer le mot de passe
        </button>
      </div>
    </div>
  );
}
