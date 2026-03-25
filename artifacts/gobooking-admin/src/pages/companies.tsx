import React, { useState } from "react";
import { useSuperAdminCompanies, useCreateCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Plus, Phone, Mail, MapPin, CheckCircle, XCircle, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Companies() {
  const { isSuperAdmin } = useAuth();
  const { data: companies = [], isLoading, refetch, isFetching } = useSuperAdminCompanies();
  const createCompany = useCreateCompany();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  if (!isSuperAdmin) return (
    <div className="p-8 text-center text-muted-foreground">
      <XCircle size={40} className="mx-auto mb-3 text-red-400" />
      <p className="font-semibold">Accès réservé aux super administrateurs.</p>
    </div>
  );

  const filtered = (companies as any[]).filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compagnies de transport</h2>
          <p className="text-sm text-muted-foreground mt-1">{(companies as any[]).length} compagnie(s) enregistrée(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-card px-3 py-2 rounded-xl border border-border"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
          >
            <Plus size={16} /> Nouvelle compagnie
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom ou ville..."
        className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
      />

      {/* Add form */}
      {showAdd && (
        <AddCompanyForm
          onClose={() => setShowAdd(false)}
          onSubmit={async (data) => {
            try {
              await createCompany.mutateAsync(data);
              toast({ title: "✅ Compagnie créée avec succès" });
              setShowAdd(false);
            } catch (e: any) {
              toast({ title: "❌ Erreur", description: e.message, variant: "destructive" });
            }
          }}
          isLoading={createCompany.isPending}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: (companies as any[]).length, color: "#7C3AED", bg: "#F5F3FF" },
          { label: "Actives", value: (companies as any[]).filter((c: any) => c.status === "active").length, color: "#059669", bg: "#DCFCE7" },
          { label: "Inactives", value: (companies as any[]).filter((c: any) => c.status !== "active").length, color: "#DC2626", bg: "#FEE2E2" },
          { label: "Villes", value: new Set((companies as any[]).map((c: any) => c.city).filter(Boolean)).size, color: "#0369A1", bg: "#DBEAFE" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border border-border shadow-sm" style={{ backgroundColor: s.bg }}>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm font-semibold text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-purple-500" />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune compagnie trouvée.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-4 font-semibold text-muted-foreground">Compagnie</th>
                  <th className="text-left px-5 py-4 font-semibold text-muted-foreground hidden md:table-cell">Contact</th>
                  <th className="text-left px-5 py-4 font-semibold text-muted-foreground hidden lg:table-cell">Ville</th>
                  <th className="text-left px-5 py-4 font-semibold text-muted-foreground">Wallet</th>
                  <th className="text-left px-5 py-4 font-semibold text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Phone size={12} />
                        {c.phone || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <MapPin size={12} />
                        {c.city || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-foreground text-xs">
                        {c.walletBalance ? `${Number(c.walletBalance).toLocaleString()} FCFA` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {c.status === "active" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {c.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCompanyForm({ onClose, onSubmit, isLoading }: {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", address: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-card border-2 border-purple-200 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Building2 size={20} className="text-purple-600" />
          Nouvelle compagnie
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">✕</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "name", label: "Nom de la compagnie *", placeholder: "Trans-Voyageurs CI" },
          { key: "email", label: "Email *", placeholder: "contact@compagnie.ci" },
          { key: "phone", label: "Téléphone *", placeholder: "+225 07 XX XX XX" },
          { key: "city", label: "Ville", placeholder: "Abidjan" },
          { key: "address", label: "Adresse", placeholder: "Gare routière d'Adjamé" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className={key === "address" ? "md:col-span-2" : ""}>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
            <input
              value={(form as any)[key]}
              onChange={set(key)}
              placeholder={placeholder}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={isLoading || !form.name || !form.email || !form.phone}
          className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Création..." : "Créer la compagnie"}
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}
