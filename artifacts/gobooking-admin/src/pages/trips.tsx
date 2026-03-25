import React, { useState } from "react";
import { useTrips, useCreateTrip, useTripAction } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Map, Plus, PlayCircle, CheckSquare, Clock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Trips() {
  const { data: trips, isLoading } = useTrips();
  const { mutate: tripAction, isPending: actionPending } = useTripAction();
  const { toast } = useToast();
  const { isCompany } = useAuth();

  const handleAction = (id: string, action: 'start' | 'end') => {
    tripAction({ id, action }, {
      onSuccess: () => toast({ title: "Succès", description: `Le trajet a été mis à jour.` }),
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Trajets Planifiés</h2>
          <p className="text-muted-foreground mt-1">Gérez vos lignes et départs.</p>
        </div>
        {isCompany ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            <Eye size={14} /> Lecture seule
          </span>
        ) : (
          <Button className="gap-2">
            <Plus size={18} /> Programmer un trajet
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <p className="text-center py-8">Chargement...</p>
        ) : trips?.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Aucun trajet planifié.</p>
        ) : (
          trips?.map((trip: any) => (
            <div key={trip.id} className="bg-card rounded-2xl p-5 border border-border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all">
              
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-muted-foreground shrink-0">
                  <Map size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-foreground">{trip.from} <span className="text-muted-foreground font-normal mx-1">→</span> {trip.to}</h3>
                    {trip.status === 'scheduled' ? <Badge variant="warning">Prévu</Badge> : 
                     trip.status === 'en_route' ? <Badge variant="accent">En route</Badge> : 
                     <Badge variant="success">Terminé</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={14}/> {trip.date} • {trip.departureTime}</span>
                    <span>Bus: <strong className="text-foreground">{trip.busName}</strong> ({trip.busType})</span>
                    <span>Prix: <strong className="text-primary">{formatCurrency(trip.price)}</strong></span>
                  </div>
                </div>
              </div>

              {!isCompany && (
                <div className="flex items-center gap-3 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-border">
                  {trip.status === 'scheduled' && (
                    <Button variant="accent" onClick={() => handleAction(trip.id, 'start')} disabled={actionPending} className="w-full md:w-auto">
                      <PlayCircle size={16} className="mr-2" /> Démarrer
                    </Button>
                  )}
                  {trip.status === 'en_route' && (
                    <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 w-full md:w-auto" onClick={() => handleAction(trip.id, 'end')} disabled={actionPending}>
                      <CheckSquare size={16} className="mr-2" /> Marquer Arrivé
                    </Button>
                  )}
                  <Button variant="ghost" size="icon">
                    <span className="sr-only">Details</span>
                    &middot;&middot;&middot;
                  </Button>
                </div>
              )}

            </div>
          ))
        )}
      </div>
    </div>
  );
}
