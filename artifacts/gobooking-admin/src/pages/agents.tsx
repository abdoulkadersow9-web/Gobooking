import React, { useRef, useState } from "react";
import { useAgents, useCreateAgent, useUploadAgentPhoto } from "@/hooks/use-company";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Camera, Plus, UserCog, Mail, Phone, Bus, Eye, MapPin, Navigation, Package, Ticket, Users, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  agent_route:       { label: "Agents En Route",         icon: <Navigation size={16} />,   color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  agent_guichet:     { label: "Agents Guichet",          icon: <Ticket size={16} />,        color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  agent_embarquement:{ label: "Agents Embarquement",     icon: <Bus size={16} />,           color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  agent_colis:       { label: "Agents Colis",            icon: <Package size={16} />,       color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  validation:        { label: "Agents Validation",       icon: <Users size={16} />,         color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
};

const ROLE_DISPLAY_KEY: Record<string, string> = {
  agent_reservation: "agent_colis",
};

const ROLE_ORDER = ["agent_route", "agent_guichet", "agent_embarquement", "agent_colis", "validation"];

function statusLabel(s: string) {
  if (s === "active")   return "Actif";
  if (s === "inactive") return "Inactif";
  if (s === "en_mission" || s === "on_trip") return "En mission";
  return s;
}

function statusVariant(s: string): "success" | "destructive" | "warning" | "neutral" {
  if (s === "active")   return "success";
  if (s === "inactive") return "destructive";
  if (s === "en_mission" || s === "on_trip") return "warning";
  return "neutral";
}

/* ── Avatar circulaire agent ── */
function AgentAvatar({ agent, cfg, size = 40 }: { agent: any; cfg: any; size?: number }) {
  const [imgError, setImgError] = useState(false);
  if (agent.photoUrl && !imgError) {
    return (
      <img
        src={agent.photoUrl}
        alt={agent.name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `1.5px solid ${cfg.border}`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`, fontWeight: "bold", fontSize: size * 0.35, flexShrink: 0 }}
    >
      {(agent.name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Carte individuelle d'un agent ── */
function AgentCard({ agent, isCompany, roleKey }: { agent: any; isCompany: boolean; roleKey: string }) {
  const cfg = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG["agent_guichet"];
  const { mutate: uploadPhoto, isPending: uploading } = useUploadAgentPhoto();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      uploadPhoto({ userId: agent.userId, photoBase64: base64 }, {
        onSuccess: () => toast({ title: "Photo mise à jour", description: `Photo de ${agent.name} enregistrée.` }),
        onError: () => toast({ variant: "destructive", title: "Erreur", description: "Impossible d'uploader la photo." }),
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <AgentAvatar agent={agent} cfg={cfg} size={40} />
            {!isCompany && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="Changer la photo"
                  style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: cfg.color, color: "#fff", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                >
                  <Camera size={10} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              </>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{agent.name ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground font-mono">Code: {agent.agentCode ?? "—"}</p>
          </div>
        </div>
        <Badge variant={statusVariant(agent.status ?? "inactive")}>
          {statusLabel(agent.status ?? "inactive")}
        </Badge>
      </div>

      {/* Détails */}
      <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/50 pt-3">
        {agent.email && (
          <div className="flex items-center gap-2">
            <Mail size={12} className="flex-shrink-0" />
            <span className="truncate">{agent.email}</span>
          </div>
        )}
        {agent.phone && (
          <div className="flex items-center gap-2">
            <Phone size={12} className="flex-shrink-0" />
            <span>{agent.phone}</span>
          </div>
        )}
        {(agent.agenceName || agent.agenceCity) && (
          <div className="flex items-center gap-2">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="font-medium text-foreground">
              {agent.agenceName ?? ""}
              {agent.agenceCity ? ` — ${agent.agenceCity}` : ""}
            </span>
          </div>
        )}
        {roleKey === "agent_route" && agent.tripName && (
          <div className="flex items-center gap-2 mt-1">
            <Navigation size={12} className="flex-shrink-0" style={{ color: cfg.color }} />
            <span className="font-semibold" style={{ color: cfg.color }}>
              {agent.tripName}
              {agent.tripTime ? ` · Départ ${agent.tripTime}` : ""}
            </span>
          </div>
        )}
        {roleKey === "agent_route" && !agent.tripName && (
          <div className="flex items-center gap-2 mt-1">
            <Navigation size={12} className="flex-shrink-0 text-muted-foreground" />
            <span className="italic text-muted-foreground">Aucun départ attribué</span>
          </div>
        )}
        {roleKey !== "agent_route" && agent.busName && agent.busName !== "Non assigné" && (
          <div className="flex items-center gap-2">
            <Bus size={12} className="flex-shrink-0 text-blue-500" />
            <span className="font-medium text-blue-600">{agent.busName}</span>
          </div>
        )}
      </div>

      {!isCompany && (
        <div className="mt-1">
          <Button variant="outline" size="sm" className="w-full text-xs">Modifier / Assigner</Button>
        </div>
      )}
    </div>
  );
}

/* ── Section par rôle ── */
function RoleSection({ roleKey, agents, isCompany }: { roleKey: string; agents: any[]; isCompany: boolean }) {
  const cfg = ROLE_CONFIG[roleKey] ?? { label: roleKey, icon: <UserCog size={16} />, color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" };

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <h3 className="font-bold text-sm" style={{ color: cfg.color }}>{cfg.label}</h3>
        <span
          className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: cfg.border, color: cfg.color }}
        >
          {agents.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-1">
        {agents.map((agent: any) => (
          <AgentCard key={agent.id} agent={agent} isCompany={isCompany} roleKey={roleKey} />
        ))}
      </div>
    </div>
  );
}

/* ── Page principale ── */
export default function Agents() {
  const { data: agents, isLoading } = useAgents();
  const [showAdd, setShowAdd] = useState(false);
  const { isCompany } = useAuth();

  const grouped = React.useMemo(() => {
    if (!agents) return {};
    const map: Record<string, any[]> = {};
    for (const agent of agents as any[]) {
      const rawRole = agent.agentRole ?? "agent_guichet";
      const role = ROLE_DISPLAY_KEY[rawRole] ?? rawRole;
      if (!map[role]) map[role] = [];
      map[role].push(agent);
    }
    return map;
  }, [agents]);

  const presentRoles = ROLE_ORDER.filter(r => (grouped[r]?.length ?? 0) > 0);
  const otherRoles   = Object.keys(grouped).filter(r => !ROLE_ORDER.includes(r));
  const allRoles     = [...presentRoles, ...otherRoles];

  const totalAgents = (agents as any[] | undefined)?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* ── En-tête ── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">Agents de Compagnie</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {totalAgents} agent{totalAgents !== 1 ? "s" : ""} · classés par rôle
            </p>
          </div>
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

      {showAdd && <AddAgentForm onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Chargement des agents…</p>
      ) : totalAgents === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-semibold">Aucun agent enregistré</p>
          <p className="text-sm mt-1">Créez votre premier agent avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {allRoles.map(roleKey => (
            grouped[roleKey]?.length > 0 && (
              <RoleSection
                key={roleKey}
                roleKey={roleKey}
                agents={grouped[roleKey]}
                isCompany={isCompany}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Formulaire ajout agent ── */
function AddAgentForm({ onClose }: { onClose: () => void }) {
  const { mutate, isPending } = useCreateAgent();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", agentCode: "", agentRole: "agent_guichet"
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setPhotoPreview(b64);
      setPhotoBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ ...formData, photoBase64 }, {
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
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo de profil */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition"
            onClick={() => fileRef.current?.click()}
            title="Cliquer pour ajouter une photo"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <Camera size={24} className="text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Photo de profil</p>
            <p className="text-xs text-muted-foreground mb-1">Optionnelle — format JPG ou PNG</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Upload size={12} /> Choisir une photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nom complet</label>
            <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Code Agent (Unique)</label>
            <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-mono"
              value={formData.agentCode} onChange={e => setFormData({ ...formData, agentCode: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Email</label>
            <input required type="email" className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Téléphone</label>
            <input required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Rôle</label>
            <select className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.agentRole} onChange={e => setFormData({ ...formData, agentRole: e.target.value })}>
              <option value="agent_guichet">Agent Guichet</option>
              <option value="agent_embarquement">Agent Embarquement</option>
              <option value="agent_colis">Agent Colis</option>
              <option value="agent_route">Agent En Route</option>
              <option value="validation">Agent Validation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Mot de passe provisoire</label>
            <input required type="password" className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" isLoading={isPending}>Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}
