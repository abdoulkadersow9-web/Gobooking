import React, { useState } from "react";
import { useAgents, useCreateAgent } from "@/hooks/use-company";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus, UserCog, Mail, Phone, Bus, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Agents() {
  const { data: agents, isLoading } = useAgents();
  const [showAdd, setShowAdd] = useState(false);
  const { isCompany } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Agents de Compagnie</h2>
          <p className="text-muted-foreground mt-1">Gérez le personnel au guichet et dans les bus.</p>
        </div>
        {isCompany ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            <Eye size={14} /> Lecture seule
          </span>
        ) : (
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus size={18} /> Nouvel Agent
          </Button>
        )}
      </div>

      {showAdd && (
        <AddAgentForm onClose={() => setShowAdd(false)} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">Chargement...</p>
        ) : (
          agents?.map((agent: any) => (
            <div key={agent.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">Code: {agent.agentCode}</p>
                  </div>
                </div>
                <Badge variant={agent.status === 'active' ? 'success' : 'neutral'}>
                  {agent.status}
                </Badge>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-border/50 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserCog size={14} />
                  <span className="capitalize">{agent.agentRole?.replace('_', ' ') || 'Guichet'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={14} />
                  <span>{agent.email}</span>
                </div>
                {agent.busName && (
                  <div className="flex items-center gap-2 text-secondary font-medium">
                    <Bus size={14} />
                    <span>Assigné: {agent.busName}</span>
                  </div>
                )}
              </div>
              
              {!isCompany && (
                <div className="mt-6">
                  <Button variant="outline" size="sm" className="w-full">Modifier / Assigner</Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddAgentForm({ onClose }: { onClose: () => void }) {
  const { mutate, isPending } = useCreateAgent();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", agentCode: "", agentRole: "guichet"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(formData, {
      onSuccess: () => {
        toast({ title: "Agent créé", description: "Le nouvel agent a été ajouté avec succès." });
        onClose();
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message })
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
      <h3 className="text-lg font-bold mb-4">Créer un nouvel agent</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Nom complet</label>
          <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" 
            value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Code Agent (Unique)</label>
          <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-mono" 
            value={formData.agentCode} onChange={e=>setFormData({...formData, agentCode: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Email</label>
          <input required type="email" className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" 
            value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Téléphone</label>
          <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" 
            value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Rôle</label>
          <select className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            value={formData.agentRole} onChange={e=>setFormData({...formData, agentRole: e.target.value})}>
            <option value="guichet">Agent de Guichet</option>
            <option value="embarquement">Agent d'Embarquement (Bus)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Mot de passe provisoire</label>
          <input required type="password" className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" 
            value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} />
        </div>
        <div className="col-span-full flex justify-end gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" isLoading={isPending}>Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}
