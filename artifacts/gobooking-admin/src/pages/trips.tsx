import React, { useState, useEffect } from "react";
import { useTrips, useCreateTrip, useTripAction, useBuses, usePriceGrid } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Map, Plus, PlayCircle, CheckSquare, Clock, Eye, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Trips() {
  const { data: trips, isLoading } = useTrips();
  const { mutate: tripAction, isPending: actionPending } = useTripAction();
  const { mutate: createTrip, isPending: creating } = useCreateTrip();
  const { data: busesData } = useBuses();
  const { data: priceGridData } = usePriceGrid();
  const { toast } = useToast();
  const { isCompany } = useAuth();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from: "",
    to: "",
    date: new Date().toISOString().split("T")[0],
    departureTime: "08:00",
    arrivalTime: "12:00",
    price: "",
    busId: "",
  });
  const [priceSource, setPriceSource] = useState<"grid" | "manual">("manual");

  const buses = (busesData ?? []) as any[];
  const cities = priceGridData?.cities ?? [];
  const grid   = priceGridData?.grid ?? {};

  function getGridPrice(from: string, to: string): number | null {
    if (grid[from]?.[to] != null) return grid[from][to];
    if (grid[to]?.[from] != null) return grid[to][from];
    return null;
  }

  useEffect(() => {
    if (form.from && form.to) {
      const p = getGridPrice(form.from, form.to);
      if (p != null) {
        setForm((f) => ({ ...f, price: String(p) }));
        setPriceSource("grid");
      } else {
        setPriceSource("manual");
      }
    }
  }, [form.from, form.to, priceGridData]);

  const handleAction = (id: string, action: "start" | "end") => {
    tripAction({ id, action }, {
      onSuccess: () => toast({ title: "Succès", description: "Le trajet a été mis à jour." }),
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message }),
    });
  };

  const handleSubmit = () => {
    if (!form.from || !form.to || !form.date || !form.departureTime || !form.price) {
      toast({ variant: "destructive", title: "Champs manquants", description: "Veuillez remplir tous les champs obligatoires." });
      return;
    }
    const payload: any = {
      from: form.from,
      to: form.to,
      date: form.date,
      departureTime: form.departureTime,
      arrivalTime: form.arrivalTime,
      price: Number(form.price),
    };
    if (form.busId) payload.busId = form.busId;
    createTrip(payload, {
      onSuccess: () => {
        toast({ title: "Trajet créé", description: `${form.from} → ${form.to} le ${form.date}` });
        setOpen(false);
        setForm({ from: "", to: "", date: new Date().toISOString().split("T")[0], departureTime: "08:00", arrivalTime: "12:00", price: "", busId: "" });
        setPriceSource("manual");
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message }),
    });
  };

  const inputCls = "w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

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
          <Button className="gap-2" onClick={() => setOpen(true)}>
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
                    {trip.status === "scheduled" ? <Badge variant="warning">Prévu</Badge> :
                     trip.status === "en_route"  ? <Badge variant="accent">En route</Badge> :
                     <Badge variant="success">Terminé</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={14}/> {trip.date} • {trip.departureTime}</span>
                    <span>Bus: <strong className="text-foreground">{trip.busName}</strong> ({trip.busType})</span>
                    <span>Tarif: <strong className="text-primary">{formatCurrency(trip.price)}</strong> / passager</span>
                  </div>
                </div>
              </div>

              {!isCompany && (
                <div className="flex items-center gap-3 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-border">
                  {trip.status === "scheduled" && (
                    <Button variant="accent" onClick={() => handleAction(trip.id, "start")} disabled={actionPending} className="w-full md:w-auto">
                      <PlayCircle size={16} className="mr-2" /> Démarrer
                    </Button>
                  )}
                  {trip.status === "en_route" && (
                    <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 w-full md:w-auto" onClick={() => handleAction(trip.id, "end")} disabled={actionPending}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Programmer un nouveau trajet</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ville de départ *</label>
                <select
                  className={inputCls}
                  value={form.from}
                  onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                >
                  <option value="">Sélectionner…</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ville d'arrivée *</label>
                <select
                  className={inputCls}
                  value={form.to}
                  onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                >
                  <option value="">Sélectionner…</option>
                  {cities.filter((c) => c !== form.from).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Tarif de la ligne (FCFA / passager) *
                {priceSource === "grid" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-normal">
                    <Info size={12} /> Grille officielle CI
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                step="500"
                className={inputCls}
                placeholder="Ex : 2500"
                value={form.price}
                onChange={(e) => { setForm((f) => ({ ...f, price: e.target.value })); setPriceSource("manual"); }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Prix unitaire par passager — ex : Abidjan → Bouaké = 2 500 FCFA
              </p>
              {form.from && form.to && getGridPrice(form.from, form.to) == null && (
                <p className="text-xs text-amber-600 mt-1">Trajet hors grille — saisir le prix manuellement.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date du départ *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Heure de départ *</label>
                <input
                  type="time"
                  className={inputCls}
                  value={form.departureTime}
                  onChange={(e) => setForm((f) => ({ ...f, departureTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Heure d'arrivée estimée</label>
              <input
                type="time"
                className={inputCls}
                value={form.arrivalTime}
                onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))}
              />
            </div>

            {buses.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Bus assigné</label>
                <select
                  className={inputCls}
                  value={form.busId}
                  onChange={(e) => setForm((f) => ({ ...f, busId: e.target.value }))}
                >
                  <option value="">— Aucun bus spécifié —</option>
                  {buses.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.busName} ({b.plateNumber}) · {b.capacity} places</option>
                  ))}
                </select>
              </div>
            )}

            {form.from && form.to && form.price && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
                <p className="text-emerald-800 font-semibold">{form.from} → {form.to}</p>
                <p className="text-emerald-700 mt-0.5">
                  Prix unitaire : <strong>{Number(form.price).toLocaleString("fr-FR")} FCFA</strong>
                  {priceSource === "grid" && <span className="ml-2 text-xs text-emerald-600">(grille officielle)</span>}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} isLoading={creating}>Créer le trajet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
