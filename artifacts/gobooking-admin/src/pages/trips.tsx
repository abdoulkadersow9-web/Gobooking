import React, { useState, useEffect, useRef } from "react";
import { useTrips, useCreateTrip, useTripAction, useBuses, usePriceGrid, useTripAgents, useTripAuditHistory, useAgencePerformance, useTripsByAgence, useTripWaypoints, useTripSegmentSeats, useRecordTripDelay, useTripDelayHistory, useTransferBus, useTripTransfers } from "@/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Map, Plus, PlayCircle, CheckSquare, Clock, Eye, Info, Bus, Users, ClipboardCheck, AlertTriangle, AlertOctagon, CheckCircle2, Building2, TrendingUp, Filter, X, MapPin, AlertCircle, ArrowRightLeft, History, Search, ChevronDown, Shuffle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getRouteStops, ALL_CI_CITIES, searchCities, TRIP_TYPE_MULTIPLIER } from "@/utils/routeGraph";

export default function Trips() {
  const { data: trips, isLoading } = useTrips();
  const { mutate: tripAction, isPending: actionPending } = useTripAction();
  const { mutate: createTrip, isPending: creating } = useCreateTrip();
  const { data: busesData } = useBuses();
  const { data: priceGridData } = usePriceGrid();
  const { toast } = useToast();
  const { isCompany } = useAuth();

  const [open, setOpen] = useState(false);
  const [agentsTripId, setAgentsTripId] = useState<string | null>(null);
  const { data: tripAgents, isLoading: agentsLoading } = useTripAgents(agentsTripId);
  const [auditTripId, setAuditTripId] = useState<string | null>(null);
  const { data: auditHistory, isLoading: auditLoading } = useTripAuditHistory(auditTripId);
  const [segmentsTripId, setSegmentsTripId] = useState<string | null>(null);
  const { data: waypointsData, isLoading: waypointsLoading } = useTripWaypoints(segmentsTripId);
  const { data: segmentData, isLoading: segmentLoading }    = useTripSegmentSeats(segmentsTripId);
  const [showPerf, setShowPerf] = useState(false);
  const { data: agencePerf, isLoading: perfLoading } = useAgencePerformance();
  const [agenceFilter, setAgenceFilter] = useState<{ id: string; name: string } | null>(null);
  const { data: filteredTrips, isLoading: filteredLoading } = useTripsByAgence(agenceFilter?.id ?? null);

  const [delayTripId, setDelayTripId] = useState<string | null>(null);
  const [delayForm, setDelayForm] = useState({ minutes: 15, reason: "Retard au départ", detail: "" });
  const { data: delayHistoryData } = useTripDelayHistory(delayTripId);
  const { mutate: recordDelay, isPending: delayPending } = useRecordTripDelay();

  const [transferTripId, setTransferTripId] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({ newBusId: "", reason: "Panne mécanique", detail: "", location: "" });
  const { data: transferHistoryData } = useTripTransfers(transferTripId);
  const { mutate: transferBus, isPending: transferPending } = useTransferBus();
  const [form, setForm] = useState({
    from: "",
    to: "",
    date: new Date().toISOString().split("T")[0],
    departureTime: "08:00",
    arrivalTime: "",
    price: "",
    busId: "",
    tripType: "standard" as "standard" | "vip" | "vip_plus",
  });
  const [priceSource, setPriceSource] = useState<"grid" | "manual">("manual");
  const [routeStops, setRouteStops] = useState<string[]>([]);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch,   setToSearch]   = useState("");
  const [fromOpen,   setFromOpen]   = useState(false);
  const [toOpen,     setToOpen]     = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef   = useRef<HTMLDivElement>(null);

  const buses = (busesData ?? []) as any[];
  const grid   = priceGridData?.grid ?? {};

  function getGridPrice(from: string, to: string): number | null {
    if (grid[from]?.[to] != null) return grid[from][to];
    if (grid[to]?.[from] != null) return grid[to][from];
    return null;
  }

  function calcArrivalTime(departureTime: string, segments: number): string {
    if (!departureTime) return "";
    const [h, m] = departureTime.split(":").map(Number);
    const totalMin = h * 60 + m + segments * 120;
    const ah = Math.floor(totalMin / 60) % 24;
    const am = totalMin % 60;
    return `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
  }

  useEffect(() => {
    if (form.from && form.to) {
      const stops = getRouteStops(form.from, form.to);
      setRouteStops(stops);
      const segments = stops.length + 1;
      const arrivalTime = calcArrivalTime(form.departureTime, segments);
      const basePrice = getGridPrice(form.from, form.to);
      if (basePrice != null) {
        const mult = TRIP_TYPE_MULTIPLIER[form.tripType] ?? 1.0;
        setForm((f) => ({ ...f, price: String(Math.round(basePrice * mult)), arrivalTime }));
        setPriceSource("grid");
      } else {
        setForm((f) => ({ ...f, arrivalTime }));
        setPriceSource("manual");
      }
    }
  }, [form.from, form.to, form.tripType, form.departureTime, priceGridData]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) setFromOpen(false);
      if (toRef.current && !toRef.current.contains(e.target as Node)) setToOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      tripType: form.tripType,
      stops: routeStops.map((city, i) => ({ city, order: i + 1 })),
    };
    if (form.busId) payload.busId = form.busId;
    createTrip(payload, {
      onSuccess: () => {
        toast({ title: "Trajet créé", description: `${form.from} → ${form.to} le ${form.date}` });
        setOpen(false);
        setForm({ from: "", to: "", date: new Date().toISOString().split("T")[0], departureTime: "08:00", arrivalTime: "", price: "", busId: "", tripType: "standard" });
        setPriceSource("manual");
        setRouteStops([]);
        setFromSearch(""); setToSearch("");
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message }),
    });
  };

  const inputCls = "w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}>
            <Bus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">Trajets Planifiés</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Gérez vos lignes et départs.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 text-indigo-700 border-indigo-300 hover:bg-indigo-50" onClick={() => setShowPerf(true)}>
            <TrendingUp size={16} /> Agences
          </Button>
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
      </div>

      {/* ── Bannière filtre agence actif ── */}
      {agenceFilter && (
        <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-indigo-700 font-semibold">
            <Filter size={15} />
            Filtré par agence : <span className="text-indigo-900">{agenceFilter.name}</span>
            <span className="text-indigo-400 font-normal">({filteredLoading ? "…" : (filteredTrips ?? []).length} trajet{(filteredTrips ?? []).length > 1 ? "s" : ""})</span>
          </div>
          <button onClick={() => setAgenceFilter(null)} className="text-indigo-500 hover:text-indigo-800 rounded p-0.5">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(agenceFilter ? filteredLoading : isLoading) ? (
          <p className="text-center py-8">Chargement...</p>
        ) : agenceFilter ? (
          /* ── Vue filtrée par agence (liste simplifiée) ── */
          (filteredTrips ?? []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun trajet trouvé pour cette agence.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Trajet</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Heure</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Bus</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredTrips as any[]).map((t: any, i: number) => (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-4 py-2.5 font-semibold text-foreground">{t.from} → {t.to}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(t.date)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.departureTime ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.busName ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {t.status === "scheduled" ? <Badge variant="warning">Prévu</Badge>
                         : t.status === "en_route" ? <Badge variant="accent">En route</Badge>
                         : t.status === "completed" ? <Badge variant="success">Arrivé</Badge>
                         : <Badge variant="default">{t.status}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : trips?.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Aucun trajet planifié.</p>
        ) : (
          trips?.map((trip: any) => {
            const isEnRoute   = trip.status === "en_route";
            const isScheduled = trip.status === "scheduled";
            const isCompleted = trip.status === "completed";
            const borderColor = isEnRoute ? "#059669" : isScheduled ? "#D97706" : "#94A3B8";
            const iconBg      = isEnRoute ? "#DCFCE7" : isScheduled ? "#FEF3C7" : "#F1F5F9";
            const iconColor   = isEnRoute ? "#059669" : isScheduled ? "#D97706" : "#64748B";
            const totalSeats  = trip.totalSeats ?? trip.total_seats ?? 0;
            const occupied    = trip.passengerCount ?? trip.passenger_count ?? 0;
            const available   = Math.max(0, totalSeats - occupied);
            const pct         = totalSeats > 0 ? Math.round((occupied / totalSeats) * 100) : 0;
            const isFull      = available === 0 && totalSeats > 0;
            const isLow       = available > 0 && available <= 5;
            const seatsColor  = isFull ? "#DC2626" : isLow ? "#D97706" : "#059669";

            return (
            <div key={trip.id}
              className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-200"
              style={{ borderLeft: `4px solid ${borderColor}` }}
            >
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: iconBg }}>
                    <Bus size={22} style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">
                        <span className="text-emerald-700">{trip.from}</span>
                        <span className="text-muted-foreground font-normal mx-2">→</span>
                        <span className="text-red-700">{trip.to}</span>
                      </h3>
                      {isScheduled && <Badge variant="warning">Prévu</Badge>}
                      {isEnRoute   && <Badge variant="accent">En route</Badge>}
                      {isCompleted && <Badge variant="success">Terminé</Badge>}
                      {trip.delay_minutes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                          +{trip.delay_minutes} min retard
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        <span className="font-medium">{trip.date}</span>
                        <span className="opacity-50">·</span>
                        <span className="font-bold text-foreground">{trip.departureTime}</span>
                        {trip.arrivalTime && <><span className="opacity-50">→</span><span>{trip.arrivalTime}</span></>}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Bus size={13} />
                        <strong className="text-foreground">{trip.busName ?? "—"}</strong>
                        {trip.busType && <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{trip.busType}</span>}
                      </span>
                      <span className="font-semibold" style={{ color: "#F97316" }}>
                        {formatCurrency(trip.price)} / pax
                      </span>
                    </div>

                    {totalSeats > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[140px]">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: seatsColor }}
                          />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: seatsColor }}>
                          {available} libre{available !== 1 ? "s" : ""} / {totalSeats}
                        </span>
                        {isFull && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">COMPLET</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-border">
                  {!isCompany && isScheduled && (
                    <Button variant="accent" onClick={() => handleAction(trip.id, "start")} disabled={actionPending} size="sm" className="gap-1.5">
                      <PlayCircle size={15} /> Démarrer
                    </Button>
                  )}
                  {!isCompany && isEnRoute && (
                    <Button size="sm" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 gap-1.5" variant="outline" onClick={() => handleAction(trip.id, "end")} disabled={actionPending}>
                      <CheckSquare size={15} /> Arrivé
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAgentsTripId(trip.id)} className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50">
                    <Users size={14} /> Équipe
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAuditTripId(trip.id)} className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50">
                    <ClipboardCheck size={14} /> Contrôles
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSegmentsTripId(trip.id)} className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                    <MapPin size={14} /> Escales
                  </Button>
                  {!isCompany && (isScheduled || isEnRoute) && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setDelayTripId(trip.id); setDelayForm({ minutes: 15, reason: "Retard au départ", detail: "" }); }} className="gap-1.5 text-orange-700 border-orange-200 hover:bg-orange-50">
                        <AlertCircle size={14} /> Retard
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setTransferTripId(trip.id); setTransferForm({ newBusId: "", reason: "Panne mécanique", detail: "", location: "" }); }} className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50">
                        <ArrowRightLeft size={14} /> Transfert
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFromSearch(""); setToSearch(""); setFromOpen(false); setToOpen(false); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus size={18} className="text-blue-600" />
              Programmer un nouveau trajet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* ── Type de départ ── */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Type de départ</label>
              <div className="flex gap-2">
                {(["standard", "vip", "vip_plus"] as const).map((t) => {
                  const labels: Record<string, string> = { standard: "Standard", vip: "VIP", vip_plus: "VIP+" };
                  const colors: Record<string, string> = {
                    standard: form.tripType === t ? "bg-blue-600 text-white border-blue-600" : "border-input text-muted-foreground hover:bg-muted",
                    vip:      form.tripType === t ? "bg-amber-500 text-white border-amber-500" : "border-input text-muted-foreground hover:bg-muted",
                    vip_plus: form.tripType === t ? "bg-violet-600 text-white border-violet-600" : "border-input text-muted-foreground hover:bg-muted",
                  };
                  return (
                    <button key={t} type="button"
                      className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-all ${colors[t]}`}
                      onClick={() => setForm((f) => ({ ...f, tripType: t }))}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Sélection des villes ── */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ville de départ *</label>
                <div ref={fromRef} className="relative">
                  <button type="button"
                    className={`${inputCls} flex items-center justify-between gap-2 text-left`}
                    onClick={() => { setFromOpen((v) => !v); setFromSearch(""); }}
                  >
                    <span className={form.from ? "text-foreground" : "text-muted-foreground"}>
                      {form.from || "Rechercher une ville…"}
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                  {fromOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                        <Search size={14} className="text-muted-foreground shrink-0" />
                        <input autoFocus className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder="Ferké, Bouaké, Man…"
                          value={fromSearch}
                          onChange={(e) => setFromSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {searchCities(fromSearch).filter(c => c !== form.to).map((city) => (
                          <button key={city} type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${form.from === city ? "font-semibold text-blue-600 bg-blue-50" : ""}`}
                            onClick={() => { setForm((f) => ({ ...f, from: city })); setFromOpen(false); setFromSearch(""); }}
                          >{city}</button>
                        ))}
                        {searchCities(fromSearch).length === 0 && (
                          <p className="text-center py-4 text-xs text-muted-foreground">Aucune ville trouvée</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button type="button"
                className="mb-0.5 p-2 rounded-lg border border-input hover:bg-muted transition-colors"
                title="Inverser départ/arrivée"
                onClick={() => setForm((f) => ({ ...f, from: f.to, to: f.from }))}
              >
                <Shuffle size={15} className="text-muted-foreground" />
              </button>

              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ville d'arrivée *</label>
                <div ref={toRef} className="relative">
                  <button type="button"
                    className={`${inputCls} flex items-center justify-between gap-2 text-left`}
                    onClick={() => { setToOpen((v) => !v); setToSearch(""); }}
                  >
                    <span className={form.to ? "text-foreground" : "text-muted-foreground"}>
                      {form.to || "Rechercher une ville…"}
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                  {toOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                        <Search size={14} className="text-muted-foreground shrink-0" />
                        <input autoFocus className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder="Ferké, Man, Korhogo…"
                          value={toSearch}
                          onChange={(e) => setToSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {searchCities(toSearch).filter(c => c !== form.from).map((city) => (
                          <button key={city} type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${form.to === city ? "font-semibold text-red-600 bg-red-50" : ""}`}
                            onClick={() => { setForm((f) => ({ ...f, to: city })); setToOpen(false); setToSearch(""); }}
                          >{city}</button>
                        ))}
                        {searchCities(toSearch).length === 0 && (
                          <p className="text-center py-4 text-xs text-muted-foreground">Aucune ville trouvée</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Visualisation du trajet ── */}
            {form.from && form.to && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin size={12} /> Trajet détecté
                </p>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    {routeStops.length > 0 && <div className="w-0.5 bg-border flex-1 my-1" style={{ minHeight: routeStops.length * 28 }} />}
                    <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  </div>
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="font-semibold text-emerald-700">{form.from}</p>
                    {routeStops.map((stop) => (
                      <p key={stop} className="text-muted-foreground text-xs py-0.5 pl-2 border-l-2 border-blue-200">{stop}</p>
                    ))}
                    <p className="font-semibold text-red-700">{form.to}</p>
                  </div>
                </div>
                {routeStops.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {routeStops.length} escale{routeStops.length > 1 ? "s" : ""} intermédiaire{routeStops.length > 1 ? "s" : ""} — {routeStops.length + 1} segments
                  </p>
                )}
              </div>
            )}

            {/* ── Prix automatique ── */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1.5">
                Tarif (FCFA / passager) *
                {priceSource === "grid" && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-normal text-xs">
                    <Info size={11} /> Grille officielle · {form.tripType === "vip" ? "×1,3" : form.tripType === "vip_plus" ? "×1,6" : "×1,0"}
                  </span>
                )}
              </label>
              <input
                type="number" min="0" step="500"
                className={inputCls}
                placeholder="Ex : 7500"
                value={form.price}
                onChange={(e) => { setForm((f) => ({ ...f, price: e.target.value })); setPriceSource("manual"); }}
              />
              {priceSource === "manual" && form.from && form.to && (
                <p className="text-xs text-amber-600 mt-1">Trajet hors grille — saisir le prix manuellement.</p>
              )}
            </div>

            {/* ── Date et heures ── */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date *</label>
                <input type="date" className={inputCls} value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Départ *</label>
                <input type="time" className={inputCls} value={form.departureTime}
                  onChange={(e) => setForm((f) => ({ ...f, departureTime: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Arrivée estimée
                  {form.from && form.to && <span className="text-blue-500 font-normal ml-1">(auto)</span>}
                </label>
                <input type="time" className={inputCls} value={form.arrivalTime}
                  onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))} />
              </div>
            </div>

            {/* ── Bus assigné ── */}
            {buses.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Bus assigné</label>
                <select className={inputCls} value={form.busId}
                  onChange={(e) => setForm((f) => ({ ...f, busId: e.target.value }))}
                >
                  <option value="">— Aucun bus spécifié —</option>
                  {buses.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.busName} ({b.plateNumber}) · {b.capacity} places</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Récapitulatif ── */}
            {form.from && form.to && form.price && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm">
                <p className="text-blue-800 font-bold">{form.from} → {form.to}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-blue-700">
                    Prix : <strong>{Number(form.price).toLocaleString("fr-FR")} FCFA</strong>
                    {priceSource === "grid" && <span className="ml-1 text-xs text-emerald-600">(grille officielle)</span>}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.tripType === "vip_plus" ? "bg-violet-100 text-violet-700" : form.tripType === "vip" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    {form.tripType === "vip_plus" ? "VIP+" : form.tripType === "vip" ? "VIP" : "Standard"}
                  </span>
                </div>
                {form.arrivalTime && (
                  <p className="text-blue-600 text-xs mt-1">Départ {form.departureTime} → Arrivée {form.arrivalTime}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} isLoading={creating}>Créer le trajet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Équipe en service ── */}
      <Dialog open={!!agentsTripId} onOpenChange={(v) => { if (!v) setAgentsTripId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} className="text-violet-600" />
              Équipe en service
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {agentsLoading ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Chargement…</p>
            ) : !tripAgents || tripAgents.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Aucun agent enregistré sur ce trajet.</p>
            ) : (() => {
              /* Résumé par agence */
              const byAgence = (tripAgents as any[]).reduce((acc: Record<string, number>, a: any) => {
                const key = a.agence_name ?? "Sans agence";
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <div className="space-y-3">
                  {/* Badges de résumé par agence */}
                  {Object.keys(byAgence).length > 1 && (
                    <div className="flex flex-wrap gap-2 pb-1 border-b border-border">
                      {Object.entries(byAgence).map(([agName, count]) => (
                        <span key={agName} className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                          {agName} · {count as number} agent{(count as number) > 1 ? "s" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Liste des agents */}
                  {(tripAgents as any[]).map((a: any, i: number) => (
                    <div key={a.user_id} className="flex items-start justify-between rounded-xl bg-muted/40 border border-border px-4 py-3">
                      <div className="flex items-start gap-3">
                        {a.photo_url ? (
                          <img
                            src={a.photo_url}
                            alt={a.name}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "flex"; }}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-violet-200"
                          />
                        ) : null}
                        <div
                          className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0"
                          style={{ display: a.photo_url ? "none" : "flex" }}
                        >
                          {(a.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground text-sm">{a.name}</p>
                          {a.contact && <p className="text-xs text-muted-foreground">{a.contact}</p>}
                          {a.agence_name && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                              📍 {a.agence_name}{a.agence_city ? ` · ${a.agence_city}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700">
                          {(a.agent_role ?? "—").replace(/_/g, " ")}
                        </span>
                        {a.recorded_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.recorded_at).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentsTripId(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Dialog : Historique des contrôles ── */}
      <Dialog open={!!auditTripId} onOpenChange={(v) => { if (!v) setAuditTripId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-amber-600" />
              Historique des contrôles de départ
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {auditLoading ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Chargement…</p>
            ) : !auditHistory || auditHistory.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Aucun contrôle enregistré pour ce trajet.</p>
            ) : (
              <div className="space-y-4">
                {(auditHistory as any[]).map((log: any, idx: number) => {
                  const hasCritique = log.has_critique;
                  const hasWarnings = log.has_warnings;
                  const isOk        = !hasCritique && !hasWarnings;
                  const borderColor = hasCritique ? "#EF4444" : hasWarnings ? "#F59E0B" : "#22C55E";
                  const bgColor     = hasCritique ? "#FEF2F2" : hasWarnings ? "#FFFBEB" : "#F0FDF4";
                  const StatusIcon  = hasCritique ? AlertOctagon : hasWarnings ? AlertTriangle : CheckCircle2;
                  const statusColor = hasCritique ? "text-red-600" : hasWarnings ? "text-amber-600" : "text-emerald-600";
                  const statusText  = hasCritique ? "Anomalies critiques" : hasWarnings ? "Avertissements" : "Contrôle OK";
                  const items: any[] = log.items ?? [];
                  return (
                    <div key={log.id} style={{ border: `1.5px solid ${borderColor}`, backgroundColor: bgColor, borderRadius: 12 }} className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon size={16} className={statusColor} />
                          <span className={`text-sm font-bold ${statusColor}`}>{statusText}</span>
                          {log.override_confirmed && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 ml-1">
                              Départ forcé
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                          <p className="font-medium">{log.validated_by}</p>
                          <p>{log.validated_at ? new Date(log.validated_at).toLocaleString("fr-CI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                      </div>

                      {/* Résumé financier */}
                      <div className="flex gap-4 mb-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Recettes : </span>
                          <span className="font-semibold text-emerald-700">{(log.total_revenue ?? 0).toLocaleString()} FCFA</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net : </span>
                          <span className={`font-semibold ${(log.net_balance ?? 0) < 0 ? "text-red-600" : "text-foreground"}`}>{(log.net_balance ?? 0).toLocaleString()} FCFA</span>
                        </div>
                      </div>

                      {/* Items */}
                      {items.length > 0 ? (
                        <div className="space-y-2">
                          {items.map((item: any, j: number) => {
                            const iBg  = item.priority === "critique" ? "#FEE2E2" : item.priority === "moyen" ? "#FEF3C7" : "#F1F5F9";
                            const iFg  = item.priority === "critique" ? "#B91C1C" : item.priority === "moyen" ? "#92400E" : "#64748B";
                            const iLbl = item.priority === "critique" ? "CRITIQUE" : item.priority === "moyen" ? "MOYEN" : "INFO";
                            const dotColor = item.level === "error" ? "#EF4444" : item.level === "warning" ? "#F59E0B" : "#22C55E";
                            return (
                              <div key={j} className="flex gap-3 items-start rounded-lg bg-white/70 px-3 py-2">
                                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0, marginTop: 5 }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span style={{ background: iBg, color: iFg }} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide">{iLbl}</span>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item.category}</span>
                                  </div>
                                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                                  {item.recommendation && <p className="text-[11px] mt-0.5 italic" style={{ color: iFg }}>→ {item.recommendation}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Aucune anomalie relevée lors de ce contrôle.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditTripId(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Dialog : Escales & Segments ── */}
      <Dialog open={!!segmentsTripId} onOpenChange={(v) => { if (!v) setSegmentsTripId(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-emerald-600" />
              Escales &amp; Disponibilité par segment
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 font-normal">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Temps réel
              </span>
            </DialogTitle>
          </DialogHeader>
          {(waypointsLoading || segmentLoading) ? (
            <div className="py-8 text-center text-muted-foreground">Chargement…</div>
          ) : (
            <div className="space-y-6">

              {/* ── Bilan global des places libérées ── */}
              {(waypointsData?.totalSeatsFreed ?? 0) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {waypointsData.totalSeatsFreed}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      {waypointsData.totalSeatsFreed} place{waypointsData.totalSeatsFreed !== 1 ? "s" : ""} libérée{waypointsData.totalSeatsFreed !== 1 ? "s" : ""} par rotation
                    </p>
                    <p className="text-xs text-emerald-600">Disponibles pour de nouvelles réservations sur les segments suivants</p>
                  </div>
                </div>
              )}

              {/* ── Timeline des escales ── */}
              {waypointsData?.waypoints?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trajet &amp; contrôle par escale</p>
                  <ol className="relative border-l-2 border-emerald-200 ml-4 space-y-5">
                    {(waypointsData.waypoints as any[]).map((wp: any) => (
                      <li key={wp.id} className="ml-5">
                        <span className={`absolute -left-[9px] w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold
                          ${wp.isArrived ? "bg-emerald-600" : wp.isOrigin ? "bg-blue-600" : wp.isDestination ? "bg-purple-600" : "bg-slate-300"}`}>
                          {wp.isArrived ? "✓" : wp.isOrigin ? "D" : wp.isDestination ? "A" : "•"}
                        </span>

                        {/* Ville + heure */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-semibold text-sm">{wp.city}</span>
                          {wp.scheduledTime && <span className="text-xs text-muted-foreground">{wp.scheduledTime}</span>}
                          {wp.isArrived && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ Arrivé
                            </span>
                          )}
                        </div>

                        {/* Stats passagers */}
                        <div className="flex flex-wrap gap-1.5">
                          {wp.passengersBoarding > 0 && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                              +{wp.passengersBoarding} montent
                            </span>
                          )}
                          {wp.passengersAlighting > 0 && (
                            <span className={`text-xs rounded-full px-2 py-0.5 border ${
                              wp.isArrived
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              -{wp.passengersAlighting} {wp.isArrived ? "descendus" : "descendent"}
                            </span>
                          )}
                          {wp.isArrived && wp.seatsFreedHere > 0 && (
                            <span className="text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5 font-semibold">
                              {wp.seatsFreedHere} place{wp.seatsFreedHere !== 1 ? "s" : ""} libérée{wp.seatsFreedHere !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!wp.isArrived && wp.passengersAlighting > 0 && (
                            <span className="text-xs text-muted-foreground italic">
                              → {wp.passengersAlighting} libération{wp.passengersAlighting !== 1 ? "s" : ""} prévue{wp.passengersAlighting !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* ── Disponibilité par segment ── */}
              {segmentData?.segments?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Places disponibles par segment</p>
                  <div className="space-y-3">
                    {(segmentData.segments as any[]).map((seg: any, i: number) => {
                      const pct = seg.totalSeats > 0 ? (seg.occupied / seg.totalSeats) * 100 : 0;
                      const isFull = seg.available === 0;
                      const isLow  = seg.available > 0 && seg.available < 5;
                      const barColor  = isFull ? "bg-red-500"   : isLow ? "bg-amber-500"   : "bg-emerald-500";
                      const textColor = isFull ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600";
                      const bgCard    = isFull ? "bg-red-50 border-red-100" : isLow ? "bg-amber-50 border-amber-100" : "bg-muted/40 border-transparent";
                      return (
                        <div key={i} className={`rounded-lg p-3 border ${bgCard}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">{seg.from}</span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="font-medium text-sm">{seg.to}</span>
                            <div className="ml-auto flex items-center gap-2">
                              {isFull && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">COMPLET</span>}
                              {isLow  && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">PRESQUE PLEIN</span>}
                              <span className={`text-sm font-bold ${textColor}`}>{seg.available} libre{seg.available !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{seg.occupied} occupée{seg.occupied !== 1 ? "s" : ""} / {seg.totalSeats} total</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(!waypointsData?.waypoints?.length && !segmentData?.segments?.length) && (
                <p className="text-center text-muted-foreground py-4">Aucune escale définie pour ce trajet.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentsTripId(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Performance par agence ── */}
      <Dialog open={showPerf} onOpenChange={setShowPerf}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              Performance par agence
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {perfLoading ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Chargement…</p>
            ) : !agencePerf || agencePerf.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Aucune agence configurée.</p>
            ) : (
              <div className="space-y-3">
                {(agencePerf as any[]).map((ag: any) => {
                  const tripsCount   = Number(ag.trips_count   ?? 0);
                  const agentsCount  = Number(ag.agents_count  ?? 0);
                  const opsCount     = Number(ag.operations_count ?? 0);
                  const hasActivity  = tripsCount > 0;
                  const roles: string[] = (ag.roles ?? []).filter(Boolean);
                  return (
                    <div key={ag.agence_id} className={`rounded-xl border px-4 py-3 ${hasActivity ? "bg-white border-indigo-200" : "bg-muted/30 border-border"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${hasActivity ? "bg-indigo-100" : "bg-muted"}`}>
                            <Building2 size={16} className={hasActivity ? "text-indigo-700" : "text-muted-foreground"} />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{ag.agence_name ?? "—"}</p>
                            {ag.agence_city && <p className="text-xs text-muted-foreground">📍 {ag.agence_city}</p>}
                            {roles.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {roles.map((r: string) => (
                                  <span key={r} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                                    {r.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {hasActivity ? (
                            <>
                              <div className="flex gap-3 text-xs">
                                <div className="text-center">
                                  <p className="font-bold text-indigo-700 text-base leading-tight">{tripsCount}</p>
                                  <p className="text-muted-foreground">trajet{tripsCount > 1 ? "s" : ""}</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-bold text-violet-700 text-base leading-tight">{agentsCount}</p>
                                  <p className="text-muted-foreground">agent{agentsCount > 1 ? "s" : ""}</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-bold text-emerald-700 text-base leading-tight">{opsCount}</p>
                                  <p className="text-muted-foreground">opérations</p>
                                </div>
                              </div>
                              {ag.last_trip_date && (
                                <p className="text-[10px] text-muted-foreground">Dernier trajet : {formatDate(ag.last_trip_date)}</p>
                              )}
                              <Button
                                variant="outline" size="sm"
                                className="mt-1 text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                                onClick={() => {
                                  setAgenceFilter({ id: ag.agence_id, name: ag.agence_name });
                                  setShowPerf(false);
                                }}
                              >
                                <Filter size={12} className="mr-1" /> Filtrer les trajets
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Aucune activité enregistrée</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPerf(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Signaler un retard ── */}
      <Dialog open={!!delayTripId} onOpenChange={(v) => { if (!v) setDelayTripId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle size={18} className="text-orange-500" />
              Signaler un retard
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Historique des retards */}
            {delayHistoryData && (delayHistoryData.delayMinutes ?? 0) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <History size={14} className="text-orange-600" />
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Retard cumulé actuel</p>
                </div>
                <p className="text-lg font-bold text-orange-700">
                  +{delayHistoryData.delayMinutes} min
                  {delayHistoryData.estimatedDeparture && (
                    <span className="text-sm font-normal ml-2 text-orange-600">— départ estimé : {delayHistoryData.estimatedDeparture}</span>
                  )}
                </p>
                {(delayHistoryData.history ?? []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(delayHistoryData.history as any[]).map((h: any, i: number) => (
                      <p key={i} className="text-xs text-orange-600">
                        {new Date(h.at).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" })} — +{h.minutes}min : {h.reason}
                        {h.detail && <span className="text-orange-400"> ({h.detail})</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Durée du retard supplémentaire (minutes) *</label>
              <input
                type="number" min="1" max="480"
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={delayForm.minutes}
                onChange={(e) => setDelayForm(f => ({ ...f, minutes: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Motif *</label>
              <select
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={delayForm.reason}
                onChange={(e) => setDelayForm(f => ({ ...f, reason: e.target.value }))}
              >
                <option>Retard au départ</option>
                <option>Ralentissement sur route</option>
                <option>Arrêt prolongé en escale</option>
                <option>Incident opérationnel</option>
                <option>Contrôle de gendarmerie</option>
                <option>Travaux / déviation</option>
                <option>Problème technique mineur</option>
                <option>Attente passager</option>
                <option>Autre</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Détail complémentaire</label>
              <textarea
                rows={2}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Informations supplémentaires (optionnel)…"
                value={delayForm.detail}
                onChange={(e) => setDelayForm(f => ({ ...f, detail: e.target.value }))}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              Un SMS sera automatiquement envoyé à tous les passagers confirmés de ce trajet.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayTripId(null)}>Annuler</Button>
            <Button
              disabled={delayPending || !delayForm.minutes || !delayForm.reason}
              style={{ backgroundColor: "#EA580C", color: "white" }}
              onClick={() => {
                if (!delayTripId) return;
                recordDelay(
                  { tripId: delayTripId, data: { minutes: delayForm.minutes, reason: delayForm.reason, detail: delayForm.detail } },
                  {
                    onSuccess: (res: any) => {
                      toast({ title: "Retard enregistré", description: `+${delayForm.minutes} min — départ estimé : ${res.estimatedDeparture}. ${res.passengersSmsCount} SMS envoyés.` });
                      setDelayTripId(null);
                    },
                    onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message }),
                  }
                );
              }}
            >
              {delayPending ? "Envoi…" : "Confirmer le retard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Transfert de car à car ── */}
      <Dialog open={!!transferTripId} onOpenChange={(v) => { if (!v) setTransferTripId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-red-500" />
              Transfert de car à car
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Historique des transferts */}
            {(transferHistoryData?.transfers ?? []).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <History size={14} className="text-red-600" />
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Transferts précédents</p>
                </div>
                {(transferHistoryData!.transfers as any[]).map((t: any, i: number) => (
                  <div key={i} className="text-xs text-red-600 mb-1 pb-1 border-b border-red-100 last:border-0">
                    <span className="font-semibold">{t.old_bus_name ?? "—"}</span> → <span className="font-semibold">{t.new_bus_name ?? "—"}</span>
                    <span className="ml-2 text-red-400">({t.reason})</span>
                    {t.transfer_location && <span className="ml-1">@ {t.transfer_location}</span>}
                    <span className="ml-2 text-red-400">{new Date(t.transferred_at).toLocaleString("fr-CI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="ml-2">{t.passengers_count} pax</span>
                    {t.created_by_name && <span className="ml-2 text-red-400">par {t.created_by_name}</span>}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nouveau car de remplacement *</label>
              <select
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={transferForm.newBusId}
                onChange={(e) => setTransferForm(f => ({ ...f, newBusId: e.target.value }))}
              >
                <option value="">— Sélectionner un car disponible —</option>
                {buses.filter((b: any) => !b.currentTripId).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.busName} — {b.plateNumber} ({b.busType})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Motif du transfert *</label>
              <select
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={transferForm.reason}
                onChange={(e) => setTransferForm(f => ({ ...f, reason: e.target.value }))}
              >
                <option>Panne mécanique</option>
                <option>Accident de circulation</option>
                <option>Force majeure</option>
                <option>Panne de climatisation</option>
                <option>Pneu éclaté</option>
                <option>Problème moteur</option>
                <option>Incendie / sécurité</option>
                <option>Autre</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lieu du transfert</label>
              <input
                type="text"
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ex : Km 47 route de Yamoussoukro, Escale de Toumodi…"
                value={transferForm.location}
                onChange={(e) => setTransferForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Détail de l'incident</label>
              <textarea
                rows={2}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Description de l'incident (optionnel)…"
                value={transferForm.detail}
                onChange={(e) => setTransferForm(f => ({ ...f, detail: e.target.value }))}
              />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              <strong>Important :</strong> Toutes les réservations, sièges et bagages seront automatiquement transférés vers le nouveau car. Un SMS sera envoyé à chaque passager. L'ancien car sera marqué hors service.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTripId(null)}>Annuler</Button>
            <Button
              disabled={transferPending || !transferForm.newBusId || !transferForm.reason}
              style={{ backgroundColor: "#DC2626", color: "white" }}
              onClick={() => {
                if (!transferTripId) return;
                transferBus(
                  {
                    tripId: transferTripId,
                    data: { newBusId: transferForm.newBusId, reason: transferForm.reason, detail: transferForm.detail, location: transferForm.location },
                  },
                  {
                    onSuccess: (res: any) => {
                      toast({ title: "Transfert effectué", description: `Nouveau car : ${res.newBus?.name ?? ""}. ${res.passengersSmsCount} passagers notifiés.` });
                      setTransferTripId(null);
                    },
                    onError: (err: any) => toast({ variant: "destructive", title: "Erreur", description: err.message }),
                  }
                );
              }}
            >
              {transferPending ? "Transfert en cours…" : "Confirmer le transfert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
