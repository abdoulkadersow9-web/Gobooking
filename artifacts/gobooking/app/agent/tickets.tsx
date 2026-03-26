import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Print from "expo-print";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import OfflineBanner from "@/components/OfflineBanner";

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
}

const PAYMENT_METHODS = [
  { id: "cash",   label: "Espèces",      icon: "cash-outline" as const },
  { id: "orange", label: "Orange Money", icon: "phone-portrait-outline" as const },
  { id: "mtn",    label: "MTN Money",    icon: "phone-portrait-outline" as const },
  { id: "wave",   label: "Wave",         icon: "phone-portrait-outline" as const },
];

const CITIES = [
  "Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro",
  "Korhogo", "Man", "Divo", "Gagnoa", "Abengourou",
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
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState<"vente" | "depart">("vente");

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

  /* ── Créer départ state ── */
  const [fleetBuses, setFleetBuses]       = useState<BusFleet[]>([]);
  const [loadingBuses, setLoadingBuses]   = useState(false);
  const [selectedBus, setSelectedBus]     = useState<BusFleet | null>(null);
  const [dFrom, setDFrom]                 = useState("");
  const [dTo, setDTo]                     = useState("");
  const [dDate, setDDate]                 = useState(todayStr());
  const [dHeure, setDHeure]               = useState("08:00");
  const [dPrix, setDPrix]                 = useState("");
  const [dGuichet, setDGuichet]           = useState("20");
  const [dOnline, setDOnline]             = useState("24");
  const [dChauffeur, setDChauffeur]       = useState("");
  const [dAgentRoute, setDAgentRoute]     = useState("");
  const [creatingDep, setCreatingDep]     = useState(false);
  const [depSuccess, setDepSuccess]       = useState<string | null>(null);

  const isAgent = user?.role === "agent";

  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const res = await apiFetch("/agent/trips", { token: token ?? undefined });
      setTrips(Array.isArray(res) ? res : []);
    } catch {
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

  useEffect(() => { fetchTrips(); }, []);
  useEffect(() => {
    if (activeTab === "depart" && fleetBuses.length === 0) fetchFleetBuses();
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
    if (!passengerPhone.trim()) { Alert.alert("Erreur", "Saisissez le numéro de téléphone."); return; }
    if (!paymentMethod) { Alert.alert("Erreur", "Sélectionnez un mode de paiement."); return; }
    const count = parseInt(passengerCount) || 1;
    if (count < 1 || count > 10) { Alert.alert("Erreur", "Nombre de passagers invalide (1-10)."); return; }
    const pmLabel = PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label ?? paymentMethod;

    setSubmitting(true);
    try {
      if (!networkStatus.isOnline) {
        const offlineRef = `OFFLINE-${Date.now().toString(36).toUpperCase()}`;
        await saveOffline({
          type: "reservation",
          payload: { tripId: selectedTrip.id, passengerName: passengerName.trim(),
            passengerPhone: passengerPhone.trim(), seatCount: count, paymentMethod },
          token: token ?? "", createdAt: Date.now(),
        });
        setConfirmed({ bookingRef: offlineRef, total: selectedTrip.price * count,
          passengerName: passengerName.trim(), passengerPhone: passengerPhone.trim(),
          seatCount: count, trip: selectedTrip, paymentLabel: pmLabel });
        return;
      }
      const res = await apiFetch<{ bookingRef?: string; id?: string }>("/agent/reservations", {
        token: token ?? undefined, method: "POST",
        body: { tripId: selectedTrip.id, clientName: passengerName.trim(),
          clientPhone: passengerPhone.trim(), seatCount: count, paymentMethod },
      });
      setConfirmed({
        bookingRef: res.bookingRef ?? res.id ?? "—",
        total: selectedTrip.price * count,
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.trim(),
        seatCount: count,
        trip: selectedTrip,
        paymentLabel: pmLabel,
      });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Créer départ submit ── */
  const handleCreateDeparture = async () => {
    if (!dFrom.trim()) { Alert.alert("Erreur", "Saisissez la ville de départ."); return; }
    if (!dTo.trim()) { Alert.alert("Erreur", "Saisissez la ville d'arrivée."); return; }
    if (!dDate.trim()) { Alert.alert("Erreur", "Saisissez la date."); return; }
    if (!dHeure.trim()) { Alert.alert("Erreur", "Saisissez l'heure de départ."); return; }
    if (!dPrix.trim() || isNaN(parseFloat(dPrix))) { Alert.alert("Erreur", "Saisissez un prix valide."); return; }
    const gSeats = parseInt(dGuichet) || 0;
    const oSeats = parseInt(dOnline) || 0;
    if (gSeats + oSeats === 0) { Alert.alert("Erreur", "Saisissez au moins une place guichet ou en ligne."); return; }
    if (selectedBus && gSeats + oSeats > selectedBus.capacity) {
      Alert.alert("Erreur", `Total (${gSeats + oSeats}) dépasse la capacité du bus (${selectedBus.capacity}).`);
      return;
    }

    setCreatingDep(true);
    try {
      const res = await apiFetch<{ success: boolean; id: string; message: string }>("/agent/guichet/departures", {
        token: token ?? undefined, method: "POST",
        body: {
          busId: selectedBus?.id,
          from: dFrom.trim(), to: dTo.trim(),
          date: dDate.trim(), departureTime: dHeure.trim(),
          price: parseFloat(dPrix),
          guichetSeats: gSeats, onlineSeats: oSeats,
          chauffeurNom: dChauffeur.trim() || undefined,
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
    setDPrix(""); setDGuichet("20"); setDOnline("24");
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
          <TouchableOpacity onPress={logout} style={S.logoutBtn}>
            <Text style={S.logoutTxt}>Déco.</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[S.content, { alignItems: "center", paddingTop: 32 }]}>
          <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
          <Text style={S.successTitle}>Billet émis !</Text>

          <View style={S.ticketCard}>
            <View style={S.ticketCardHeader}>
              <Text style={S.ticketRef}>{confirmed.bookingRef}</Text>
            </View>
            <Text style={S.ticketRoute}>{confirmed.trip.from} → {confirmed.trip.to}</Text>
            {[
              { k: "Passager",   v: confirmed.passengerName },
              { k: "Téléphone",  v: confirmed.passengerPhone },
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
              <Text style={S.ticketTotalVal}>{confirmed.total.toLocaleString("fr-FR")} FCFA</Text>
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
        <TouchableOpacity onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déco.</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── */}
      <View style={S.tabBar}>
        <TouchableOpacity style={[S.tab, activeTab === "vente" && S.tabActive]} onPress={() => setActiveTab("vente")}>
          <Ionicons name="ticket-outline" size={16} color={activeTab === "vente" ? G_DARK : "#9CA3AF"} />
          <Text style={[S.tabTxt, activeTab === "vente" && S.tabTxtActive]}>Vente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, activeTab === "depart" && S.tabActive]} onPress={() => setActiveTab("depart")}>
          <Ionicons name="bus-outline" size={16} color={activeTab === "depart" ? G_DARK : "#9CA3AF"} />
          <Text style={[S.tabTxt, activeTab === "depart" && S.tabTxtActive]}>Créer départ</Text>
        </TouchableOpacity>
      </View>

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
              <View style={{ gap: 8 }}>
                {trips.map(trip => (
                  <TouchableOpacity key={trip.id}
                    style={[S.tripItem, selectedTrip?.id === trip.id && S.tripItemSel]}
                    onPress={() => setSelectedTrip(trip)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                      <Text style={S.tripMeta}>{trip.departureTime} · {trip.date}</Text>
                      {trip.guichetSeats !== undefined && trip.guichetSeats > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
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
                        <Text style={{ fontSize: 12, color: G, marginTop: 1 }}>{trip.availableSeats} places dispo.</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={S.tripPrice}>{trip.price?.toLocaleString()}</Text>
                      <Text style={{ fontSize: 11, color: "#9CA3AF" }}>FCFA</Text>
                    </View>
                    {selectedTrip?.id === trip.id && <Ionicons name="checkmark-circle" size={20} color={G} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* PASSAGER */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <Ionicons name="person-outline" size={18} color={G} />
              <Text style={S.cardTitle}>Informations passager</Text>
            </View>
            <Text style={S.label}>Nom complet *</Text>
            <TextInput style={S.input} placeholder="Ex: Kouamé Jean" value={passengerName} onChangeText={setPassengerName} />
            <Text style={S.label}>Téléphone *</Text>
            <TextInput style={S.input} placeholder="Ex: 07 12 34 56 78" value={passengerPhone}
              onChangeText={setPassengerPhone} keyboardType="phone-pad" />
            <Text style={S.label}>Nombre de passagers</Text>
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

          {/* PAIEMENT */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <Ionicons name="wallet-outline" size={18} color={G} />
              <Text style={S.cardTitle}>Mode de paiement *</Text>
            </View>
            {!paymentMethod && (
              <Text style={{ fontSize: 12, color: "#EF4444", marginBottom: 6 }}>
                Veuillez sélectionner un mode de paiement
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
          </View>

          {/* RECAP */}
          {selectedTrip && (
            <View style={S.recap}>
              <Text style={S.recapTitle}>Récapitulatif</Text>
              <View style={S.recapRow}><Text style={S.recapKey}>Trajet</Text><Text style={S.recapVal}>{selectedTrip.from} → {selectedTrip.to}</Text></View>
              <View style={S.recapRow}><Text style={S.recapKey}>Départ</Text><Text style={S.recapVal}>{selectedTrip.departureTime}</Text></View>
              <View style={S.recapRow}><Text style={S.recapKey}>Passagers</Text><Text style={S.recapVal}>{passengerCount}</Text></View>
              <View style={[S.recapRow, { borderTopWidth: 1, borderColor: "#FDE68A", paddingTop: 8, marginTop: 4 }]}>
                <Text style={[S.recapKey, { fontWeight: "700", color: G_DARK }]}>TOTAL</Text>
                <Text style={[S.recapVal, { fontWeight: "800", color: G, fontSize: 18 }]}>
                  {(selectedTrip.price * (parseInt(passengerCount) || 1)).toLocaleString()} FCFA
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={[S.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <Text style={S.submitTxt}>Valider la vente</Text>
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

              {/* ── Route ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="navigate-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Itinéraire</Text>
                </View>
                <Text style={S.label}>Ville de départ *</Text>
                <TextInput style={S.input} placeholder="Ex: Abidjan" value={dFrom} onChangeText={setDFrom} />
                <Text style={S.label}>Ville d'arrivée *</Text>
                <TextInput style={S.input} placeholder="Ex: Bouaké" value={dTo} onChangeText={setDTo} />

                <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Villes fréquentes :</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {CITIES.map(city => (
                    <TouchableOpacity key={city}
                      style={{ backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                      onPress={() => {
                        if (!dFrom) setDFrom(city);
                        else if (!dTo) setDTo(city);
                      }}>
                      <Text style={{ fontSize: 11, color: "#374151", fontWeight: "600" }}>{city}</Text>
                    </TouchableOpacity>
                  ))}
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

              {/* ── Prix & quotas ── */}
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Ionicons name="wallet-outline" size={18} color={G} />
                  <Text style={S.cardTitle}>Prix & places</Text>
                </View>
                <Text style={S.label}>Prix du billet (FCFA) *</Text>
                <TextInput style={S.input} placeholder="Ex: 3500" value={dPrix} onChangeText={setDPrix}
                  keyboardType="number-pad" />

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
                <View style={S.recapRow}><Text style={S.recapKey}>Trajet</Text><Text style={S.recapVal}>{dFrom || "—"} → {dTo || "—"}</Text></View>
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
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  logoutTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  tabBar:     { flexDirection: "row", backgroundColor: G_DARK, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tab:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" },
  tabActive:  { backgroundColor: "#fff" },
  tabTxt:     { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
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
});
