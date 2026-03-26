import React, { useState } from "react";
import { useAllAgences, useCreateAdminAgence, useSuperAdminCompanies } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, MapPin, Phone, Plus, RefreshCw, Users, XCircle,
  CheckCircle, Search, Store, ChevronDown, ChevronRight,
} from "lucide-react";

export default function Agences() {
  const { isSuperAdmin } = useAuth();
  const { data: agences = [], isLoading, refetch, isFetching } = useAllAgences();
  const { data: companies = [] } = useSuperAdminCompanies();
  const createAgence = useCreateAdminAgence();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  if (!isSuperAdmin) return (
    <div className="p-8 text-center text-muted-foreground">
      <XCircle size={40} className="mx-auto mb-3 text-red-400" />
      <p className="font-semibold">Accès réservé aux super administrateurs.</p>
    </div>
  );

  /* Group agences by company */
  const byCompany: Record<string, { companyName: string; agences: any[] }> = {};
  for (const a of (agences as any[])) {
    if (!byCompany[a.companyId]) {
      byCompany[a.companyId] = { companyName: a.companyName || "—", agences: [] };
    }
    byCompany[a.companyId].agences.push(a);
  }

  const filtered = (agences as any[]).filter(
    (a) =>
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.city?.toLowerCase().includes(search.toLowerCase()) ||
      a.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
            <Store size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Agences</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hiérarchie : <span className="font-semibold text-purple-600">Compagnie → Agences → Agents</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
          >
            <Plus size={16} /> Nouvelle agence
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total agences",    value: (agences as any[]).length,                                                color: "#7C3AED", bg: "#F5F3FF" },
          { label: "Actives",          value: (agences as any[]).filter((a: any) => a.status === "active").length,     color: "#059669", bg: "#DCFCE7" },
          { label: "Compagnies",       value: Object.keys(byCompany).length,                                           color: "#2563EB", bg: "#DBEAFE" },
          { label: "Agents affectés",  value: (agences as any[]).reduce((s: number, a: any) => s + (a.agentCount ?? 0), 0), color: "#D97706", bg: "#FEF9C3" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 border border-border shadow-sm" style={{ backgroundColor: s.bg }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <AddAgenceForm
          companies={companies as any[]}
          onClose={() => setShowAdd(false)}
          onSubmit={async (data) => {
            try {
              await createAgence.mutateAsync(data);
              toast({ title: "Agence créée avec succès" });
              setShowAdd(false);
              refetch();
            } catch (e: any) {
              toast({ title: "Erreur", description: e.message, variant: "destructive" });
            }
          }}
          isLoading={createAgence.isPending}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, ville ou compagnie..."
          className="w-full pl-10 pr-4 bg-card border border-border rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-purple-500" />
          Chargement...
        </div>
      ) : search ? (
        /* Flat list when searching */
        <div className="space-y-3">
          {filtered.map((a: any) => (
            <AgenceCard key={a.id} agence={a} showCompany />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Store size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aucune agence trouvée.</p>
            </div>
          )}
        </div>
      ) : (
        /* Grouped by company */
        <div className="space-y-4">
          {Object.entries(byCompany).map(([companyId, group]) => {
            const isOpen = expandedCompany === companyId;
            return (
              <div key={companyId} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Company header */}
                <button
                  onClick={() => setExpandedCompany(isOpen ? null : companyId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                      {group.companyName.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{group.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.agences.length} agence(s) · {group.agences.reduce((s, a) => s + (a.agentCount ?? 0), 0)} agent(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2.5 py-1 rounded-full">
                      {group.agences.length}
                    </span>
                    {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {/* Agences list */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.agences.map((a: any) => (
                      <AgenceCard key={a.id} agence={a} showCompany={false} />
                    ))}
                    {group.agences.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Aucune agence pour cette compagnie
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(byCompany).length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Store size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-semibold">Aucune agence enregistrée</p>
              <p className="text-sm mt-1">Créez la première agence en cliquant sur "Nouvelle agence"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgenceCard({ agence, showCompany }: { agence: any; showCompany: boolean }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Store size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{agence.name}</p>
            {showCompany && (
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {agence.companyName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={11} />{agence.city}</span>
            {agence.phone && <span className="flex items-center gap-1"><Phone size={11} />{agence.phone}</span>}
            <span className="flex items-center gap-1">
              <Users size={11} />
              {agence.agentCount ?? 0} agent(s)
            </span>
          </div>
        </div>
      </div>
      <span className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
        agence.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}>
        {agence.status === "active" ? <CheckCircle size={11} /> : <XCircle size={11} />}
        {agence.status === "active" ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

function AddAgenceForm({ onClose, onSubmit, isLoading, companies }: {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  companies: any[];
}) {
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "", companyId: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-card border-2 border-purple-200 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Store size={20} className="text-purple-600" />
          Nouvelle agence
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 text-xl">✕</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Compagnie *</label>
          <select
            value={form.companyId}
            onChange={set("companyId")}
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">— Sélectionner une compagnie —</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: "name",    label: "Nom de l'agence *",  placeholder: "Agence d'Adjamé" },
            { key: "city",    label: "Ville *",             placeholder: "Abidjan" },
            { key: "phone",   label: "Téléphone",           placeholder: "+225 07 XX XX XX" },
            { key: "address", label: "Adresse",             placeholder: "Gare routière d'Adjamé" },
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
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={isLoading || !form.name || !form.city || !form.companyId}
          className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Création..." : "Créer l'agence"}
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">
          Annuler
        </button>
      </div>
    </div>
  );
}
