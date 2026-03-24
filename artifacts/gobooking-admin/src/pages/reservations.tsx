import React, { useState } from "react";
import { useReservations } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Search, Filter, ChevronDown, CheckCircle } from "lucide-react";

function buildWALink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("225") ? digits : digits.startsWith("0") && digits.length === 10 ? "225" + digits.slice(1) : "225" + digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

const WA_TEMPLATES = {
  reservationConfirmee: (ref: string, from: string, to: string, date: string, montant: number) =>
    `✅ *GoBooking – Réservation confirmée*\n\nBonjour,\n\nVotre réservation *#${ref}* est confirmée !\n\n🚌 *Trajet :* ${from} → ${to}\n📅 *Date :* ${date}\n💰 *Montant :* ${montant.toLocaleString("fr-CI")} FCFA\n\nPrésentez votre QR code à l'embarquement.\nBon voyage ! 🙏`,
  busEnApproche: (from: string, to: string) =>
    `🚌 *GoBooking – Bus en approche*\n\nBonjour, votre bus *${from} → ${to}* est en approche !\n\nMerci de vous rendre au point d'embarquement. 🏃`,
  rappel: (ref: string, from: string, to: string, date: string) =>
    `⏰ *GoBooking – Rappel de départ*\n\nBonjour,\nRappel : votre bus *${from} → ${to}* part le *${date}*.\nRéf : *#${ref}*\n\nSoyez à l'heure ! 👍`,
};

export default function Reservations() {
  const { data: reservations, isLoading } = useReservations();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = reservations?.filter((r: any) => 
    r.bookingRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Réservations</h2>
          <p className="text-muted-foreground mt-1">Gérez les billets et embarquements de vos clients.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 bg-muted/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Chercher par Réf ou Nom..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
            <Filter size={16} />
            Filtres
            <ChevronDown size={14} className="ml-1 opacity-50" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Réf</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Trajet</th>
                <th className="px-6 py-4">Départ</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Paiement</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Chargement...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Aucune réservation trouvée.</td></tr>
              ) : (
                filtered?.map((res: any) => (
                  <tr key={res.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-primary">#{res.bookingRef}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{res.clientName}</div>
                      <div className="text-xs text-muted-foreground">{res.clientPhone}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {res.tripFrom} <span className="text-muted-foreground">→</span> {res.tripTo}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(res.tripDate + 'T' + res.tripDeparture)}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {formatCurrency(res.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      {res.paymentStatus === 'paid' ? (
                        <Badge variant="success" className="gap-1"><CheckCircle size={10}/> Payé</Badge>
                      ) : (
                        <Badge variant="warning">En attente</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {res.status === 'confirmed' ? <Badge variant="default">Confirmé</Badge> :
                       res.status === 'embarqué' ? <Badge variant="success">Embarqué</Badge> :
                       res.status === 'annulé' ? <Badge variant="danger">Annulé</Badge> :
                       <Badge variant="neutral">{res.status}</Badge>}
                    </td>
                    <td className="px-6 py-4">
                      {res.clientPhone ? (
                        <div className="flex flex-col gap-1">
                          <a
                            href={buildWALink(res.clientPhone, WA_TEMPLATES.reservationConfirmee(res.bookingRef, res.tripFrom, res.tripTo, res.tripDate, res.totalAmount))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: "#25D366" }}
                          >
                            💬 Confirmé
                          </a>
                          <a
                            href={buildWALink(res.clientPhone, WA_TEMPLATES.busEnApproche(res.tripFrom, res.tripTo))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: "#128C7E" }}
                          >
                            🚌 Bus proche
                          </a>
                          <a
                            href={buildWALink(res.clientPhone, WA_TEMPLATES.rappel(res.bookingRef, res.tripFrom, res.tripTo, res.tripDate))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: "#075E54" }}
                          >
                            ⏰ Rappel
                          </a>
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
