import React, { useState } from "react";
import { useParcels } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Search, Package, ArrowRight, Bus } from "lucide-react";

function buildWALink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("225") ? digits : digits.startsWith("0") && digits.length === 10 ? "225" + digits.slice(1) : "225" + digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function waColisArrive(ref: string, destination: string): string {
  return `📦 *GoBooking – Votre colis est arrivé*\n\nBonjour,\n\nVotre colis *${ref}* est arrivé à *${destination}* !\n\nVous pouvez venir le récupérer muni de votre bon de livraison.\n\nGoBooking vous remercie de votre confiance. 🙏`;
}

function waColisEnRoute(ref: string, from: string, to: string): string {
  return `🚌 *GoBooking – Colis en route*\n\nBonjour,\n\nVotre colis *${ref}* est en route de *${from}* vers *${to}*.\n\nNous vous préviendrons à l'arrivée. 📦`;
}

export default function Parcels() {
  const { data: parcels, isLoading } = useParcels();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = parcels?.filter((p: any) => 
    p.trackingRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.senderName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'créé': return <Badge variant="neutral">Créé</Badge>;
      case 'en_gare': return <Badge variant="warning">En Gare</Badge>;
      case 'chargé_bus': return <Badge variant="accent">En Route</Badge>;
      case 'livré': return <Badge variant="success">Livré</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
          <Package size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Gestion des Colis</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Suivez les expéditions de marchandises.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Code de suivi ou Expéditeur..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Tracking</th>
                <th className="px-6 py-4">Expéditeur</th>
                <th className="px-6 py-4">Destinataire</th>
                <th className="px-6 py-4">Poids / Prix</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Création</th>
                <th className="px-6 py-4">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Chargement...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucun colis trouvé.</td></tr>
              ) : (
                filtered?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-medium text-accent">
                        <Package size={16} />
                        {p.trackingRef}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold">{p.senderName}</div>
                      <div className="text-xs text-muted-foreground">{p.senderPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-muted-foreground"/>
                        <div>
                          <div className="font-semibold">{p.receiverName}</div>
                          <div className="text-xs text-muted-foreground">{p.receiverPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{p.weight} kg</div>
                      <div className="font-bold text-foreground">{formatCurrency(p.price)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(p.status)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      {(p.receiverPhone || p.senderPhone) ? (
                        <div className="flex flex-col gap-1">
                          {p.receiverPhone && (
                            <a
                              href={buildWALink(p.receiverPhone, waColisArrive(p.trackingRef, p.to ?? "destination"))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#25D366" }}
                            >
                              <Package size={12} className="shrink-0" /> Colis arrivé
                            </a>
                          )}
                          {p.senderPhone && (
                            <a
                              href={buildWALink(p.senderPhone, waColisEnRoute(p.trackingRef, p.from ?? "origine", p.to ?? "destination"))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#128C7E" }}
                            >
                              <Bus size={12} className="shrink-0" /> En route
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
