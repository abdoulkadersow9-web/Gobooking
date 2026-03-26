import React from "react";
import { useInvoices, useGenerateInvoice } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileText, Download, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Invoices() {
  const { data: invoices, isLoading } = useInvoices();
  const { mutate: generate, isPending } = useGenerateInvoice();
  const { toast } = useToast();

  const handleGenerate = () => {
    generate(undefined, {
      onSuccess: () => toast({ title: "Facture générée", description: "La facture du mois a été mise à jour." }),
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #0B3C5D, #1E5B8A)" }}>
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">Factures & Reversements</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Consultez vos factures de commission mensuelles.</p>
          </div>
        </div>
        <Button onClick={handleGenerate} isLoading={isPending} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary/20">
          Générer la facture du mois
        </Button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Période</th>
                <th className="px-6 py-4">Transactions</th>
                <th className="px-6 py-4">Brut</th>
                <th className="px-6 py-4 text-destructive">Commission</th>
                <th className="px-6 py-4 text-success font-bold">Net à reverser</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Chargement...</td></tr>
              ) : invoices?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-semibold text-foreground">Aucune facture</p>
                    <p className="text-muted-foreground">Vous n'avez pas encore de factures générées.</p>
                  </td>
                </tr>
              ) : (
                invoices?.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-5 font-bold text-foreground">{inv.period}</td>
                    <td className="px-6 py-5">{inv.transactionCount}</td>
                    <td className="px-6 py-5 font-medium">{formatCurrency(inv.totalGross)}</td>
                    <td className="px-6 py-5 text-destructive font-medium">- {formatCurrency(inv.totalCommission)}</td>
                    <td className="px-6 py-5 font-bold text-success text-base">{formatCurrency(inv.totalNet)}</td>
                    <td className="px-6 py-5">
                      {inv.status === 'paid' ? (
                        <Badge variant="success" className="gap-1"><CheckCircle size={12}/> Payée</Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1"><Clock size={12}/> En attente</Badge>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                        <Download size={16} className="mr-2" /> PDF
                      </Button>
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
