import React, { useState } from "react";
import { useSuperAdminCompanies, useCreateCompany, useAllAgences, useCreateAdminAgence } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Plus, Phone, Mail, MapPin, CheckCircle, XCircle,
  Users, RefreshCw, Search, Store, ChevronDown, ChevronRight,
  Wallet, Calendar,
} from "lucide-react";

export default function Companies() {
  const { isSuperAdmin } = useAuth();
  const { data: companies = [], isLoading, refetch, isFetching } = useSuperAdminCompanies();
  const { data: allAgences = [] } = useAllAgences();
  const createCompany = useCreateCompany();
  const createAgence = useCreateAdminAgence();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddAgence, setShowAddAgence] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const agencesByCompany = (allAgences as any[]).reduce((acc: Record<string, any[]>, a: any) => {
    if (!acc[a.companyId]) acc[a.companyId] = [];
    acc[a.companyId].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compagnies de transport</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hiérarchie : <span className="font-semibold text-purple-600">Compagnie → Agences → Agents</span>
          </p>
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
            <Plus size={16} /> Nouvelle compagnie
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total",           value: (companies as any[]).length,                                                         color: "#7C3AED", bg: "#F5F3FF" },
          { label: "Actives",         value: (companies as any[]).filter((c: any) => c.status === "active").length,               color: "#059669", bg: "#DCFCE7" },
          { label: "Inactives",       value: (companies as any[]).filter((c: any) => c.status !== "active").length,               color: "#DC2626", bg: "#FEE2E2" },
          { label: "Villes couvertes",value: new Set((companies as any[]).map((c: any) => c.city).filter(Boolean)).size,          color: "#2563EB", bg: "#DBEAFE" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 border border-border shadow-sm" style={{ backgroundColor: s.bg }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add company form */}
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

      {/* Add agence form */}
      {showAddAgence && (
        <AddAgenceInlineForm
          companyId={showAddAgence}
          onClose={() => setShowAddAgence(null)}
          onSubmit={async (data) => {
            try {
              await createAgence.mutateAsync(data);
              toast({ title: "✅ Agence créée avec succès" });
              setShowAddAgence(null);
              refetch();
            } catch (e: any) {
              toast({ title: "❌ Erreur", description: e.message, variant: "destructive" });
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
          placeholder="Rechercher par nom ou ville..."
          className="w-full pl-10 pr-4 bg-card border border-border rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {/* Companies list with hierarchy */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-purple-500" /> Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune compagnie trouvée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => {
            const compAgences = agencesByCompany[c.id] || [];
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Company row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-base shrink-0">
                      {c.name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {c.status === "active" ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {c.city && <span className="flex items-center gap-1"><MapPin size={10} />{c.city}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    {c.walletBalance && (
                      <span className="hidden md:flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <Wallet size={11} />
                        {Number(c.walletBalance).toLocaleString()} FCFA
                      </span>
                    )}
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <Store size={11} />
                      {compAgences.length} agence(s)
                    </span>
                    {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {/* Agencies expand */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/10">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Agences ({compAgences.length})
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAddAgence(c.id); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Ajouter une agence
                      </button>
                    </div>

                    {compAgences.length === 0 ? (
                      <div className="px-5 pb-4 text-sm text-muted-foreground text-center py-6">
                        Aucune agence pour cette compagnie
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {compAgences.map((a: any) => (
                          <div key={a.id} className="px-8 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Store size={14} className="text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><MapPin size={10} />{a.city}</span>
                                  {a.phone && <span>{a.phone}</span>}
                                  <span className="flex items-center gap-1"><Users size={10} />{a.agentCount ?? 0} agent(s)</span>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              a.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {a.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Forms ── */

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
          <Building2 size={20} className="text-purple-600" /> Nouvelle compagnie
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 text-xl">✕</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "name",    label: "Nom *",       placeholder: "Trans-Voyageurs CI" },
          { key: "email",   label: "Email *",     placeholder: "contact@compagnie.ci" },
          { key: "phone",   label: "Téléphone *", placeholder: "+225 07 XX XX XX" },
          { key: "city",    label: "Ville",       placeholder: "Abidjan" },
          { key: "address", label: "Adresse",     placeholder: "Gare routière d'Adjamé" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className={key === "address" ? "md:col-span-2" : ""}>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
            <input value={(form as any)[key]} onChange={set(key)} placeholder={placeholder}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSubmit(form)} disabled={isLoading || !form.name || !form.email || !form.phone}
          className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {isLoading ? "Création..." : "Créer la compagnie"}
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">Annuler</button>
      </div>
    </div>
  );
}

function AddAgenceInlineForm({ companyId, onClose, onSubmit, isLoading }: {
  companyId: string;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ name: "", city: "", phone: "", address: "", companyId });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Store size={16} className="text-blue-600" /> Nouvelle agence
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">✕</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: "name",    label: "Nom *",     placeholder: "Agence d'Adjamé" },
          { key: "city",    label: "Ville *",   placeholder: "Abidjan" },
          { key: "phone",   label: "Téléphone", placeholder: "+225 07 XX XX XX" },
          { key: "address", label: "Adresse",   placeholder: "Gare routière d'Adjamé" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className={key === "address" ? "md:col-span-2" : ""}>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
            <input value={(form as any)[key]} onChange={set(key)} placeholder={placeholder}
              className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => onSubmit(form)} disabled={isLoading || !form.name || !form.city}
          className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? "Création..." : "Créer l'agence"}
        </button>
        <button onClick={onClose} className="px-5 py-2 rounded-xl border border-border text-sm hover:bg-muted">Annuler</button>
      </div>
    </div>
  );
}
