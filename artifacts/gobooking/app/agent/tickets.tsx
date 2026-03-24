import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
  date: string;
}

const PAYMENT_METHODS = [
  { id: "cash",         label: "Espèces",      icon: "cash-outline" as const },
  { id: "orange",       label: "Orange Money", icon: "phone-portrait-outline" as const },
  { id: "mtn",          label: "MTN Money",    icon: "phone-portrait-outline" as const },
  { id: "wave",         label: "Wave",         icon: "phone-portrait-outline" as const },
];

export default function TicketsScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  const [trips, setTrips]           = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed]   = useState<{ bookingRef: string; total: number } | null>(null);

  const isTicketAgent = !user?.agentRole ||
    user.agentRole === "agent_ticket" || user.agentRole === "vente";

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

  useEffect(() => { fetchTrips(); }, []);

  if (!isTicketAgent) {
    return (
      <SafeAreaView style={S.denied}>
        <StatusBar barStyle="dark-content" />
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={S.deniedTitle}>Accès non autorisé</Text>
        <Text style={S.deniedSub}>Cet écran est réservé aux agents ticketing.</Text>
        <TouchableOpacity style={S.deniedBtn} onPress={() => router.replace("/agent/home" as never)}>
          <Text style={S.deniedBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
    if (!selectedTrip) { Alert.alert("Erreur", "Sélectionnez un trajet."); return; }
    if (!passengerName.trim()) { Alert.alert("Erreur", "Saisissez le nom du passager."); return; }
    if (!passengerPhone.trim()) { Alert.alert("Erreur", "Saisissez le numéro de téléphone."); return; }
    const count = parseInt(passengerCount) || 1;
    if (count < 1 || count > 10) { Alert.alert("Erreur", "Nombre de passagers invalide (1-10)."); return; }

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
        setConfirmed({ bookingRef: offlineRef, total: selectedTrip.price * count });
        return;
      }
      const res = await apiFetch<{ bookingRef?: string; id?: string }>("/company/reservations", {
        token: token ?? undefined, method: "POST",
        body: { tripId: selectedTrip.id, clientName: passengerName.trim(),
          clientPhone: passengerPhone.trim(), seatCount: count, paymentMethod },
      });
      setConfirmed({ bookingRef: res.bookingRef ?? res.id ?? "—", total: selectedTrip.price * count });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setConfirmed(null); setSelectedTrip(null);
    setPassengerName(""); setPassengerPhone("");
    setPassengerCount("1"); setPaymentMethod("cash");
  };

  if (confirmed) {
    return (
      <SafeAreaView style={S.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <View style={S.header}>
          <View style={S.headerRow}>
            <View style={S.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
            <View>
              <Text style={S.headerTitle}>🎫 Espace Ticketing</Text>
              <Text style={S.headerSub}>Vente de billets en gare</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={S.logoutBtn}>
            <Text style={S.logoutTxt}>Déco.</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[S.content, { alignItems: "center", paddingTop: 40 }]}>
          <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
          <Text style={S.successTitle}>Billet émis !</Text>
          <Text style={S.successRef}>Réf : {confirmed.bookingRef}</Text>
          <Text style={S.successTotal}>{confirmed.total.toLocaleString()} FCFA encaissés</Text>
          {confirmed.bookingRef.startsWith("OFFLINE-") && (
            <View style={S.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#D97706" />
              <Text style={S.offlineTxt}>Sauvegardé hors ligne — sync automatique dès retour connexion.</Text>
            </View>
          )}
          <TouchableOpacity style={S.newSaleBtn} onPress={reset}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={S.newSaleBtnTxt}>Nouvelle vente</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
      <OfflineBanner status={networkStatus} />

      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>🎫 Espace Ticketing</Text>
            <Text style={S.headerSub}>{networkStatus.isOnline ? "Vente de billets en gare" : "⚡ Mode hors ligne"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déco.</Text>
        </TouchableOpacity>
      </View>

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
                    {trip.availableSeats !== undefined && (
                      <Text style={{ fontSize: 12, color: G, marginTop: 1 }}>{trip.availableSeats} places dispo.</Text>
                    )}
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
            <Text style={S.cardTitle}>Mode de paiement</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.id}
                style={[S.payItem, paymentMethod === pm.id && S.payItemSel]}
                onPress={() => setPaymentMethod(pm.id)}>
                <Ionicons name={pm.icon} size={20} color={paymentMethod === pm.id ? G : "#9CA3AF"} />
                <Text style={[S.payLabel, paymentMethod === pm.id && { color: G, fontWeight: "700" }]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
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
      </ScrollView>
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

  content:   { padding: 16, gap: 14, paddingBottom: 32 },
  card:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  tripItem:  { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  tripItemSel: { borderColor: G, backgroundColor: G_LIGHT },
  tripRoute: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripMeta:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tripPrice: { fontSize: 15, fontWeight: "800", color: G },

  label:     { fontSize: 13, fontWeight: "500", color: "#374151" },
  input:     { borderWidth: 1.5, borderColor: "#FDE68A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: G_LIGHT, color: "#111827" },

  countRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn:  { width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: G, alignItems: "center", justifyContent: "center" },
  countInput:{ borderWidth: 1.5, borderColor: "#FDE68A", borderRadius: 10, width: 70, paddingVertical: 9, fontSize: 18, fontWeight: "700", color: "#111827", backgroundColor: G_LIGHT },

  payItem:   { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  payItemSel:{ borderColor: G, backgroundColor: G_LIGHT },
  payLabel:  { fontSize: 12, color: "#9CA3AF" },

  recap:     { backgroundColor: G_LIGHT, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: "#FDE68A", gap: 8 },
  recapTitle:{ fontSize: 15, fontWeight: "700", color: G_DARK, marginBottom: 4 },
  recapRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapKey:  { fontSize: 13, color: "#6B7280" },
  recapVal:  { fontSize: 13, fontWeight: "600", color: "#111827" },

  submitBtn:  { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14, elevation: 3, shadowColor: G, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitTxt:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  offlineBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginTop: 8, maxWidth: 320 },
  offlineTxt:    { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },

  successTitle:  { fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 12 },
  successRef:    { fontSize: 16, fontWeight: "700", color: "#16a34a", marginTop: 4 },
  successTotal:  { fontSize: 15, color: "#374151", marginTop: 4 },
  newSaleBtn:    { marginTop: 28, backgroundColor: G, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  newSaleBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
