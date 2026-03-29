import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Pressable, Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import OfflineBanner from "@/components/OfflineBanner";
import { getSeatColor, SEAT_LEGEND } from "@/utils/seatColors";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface Trip {
  id: string;
  from: string;
  to: string;
  fromCity?: string;
  toCity?: string;
  departureTime: string;
  price: number;
  availableSeats?: number;
  date: string;
  status?: string;
  stops?: string[];
  allCities?: string[];
  tripType?: string;
}

interface Passenger {
  bookingId: string;
  bookingRef: string;
  name: string;
  phone: string;
  seatNumbers: string[];
  status: "payé" | "à_bord" | "réservé" | "sp";
  paymentStatus: string;
  source: string;
  boardingCity: string | null;
  alightingCity: string | null;
  amount: number;
  createdAt: string;
}

interface TripDashboard {
  trip: {
    id: string; from: string; to: string; date: string;
    departureTime: string; price: number; status: string;
    tripType: string; busName: string; plateNumber: string; busType: string;
    stops: string[]; allCities: string[];
  };
  seats: {
    total: number; guichetTotal: number; onlineTotal: number;
    usedGuichet: number; usedOnline: number; usedSP: number;
    reserved: number; availGuichet: number; availOnline: number; availTotal: number;
  };
  passengers: Passenger[];
  totals: {
    passengersCount: number; payéCount: number; réservéCount: number; spCount: number; revenue: number;
  };
}

interface TicketData {
  bookingRef: string; bookingId: string;
  passengerName: string; phone: string;
  seatNumbers: string[]; seatCount: number;
  amount: number; paymentMethod: string; paymentStatus: string;
  status: string; source: string;
  boardingCity: string | null; alightingCity: string | null;
  createdAt: string;
  trip: {
    id: string; from: string; to: string; date: string;
    departureTime: string; price: number; busName: string;
    plateNumber: string; busType: string; tripType: string;
  };
}

const PAYMENT_METHODS = [
  { id: "cash",         label: "Espèces",      icon: "cash-outline"           as const },
  { id: "mobile_money", label: "Mobile Money", icon: "phone-portrait-outline" as const },
  { id: "card",         label: "Carte",         icon: "card-outline"           as const },
];

/* ─── Status helpers ───────────────────────────────────────────────────────── */
function statusColor(s: string) {
  if (s === "payé" || s === "à_bord") return G;
  if (s === "sp")    return "#7C3AED";
  if (s === "réservé") return "#D97706";
  return "#9CA3AF";
}
function statusLabel(s: string) {
  if (s === "payé")    return "Payé";
  if (s === "à_bord")  return "À bord";
  if (s === "sp")      return "SP";
  if (s === "réservé") return "Réservé";
  return s;
}
function statusBg(s: string) {
  if (s === "payé" || s === "à_bord") return "#D1FAE5";
  if (s === "sp")    return "#EDE9FE";
  if (s === "réservé") return "#FEF3C7";
  return "#F3F4F6";
}
function sourceBadge(s: string) {
  if (s === "online" || s === "mobile") return { label: "En ligne", color: "#2563EB", bg: "#EFF6FF" };
  if (s === "voucher") return { label: "BON", color: "#7C3AED", bg: "#EDE9FE" };
  if (s === "sp") return { label: "SP", color: "#7C3AED", bg: "#EDE9FE" };
  return { label: "Guichet", color: G, bg: G_LIGHT };
}
function tripTypeLabel(t: string) {
  if (t === "vip")     return "VIP";
  if (t === "vip_plus") return "VIP+";
  return "Standard";
}

/* ─── Ticket HTML for print ─────────────────────────────────────────────────*/
function buildTicketHtml(ticket: TicketData): string {
  const spStr = ticket.paymentStatus === "sp" ? " (SP — Sans Payer)" : "";
  const seatStr = ticket.seatNumbers.length > 0 ? ticket.seatNumbers.join(", ") : "Auto";
  const amountStr = ticket.paymentStatus === "sp" ? "0 FCFA (SP)" : `${(ticket.amount ?? 0).toLocaleString()} FCFA`;
  const pmLabel = ticket.paymentMethod === "sp" ? "SP" :
    ticket.paymentMethod === "cash" ? "Espèces" :
    ticket.paymentMethod === "mobile_money" ? "Mobile Money" :
    ticket.paymentMethod === "card" ? "Carte" : ticket.paymentMethod;

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111}
      .header{background:#065F46;color:#fff;padding:16px;border-radius:8px;margin-bottom:20px;text-align:center}
      h1{margin:0;font-size:22px}
      .sub{font-size:13px;opacity:.8;margin-top:4px}
      .ref{font-size:28px;font-weight:bold;color:#059669;text-align:center;margin:20px 0;letter-spacing:3px}
      .section{background:#F9FAFB;border-radius:8px;padding:14px;margin-bottom:12px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E5E7EB}
      .row:last-child{border-bottom:none;font-weight:bold}
      .label{color:#6B7280;font-size:13px}
      .value{font-size:13px;font-weight:600;color:#111}
      .sp-badge{background:#EDE9FE;color:#7C3AED;padding:4px 10px;border-radius:12px;font-size:12px;display:inline-block}
      .footer{text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px}
    </style>
  </head><body>
    <div class="header">
      <h1>GoBooking</h1>
      <div class="sub">Billet de transport intercité</div>
    </div>
    <div class="ref">${ticket.bookingRef}${ticket.paymentStatus === "sp" ? ' <span class="sp-badge">SP</span>' : ""}</div>
    <div class="section">
      <div class="row"><span class="label">Passager</span><span class="value">${ticket.passengerName}</span></div>
      <div class="row"><span class="label">Téléphone</span><span class="value">${ticket.phone || "—"}</span></div>
      <div class="row"><span class="label">Siège(s)</span><span class="value">${seatStr}</span></div>
    </div>
    <div class="section">
      <div class="row"><span class="label">Trajet</span><span class="value">${ticket.trip.from} → ${ticket.trip.to}</span></div>
      ${ticket.boardingCity ? `<div class="row"><span class="label">Monte à</span><span class="value">${ticket.boardingCity}</span></div>` : ""}
      ${ticket.alightingCity ? `<div class="row"><span class="label">Descend à</span><span class="value">${ticket.alightingCity}</span></div>` : ""}
      <div class="row"><span class="label">Date</span><span class="value">${ticket.trip.date} à ${ticket.trip.departureTime}</span></div>
      <div class="row"><span class="label">Bus</span><span class="value">${ticket.trip.busName || "—"} (${ticket.trip.plateNumber || "—"})</span></div>
    </div>
    <div class="section">
      <div class="row"><span class="label">Mode de paiement</span><span class="value">${pmLabel}</span></div>
      <div class="row"><span class="label">Montant total</span><span class="value" style="color:#059669;font-size:16px">${amountStr}${spStr}</span></div>
    </div>
    <div class="footer">Billet généré par GoBooking · ${new Date().toLocaleString("fr-FR")}<br/>Présentez ce billet à l'agent d'embarquement</div>
  </body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
export default function VenteScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  /* View state */
  const [view, setView] = useState<"trips" | "detail" | "form">("trips");

  /* Trips list */
  const [trips, setTrips]             = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  /* Selected trip + dashboard */
  const [selectedTrip, setSelectedTrip]       = useState<Trip | null>(null);
  const [dashboard, setDashboard]              = useState<TripDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  /* Sale form */
  const [showForm, setShowForm] = useState(false);
  const [passengerName,  setPassengerName]  = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [paymentMethod,  setPaymentMethod]  = useState("cash");
  const [isSP,           setIsSP]           = useState(false);
  const [boardingCity,   setBoardingCity]   = useState("");
  const [alightingCity,  setAlightingCity]  = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [confirmed, setConfirmed] = useState<{
    bookingRef: string; total: number; seatNumbers?: string[];
    boardingCity?: string; alightingCity?: string; isSP?: boolean;
  } | null>(null);

  /* Reprint modal */
  const [reprintModal, setReprintModal]       = useState(false);
  const [reprintTicket, setReprintTicket]     = useState<TicketData | null>(null);
  const [loadingReprint, setLoadingReprint]   = useState(false);
  const [printingTicket, setPrintingTicket]   = useState(false);

  /* Passenger filter */
  const [passengerFilter, setPassengerFilter] = useState<"all" | "payé" | "réservé" | "sp">("all");

  /* Seat map */
  const [showSeatMap, setShowSeatMap]         = useState(false);
  const [seatMapData, setSeatMapData]         = useState<any[]>([]);
  const [loadingSeatMap, setLoadingSeatMap]   = useState(false);
  const [clickedSeat, setClickedSeat]         = useState<any | null>(null);
  const [seatActionType, setSeatActionType]   = useState<"vendre" | "réserver" | "sp">("vendre");
  const [showSeatModal, setShowSeatModal]     = useState(false);
  const [seatPaxName, setSeatPaxName]         = useState("");
  const [seatPaxPhone, setSeatPaxPhone]       = useState("");
  const [seatSubmitting, setSeatSubmitting]   = useState(false);

  /* ── Fetch trips list ── */
  const fetchTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await apiFetch<Trip[]>("/agent/trips", { token: token ?? undefined });
      const all = Array.isArray(res) ? res : [];
      const today = new Date().toISOString().split("T")[0];
      const yest  = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
      const tmrw  = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
      const active = all.filter(t =>
        (t.date === today || t.date === yest || t.date === tmrw) &&
        !["arrived", "completed", "cancelled"].includes(t.status ?? "")
      );
      setTrips(active);
    } catch {
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, [token]);

  /* ── Fetch trip dashboard ── */
  const fetchDashboard = useCallback(async (tripId: string) => {
    setLoadingDashboard(true);
    try {
      const res = await apiFetch<TripDashboard>(`/agent/guichet/trip/${tripId}`, { token: token ?? undefined });
      setDashboard(res);
    } catch {
      setDashboard(null);
    } finally {
      setLoadingDashboard(false);
    }
  }, [token]);

  /* ── Fetch seat map ── */
  const fetchSeatMap = useCallback(async (tripId: string) => {
    setLoadingSeatMap(true);
    try {
      const res = await apiFetch<any[]>(`/agent/seats/${tripId}`, { token: token ?? undefined });
      setSeatMapData(Array.isArray(res) ? res : []);
    } catch {
      setSeatMapData([]);
    } finally {
      setLoadingSeatMap(false);
    }
  }, [token]);

  /* Auto-refresh on focus */
  useFocusEffect(useCallback(() => {
    fetchTrips();
    if (selectedTrip) { fetchDashboard(selectedTrip.id); fetchSeatMap(selectedTrip.id); }
  }, [fetchTrips, fetchDashboard, fetchSeatMap, selectedTrip]));

  /* ── Polling seat map (15s) when plan is visible ── */
  useEffect(() => {
    if (!showSeatMap || !selectedTrip) return;
    const interval = setInterval(() => fetchSeatMap(selectedTrip.id), 15_000);
    return () => clearInterval(interval);
  }, [showSeatMap, selectedTrip, fetchSeatMap]);

  /* ── Select trip → go to detail view ── */
  const selectTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    const cities = trip.allCities ?? [trip.fromCity ?? trip.from, trip.toCity ?? trip.to];
    setBoardingCity(cities[0] ?? "");
    setAlightingCity(cities[cities.length - 1] ?? "");
    setView("detail");
    setShowSeatMap(false);
    fetchDashboard(trip.id);
    fetchSeatMap(trip.id);
  };

  /* ── Open sale form ── */
  const openForm = () => {
    setConfirmed(null);
    setPassengerName("");
    setPassengerPhone("");
    setPassengerCount("1");
    setPaymentMethod("cash");
    setIsSP(false);
    setShowForm(true);
  };

  /* ── Submit sale ── */
  const handleSubmit = async () => {
    if (!selectedTrip) return;
    if (!passengerName.trim()) { Alert.alert("Erreur", "Saisissez le nom du passager."); return; }
    if (!passengerPhone.trim() && !isSP) { Alert.alert("Erreur", "Saisissez le numéro de téléphone."); return; }
    const count = parseInt(passengerCount) || 1;
    if (count < 1 || count > 10) { Alert.alert("Erreur", "Nombre de passagers invalide (1-10)."); return; }

    setSubmitting(true);
    try {
      if (!networkStatus.isOnline) {
        const offlineRef = `OFFLINE-${Date.now().toString(36).toUpperCase()}`;
        await saveOffline({
          type: "reservation",
          payload: {
            tripId: selectedTrip.id, passengerName: passengerName.trim(),
            passengerPhone: passengerPhone.trim(), passengerCount: count,
            paymentMethod: isSP ? "sp" : paymentMethod, isSP,
          } as any,
          token: token ?? "",
          createdAt: Date.now(),
        });
        setConfirmed({ bookingRef: `OFFLINE-${Date.now()}`, total: isSP ? 0 : selectedTrip.price * count, isSP });
        return;
      }

      const res = await apiFetch<{
        bookingRef?: string; id?: string; seatNumbers?: string[];
        boardingCity?: string; alightingCity?: string;
      }>("/agent/reservations", {
        token: token ?? undefined,
        method: "POST",
        body: {
          tripId:        selectedTrip.id,
          clientName:    passengerName.trim(),
          clientPhone:   passengerPhone.trim(),
          seatCount:     count,
          paymentMethod: isSP ? "sp" : paymentMethod,
          boardingCity:  boardingCity  || (selectedTrip.fromCity ?? selectedTrip.from),
          alightingCity: alightingCity || (selectedTrip.toCity   ?? selectedTrip.to),
          isSP,
        },
      });

      setConfirmed({
        bookingRef:   res.bookingRef ?? res.id ?? "—",
        total:        isSP ? 0 : selectedTrip.price * count,
        seatNumbers:  res.seatNumbers,
        boardingCity: res.boardingCity,
        alightingCity: res.alightingCity,
        isSP,
      });

      // Refresh dashboard
      fetchDashboard(selectedTrip.id);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Reprint ticket ── */
  const handleReprint = async (bookingId: string) => {
    setLoadingReprint(true);
    setReprintTicket(null);
    setReprintModal(true);
    try {
      const data = await apiFetch<TicketData>(`/agent/booking/${bookingId}/ticket-data`, {
        token: token ?? undefined,
      });
      setReprintTicket(data);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les données du billet");
      setReprintModal(false);
    } finally {
      setLoadingReprint(false);
    }
  };

  const printTicket = async () => {
    if (!reprintTicket) return;
    setPrintingTicket(true);
    try {
      const html = buildTicketHtml(reprintTicket);
      if (Platform.OS === "web") {
        Alert.alert("Impression", "Impression non disponible sur le web. Exportez en PDF.");
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch {
      Alert.alert("Erreur", "Impossible d'imprimer le billet");
    } finally {
      setPrintingTicket(false);
    }
  };

  /* ── Convert online booking to voucher ── */
  const handleToVoucher = async (passenger: Passenger) => {
    Alert.alert(
      "Convertir en BON",
      `Convertir la réservation de ${passenger.name} (${passenger.bookingRef}) en BON de transport ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Convertir",
          onPress: async () => {
            try {
              await apiFetch(`/agent/guichet/booking/${passenger.bookingId}/to-voucher`, {
                token: token ?? undefined, method: "POST", body: {},
              });
              fetchDashboard(selectedTrip!.id);
              Alert.alert("Succès", "Réservation convertie en BON.");
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Impossible de convertir en BON");
            }
          },
        },
      ]
    );
  };

  /* ── Cancel guichet ticket (chef/company only) ── */
  const handleCancelGuichet = async (passenger: Passenger) => {
    Alert.alert(
      "Annuler le billet",
      `Annuler le billet de ${passenger.name} (${passenger.bookingRef}) ? La place sera libérée et le montant remis à zéro.`,
      [
        { text: "Non", style: "cancel" },
        {
          text: "Annuler le billet",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/agent/guichet/booking/${passenger.bookingId}/cancel`, {
                token: token ?? undefined, method: "POST", body: { reason: "Annulé par chef d'agence" },
              });
              fetchDashboard(selectedTrip!.id);
              Alert.alert("Succès", "Billet annulé — place libérée.");
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Impossible d'annuler le billet");
            }
          },
        },
      ]
    );
  };

  /* ── Seat map click handler ── */
  const handleSeatClick = (seat: any) => {
    if (seat.status !== "available") return;
    setClickedSeat(seat);
    setSeatPaxName("");
    setSeatPaxPhone("");
    setSeatActionType("vendre");
    setShowSeatModal(true);
  };

  /* ── Submit sale from seat modal ── */
  const handleSeatSale = async () => {
    if (!selectedTrip || !clickedSeat) return;
    if (!seatPaxName.trim()) { Alert.alert("Erreur", "Saisissez le nom du passager."); return; }
    const isSPAction = seatActionType === "sp";
    const isResv     = seatActionType === "réserver";
    setSeatSubmitting(true);
    try {
      const res = await apiFetch<any>("/agent/reservations", {
        token: token ?? undefined,
        method: "POST",
        body: {
          tripId:              selectedTrip.id,
          clientName:          seatPaxName.trim(),
          clientPhone:         seatPaxPhone.trim(),
          seatCount:           1,
          paymentMethod:       isSPAction ? "sp" : "cash",
          boardingCity:        selectedTrip.fromCity ?? selectedTrip.from,
          alightingCity:       selectedTrip.toCity   ?? selectedTrip.to,
          isSP:                isSPAction,
          isReservation:       isResv,
          preferredSeatNumber: clickedSeat.number,
        },
      });
      setShowSeatModal(false);
      fetchDashboard(selectedTrip.id);
      fetchSeatMap(selectedTrip.id);
      const label = isSPAction ? "SP créé" : isResv ? "Réservé" : "Vendu";
      Alert.alert("Succès", `Siège ${clickedSeat.number} — ${label}\nRéf: ${res.bookingRef ?? res.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de traiter la demande");
    } finally {
      setSeatSubmitting(false);
    }
  };

  /* ── Access control ── */
  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={s.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={s.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     HEADER commun
  ──────────────────────────────────────────────────────────────── */
  const Header = ({ backFn }: { backFn?: () => void }) => (
    <View style={s.header}>
      <View style={s.headerRow}>
        {backFn ? (
          <TouchableOpacity onPress={backFn} style={s.headerBack} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={s.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>
            {view === "trips" ? "Espace Vente" : view === "detail" ? `${selectedTrip?.from} → ${selectedTrip?.to}` : "Nouvelle vente"}
          </Text>
          <Text style={s.headerSub}>
            {view === "trips" ? "Sélectionnez un départ" :
             view === "detail" ? `${selectedTrip?.departureTime} · ${selectedTrip?.date}` :
             "Enregistrement passager"}
          </Text>
        </View>
        <TouchableOpacity
          style={s.headerLogout} hitSlop={8}
          onPress={() => {
            if (Platform.OS === "web") { logout(); return; }
            Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Se déconnecter", style: "destructive", onPress: logout },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ═══════════════════════════════════════════════════════
     VUE 1 — LISTE DES TRAJETS
  ═══════════════════════════════════════════════════════ */
  if (view === "trips") {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <OfflineBanner status={networkStatus} />
        <Header />
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <View style={s.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={s.cardTitle}>
                <Ionicons name="bus-outline" size={15} color={G} /> Départs disponibles
              </Text>
              <TouchableOpacity onPress={fetchTrips} hitSlop={8}>
                <Ionicons name="refresh" size={18} color={G} />
              </TouchableOpacity>
            </View>

            {loadingTrips ? (
              <ActivityIndicator color={G} style={{ padding: 20 }} />
            ) : trips.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="bus-outline" size={40} color="#D1FAE5" />
                <Text style={s.emptyText}>Aucun départ disponible</Text>
                <TouchableOpacity onPress={fetchTrips}>
                  <Text style={{ color: G, fontSize: 13, marginTop: 4 }}>Actualiser</Text>
                </TouchableOpacity>
              </View>
            ) : (
              trips.map(trip => {
                const isTransit = trip.status === "en_route" || trip.status === "in_progress";
                const isBoarding = trip.status === "boarding";
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={[s.tripCard, isBoarding && { borderColor: "#F59E0B", borderLeftWidth: 4 }]}
                    onPress={() => selectTrip(trip)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <Text style={s.tripRoute}>{trip.from} → {trip.to}</Text>
                        {isBoarding && (
                          <View style={{ backgroundColor: "#FEF3C7", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}>Embarquement</Text>
                          </View>
                        )}
                        {isTransit && (
                          <View style={{ backgroundColor: G_LIGHT, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: G }}>En transit</Text>
                          </View>
                        )}
                        {trip.tripType && trip.tripType !== "standard" && (
                          <View style={{ backgroundColor: "#EDE9FE", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#7C3AED" }}>{tripTypeLabel(trip.tripType)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.tripMeta}>{trip.departureTime} · {trip.date}</Text>
                      {trip.availableSeats !== undefined && (
                        <Text style={[s.tripMeta, { color: trip.availableSeats <= 5 ? "#EF4444" : G, fontWeight: "600" }]}>
                          {trip.availableSeats} place{trip.availableSeats !== 1 ? "s" : ""} dispo.
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Text style={s.tripPrice}>{trip.price?.toLocaleString()} <Text style={{ fontSize: 11, fontWeight: "400" }}>FCFA</Text></Text>
                      <Ionicons name="chevron-forward" size={18} color="#D1FAE5" />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ═══════════════════════════════════════════════════════
     VUE 2 — DÉTAIL DU DÉPART + LISTE PASSAGERS
  ═══════════════════════════════════════════════════════ */
  if (view === "detail") {
    const d = dashboard;
    const filteredPax = d
      ? (passengerFilter === "all" ? d.passengers : d.passengers.filter(p => p.status === passengerFilter))
      : [];

    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <OfflineBanner status={networkStatus} />
        <Header backFn={() => { setView("trips"); setDashboard(null); setSelectedTrip(null); }} />

        <ScrollView style={s.scroll} contentContainerStyle={s.content}>

          {/* ── Infos trajet ── */}
          {d && (
            <View style={[s.card, { gap: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
                    {d.trip.from} → {d.trip.to}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                    {d.trip.date} · {d.trip.departureTime}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => fetchDashboard(selectedTrip!.id)} hitSlop={8}>
                  <Ionicons name="refresh" size={18} color={G} />
                </TouchableOpacity>
              </View>
              {d.trip.busName && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="bus" size={14} color={G} />
                  <Text style={{ fontSize: 13, color: "#374151" }}>
                    {d.trip.busName} · {d.trip.plateNumber || "—"} · {d.trip.busType || "—"}
                  </Text>
                </View>
              )}
              {/* Seat stats bar */}
              <View style={s.statsGrid}>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{d.seats.total}</Text>
                  <Text style={s.statLbl}>Places totales</Text>
                </View>
                <View style={[s.statBox, { backgroundColor: G_LIGHT }]}>
                  <Text style={[s.statNum, { color: G }]}>{d.seats.availGuichet}</Text>
                  <Text style={[s.statLbl, { color: G }]}>Dispo guichet</Text>
                </View>
                <View style={[s.statBox, { backgroundColor: "#EFF6FF" }]}>
                  <Text style={[s.statNum, { color: "#2563EB" }]}>{d.seats.usedOnline}</Text>
                  <Text style={[s.statLbl, { color: "#2563EB" }]}>En ligne</Text>
                </View>
                <View style={[s.statBox, { backgroundColor: "#EDE9FE" }]}>
                  <Text style={[s.statNum, { color: "#7C3AED" }]}>{d.seats.usedSP}</Text>
                  <Text style={[s.statLbl, { color: "#7C3AED" }]}>SP</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Bouton Nouvelle Vente ── */}
          <TouchableOpacity style={s.newSaleBtn} onPress={openForm} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={s.newSaleBtnText}>Nouvelle vente / Billet SP</Text>
          </TouchableOpacity>

          {/* ── Toggle Passagers / Plan sièges ── */}
          <View style={s.viewToggleRow}>
            <TouchableOpacity
              style={[s.viewToggleBtn, !showSeatMap && s.viewToggleBtnActive]}
              onPress={() => setShowSeatMap(false)}
            >
              <Ionicons name="people-outline" size={15} color={!showSeatMap ? G : "#9CA3AF"} />
              <Text style={[s.viewToggleTxt, !showSeatMap && s.viewToggleTxtActive]}>
                Passagers ({d?.totals.passengersCount ?? 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, showSeatMap && s.viewToggleBtnActive]}
              onPress={() => { setShowSeatMap(true); if (selectedTrip && seatMapData.length === 0) fetchSeatMap(selectedTrip.id); }}
            >
              <Ionicons name="grid-outline" size={15} color={showSeatMap ? G : "#9CA3AF"} />
              <Text style={[s.viewToggleTxt, showSeatMap && s.viewToggleTxtActive]}>Plan sièges</Text>
            </TouchableOpacity>
          </View>

          {/* ── PLAN DES SIÈGES ── */}
          {showSeatMap && (() => {
            const rows = [...new Set(seatMapData.map(s => s.row))].sort((a, b) => a - b);
            const seatByRowCol: Record<string, Record<number, any>> = {};
            for (const seat of seatMapData) {
              if (!seatByRowCol[seat.row]) seatByRowCol[seat.row] = {};
              seatByRowCol[seat.row][seat.column] = seat;
            }
            const maxCols = Math.max(...seatMapData.map(s => s.column), 0);
            const midPoint = Math.ceil(maxCols / 2);
            return (
              <View style={s.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={s.cardTitle}><Ionicons name="grid-outline" size={15} color={G} /> Plan des sièges</Text>
                  {loadingSeatMap && <ActivityIndicator color={G} size="small" />}
                  <TouchableOpacity onPress={() => selectedTrip && fetchSeatMap(selectedTrip.id)} hitSlop={8}>
                    <Ionicons name="refresh" size={18} color={G} />
                  </TouchableOpacity>
                </View>
                {/* Legend */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  {SEAT_LEGEND.map(item => {
                    const c = getSeatColor(item.status);
                    return (
                      <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border }} />
                        <Text style={{ fontSize: 11, color: "#6B7280" }}>{item.label}</Text>
                      </View>
                    );
                  })}
                </View>
                {/* Driver row */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 }}>
                  <View style={{ backgroundColor: "#F3F4F6", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="person" size={12} color="#6B7280" />
                    <Text style={{ fontSize: 11, color: "#6B7280" }}>Chauffeur</Text>
                  </View>
                </View>
                {/* Seat grid */}
                {rows.map(rowNum => {
                  const colMap = seatByRowCol[rowNum] ?? {};
                  const colNums = Object.keys(colMap).map(Number).sort((a, b) => a - b);
                  return (
                    <View key={rowNum} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }}>
                      <Text style={{ width: 20, fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>{rowNum}</Text>
                      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                        {colNums.map((col, ci) => {
                          const seat = colMap[col];
                          const c = getSeatColor(seat.status);
                          const isAvail = seat.status === "available";
                          const isMidGap = col > midPoint && colNums[ci - 1] <= midPoint;
                          return (
                            <React.Fragment key={col}>
                              {isMidGap && <View style={{ width: 12 }} />}
                              <TouchableOpacity
                                style={[s.seatBox, { backgroundColor: c.bg, borderColor: c.border }]}
                                onPress={() => handleSeatClick(seat)}
                                disabled={!isAvail}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.seatBoxTxt, { color: c.text }]}>{seat.number}</Text>
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                  Appuyez sur un siège libre (gris) pour le vendre, réserver ou marquer SP
                </Text>
              </View>
            );
          })()}

          {/* ── Liste passagers (masquée si plan sièges actif) ── */}
          {!showSeatMap && (
          <View style={s.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={s.cardTitle}>
                <Ionicons name="people-outline" size={15} color={G} /> Passagers
                {d ? ` (${d.totals.passengersCount})` : ""}
              </Text>
              {loadingDashboard && <ActivityIndicator color={G} size="small" />}
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { id: "all" as const, label: `Tous (${d?.totals.passengersCount ?? 0})` },
                  { id: "payé" as const, label: `Payé (${d?.totals.payéCount ?? 0})` },
                  { id: "réservé" as const, label: `Réservé (${d?.totals.réservéCount ?? 0})` },
                  { id: "sp" as const, label: `SP (${d?.totals.spCount ?? 0})` },
                ].map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.filterChip, passengerFilter === f.id && s.filterChipActive]}
                    onPress={() => setPassengerFilter(f.id)}
                  >
                    <Text style={[s.filterChipText, passengerFilter === f.id && s.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Passenger rows */}
            {loadingDashboard && !d ? (
              <ActivityIndicator color={G} style={{ padding: 20 }} />
            ) : filteredPax.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="person-outline" size={32} color="#D1FAE5" />
                <Text style={s.emptyText}>Aucun passager</Text>
              </View>
            ) : (
              filteredPax.map((p, idx) => {
                const srcBadge = sourceBadge(p.source);
                const isOnline = p.source === "online" || p.source === "mobile";
                return (
                  <View key={`${p.bookingId}-${idx}`} style={s.paxRow}>
                    {/* Left: avatar + status */}
                    <View style={[s.paxAvatar, { backgroundColor: statusBg(p.status) }]}>
                      <Ionicons
                        name={p.status === "à_bord" ? "checkmark-circle" : p.status === "sp" ? "star" : "person"}
                        size={18}
                        color={statusColor(p.status)}
                      />
                    </View>

                    {/* Center: info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={s.paxName}>{p.name || "—"}</Text>
                        {/* Status badge */}
                        <View style={{ backgroundColor: statusBg(p.status), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor(p.status) }}>
                            {statusLabel(p.status)}
                          </Text>
                        </View>
                        {/* Source badge */}
                        <View style={{ backgroundColor: srcBadge.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: "600", color: srcBadge.color }}>{srcBadge.label}</Text>
                        </View>
                      </View>
                      <Text style={s.paxPhone}>{p.phone || "—"}</Text>
                      <Text style={s.paxRef}>{p.bookingRef}</Text>
                      {p.seatNumbers.length > 0 && (
                        <Text style={{ fontSize: 11, color: G, fontWeight: "600", marginTop: 1 }}>
                          Siège{p.seatNumbers.length > 1 ? "s" : ""}: {p.seatNumbers.join(", ")}
                        </Text>
                      )}
                      <Text style={{ fontSize: 12, color: "#374151", marginTop: 1, fontWeight: "600" }}>
                        {p.status === "sp" ? "SP — Gratuit" : `${(p.amount ?? 0).toLocaleString()} FCFA`}
                      </Text>
                    </View>

                    {/* Right: actions */}
                    <View style={{ gap: 6, alignItems: "flex-end" }}>
                      {/* Reprint */}
                      <TouchableOpacity
                        style={s.paxActionBtn}
                        onPress={() => handleReprint(p.bookingId)}
                        hitSlop={6}
                      >
                        <Ionicons name="print-outline" size={16} color={G} />
                      </TouchableOpacity>
                      {/* Convert to voucher (online only, not boarded) */}
                      {isOnline && p.status !== "à_bord" && (
                        <TouchableOpacity
                          style={[s.paxActionBtn, { borderColor: "#7C3AED" }]}
                          onPress={() => handleToVoucher(p)}
                          hitSlop={6}
                        >
                          <Ionicons name="gift-outline" size={16} color="#7C3AED" />
                        </TouchableOpacity>
                      )}
                      {/* Cancel guichet (chef/company only) */}
                      {!isOnline && p.status !== "à_bord" && (
                        <TouchableOpacity
                          style={[s.paxActionBtn, { borderColor: "#EF4444" }]}
                          onPress={() => handleCancelGuichet(p)}
                          hitSlop={6}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
          )}

          {/* Revenue summary */}
          {!showSeatMap && d && (
            <View style={s.revCard}>
              <View style={s.revRow}>
                <Text style={s.revKey}>Total passagers</Text>
                <Text style={s.revVal}>{d.totals.passengersCount}</Text>
              </View>
              <View style={s.revRow}>
                <Text style={s.revKey}>Recette guichet</Text>
                <Text style={[s.revVal, { color: G, fontWeight: "800" }]}>{(d.totals.revenue ?? 0).toLocaleString()} FCFA</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ─── Seat Action Modal ─── */}
        <Modal visible={showSeatModal} animationType="slide" transparent onRequestClose={() => setShowSeatModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.reprintModal, { paddingBottom: 48 }]}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 8, padding: 8 }}>
                    <Ionicons name="grid-outline" size={20} color={G} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>Siège {clickedSeat?.number}</Text>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>{selectedTrip?.from} → {selectedTrip?.to}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowSeatModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Action type selector */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {([
                  { key: "vendre" as const,   label: "Vendre",   icon: "cash-outline" as const,  color: G,        bg: G_LIGHT },
                  { key: "réserver" as const, label: "Réserver", icon: "bookmark-outline" as const, color: "#D97706", bg: "#FEF3C7" },
                  { key: "sp" as const,       label: "SP",       icon: "star-outline" as const,  color: "#7C3AED", bg: "#EDE9FE" },
                ] as const).map(action => (
                  <TouchableOpacity
                    key={action.key}
                    style={{ flex: 1, backgroundColor: seatActionType === action.key ? action.bg : "#F9FAFB", borderWidth: 2, borderColor: seatActionType === action.key ? action.color : "#E5E7EB", borderRadius: 10, padding: 10, alignItems: "center", gap: 4 }}
                    onPress={() => setSeatActionType(action.key)}
                  >
                    <Ionicons name={action.icon} size={20} color={seatActionType === action.key ? action.color : "#9CA3AF"} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: seatActionType === action.key ? action.color : "#9CA3AF" }}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* SP badge */}
              {seatActionType === "sp" && (
                <View style={{ backgroundColor: "#EDE9FE", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Ionicons name="star" size={16} color="#7C3AED" />
                  <Text style={{ fontSize: 12, color: "#6D28D9", fontWeight: "600" }}>Sans Payer — Montant = 0 FCFA · Place occupée</Text>
                </View>
              )}
              {seatActionType === "réserver" && (
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Ionicons name="time-outline" size={16} color="#D97706" />
                  <Text style={{ fontSize: 12, color: "#92400E", fontWeight: "600" }}>Réservation — annulée auto. 45 min avant départ</Text>
                </View>
              )}

              {/* Passenger info */}
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4 }}>Nom complet *</Text>
              <TextInput
                style={[s.input, { marginBottom: 10 }]}
                placeholder="Ex: Kouamé Jean"
                value={seatPaxName}
                onChangeText={setSeatPaxName}
              />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4 }}>Téléphone</Text>
              <TextInput
                style={[s.input, { marginBottom: 16 }]}
                placeholder="Ex: 07 12 34 56"
                value={seatPaxPhone}
                onChangeText={setSeatPaxPhone}
                keyboardType="phone-pad"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitBtn, seatSubmitting && s.submitBtnDisabled,
                  seatActionType === "sp" ? { backgroundColor: "#7C3AED" } :
                  seatActionType === "réserver" ? { backgroundColor: "#D97706" } : {}
                ]}
                onPress={handleSeatSale}
                disabled={seatSubmitting}
              >
                {seatSubmitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name={seatActionType === "sp" ? "star-outline" : seatActionType === "réserver" ? "bookmark-outline" : "checkmark-circle-outline"} size={20} color="#fff" />
                    <Text style={s.submitBtnText}>
                      {seatActionType === "sp" ? "Créer ticket SP" : seatActionType === "réserver" ? "Réserver ce siège" : "Valider la vente"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ─── Sale Form Modal ─── */}
        <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: G_DARK }} edges={["top"]}>
            <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
            <View style={s.header}>
              <View style={s.headerRow}>
                <TouchableOpacity onPress={() => { setShowForm(false); setConfirmed(null); }} style={s.headerBack} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={s.headerTitle}>Nouvelle vente</Text>
                  <Text style={s.headerSub}>{selectedTrip?.from} → {selectedTrip?.to} · {selectedTrip?.departureTime}</Text>
                </View>
              </View>
            </View>

            <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              {confirmed ? (
                /* ── Confirmation ── */
                <View style={{ alignItems: "center", paddingTop: 24, gap: 16 }}>
                  <Ionicons name={confirmed.isSP ? "star-circle" : "checkmark-circle"} size={72} color={confirmed.isSP ? "#7C3AED" : G} />
                  <Text style={s.successTitle}>{confirmed.isSP ? "Ticket SP créé !" : "Vente enregistrée !"}</Text>
                  <Text style={s.successRef}>Réf: {confirmed.bookingRef}</Text>
                  {confirmed.isSP ? (
                    <View style={{ backgroundColor: "#EDE9FE", borderRadius: 12, padding: 14, width: "100%", alignItems: "center" }}>
                      <Ionicons name="star" size={20} color="#7C3AED" />
                      <Text style={{ color: "#7C3AED", fontWeight: "700", fontSize: 15, marginTop: 4 }}>Sans Payer (SP)</Text>
                      <Text style={{ color: "#6D28D9", fontSize: 13, marginTop: 2 }}>Place occupée · Montant = 0 FCFA</Text>
                    </View>
                  ) : (
                    <Text style={s.successTotal}>Total: {(confirmed.total ?? 0).toLocaleString()} FCFA</Text>
                  )}
                  {confirmed.seatNumbers && confirmed.seatNumbers.length > 0 && (
                    <View style={{ backgroundColor: G_LIGHT, borderRadius: 12, padding: 14, width: "100%", borderWidth: 1, borderColor: "#A7F3D0" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: G_DARK, marginBottom: 6 }}>Sièges attribués</Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {confirmed.seatNumbers.map(sn => (
                          <View key={sn} style={{ backgroundColor: G, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: "#fff", fontWeight: "800" }}>{sn}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  <TouchableOpacity style={[s.submitBtn, { width: "100%" }]} onPress={() => { setConfirmed(null); openForm(); }}>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={s.submitBtnText}>Nouvelle vente</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.submitBtn, { width: "100%", backgroundColor: G_DARK }]} onPress={() => { setShowForm(false); setConfirmed(null); }}>
                    <Ionicons name="list-outline" size={20} color="#fff" />
                    <Text style={s.submitBtnText}>Retour à la liste</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── Form ── */
                <>
                  {/* SP toggle */}
                  <TouchableOpacity
                    style={[s.spToggle, isSP && s.spToggleActive]}
                    onPress={() => setIsSP(v => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name={isSP ? "star" : "star-outline"} size={22} color={isSP ? "#fff" : "#7C3AED"} />
                      <View>
                        <Text style={[s.spToggleLabel, isSP && { color: "#fff" }]}>Ticket SP (Sans Payer)</Text>
                        <Text style={[s.spToggleSub, isSP && { color: "#C4B5FD" }]}>Montant = 0 · Place occupée · Visible partout</Text>
                      </View>
                    </View>
                    <View style={[s.spCheckBox, isSP && s.spCheckBoxActive]}>
                      {isSP && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>

                  {/* Infos passager */}
                  <View style={s.card}>
                    <Text style={s.cardTitle}><Ionicons name="person-outline" size={15} color={G} /> Informations passager</Text>
                    <Text style={s.label}>Nom complet *</Text>
                    <TextInput style={s.input} placeholder="Ex: Kouamé Jean" value={passengerName} onChangeText={setPassengerName} />
                    <Text style={s.label}>Téléphone {isSP ? "" : "*"}</Text>
                    <TextInput style={s.input} placeholder="Ex: 07 12 34 56 78" value={passengerPhone} onChangeText={setPassengerPhone} keyboardType="phone-pad" />
                    <Text style={s.label}>Nombre de passagers</Text>
                    <View style={s.countRow}>
                      <TouchableOpacity style={s.countBtn} onPress={() => setPassengerCount(c => String(Math.max(1, parseInt(c) - 1)))}>
                        <Ionicons name="remove" size={18} color={G} />
                      </TouchableOpacity>
                      <TextInput style={s.countInput} value={passengerCount} onChangeText={setPassengerCount} keyboardType="number-pad" textAlign="center" />
                      <TouchableOpacity style={s.countBtn} onPress={() => setPassengerCount(c => String(Math.min(10, parseInt(c) + 1)))}>
                        <Ionicons name="add" size={18} color={G} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Mode paiement (masqué si SP) */}
                  {!isSP && (
                    <View style={s.card}>
                      <Text style={s.cardTitle}><Ionicons name="wallet-outline" size={15} color={G} /> Mode de paiement</Text>
                      <View style={s.paymentGrid}>
                        {PAYMENT_METHODS.map(pm => (
                          <TouchableOpacity
                            key={pm.id}
                            style={[s.paymentItem, paymentMethod === pm.id && s.paymentItemSelected]}
                            onPress={() => setPaymentMethod(pm.id)}
                          >
                            <Ionicons name={pm.icon} size={22} color={paymentMethod === pm.id ? G : "#9CA3AF"} />
                            <Text style={[s.paymentLabel, paymentMethod === pm.id && s.paymentLabelSelected]}>{pm.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Récapitulatif */}
                  <View style={[s.summaryCard, isSP && { backgroundColor: "#EDE9FE", borderColor: "#C4B5FD" }]}>
                    <Text style={[s.summaryTitle, isSP && { color: "#7C3AED" }]}>Récapitulatif</Text>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryKey}>Trajet</Text>
                      <Text style={s.summaryVal}>{selectedTrip?.from} → {selectedTrip?.to}</Text>
                    </View>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryKey}>Passagers</Text>
                      <Text style={s.summaryVal}>{passengerCount}</Text>
                    </View>
                    <View style={[s.summaryRow, { borderTopWidth: 1, borderColor: isSP ? "#C4B5FD" : "#D1FAE5", paddingTop: 10, marginTop: 4 }]}>
                      <Text style={[s.summaryKey, { fontWeight: "700", color: "#111827" }]}>Total</Text>
                      <Text style={[s.summaryVal, { fontWeight: "800", fontSize: 16, color: isSP ? "#7C3AED" : G }]}>
                        {isSP ? "0 FCFA (SP)" : `${((selectedTrip?.price ?? 0) * (parseInt(passengerCount) || 1)).toLocaleString()} FCFA`}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[s.submitBtn, submitting && s.submitBtnDisabled, isSP && { backgroundColor: "#7C3AED" }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name={isSP ? "star-outline" : "checkmark-circle-outline"} size={22} color="#fff" />
                        <Text style={s.submitBtnText}>{isSP ? "Créer ticket SP" : "Valider la vente"}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* ─── Reprint Modal ─── */}
        <Modal visible={reprintModal} animationType="fade" transparent onRequestClose={() => setReprintModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.reprintModal}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>Réimpression billet</Text>
                <TouchableOpacity onPress={() => setReprintModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {loadingReprint ? (
                <ActivityIndicator color={G} style={{ padding: 20 }} />
              ) : reprintTicket ? (
                <>
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 10, padding: 14, gap: 6, marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Référence</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: G }}>{reprintTicket.bookingRef}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Passager</Text>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#111827" }}>{reprintTicket.passengerName}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Trajet</Text>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#111827" }}>{reprintTicket.trip.from} → {reprintTicket.trip.to}</Text>
                    </View>
                    {reprintTicket.seatNumbers.length > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, color: "#6B7280" }}>Siège(s)</Text>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: G }}>{reprintTicket.seatNumbers.join(", ")}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Montant</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: reprintTicket.paymentStatus === "sp" ? "#7C3AED" : G }}>
                        {reprintTicket.paymentStatus === "sp" ? "SP — 0 FCFA" : `${(reprintTicket.amount ?? 0).toLocaleString()} FCFA`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.submitBtn, printingTicket && s.submitBtnDisabled]}
                    onPress={printTicket}
                    disabled={printingTicket}
                  >
                    {printingTicket ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="print-outline" size={20} color="#fff" />
                        <Text style={s.submitBtnText}>Imprimer / Partager PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return null;
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: G_DARK },
  denied:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText:  { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header:      { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 14 },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon:  { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerBack:  { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerLogout:{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub:   { color: "#A7F3D0", fontSize: 12, marginTop: 1 },

  scroll:   { flex: 1, backgroundColor: "#F9FAFB" },
  content:  { padding: 16, gap: 14, paddingBottom: 40 },

  card:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },

  tripCard:  { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, backgroundColor: "#fff" },
  tripRoute: { fontSize: 15, fontWeight: "800", color: "#111827" },
  tripMeta:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tripPrice: { fontSize: 16, fontWeight: "800", color: G },

  emptyBox:  { alignItems: "center", gap: 8, padding: 24 },
  emptyText: { fontSize: 14, color: "#9CA3AF" },

  statsGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statBox:   { flex: 1, minWidth: 70, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, alignItems: "center", gap: 2 },
  statNum:   { fontSize: 20, fontWeight: "800", color: "#111827" },
  statLbl:   { fontSize: 10, color: "#6B7280", textAlign: "center" },

  newSaleBtn:     { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 12 },
  newSaleBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  filterChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  filterChipActive:   { backgroundColor: G_LIGHT, borderColor: G },
  filterChipText:     { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  filterChipTextActive: { color: G },

  paxRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#F3F4F6" },
  paxAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  paxName:   { fontSize: 14, fontWeight: "700", color: "#111827" },
  paxPhone:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  paxRef:    { fontSize: 11, color: "#9CA3AF", marginTop: 1, letterSpacing: 0.5 },
  paxActionBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: G, justifyContent: "center", alignItems: "center" },

  revCard: { backgroundColor: G_LIGHT, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#D1FAE5", gap: 8 },
  revRow:  { flexDirection: "row", justifyContent: "space-between" },
  revKey:  { fontSize: 13, color: "#6B7280" },
  revVal:  { fontSize: 13, fontWeight: "600", color: "#111827" },

  spToggle:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#EDE9FE", borderRadius: 12, padding: 14, borderWidth: 2, borderColor: "#C4B5FD" },
  spToggleActive:{ backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  spToggleLabel: { fontSize: 14, fontWeight: "700", color: "#7C3AED" },
  spToggleSub:   { fontSize: 11, color: "#6D28D9", marginTop: 2 },
  spCheckBox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#C4B5FD", justifyContent: "center", alignItems: "center" },
  spCheckBoxActive: { backgroundColor: "#fff", borderColor: "#fff" },

  label:      { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input:      { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT, marginBottom: 10 },

  countRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn:   { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: G, alignItems: "center", justifyContent: "center" },
  countInput: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, width: 64, paddingVertical: 8, fontSize: 16, fontWeight: "700", color: "#111827", backgroundColor: G_LIGHT, textAlign: "center" },

  paymentGrid:         { flexDirection: "row", gap: 10 },
  paymentItem:         { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, alignItems: "center", gap: 6 },
  paymentItemSelected: { borderColor: G, backgroundColor: G_LIGHT },
  paymentLabel:        { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  paymentLabelSelected:{ color: G, fontWeight: "600" },

  summaryCard:   { backgroundColor: G_LIGHT, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#D1FAE5", gap: 8 },
  summaryTitle:  { fontSize: 14, fontWeight: "700", color: G_DARK, marginBottom: 4 },
  summaryRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryKey:    { fontSize: 13, color: "#6B7280" },
  summaryVal:    { fontSize: 13, fontWeight: "600", color: "#111827" },

  submitBtn:         { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },

  successTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  successRef:   { fontSize: 15, fontWeight: "600", color: G, marginTop: 4 },
  successTotal: { fontSize: 15, color: "#374151", marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  reprintModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },

  viewToggleRow:       { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, gap: 4 },
  viewToggleBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 8 },
  viewToggleBtnActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  viewToggleTxt:       { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  viewToggleTxtActive: { color: G },

  seatBox:    { width: 44, height: 40, borderRadius: 8, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  seatBoxTxt: { fontSize: 11, fontWeight: "700" },
});
