import React, { useState } from "react";
import { useParcels } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Search, Package, ArrowRight } from "lucide-react";

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Gestion des Colis</h2>
          <p className="text-muted-foreground mt-1">Suivez les expéditions de marchandises.</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Chargement...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Aucun colis trouvé.</td></tr>
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
