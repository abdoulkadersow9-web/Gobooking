import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
  Modal, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/context/AuthContext";
import AlertBanner from "@/components/AlertBanner";
import { useRealtime, useTripLive } from "@/hooks/useRealtime";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import OfflineBanner from "@/components/OfflineBanner";
import {
  generateBordereauRoute,
  computeAudit,
  type BordereauData as PdfBordereauData,
  type AuditItem,
} from "@/utils/bordereau-pdf";
import { getRouteStops, getRouteAllCities, searchCities, ALL_CI_CITIES } from "@/utils/routeGraph";

const G       = "#D97706";
const G_DARK  = "#92400E";
const G_LIGHT = "#FEF3C7";

interface Trip {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  price: number;
  availableSeats?: number;
  guichetSeats?: number;
  onlineSeats?: number;
  date: string;
}

interface BusFleet {
  id: string;
  busName: string;
  plateNumber: string;
  busType: string;
  capacity: number;
  logisticStatus: string;
}

interface Confirmed {
  bookingRef: string;
  total: number;
  passengerName: string;
  passengerPhone: string;
  seatCount: number;
  trip: Trip;
  paymentLabel: string;
  isSP?: boolean;
  seatNumber?: string;
}

/* ── Impression Départ interfaces ── */
interface TripSummary {
  id: string; from: string; to: string; date: string;
  departureTime: string; busName: string; status: string;
  totalPassengers: number; boardedCount: number; absentCount: number;
  bagageCount: number; colisCount: number; expenseTotal: number;
  isValidated: boolean;
}
interface Expense { id: string; type: string; amount: number; description: string | null; }
interface BordereauFull {
  trip: { id: string; from: string; to: string; date: string; departureTime: string; busName: string; status: string };
  passengers: any[]; boarded: any[]; absents: any[];
  bagages: any[]; colis: any[]; expenses: Expense[];
  agents?: Array<{ user_id: number; agent_role: string; name: string; contact: string; recorded_at: string }>;
  summary: {
    totalPassengers: number; boardedCount: number; absentCount: number;
    bagageCount: number; colisCount: number;
    totalPassengerRevenue: number; totalBagageRevenue: number;
    totalColisRevenue: number; totalExpenses: number; netRevenue: number;
  };
}
const IMP_EXPENSE_TYPES = [
  { key: "péage",     label: "Péage",          icon: "map-pin"        as const },
  { key: "ration",    label: "Ration équipage", icon: "coffee"         as const },
  { key: "carburant", label: "Carburant",       icon: "droplet"        as const },
  { key: "entretien", label: "Entretien",       icon: "tool"           as const },
  { key: "autre",     label: "Autre",           icon: "more-horizontal" as const },
];

const PAYMENT_METHODS = [
  { id: "cash",   label: "Espèces",      icon: "cash-outline" as const },
  { id: "orange", label: "Orange Money", icon: "phone-portrait-outline" as const },
  { id: "mtn",    label: "MTN Money",    icon: "phone-portrait-outline" as const },
  { id: "wave",   label: "Wave",         icon: "phone-portrait-outline" as const },
];

const CITIES = [
  "Abidjan", "Abengourou", "Aboisso", "Adzopé", "Agboville", "Agnibilékrou",
  "Alépé", "Anyama", "Bangolo", "Bettié", "Biankouma", "Bingerville",
  "Bocanda", "Bondoukou", "Bongouanou", "Bonoua", "Bouaflé", "Bouaké",
  "Bouna", "Boundiali", "Dabou", "Daloa", "Danané", "Daoukro",
  "Didiévi", "Dimbokro", "Divo", "Duékoué", "Ferkessédougou", "Fresco",
  "Gagnoa", "Grand-Bassam", "Grand-Béréby", "Grand-Lahou", "Guiglo", "Issia",
  "Jacqueville", "Katiola", "Kong", "Korhogo", "Lakota", "Man",
  "Mankono", "Mbahiakro", "Méagui", "Minignan", "Niakaramandougou", "Niablé",
  "Odienné", "Oumé", "San-Pédro", "Sassandra", "Séguéla", "Sikensi",
  "Sinfra", "Sinématiali", "Soubré", "Tabou", "Taï", "Tengréla",
  "Tiassalé", "Tiébissou", "Touba", "Toulepleu", "Toumodi", "Vavoua",
  "Yamoussoukro", "Zouan-Hounien", "Zuénoula",
];

function buildTicketHtml(c: Confirmed): string {
  const qrData = encodeURIComponent(c.bookingRef);
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
  const isOffline = c.bookingRef.startsWith("OFFLINE-");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Billet GoBooking</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    background: #fff;
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  .ticket {
    width: 80mm;
    margin: 0 auto;
    padding: 12px;
    border: 2px dashed #D97706;
    border-radius: 8px;
    text-align: center;
  }
  .header { border-bottom: 1px dashed #ccc; padding-bottom: 8px; margin-bottom: 10px; }
  .logo { font-size: 20px; font-weight: bold; color: #92400E; letter-spacing: 2px; }
  .sub  { font-size: 10px; color: #6B7280; margin-top: 3px; }
  .route { font-size: 18px; font-weight: bold; color: #111; margin: 10px 0 4px; }
  .arrow { color: #D97706; }
  .ref  {
    font-size: 15px; font-weight: bold; color: #D97706;
    letter-spacing: 1px; margin: 8px 0;
    padding: 7px 10px; background: #FEF3C7;
    border-radius: 4px; border: 1px dashed #FCD34D;
    display: inline-block; width: 100%;
  }
  .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
  table { width: 100%; font-size: 11px; border-collapse: collapse; text-align: left; }
  td { padding: 5px 2px; vertical-align: top; }
  td:first-child { color: #6B7280; width: 42%; }
  td:last-child { color: #111; font-weight: 600; text-align: right; }
  .total-row td { font-size: 14px; font-weight: bold; color: #D97706; padding-top: 10px; }
  .qr-section { margin: 14px 0 6px; }
  .qr-section img {
    width: 160px;
    height: 160px;
    display: block;
    margin: 0 auto;
  }
  .qr-label { font-size: 9px; color: #9CA3AF; margin-top: 5px; }
  .offline-badge { background: #FEF3C7; color: #92400E; font-size: 9px; padding: 4px 8px; border-radius: 3px; margin: 6px 0; display: inline-block; }
  .footer { font-size: 9px; color: #9CA3AF; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ccc; line-height: 1.6; }
  @media print {
    body {
      width: 80mm;
      margin: 0;
      padding: 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .ticket { border: 2px dashed #D97706; }
    .qr-section img { width: 160px; height: 160px; }
  }
</style>
</head>
<body>
<div class="ticket">
  <div class="header">
    <div class="logo">GoBooking</div>
    <div class="sub">Billet de transport · Côte d'Ivoire</div>
  </div>

  <div class="route">${c.trip.from} <span class="arrow">→</span> ${c.trip.to}</div>
  <div class="ref">${c.bookingRef}</div>

  <table>
    <tr><td>Passager</td><td>${c.passengerName}</td></tr>
    <tr><td>Téléphone</td><td>${c.passengerPhone}</td></tr>
    <tr><td>Date</td><td>${c.trip.date}</td></tr>
    <tr><td>Départ</td><td>${c.trip.departureTime}</td></tr>
    <tr><td>Places</td><td>${c.seatCount} siège(s)</td></tr>
    <tr><td>Paiement</td><td>${c.paymentLabel}</td></tr>
  </table>

  <div class="divider"></div>
  <table>
    <tr class="total-row">
      <td>TOTAL</td>
      <td>${c.total.toLocaleString("fr-FR")} FCFA</td>
    </tr>
  </table>

  ${isOffline ? '<div class="offline-badge">Billet hors ligne — sera synchronisé</div>' : ""}

  <div class="qr-section">
    <img src="${qrUrl}" alt="QR Code ${c.bookingRef}" />
    <div class="qr-label">Scannez pour valider l'embarquement</div>
  </div>

  <div class="footer">
    Émis le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}<br/>
    Conservez ce billet jusqu'à destination.<br/>
    Merci de voyager avec GoBooking !
  </div>
</div>
</body>
</html>`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TicketsScreen() {
  const { user, token, logout, logoutIfActiveToken } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  /* ── Module 6 — Temps réel ── */
  const { preDepartureAlerts, validationAlerts, agentRole: realtimeRole } = useRealtime(token);

  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState<"vente" | "depart" | "impression">("vente");

  /* ── Vente state ── */
  const [trips, setTrips]           = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [confirmed, setConfirmed]   = useState<Confirmed | null>(null);

  /* ── SP state ── */
  const [isSP, setIsSP] = useState(false);

  /* ── Créer départ state ── */
  const [fleetBuses, setFleetBuses]         = useState<BusFleet[]>([]);
  const [loadingBuses, setLoadingBuses]     = useState(false);
  const [selectedBus, setSelectedBus]       = useState<BusFleet | null>(null);
  const [dFrom, setDFrom]                   = useState("");
  const [dTo, setDTo]                       = useState("");
  const [dDate, setDDate]                   = useState(todayStr());
  const [dHeure, setDHeure]                 = useState("08:00");
  const [dTripType, setDTripType]           = useState<"standard" | "vip">("standard");
  const [dRouteStops, setDRouteStops]       = useState<string[]>([]);
  const [dAutoPrice, setDAutoPrice]         = useState<number | null>(null);
  const [dPriceOverride, setDPriceOverride] = useState("");
  const [dPriceLoading, setDPriceLoading]   = useState(false);
  const [dGuichet, setDGuichet]             = useState("20");
  const [dOnline, setDOnline]               = useState("24");
  const [dChauffeur, setDChauffeur]         = useState("");
  const [dAgentRoute, setDAgentRoute]       = useState("");
  const [creatingDep, setCreatingDep]       = useState(false);
  const [depSuccess, setDepSuccess]         = useState<string | null>(null);
  /* ── City picker modal ── */
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityPickerFor, setCityPickerFor]   = useState<"from" | "to">("from");
  const [citySearch, setCitySearch]         = useState("");

  /* ── Impression Départ state ── */
  const [impTrips, setImpTrips]           = useState<TripSummary[]>([]);
  const [impLoading, setImpLoading]       = useState(false);
  const [impRefreshing, setImpRefr]       = useState(false);
  const [impSelTrip, setImpSelTrip]       = useState<TripSummary | null>(null);
  // Polling live stats pour le trajet sélectionné (Impression tab)
  const liveStats = useTripLive(impSelTrip?.id, token, activeTab === "impression" && !!impSelTrip);
  const [bordereau, setBordereau]         = useState<BordereauFull | null>(null);
  const [bordeLoading, setBordeLoading]   = useState(false);
  // expense modal
  const [showExpModal, setShowExpModal]   = useState(false);
  const [expType, setExpType]             = useState("péage");
  const [expAmount, setExpAmount]         = useState("");
  const [expDesc, setExpDesc]             = useState("");
  const [savingExp, setSavingExp]         = useState(false);
  // print
  const [printingRoute, setPrintingRoute] = useState(false);

  const isAgent = user?.role === "agent";

  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const res = await apiFetch("/agent/trips", { token: token ?? undefined });
      setTrips(Array.isArray(res) ? res : []);
    } catch (e: any) {
      if (e?.httpStatus === 401) {
        logoutIfActiveToken(token ?? "");
        return;
      }
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  };

  const fetchFleetBuses = async () => {
    setLoadingBuses(true);
    try {
      const res = await apiFetch<BusFleet[]>("/agent/guichet/buses", { token: token ?? undefined });
      setFleetBuses(Array.isArray(res) ? res : []);
    } catch {
      setFleetBuses([]);
    } finally {
      setLoadingBuses(false);
    }
  };

  /* ── Auto-détection des étapes du trajet ── */
  useEffect(() => {
    if (dFrom && dTo && dFrom !== dTo) {
      const stops = getRouteStops(dFrom, dTo);
      setDRouteStops(stops);
    } else {
      setDRouteStops([]);
    }
  }, [dFrom, dTo]);

  /* ── Auto-calcul du prix depuis la grille tarifaire ── */
  useEffect(() => {
    if (!dFrom || !dTo || dFrom === dTo) { setDAutoPrice(null); return; }
    const timer = setTimeout(async () => {
      setDPriceLoading(true);
      try {
        const enc = encodeURIComponent;
        const res = await apiFetch<{ price: number | null }>(`/trips/price-grid?from=${enc(dFrom)}&to=${enc(dTo)}&tripType=${dTripType}`);
        setDAutoPrice(res?.price ?? null);
        if (res?.price) setDPriceOverride("");
      } catch {
        setDAutoPrice(null);
      } finally {
        setDPriceLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [dFrom, dTo, dTripType]);

  /* ── Impression Départ functions ── */
  const fetchImpTrips = useCallback(async () => {
    setImpLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/validation-depart/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setImpTrips(Array.isArray(data) ? data : []);
    } catch { setImpTrips([]); }
    finally { setImpLoading(false); setImpRefr(false); }
  }, [token]);

  const fetchImpDetail = useCallback(async (tripId: string) => {
    setBordeLoading(true); setBordereau(null);
    try {
      const res = await fetch(`${BASE_URL}/agent/validation-depart/trip/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBordereau(await res.json());
    } catch {}
    finally { setBordeLoading(false); }
  }, [token]);

  const selectImpTrip = (t: TripSummary) => {
    setImpSelTrip(t);
    fetchImpDetail(t.id);
  };

  const handleAddExpense = async () => {
    if (!impSelTrip || !expAmount.trim()) { Alert.alert("Erreur", "Montant requis."); return; }
    setSavingExp(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/validation-depart/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tripId: impSelTrip.id,
          type: expType,
          amount: parseInt(expAmount),
          description: expDesc.trim() || null,
        }),
      });
      if (res.ok) {
        setShowExpModal(false); setExpAmount(""); setExpDesc(""); setExpType("péage");
        fetchImpDetail(impSelTrip.id);
      } else {
        const d = await res.json();
        Alert.alert("Erreur", d.error ?? "Impossible d'ajouter la dépense.");
      }
    } catch { Alert.alert("Erreur réseau", "Vérifiez votre connexion."); }
    finally { setSavingExp(false); }
  };

  const handlePrintRoute = async () => {
    if (!bordereau || !impSelTrip) return;
    setPrintingRoute(true);
    try {
      const pdfData: PdfBordereauData = {
        trip: bordereau.trip,
        boarded: bordereau.boarded,
        absents: bordereau.absents,
        bagages: bordereau.bagages,
        colis: bordereau.colis,
        expenses: bordereau.expenses,
        agents: bordereau.agents ?? [],
        summary: bordereau.summary,
        validatedBy: (user as any)?.name ?? "Agent Guichet",
        validatedAt: new Date().toISOString(),
      };
      const html    = generateBordereauRoute(pdfData);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Feuille de Route",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF généré", `Fichier : ${uri}`);
      }
    } catch (e) {
      console.error("printRoute error:", e);
      Alert.alert("Erreur", "Impossible de générer la feuille de route.");
    } finally { setPrintingRoute(false); }
  };

  useEffect(() => { if (token) fetchTrips(); }, [token]);
  useEffect(() => {
    if (activeTab === "depart" && fleetBuses.length === 0) fetchFleetBuses();
    if (activeTab === "impression") fetchImpTrips();
  }, [activeTab]);

  if (!isAgent) {
    return (
      <SafeAreaView style={S.denied}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="lock-closed" size={52} color="#D1D5DB" />
        <Text style={S.deniedTitle}>Accès non autorisé</Text>
        <Text style={S.deniedSub}>Cet espace est réservé aux agents GoBooking.</Text>
        <TouchableOpacity style={S.deniedBtn} onPress={() => router.replace("/agent/home" as never)}>
          <Text style={S.deniedBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ── Vente submit ── */
  const handleSubmit = async () => {
    if (!selectedTrip) { Alert.alert("Erreur", "Sélectionnez un trajet."); return; }
    if (!passengerName.trim()) { Alert.alert("Erreur", "Saisissez le nom du passager."); return; }
    if (!isSP && !passengerPhone.trim()) { Alert.alert("Erreur", "Saisissez le numéro de téléphone."); return; }
    if (!isSP && !paymentMethod) { Alert.alert("Erreur", "Sélectionnez un mode de paiement."); return; }
    const count = parseInt(passengerCount) || 1;
    if (count < 1 || count > 10) { Alert.alert("Erreur", "Nombre de passagers invalide (1-10)."); return; }
    const pmLabel = isSP ? "SP (Sans Payer)" : (PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label ?? paymentMethod);
    const finalPayment = isSP ? "sp" : paymentMethod;
    const finalTotal   = isSP ? 0 : selectedTrip.price * count;

    setSubmitting(true);
    try {
      if (!networkStatus.isOnline) {
        const offlineRef = `OFFLINE-${Date.now().toString(36).toUpperCase()}`;
        await saveOffline({
          type: "reservation",
          payload: { tripId: selectedTrip.id, passengerName: passengerName.trim(),
            passengerPhone: passengerPhone.trim(), passengerCount: count, paymentMethod: finalPayment },
          token: token ?? "", createdAt: Date.now(),
        });
        setConfirmed({ bookingRef: offlineRef, total: finalTotal,
          passengerName: passengerName.trim(), passengerPhone: passengerPhone.trim(),
          seatCount: count, trip: selectedTrip, paymentLabel: pmLabel, isSP });
        return;
      }
      const res = await apiFetch<{ bookingRef?: string; id?: string }>("/agent/reservations", {
        token: token ?? undefined, method: "POST",
        body: { tripId: selectedTrip.id, clientName: passengerName.trim(),
          clientPhone: passengerPhone.trim(), seatCount: count,
          paymentMethod: finalPayment, isSP },
      });
      setConfirmed({
        bookingRef: res.bookingRef ?? res.id ?? "—",
        total: finalTotal,
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.trim(),
        seatCount: count,
        trip: selectedTrip,
        paymentLabel: pmLabel,
        isSP,
      });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Créer départ submit ── */
  const handleCreateDeparture = async () => {
    if (!dFrom.trim()) { Alert.alert("Erreur", "Sélectionnez la ville de départ."); return; }
    if (!dTo.trim())   { Alert.alert("Erreur", "Sélectionnez la ville d'arrivée."); return; }
    if (dFrom.trim() === dTo.trim()) { Alert.alert("Erreur", "Départ et arrivée doivent être différents."); return; }
    if (!dDate.trim()) { Alert.alert("Erreur", "Saisissez la date."); return; }
    if (!dHeure.trim()) { Alert.alert("Erreur", "Saisissez l'heure de départ."); return; }

    const finalPrice = dAutoPrice ?? (dPriceOverride ? parseFloat(dPriceOverride) : null);
    if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
      Alert.alert("Erreur", "Prix introuvable dans la grille tarifaire. Saisissez un prix manuellement.");
      return;
    }

    const gSeats = parseInt(dGuichet) || 0;
    const oSeats = parseInt(dOnline) || 0;
    if (gSeats + oSeats === 0) { Alert.alert("Erreur", "Saisissez au moins une place guichet ou en ligne."); return; }
    if (selectedBus && gSeats + oSeats > selectedBus.capacity) {
      Alert.alert("Erreur", `Total (${gSeats + oSeats}) dépasse la capacité du bus (${selectedBus.capacity}).`);
      return;
    }

    setCreatingDep(true);
    try {
      const res = await apiFetch<{ success: boolean; id: string; message: string; price: number }>("/agent/guichet/departures", {
        token: token ?? undefined, method: "POST",
        body: {
          busId:         selectedBus?.id,
          from:          dFrom.trim(),
          to:            dTo.trim(),
          date:          dDate.trim(),
          departureTime: dHeure.trim(),
          price:         finalPrice,
          tripType:      dTripType,
          stops:         dRouteStops,
          guichetSeats:  gSeats,
          onlineSeats:   oSeats,
          chauffeurNom:  dChauffeur.trim() || undefined,
          agentRouteNom: dAgentRoute.trim() || undefined,
        },
      });
      setDepSuccess(res.id);
      await fetchTrips();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer le départ.");
    } finally {
      setCreatingDep(false);
    }
  };

  const resetDeparture = () => {
    setDepSuccess(null);
    setSelectedBus(null);
    setDFrom(""); setDTo(""); setDDate(todayStr()); setDHeure("08:00");
    setDTripType("standard"); setDRouteStops([]);
    setDAutoPrice(null); setDPriceOverride("");
    setDGuichet("20"); setDOnline("24");
    setDChauffeur(""); setDAgentRoute("");
  };

  const handlePrint = async () => {
    if (!confirmed) return;
    setPrinting(true);
    try {
      const html = buildTicketHtml(confirmed);
      if (Platform.OS === "web") {
        const win = window.open("", "_blank");
        if (win) { win.document.write(html); win.document.close(); win.print(); }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Impression", e?.message ?? "Impossible d'ouvrir l'impression.");
    } finally {
      setPrinting(false);
    }
  };

  const reset = () => {
    setConfirmed(null); setSelectedTrip(null);
    setPassengerName(""); setPassengerPhone("");
    setPassengerCount("1"); setPaymentMethod("");
    setIsSP(false);
  };

  /* ── Confirmed screen ── */
  if (confirmed) {
    return (
      <SafeAreaView style={S.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <View style={S.header}>
          <View style={S.headerRow}>
            <View style={S.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
            <View>
              <Text style={S.headerTitle}>Espace Ticketing</Text>
              <Text style={S.headerSub}>Billet émis avec succès</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={S.logoutBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[S.content, { alignItems: "center", paddingTop: 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {confirmed.isSP
            ? <Ionicons name="shield-checkmark" size={72} color="#7C3AED" />
            : <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
          }
          <Text style={[S.successTitle, confirmed.isSP && { color: "#7C3AED" }]}>
            {confirmed.isSP ? "SP Émis !" : "Billet émis !"}
          </Text>
          {confirmed.isSP && (
            <View style={S.spBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#7C3AED" />
              <Text style={S.spBadgeTxt}>Sans Payer — Billet de courtoisie</Text>
            </View>
          )}

          <View style={S.ticketCard}>
            <View style={[S.ticketCardHeader, confirmed.isSP && { borderBottomColor: "#DDD6FE" }]}>
              <Text style={[S.ticketRef, confirmed.isSP && { color: "#7C3AED" }]}>{confirmed.bookingRef}</Text>
              {confirmed.isSP && <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "700" }}>SP</Text>}
            </View>
            <Text style={S.ticketRoute}>{confirmed.trip.from} → {confirmed.trip.to}</Text>
            {[
              { k: "Passager",   v: confirmed.passengerName },
              { k: "Téléphone",  v: confirmed.passengerPhone || "—" },
              { k: "Date",       v: confirmed.trip.date },
              { k: "Départ",     v: confirmed.trip.departureTime },
              { k: "Places",     v: `${confirmed.seatCount}` },
              { k: "Paiement",   v: confirmed.paymentLabel },
            ].map(r => (
              <View key={r.k} style={S.ticketRow}>
                <Text style={S.ticketKey}>{r.k}</Text>
                <Text style={S.ticketVal}>{r.v}</Text>
              </View>
            ))}
            <View style={[S.ticketRow, S.ticketTotalRow]}>
              <Text style={S.ticketTotalKey}>TOTAL</Text>
              <Text style={[S.ticketTotalVal, confirmed.isSP && { color: "#7C3AED" }]}>
                {confirmed.isSP ? "0 FCFA (SP)" : `${confirmed.total.toLocaleString("fr-FR")} FCFA`}
              </Text>
            </View>
          </View>

          {confirmed.bookingRef.startsWith("OFFLINE-") && (
            <View style={S.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#D97706" />
              <Text style={S.offlineTxt}>Sauvegardé hors ligne — sync automatique dès retour connexion.</Text>
            </View>
          )}

          <TouchableOpacity style={S.printBtn} onPress={handlePrint} disabled={printing}>
            {printing
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="print-outline" size={20} color="#fff" /><Text style={S.printBtnTxt}>Imprimer le ticket</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={S.newSaleBtn} onPress={reset}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={S.newSaleBtnTxt}>Nouvelle vente</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Main screen ── */
  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
      <OfflineBanner status={networkStatus} />

      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>Espace Ticketing</Text>
            <Text style={S.headerSub}>Vente guichet · {networkStatus.isOnline ? "En ligne" : "Hors ligne"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── */}
      <View style={S.tabBar}>
        <TouchableOpacity style={[S.tab, activeTab === "vente" && S.tabActive]} onPress={() => setActiveTab("vente")}>
          <Ionicons name="ticket-outline" size={15} color={activeTab === "vente" ? G_DARK : "#9CA3AF"} />
          <Text style={[S.tabTxt, activeTab === "vente" && S.tabTxtActive]} numberOfLines={1}>Vente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, activeTab === "depart" && S.tabActive]} onPress={() => setActiveTab("depart")}>
          <Ionicons name="bus-outline" size={15} color={activeTab === "depart" ? G_DARK : "#9CA3AF"} />
          <Text style={[S.tabTxt, activeTab === "depart" && S.tabTxtActive]} numberOfLines={1}>Départ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, activeTab === "impression" && S.tabActive]} onPress={() => setActiveTab("impression")}>
          <Feather name="printer" size={14} color={activeTab === "impression" ? G_DARK : "#9CA3AF"} />
          <Text style={[S.tabTxt, activeTab === "impression" && S.tabTxtActive]} numberOfLines={1}>Impression</Text>
        </TouchableOpacity>
      </View>

      {/* Alertes temps réel — Module 6 */}
      <AlertBanner
        preDepartureAlerts={preDepartureAlerts}
        validationAlerts={validationAlerts}
        agentRole={realtimeRole}
        onAction={(_tripId, type) => {
          if (type === "pre_departure") setActiveTab("depart");
          else setActiveTab("impression");
        }}
      />

      {/* ══════════════ TAB: VENTE ══════════════ */}
      {activeTab === "vente" && (
        <ScrollView style={{ flex: 1, backgroundColor: "#FFFBEB" }} contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
          {/* TRAJET */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <Ionicons name="bus-outline" size={18} color={G} />
              <Text style={S.cardTitle}>Sélectionner un trajet</Text>
            </View>
            {loadingTrips ? (
              <ActivityIndicator color={G} style={{ marginVertical: 12 }} />
            ) : trips.length === 0 ? (
              <View style={{ alignItems: "center", padding: 12, gap: 8 }}>
                <Text style={{ color: "#9CA3AF", fontSize: 14 }}>Aucun trajet disponible</Text>
                <TouchableOpacity onPress={fetchTrips}>
                  <Text style={{ color: G, fontSize: 13, fontWeight: "600" }}>Actualiser</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {trips.map(trip => {
                  const isSelected = selectedTrip?.id === trip.id;
                  return (
                    <View key={trip.id} style={[S.tripItem, isSelected && S.tripItemSel]}>
                      {/* ── Ligne principale : info + prix ── */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setSelectedTrip(isSelected ? null : trip)}
                        style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                          <Text style={S.tripMeta}>{trip.departureTime} · {trip.date}</Text>
                          {trip.guichetSeats !== undefined && trip.guichetSeats > 0 ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                              <View style={{ backgroundColor: G_LIGHT, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: G_DARK }}>{trip.guichetSeats} guichet</Text>
                              </View>
                              {(trip.onlineSeats ?? 0) > 0 && (
                                <View style={{ backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#1D4ED8" }}>{trip.onlineSeats} en ligne</Text>
                                </View>
                              )}
                            </View>
                          ) : trip.availableSeats !== undefined ? (
                            <Text style={{ fontSize: 12, color: G, marginTop: 2 }}>{trip.availableSeats} places dispo.</Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                          <Text style={S.tripPrice}>{trip.price?.toLocaleString()}</Text>
                          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>FCFA</Text>
                        </View>
                        {isSelected
                          ? <Ionicons name="checkmark-circle" size={22} color={G} />
                          : <Ionicons name="chevron-down" size={18} color="#9CA3AF" />}
                      </TouchableOpacity>

                      {/* ── Bouton plan de sièges (visible quand sélectionné) ── */}
                      {isSelected && (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => router.push({
                            pathname: "/agent/seat-plan/[tripId]" as any,
                            params: {
                              tripId:  trip.id,
                              from:    trip.from,
                              to:      trip.to,
                              date:    trip.date,
                              time:    trip.departureTime,
                              busType: trip.busType ?? "",
                            },
                          })}
                          style={{
                            marginTop: 12,
                            flexDirection: "row", alignItems: "center", justifyContent: "center",
                            gap: 8, backgroundColor: G, borderRadius: 10,
                            paddingVertical: 11,
                            shadowColor: G, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
                          }}>
                          <Ionicons name="grid-outline" size={17} color="#fff" />
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Voir le plan de sièges</Text>
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>


          {/* ── Vente rapide passager ── */}
          {selectedTrip && (
            <>
              {/* PASSAGER */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="person-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Informations passager</Text>
                </View>
                <Text style={S.label}>Nom complet *</Text>
                <TextInput style={S.input} placeholder="Ex: Kouamé Jean" value={passengerName} onChangeText={setPassengerName} />
                {!isSP && (
                  <>
                    <Text style={[S.label, { marginTop: 8 }]}>Téléphone *</Text>
                    <TextInput style={S.input} placeholder="Ex: 07 12 34 56 78" value={passengerPhone}
                      onChangeText={setPassengerPhone} keyboardType="phone-pad" />
                  </>
                )}
                <Text style={[S.label, { marginTop: 8 }]}>Nombre de passagers</Text>
                <View style={S.countRow}>
                  <TouchableOpacity style={S.countBtn} onPress={() => setPassengerCount(c => String(Math.max(1, parseInt(c) - 1)))}>
                    <Ionicons name="remove" size={20} color={G} />
                  </TouchableOpacity>
                  <TextInput style={S.countInput} value={passengerCount} onChangeText={setPassengerCount}
                    keyboardType="number-pad" textAlign="center" />
                  <TouchableOpacity style={S.countBtn} onPress={() => setPassengerCount(c => String(Math.min(10, parseInt(c) + 1)))}>
                    <Ionicons name="add" size={20} color={G} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* PAIEMENT + SP TOGGLE */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="wallet-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Mode de paiement *</Text>
                </View>

                {/* SP Toggle */}
                <TouchableOpacity
                  style={[S.spToggle, isSP && S.spToggleActive]}
                  onPress={() => { setIsSP(v => !v); if (!isSP) setPaymentMethod(""); }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={isSP ? "#fff" : "#7C3AED"} />
                    <View>
                      <Text style={[S.spToggleTxt, isSP && { color: "#fff" }]}>Billet SP (Sans Payer)</Text>
                      <Text style={[S.spToggleSub, isSP && { color: "#EDE9FE" }]}>Courtoisie · Montant = 0 FCFA</Text>
                    </View>
                  </View>
                  <View style={[S.spTogglePill, isSP && S.spTogglePillActive]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: isSP ? "#7C3AED" : "#9CA3AF" }}>
                      {isSP ? "ON" : "OFF"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {!isSP && (
                  <>
                    {!paymentMethod && (
                      <Text style={{ fontSize: 12, color: "#EF4444", marginBottom: 6, marginTop: 8 }}>
                        Veuillez sélectionner un mode de paiement
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                      {PAYMENT_METHODS.map(pm => {
                        const selected = paymentMethod === pm.id;
                        return (
                          <TouchableOpacity key={pm.id}
                            activeOpacity={0.7}
                            style={[S.payItem, selected && S.payItemSel]}
                            onPress={() => setPaymentMethod(pm.id)}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name={pm.icon} size={20} color={selected ? "#fff" : "#9CA3AF"} />
                              <Text style={[S.payLabel, selected && { color: "#fff", fontWeight: "800" }]}>{pm.label}</Text>
                              {selected && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>

              {/* RECAP */}
              {selectedTrip && (
                <View style={[S.recap, isSP && { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                  <Text style={[S.recapTitle, isSP && { color: "#5B21B6" }]}>Récapitulatif</Text>
                  <View style={S.recapRow}><Text style={S.recapKey}>Trajet</Text><Text style={S.recapVal}>{selectedTrip.from} → {selectedTrip.to}</Text></View>
                  <View style={S.recapRow}><Text style={S.recapKey}>Départ</Text><Text style={S.recapVal}>{selectedTrip.departureTime}</Text></View>
                  <View style={S.recapRow}><Text style={S.recapKey}>Passagers</Text><Text style={S.recapVal}>{passengerCount}</Text></View>
                  {isSP && <View style={S.recapRow}><Text style={S.recapKey}>Type</Text><Text style={{ fontSize: 13, fontWeight: "700", color: "#7C3AED" }}>SP — Sans Payer</Text></View>}
                  <View style={[S.recapRow, { borderTopWidth: 1, borderColor: isSP ? "#DDD6FE" : "#FDE68A", paddingTop: 8, marginTop: 4 }]}>
                    <Text style={[S.recapKey, { fontWeight: "700", color: isSP ? "#5B21B6" : G_DARK }]}>TOTAL</Text>
                    <Text style={[S.recapVal, { fontWeight: "800", fontSize: 18, color: isSP ? "#7C3AED" : G }]}>
                      {isSP ? "0 FCFA (SP)" : `${(selectedTrip.price * (parseInt(passengerCount) || 1)).toLocaleString()} FCFA`}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[S.submitBtn, isSP && { backgroundColor: "#7C3AED", shadowColor: "#7C3AED" }, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name={isSP ? "shield-checkmark-outline" : "checkmark-circle-outline"} size={22} color="#fff" />
                    <Text style={S.submitTxt}>{isSP ? "Émettre billet SP" : "Valider la vente"}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14, marginTop: 8, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={() => router.push("/agent/rapport" as never)}
              >
                <Feather name="alert-triangle" size={16} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>Faire un rapport</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* ══════════════ TAB: CRÉER DÉPART ══════════════ */}
      {activeTab === "depart" && (
        <ScrollView style={{ flex: 1, backgroundColor: "#FFFBEB" }} contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">

          {depSuccess ? (
            /* ── Succès création départ ── */
            <View style={{ alignItems: "center", paddingTop: 24, gap: 16 }}>
              <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
              <Text style={S.successTitle}>Départ programmé !</Text>
              <View style={[S.card, { width: "100%", alignItems: "center", gap: 6 }]}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Référence départ</Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: G, letterSpacing: 1 }}>{depSuccess}</Text>
                <Text style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
                  {dFrom} → {dTo}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>
                  {dDate} à {dHeure} · {parseInt(dGuichet) + parseInt(dOnline)} places
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: G_DARK }}>{dGuichet} guichet</Text>
                  </View>
                  <View style={{ backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1D4ED8" }}>{dOnline} en ligne</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={S.submitBtn} onPress={resetDeparture}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={S.submitTxt}>Programmer un autre départ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}
                onPress={() => setActiveTab("vente")}>
                <Ionicons name="ticket-outline" size={16} color={G} />
                <Text style={{ color: G, fontWeight: "700", fontSize: 14 }}>Aller à la vente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── Bus selector ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="bus-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Sélectionner un bus</Text>
                  {loadingBuses && <ActivityIndicator size="small" color={G} style={{ marginLeft: "auto" }} />}
                </View>
                {!loadingBuses && fleetBuses.length === 0 ? (
                  <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun bus dans la flotte</Text>
                    <TouchableOpacity onPress={fetchFleetBuses}>
                      <Text style={{ color: G, fontSize: 13, fontWeight: "600" }}>Actualiser</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {fleetBuses.map(bus => {
                      const sel = selectedBus?.id === bus.id;
                      return (
                        <TouchableOpacity key={bus.id}
                          style={[S.busItem, sel && S.busItemSel]}
                          onPress={() => setSelectedBus(sel ? null : bus)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: sel ? G_DARK : "#111827" }}>
                              {bus.busName}
                            </Text>
                            <Text style={{ fontSize: 11, color: sel ? G : "#6B7280", marginTop: 2 }}>
                              {bus.plateNumber} · {bus.busType} · {bus.capacity} places
                            </Text>
                          </View>
                          {sel && <Ionicons name="checkmark-circle" size={22} color={G} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {selectedBus && (
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 10, padding: 10, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: G_DARK, fontWeight: "600" }}>
                      {selectedBus.busName} · capacité : {selectedBus.capacity} places
                    </Text>
                    <Text style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>
                      Guichet ({dGuichet || "0"}) + En ligne ({dOnline || "0"}) = {(parseInt(dGuichet) || 0) + (parseInt(dOnline) || 0)} / {selectedBus.capacity}
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Itinéraire ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="navigate-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Itinéraire</Text>
                </View>

                {/* Ville de départ */}
                <Text style={S.label}>Ville de départ *</Text>
                <TouchableOpacity style={[S.input, { justifyContent: "center" }]}
                  onPress={() => { setCityPickerFor("from"); setCitySearch(""); setCityPickerOpen(true); }}>
                  <Text style={{ fontSize: 15, color: dFrom ? "#111827" : "#9CA3AF", fontWeight: dFrom ? "600" : "400" }}>
                    {dFrom || "Rechercher une ville de départ..."}
                  </Text>
                </TouchableOpacity>

                {/* Route visualization */}
                {dFrom && dTo && (
                  <View style={{ marginVertical: 8, paddingLeft: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      {/* Ligne verticale */}
                      <View style={{ alignItems: "center", width: 20, paddingTop: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981" }} />
                        {dRouteStops.map((_, i) => (
                          <View key={i}>
                            <View style={{ width: 2, height: 18, backgroundColor: "#D1D5DB", marginLeft: 4 }} />
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: G_LIGHT, borderWidth: 1.5, borderColor: G, marginLeft: 1 }} />
                          </View>
                        ))}
                        <View style={{ width: 2, height: 18, backgroundColor: "#D1D5DB", marginLeft: 4 }} />
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" }} />
                      </View>
                      {/* Textes */}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#065F46", paddingTop: 2 }}>{dFrom}</Text>
                        {dRouteStops.map((stop, i) => (
                          <Text key={i} style={{ fontSize: 12, color: G_DARK, fontStyle: "italic", paddingTop: 18 }}>
                            {stop}
                          </Text>
                        ))}
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#991B1B", paddingTop: dRouteStops.length > 0 ? 18 : 2 }}>
                          {dTo}
                        </Text>
                      </View>
                    </View>
                    {dRouteStops.length > 0 && (
                      <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                        {dRouteStops.length} escale{dRouteStops.length > 1 ? "s" : ""} intermédiaire{dRouteStops.length > 1 ? "s" : ""} détectée{dRouteStops.length > 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                )}

                {/* Ville d'arrivée */}
                <Text style={S.label}>Ville d'arrivée *</Text>
                <TouchableOpacity style={[S.input, { justifyContent: "center" }]}
                  onPress={() => { setCityPickerFor("to"); setCitySearch(""); setCityPickerOpen(true); }}>
                  <Text style={{ fontSize: 15, color: dTo ? "#111827" : "#9CA3AF", fontWeight: dTo ? "600" : "400" }}>
                    {dTo || "Rechercher une ville d'arrivée..."}
                  </Text>
                </TouchableOpacity>

                {/* Échange from/to */}
                {dFrom && dTo && (
                  <TouchableOpacity onPress={() => { const tmp = dFrom; setDFrom(dTo); setDTo(tmp); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "center" }}>
                    <Ionicons name="swap-vertical-outline" size={16} color={G} />
                    <Text style={{ fontSize: 12, color: G, fontWeight: "600" }}>Inverser départ/arrivée</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Type de départ ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="star-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Type de départ</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
                      backgroundColor: dTripType === "standard" ? G : "#F3F4F6",
                      borderWidth: 1.5, borderColor: dTripType === "standard" ? G : "#E5E7EB",
                    }}
                    onPress={() => setDTripType("standard")}>
                    <Ionicons name="bus-outline" size={20} color={dTripType === "standard" ? "#fff" : "#6B7280"} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: dTripType === "standard" ? "#fff" : "#374151", marginTop: 4 }}>
                      Standard
                    </Text>
                    <Text style={{ fontSize: 10, color: dTripType === "standard" ? "#FEF3C7" : "#9CA3AF" }}>
                      Tarif de base
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
                      backgroundColor: dTripType === "vip" ? "#7C3AED" : "#F3F4F6",
                      borderWidth: 1.5, borderColor: dTripType === "vip" ? "#7C3AED" : "#E5E7EB",
                    }}
                    onPress={() => setDTripType("vip")}>
                    <Ionicons name="diamond-outline" size={20} color={dTripType === "vip" ? "#fff" : "#6B7280"} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: dTripType === "vip" ? "#fff" : "#374151", marginTop: 4 }}>
                      VIP
                    </Text>
                    <Text style={{ fontSize: 10, color: dTripType === "vip" ? "#EDE9FE" : "#9CA3AF" }}>
                      +30% du tarif
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Horaires ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="time-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Date & heure</Text>
                </View>
                <Text style={S.label}>Date du départ *</Text>
                <TextInput style={S.input} placeholder="YYYY-MM-DD" value={dDate} onChangeText={setDDate} />
                <Text style={S.label}>Heure de départ *</Text>
                <TextInput style={S.input} placeholder="HH:MM" value={dHeure} onChangeText={setDHeure} />
              </View>

              {/* ── Prix & places ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="wallet-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Prix & places</Text>
                </View>

                {/* Prix auto */}
                {dFrom && dTo ? (
                  dPriceLoading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <ActivityIndicator size="small" color={G} />
                      <Text style={{ fontSize: 13, color: "#6B7280" }}>Calcul du prix...</Text>
                    </View>
                  ) : dAutoPrice ? (
                    <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View>
                        <Text style={{ fontSize: 11, color: "#166534", fontWeight: "600" }}>
                          PRIX {dTripType === "vip" ? "VIP" : "STANDARD"} — {dFrom} → {dTo}
                        </Text>
                        <Text style={{ fontSize: 24, fontWeight: "800", color: "#15803D", marginTop: 2 }}>
                          {dAutoPrice.toLocaleString()} FCFA
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
                    </View>
                  ) : (
                    <View>
                      <View style={{ backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: "#92400E" }}>
                          Trajet non trouvé dans la grille tarifaire. Saisissez le prix manuellement.
                        </Text>
                      </View>
                      <Text style={S.label}>Prix du billet (FCFA) *</Text>
                      <TextInput style={S.input} placeholder="Ex: 3500" value={dPriceOverride}
                        onChangeText={setDPriceOverride} keyboardType="number-pad" />
                    </View>
                  )
                ) : (
                  <Text style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>
                    Sélectionnez départ et arrivée pour calculer le prix automatiquement.
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.label, { color: G_DARK }]}>Places guichet</Text>
                    <View style={S.countRow}>
                      <TouchableOpacity style={S.countBtn} onPress={() => setDGuichet(v => String(Math.max(0, parseInt(v || "0") - 1)))}>
                        <Ionicons name="remove" size={18} color={G} />
                      </TouchableOpacity>
                      <TextInput style={[S.countInput, { flex: 1, width: undefined }]} value={dGuichet}
                        onChangeText={setDGuichet} keyboardType="number-pad" textAlign="center" />
                      <TouchableOpacity style={S.countBtn} onPress={() => setDGuichet(v => String(parseInt(v || "0") + 1))}>
                        <Ionicons name="add" size={18} color={G} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.label, { color: "#1D4ED8" }]}>Places en ligne</Text>
                    <View style={S.countRow}>
                      <TouchableOpacity style={[S.countBtn, { borderColor: "#1D4ED8" }]} onPress={() => setDOnline(v => String(Math.max(0, parseInt(v || "0") - 1)))}>
                        <Ionicons name="remove" size={18} color="#1D4ED8" />
                      </TouchableOpacity>
                      <TextInput style={[S.countInput, { flex: 1, width: undefined, borderColor: "#BFDBFE" }]} value={dOnline}
                        onChangeText={setDOnline} keyboardType="number-pad" textAlign="center" />
                      <TouchableOpacity style={[S.countBtn, { borderColor: "#1D4ED8" }]} onPress={() => setDOnline(v => String(parseInt(v || "0") + 1))}>
                        <Ionicons name="add" size={18} color="#1D4ED8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── Personnel (optionnel) ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="people-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Personnel (optionnel)</Text>
                </View>
                <Text style={S.label}>Nom du chauffeur</Text>
                <TextInput style={S.input} placeholder="Ex: Diallo Bakary" value={dChauffeur} onChangeText={setDChauffeur} />
                <Text style={S.label}>Nom de l'agent en route</Text>
                <TextInput style={S.input} placeholder="Ex: Koné Ibrahim" value={dAgentRoute} onChangeText={setDAgentRoute} />
              </View>

              {/* ── Récap ── */}
              <View style={S.recap}>
                <Text style={S.recapTitle}>Récapitulatif du départ</Text>
                <View style={S.recapRow}>
                  <Text style={S.recapKey}>Trajet</Text>
                  <Text style={[S.recapVal, { flexShrink: 1, textAlign: "right" }]}>{dFrom || "—"} → {dTo || "—"}</Text>
                </View>
                {dRouteStops.length > 0 && (
                  <View style={S.recapRow}>
                    <Text style={S.recapKey}>Escales</Text>
                    <Text style={[S.recapVal, { flexShrink: 1, textAlign: "right", fontSize: 11, color: G_DARK }]}>
                      {dRouteStops.join(" · ")}
                    </Text>
                  </View>
                )}
                <View style={S.recapRow}><Text style={S.recapKey}>Type</Text>
                  <Text style={[S.recapVal, { color: dTripType === "vip" ? "#7C3AED" : G, fontWeight: "700" }]}>
                    {dTripType === "vip" ? "VIP" : "Standard"}
                  </Text>
                </View>
                <View style={S.recapRow}><Text style={S.recapKey}>Prix billet</Text>
                  <Text style={[S.recapVal, { color: "#15803D", fontWeight: "700" }]}>
                    {(dAutoPrice ?? (dPriceOverride ? parseFloat(dPriceOverride) : null))
                      ? `${(dAutoPrice ?? parseFloat(dPriceOverride)).toLocaleString()} FCFA`
                      : "—"}
                  </Text>
                </View>
                <View style={S.recapRow}><Text style={S.recapKey}>Date</Text><Text style={S.recapVal}>{dDate || "—"}</Text></View>
                <View style={S.recapRow}><Text style={S.recapKey}>Heure</Text><Text style={S.recapVal}>{dHeure || "—"}</Text></View>
                <View style={S.recapRow}><Text style={S.recapKey}>Bus</Text><Text style={S.recapVal}>{selectedBus?.busName ?? "Non sélectionné"}</Text></View>
                <View style={S.recapRow}><Text style={S.recapKey}>Guichet</Text><Text style={S.recapVal}>{dGuichet} places</Text></View>
                <View style={S.recapRow}><Text style={S.recapKey}>En ligne</Text><Text style={S.recapVal}>{dOnline} places</Text></View>
                <View style={[S.recapRow, { borderTopWidth: 1, borderColor: "#FDE68A", paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[S.recapKey, { fontWeight: "700", color: G_DARK }]}>TOTAL PLACES</Text>
                  <Text style={[S.recapVal, { fontWeight: "800", color: G, fontSize: 18 }]}>
                    {(parseInt(dGuichet) || 0) + (parseInt(dOnline) || 0)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[S.submitBtn, creatingDep && { opacity: 0.6 }]}
                onPress={handleCreateDeparture} disabled={creatingDep}>
                {creatingDep ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="add-circle-outline" size={22} color="#fff" />
                    <Text style={S.submitTxt}>Programmer ce départ</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* ══════════════ TAB: IMPRESSION DÉPART ══════════════ */}
      {activeTab === "impression" && (
        <>
          {/* Trip list */}
          {!impSelTrip ? (
            <ScrollView style={{ flex: 1, backgroundColor: "#FFFBEB" }}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={
                <RefreshControl refreshing={impRefreshing || impLoading}
                  onRefresh={() => { setImpRefr(true); fetchImpTrips(); }} tintColor={G} />
              }>

              <View style={S.impInfoBox}>
                <Feather name="info" size={13} color={G_DARK} />
                <Text style={S.impInfoTxt}>
                  Sélectionnez un départ pour ajouter des dépenses (péage, ration...) et imprimer la feuille de route sans montants.
                </Text>
              </View>

              <View style={S.impSectionRow}>
                <Feather name="calendar" size={16} color={G_DARK} />
                <Text style={S.impSectionTitle}>Départs du jour</Text>
                <View style={S.impBadge}><Text style={S.impBadgeTxt}>{impTrips.length}</Text></View>
                <TouchableOpacity onPress={fetchImpTrips} style={{ marginLeft: "auto" }}>
                  <Feather name="refresh-cw" size={14} color={G} />
                </TouchableOpacity>
              </View>

              {impLoading ? (
                <ActivityIndicator color={G} size="large" style={{ marginTop: 32 }} />
              ) : impTrips.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
                  <Feather name="calendar" size={44} color="#CBD5E1" />
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#334155" }}>Aucun départ aujourd'hui</Text>
                </View>
              ) : (
                impTrips.map(t => {
                  const validated = t.isValidated;
                  const ready = t.boardedCount > 0 || t.bagageCount > 0;
                  const accent = validated ? "#059669" : ready ? G : "#94A3B8";
                  const label  = validated ? "En route" : ready ? "Prêt" : "En attente";
                  return (
                    <TouchableOpacity key={t.id} style={[S.impTripCard, validated && { opacity: 0.8 }]}
                      onPress={() => selectImpTrip(t)}>
                      <View style={[S.impTripAccent, { backgroundColor: accent }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <Text style={S.impTripRoute}>{t.from} → {t.to}</Text>
                          <View style={[S.impBadge, { backgroundColor: accent + "18" }]}>
                            <Text style={[S.impBadgeTxt, { color: accent }]}>{t.departureTime}</Text>
                          </View>
                        </View>
                        <Text style={S.impTripMeta}>{t.busName} · {t.date}</Text>
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          <View style={S.impChip}>
                            <Feather name="users" size={10} color="#059669" />
                            <Text style={[S.impChipTxt, { color: "#059669" }]}>{t.boardedCount} pax</Text>
                          </View>
                          {t.bagageCount > 0 && (
                            <View style={S.impChip}>
                              <Feather name="briefcase" size={10} color={G_DARK} />
                              <Text style={[S.impChipTxt, { color: G_DARK }]}>{t.bagageCount} bag.</Text>
                            </View>
                          )}
                          {t.expenseTotal > 0 && (
                            <View style={S.impChip}>
                              <Feather name="minus-circle" size={10} color="#DC2626" />
                              <Text style={[S.impChipTxt, { color: "#DC2626" }]}>{t.expenseTotal.toLocaleString()} FCFA</Text>
                            </View>
                          )}
                          <View style={[S.impBadge, { backgroundColor: accent + "15" }]}>
                            <Text style={[S.impBadgeTxt, { color: accent }]}>{label}</Text>
                          </View>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color={G} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          ) : (
            /* ── Detail view ── */
            <ScrollView style={{ flex: 1, backgroundColor: "#FFFBEB" }} contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Back */}
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                onPress={() => { setImpSelTrip(null); setBordereau(null); }}>
                <Feather name="arrow-left" size={16} color={G_DARK} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: G_DARK }}>Retour aux départs</Text>
              </TouchableOpacity>

              {/* Trip banner */}
              <View style={[S.card, { borderLeftWidth: 4, borderLeftColor: G }]}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: G_DARK }}>
                  {impSelTrip.from} → {impSelTrip.to}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>
                  {impSelTrip.departureTime} · {impSelTrip.busName} · {impSelTrip.date}
                </Text>
                {impSelTrip.isValidated && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#059669" }}>Départ validé · En route</Text>
                  </View>
                )}
              </View>

              {bordeLoading ? (
                <ActivityIndicator color={G} size="large" style={{ marginTop: 20 }} />
              ) : !bordereau ? (
                <TouchableOpacity style={S.submitBtn} onPress={() => fetchImpDetail(impSelTrip.id)}>
                  <Text style={S.submitTxt}>Réessayer le chargement</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {/* Stats — préférer liveStats (polling 30s) sur bordereau.summary */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { label: "Embarqués", val: liveStats.boardedCount  ?? bordereau.summary.boardedCount, color: "#059669" },
                      { label: "Absents",   val: liveStats.absentCount   ?? bordereau.summary.absentCount,  color: G },
                      { label: "Bagages",   val: liveStats.bagageCount   ?? bordereau.summary.bagageCount,  color: G_DARK },
                      { label: "Colis",     val: liveStats.colisCount    ?? bordereau.summary.colisCount,   color: "#4338CA" },
                    ].map(s => (
                      <View key={s.label} style={[S.card, { flex: 1, alignItems: "center", padding: 10, borderTopWidth: 3, borderTopColor: s.color }]}>
                        <Text style={{ fontSize: 20, fontWeight: "900", color: s.color }}>{s.val ?? 0}</Text>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: "#6B7280", marginTop: 2 }}>{s.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── DÉPENSES ── */}
                  <View style={S.card}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Feather name="minus-circle" size={16} color="#DC2626" />
                      <Text style={[S.cardTitle, { color: "#DC2626", flex: 1 }]}>
                        Dépenses ({bordereau.expenses.length})
                      </Text>
                      {!impSelTrip.isValidated && (
                        <TouchableOpacity
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                          onPress={() => setShowExpModal(true)}>
                          <Feather name="plus" size={12} color="#DC2626" />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>Ajouter</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {bordereau.expenses.length === 0 ? (
                      <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>Aucune dépense enregistrée.</Text>
                        {!impSelTrip.isValidated && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {["Péage", "Ration équipage", "Carburant"].map(label => (
                              <TouchableOpacity key={label}
                                style={{ backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                                onPress={() => { setExpType(label.toLowerCase().split(" ")[0]); setShowExpModal(true); }}>
                                <Text style={{ fontSize: 12, fontWeight: "700", color: G_DARK }}>+ {label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {bordereau.expenses.map(e => (
                          <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#FEE2E2" }}>
                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" }}>
                              <Feather name="arrow-down-left" size={12} color="#DC2626" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", textTransform: "capitalize" }}>{e.type}</Text>
                              {e.description && <Text style={{ fontSize: 11, color: "#6B7280" }}>{e.description}</Text>}
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: "#DC2626" }}>
                              − {(e.amount ?? 0).toLocaleString()} FCFA
                            </Text>
                          </View>
                        ))}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280" }}>Total</Text>
                          <Text style={{ fontSize: 14, fontWeight: "900", color: "#DC2626" }}>
                            − {(bordereau.summary.totalExpenses ?? 0).toLocaleString()} FCFA
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* ── INFO SYNC ── */}
                  <View style={{ backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Feather name="info" size={13} color="#4338CA" />
                    <Text style={{ flex: 1, fontSize: 11, color: "#4338CA", lineHeight: 16 }}>
                      Les dépenses ajoutées ici apparaissent automatiquement sur le bordereau de l'agent de validation. La feuille imprimée ne contient <Text style={{ fontWeight: "800" }}>aucun montant</Text>.
                    </Text>
                  </View>

                  {/* ── RAPPORT DE CONTRÔLE ── */}
                  {(() => {
                    const audit = computeAudit({
                      trip: bordereau.trip, boarded: bordereau.boarded,
                      absents: bordereau.absents, bagages: bordereau.bagages,
                      colis: bordereau.colis, expenses: bordereau.expenses,
                      agents: bordereau.agents, summary: bordereau.summary,
                    } as PdfBordereauData);
                    const boxColor = audit.hasErrors ? "#DC2626" : audit.hasWarnings ? G : "#059669";
                    const icon     = audit.hasErrors ? "alert-circle" : audit.hasWarnings ? "alert-triangle" : "check-circle";
                    const lbl      = audit.hasErrors ? "Anomalie(s)" : audit.hasWarnings ? "Avertissement" : "OK";
                    return (
                      <View style={{ borderRadius: 12, borderWidth: 1.5, borderColor: boxColor, backgroundColor: boxColor + "0D", overflow: "hidden" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: boxColor + "22" }}>
                          <Feather name={icon as any} size={15} color={boxColor} />
                          <Text style={{ flex: 1, fontSize: 12, fontWeight: "800", color: "#0F172A" }}>Rapport de contrôle</Text>
                          <View style={{ backgroundColor: boxColor, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{lbl}</Text>
                          </View>
                        </View>
                        <View style={{ padding: 10, gap: 8 }}>
                          {(audit.items as AuditItem[]).map((item, i) => {
                            const ic      = item.level === "error" ? "#DC2626" : item.level === "warning" ? G : "#059669";
                            const prioBg  = item.priority === "critique" ? "#FEE2E2" : item.priority === "moyen" ? "#FEF3C7" : "#F1F5F9";
                            const prioFg  = item.priority === "critique" ? "#B91C1C" : item.priority === "moyen" ? "#92400E" : "#64748B";
                            const prioLbl = item.priority === "critique" ? "CRITIQUE" : item.priority === "moyen" ? "MOYEN" : "INFO";
                            return (
                              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ic, marginTop: 6 }} />
                                <View style={{ flex: 1, gap: 2 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                    <View style={{ backgroundColor: prioBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                      <Text style={{ fontSize: 8, fontWeight: "800", color: prioFg, letterSpacing: 0.4 }}>{prioLbl}</Text>
                                    </View>
                                    <Text style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>{item.category}</Text>
                                  </View>
                                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#0F172A" }}>{item.label}</Text>
                                  <Text style={{ fontSize: 10, color: "#64748B" }}>{item.detail}</Text>
                                  {!!item.recommendation && (
                                    <Text style={{ fontSize: 9, color: prioFg, fontStyle: "italic" }}>→ {item.recommendation}</Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}

                  {/* ── PASSAGERS résumé ── */}
                  <View style={S.card}>
                    <View style={S.cardHeader}>
                      <Feather name="users" size={16} color="#059669" />
                      <Text style={[S.cardTitle, { color: "#059669" }]}>Passagers embarqués ({bordereau.summary.boardedCount})</Text>
                    </View>
                    {bordereau.boarded.length === 0 ? (
                      <Text style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>Aucun passager embarqué pour l'instant.</Text>
                    ) : (
                      <View style={{ gap: 6 }}>
                        {bordereau.boarded.slice(0, 5).map((p: any) => (
                          <View key={p.bookingId} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Feather name="check-circle" size={13} color="#059669" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>{p.name}</Text>
                              <Text style={{ fontSize: 11, color: "#6B7280" }}>{p.bookingRef}</Text>
                            </View>
                          </View>
                        ))}
                        {bordereau.boarded.length > 5 && (
                          <Text style={{ fontSize: 12, color: "#059669", fontWeight: "700" }}>
                            + {bordereau.boarded.length - 5} autres passagers
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* ── PRINT BUTTON ── */}
                  <TouchableOpacity
                    style={[S.submitBtn, { backgroundColor: G_DARK, flexDirection: "row", gap: 12 }, printingRoute && { opacity: 0.6 }]}
                    onPress={handlePrintRoute}
                    disabled={printingRoute}>
                    {printingRoute ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Feather name="printer" size={20} color="#fff" />
                        <View style={{ flex: 1 }}>
                          <Text style={S.submitTxt}>Imprimer la Feuille de Route</Text>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 }}>
                            Chauffeur · Agent Route · Sans montants
                          </Text>
                        </View>
                        <Feather name="download" size={15} color="rgba(255,255,255,0.6)" />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          )}

          {/* ── Expense modal ── */}
          <Modal visible={showExpModal} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#111827" }}>Ajouter une dépense</Text>
                  <TouchableOpacity onPress={() => setShowExpModal(false)} hitSlop={8}>
                    <Feather name="x" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {impSelTrip && (
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: G_DARK }}>
                      {impSelTrip.from} → {impSelTrip.to} · {impSelTrip.departureTime}
                    </Text>
                  </View>
                )}

                <Text style={S.label}>Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {IMP_EXPENSE_TYPES.map(et => (
                    <TouchableOpacity key={et.key}
                      style={[
                        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB" },
                        expType === et.key && { backgroundColor: "#DC2626", borderColor: "#DC2626" },
                      ]}
                      onPress={() => setExpType(et.key)}>
                      <Feather name={et.icon} size={13} color={expType === et.key ? "#fff" : "#6B7280"} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: expType === et.key ? "#fff" : "#6B7280" }}>
                        {et.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={S.label}>Montant (FCFA) *</Text>
                <TextInput style={S.input} placeholder="ex: 5000" placeholderTextColor="#9CA3AF"
                  value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" />

                <Text style={S.label}>Description (optionnel)</Text>
                <TextInput style={S.input} placeholder="ex: Péage autoroute, Déjeuner équipage..."
                  placeholderTextColor="#9CA3AF" value={expDesc} onChangeText={setExpDesc} />

                <Text style={{ fontSize: 11, color: "#059669", fontWeight: "600" }}>
                  ✓ Automatiquement visible sur le bordereau de validation
                </Text>

                <TouchableOpacity
                  style={[S.submitBtn, { backgroundColor: "#DC2626" }, savingExp && { opacity: 0.6 }]}
                  onPress={handleAddExpense} disabled={savingExp}>
                  {savingExp
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={S.submitTxt}>Enregistrer la dépense</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* ══════════ CITY PICKER MODAL ══════════ */}
      <Modal visible={cityPickerOpen} animationType="slide" transparent onRequestClose={() => setCityPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", flex: 0, minHeight: "70%" }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderColor: "#F3F4F6" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
                {cityPickerFor === "from" ? "Ville de départ" : "Ville d'arrivée"}
              </Text>
              <TouchableOpacity onPress={() => setCityPickerOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#F3F4F6" }}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: "#111827", padding: 0 }}
                placeholder="Rechercher une ville (ex: Ferké, Bouaké...)"
                value={citySearch}
                onChangeText={setCitySearch}
                autoFocus
                autoCorrect={false}
              />
              {citySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCitySearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            {/* List */}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
              {searchCities(citySearch, ALL_CI_CITIES).map((city) => {
                const isSelected = cityPickerFor === "from" ? city === dFrom : city === dTo;
                const isOther    = cityPickerFor === "from" ? city === dTo : city === dFrom;
                return (
                  <TouchableOpacity
                    key={city}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingHorizontal: 20, paddingVertical: 14,
                      borderBottomWidth: 1, borderColor: "#F9FAFB",
                      backgroundColor: isSelected ? G_LIGHT : "#fff",
                      opacity: isOther ? 0.4 : 1,
                    }}
                    disabled={isOther}
                    onPress={() => {
                      if (cityPickerFor === "from") setDFrom(city);
                      else setDTo(city);
                      setCityPickerOpen(false);
                    }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "location-outline"}
                        size={18}
                        color={isSelected ? G : "#9CA3AF"}
                      />
                      <Text style={{ fontSize: 15, color: isSelected ? G_DARK : "#111827", fontWeight: isSelected ? "700" : "400" }}>
                        {city}
                      </Text>
                    </View>
                    {isOther && <Text style={{ fontSize: 10, color: "#9CA3AF" }}>Déjà sélectionné</Text>}
                  </TouchableOpacity>
                );
              })}
              {searchCities(citySearch, ALL_CI_CITIES).length === 0 && (
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={32} color="#D1D5DB" />
                  <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 8 }}>
                    Aucune ville trouvée pour "{citySearch}"
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: G_DARK },
  denied:  { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 },
  deniedTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  deniedSub: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  deniedBtn:  { backgroundColor: G, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  deniedBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  header:    { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon:{ backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub: { color: "#FDE68A", fontSize: 12, marginTop: 1 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" },

  tabBar:     { flexDirection: "row", backgroundColor: G_DARK, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4, gap: 8 },
  tab:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" },
  tabActive:  { backgroundColor: "#fff" },
  tabTxt:     { fontSize: 12, fontWeight: "700", color: "#9CA3AF", flexShrink: 1 },
  tabTxtActive: { color: G_DARK },

  content:   { padding: 16, gap: 14, paddingBottom: 32 },
  card:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  tripItem:  { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  tripItemSel: { borderColor: G, backgroundColor: G_LIGHT },
  tripRoute: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripMeta:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tripPrice: { fontSize: 15, fontWeight: "800", color: G },

  busItem:    { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  busItemSel: { borderColor: G, backgroundColor: G_LIGHT },

  label:     { fontSize: 13, fontWeight: "500", color: "#374151" },
  input:     { borderWidth: 1.5, borderColor: "#FDE68A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: G_LIGHT, color: "#111827" },

  countRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn:  { width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: G, alignItems: "center", justifyContent: "center" },
  countInput:{ borderWidth: 1.5, borderColor: "#FDE68A", borderRadius: 10, width: 70, paddingVertical: 9, fontSize: 18, fontWeight: "700", color: "#111827", backgroundColor: G_LIGHT },

  payItem:   { borderWidth: 2, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#F9FAFB" },
  payItemSel:{ borderColor: G, backgroundColor: G },
  payLabel:  { fontSize: 13, color: "#6B7280", fontWeight: "500" },

  recap:     { backgroundColor: G_LIGHT, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: "#FDE68A", gap: 8 },
  recapTitle:{ fontSize: 15, fontWeight: "700", color: G_DARK, marginBottom: 4 },
  recapRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapKey:  { fontSize: 13, color: "#6B7280" },
  recapVal:  { fontSize: 13, fontWeight: "600", color: "#111827" },

  submitBtn:  { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14, elevation: 3, shadowColor: G, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitTxt:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  offlineBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginTop: 8, maxWidth: 320 },
  offlineTxt:    { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },

  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 12 },

  ticketCard: { width: "100%", backgroundColor: "#FFFBEB", borderRadius: 14, padding: 16, borderWidth: 2, borderColor: "#FDE68A", marginTop: 16, gap: 6 },
  ticketCardHeader: { borderBottomWidth: 1, borderColor: "#FDE68A", paddingBottom: 10, marginBottom: 6, alignItems: "center" },
  ticketRef:  { fontSize: 16, fontWeight: "800", color: G, letterSpacing: 1 },
  ticketRoute:{ fontSize: 15, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 8 },
  ticketRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#FEF3C7" },
  ticketKey:  { fontSize: 12, color: "#6B7280" },
  ticketVal:  { fontSize: 12, fontWeight: "700", color: "#111827" },
  ticketTotalRow: { borderTopWidth: 2, borderColor: "#FDE68A", borderBottomWidth: 0, paddingTop: 10, marginTop: 4 },
  ticketTotalKey: { fontSize: 14, fontWeight: "800", color: G_DARK },
  ticketTotalVal: { fontSize: 16, fontWeight: "800", color: G },

  printBtn:    { marginTop: 20, backgroundColor: G_DARK, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, width: "100%", justifyContent: "center" },
  printBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  newSaleBtn:    { marginTop: 10, backgroundColor: G, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, width: "100%", justifyContent: "center" },
  newSaleBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  /* ── SP styles ── */
  spBadge:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  spBadgeTxt:    { fontSize: 12, color: "#5B21B6", fontWeight: "700" },
  spToggle:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderColor: "#DDD6FE", borderRadius: 12, padding: 12, backgroundColor: "#F5F3FF" },
  spToggleActive:{ borderColor: "#7C3AED", backgroundColor: "#7C3AED" },
  spToggleTxt:   { fontSize: 14, fontWeight: "700", color: "#5B21B6" },
  spToggleSub:   { fontSize: 11, color: "#7C3AED", marginTop: 1 },
  spTogglePill:  { backgroundColor: "#EDE9FE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  spTogglePillActive: { backgroundColor: "#EDE9FE" },

  /* ── Seat map toggle ── */
  viewToggleBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  viewToggleBtnActive: { borderColor: G, backgroundColor: G_LIGHT },
  viewToggleTxt:       { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  viewToggleTxtActive: { color: G_DARK },

  /* ── Impression tab ── */
  impInfoBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FDE68A" },
  impInfoTxt:     { flex: 1, fontSize: 12, fontWeight: "600", color: G_DARK, lineHeight: 18 },
  impSectionRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  impSectionTitle:{ fontSize: 14, fontWeight: "800", color: G_DARK, flex: 1 },
  impBadge:       { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: G_LIGHT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  impBadgeTxt:    { fontSize: 11, fontWeight: "700", color: G_DARK },
  impTripCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#0B3C5D", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: "hidden" },
  impTripAccent:  { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  impTripRoute:   { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  impTripMeta:    { fontSize: 11, color: "#6B7280", marginTop: 1 },
  impChip:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  impChipTxt:     { fontSize: 11, fontWeight: "600", color: "#64748B" },
});
