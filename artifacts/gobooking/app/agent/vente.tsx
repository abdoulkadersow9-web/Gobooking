import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const G = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK = "#065F46";

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
  { id: "cash",         label: "Espèces",     icon: "cash-outline" as const },
  { id: "mobile_money", label: "Mobile Money", icon: "phone-portrait-outline" as const },
  { id: "card",         label: "Carte",        icon: "card-outline" as const },
];

export default function VenteScreen() {
  const { user, token } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ bookingRef: string; total: number } | null>(null);

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={styles.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    fetchTrips();
  }, []);

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

  const handleSubmit = async () => {
    if (!selectedTrip) { Alert.alert("Erreur", "Sélectionnez un trajet."); return; }
    if (!passengerName.trim()) { Alert.alert("Erreur", "Saisissez le nom du passager."); return; }
    if (!passengerPhone.trim()) { Alert.alert("Erreur", "Saisissez le numéro de téléphone."); return; }
    const count = parseInt(passengerCount) || 1;
    if (count < 1 || count > 10) { Alert.alert("Erreur", "Nombre de passagers invalide (1-10)."); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch("/company/reservations", {
        token: token ?? undefined,
        method: "POST",
        body: {
          tripId: selectedTrip.id,
          passengerName: passengerName.trim(),
          passengerPhone: passengerPhone.trim(),
          passengerCount: count,
          paymentMethod,
          createdByAgent: true,
        },
      });
      setConfirmed({ bookingRef: res.bookingRef ?? res.id ?? "—", total: selectedTrip.price * count });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setConfirmed(null);
    setSelectedTrip(null);
    setPassengerName("");
    setPassengerPhone("");
    setPassengerCount("1");
    setPaymentMethod("cash");
  };

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons name="ticket" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Espace Vente</Text>
              <Text style={styles.headerSub}>Vente de billets</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { alignItems: "center", paddingTop: 40 }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={72} color={G} />
          </View>
          <Text style={styles.successTitle}>Réservation créée !</Text>
          <Text style={styles.successRef}>Réf: {confirmed.bookingRef}</Text>
          <Text style={styles.successTotal}>Total encaissé: {confirmed.total.toLocaleString()} FCFA</Text>
          <Text style={styles.successSub}>Imprimez ou envoyez le billet au client</Text>
          <TouchableOpacity style={styles.newSaleBtn} onPress={reset}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.newSaleBtnText}>Nouvelle vente</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="ticket" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Espace Vente</Text>
            <Text style={styles.headerSub}>Vente de billets en gare</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="bus-outline" size={15} color={G} /> Sélectionner un trajet
          </Text>
          {loadingTrips ? (
            <ActivityIndicator color={G} />
          ) : trips.length === 0 ? (
            <View style={styles.emptyTrips}>
              <Text style={styles.emptyTripsText}>Aucun trajet disponible</Text>
              <TouchableOpacity onPress={fetchTrips}>
                <Text style={{ color: G, fontSize: 13 }}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            trips.map(trip => (
              <TouchableOpacity
                key={trip.id}
                style={[styles.tripItem, selectedTrip?.id === trip.id && styles.tripItemSelected]}
                onPress={() => setSelectedTrip(trip)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripRoute}>{trip.from} → {trip.to}</Text>
                  <Text style={styles.tripTime}>{trip.departureTime} · {trip.date}</Text>
                  {trip.availableSeats !== undefined ? (
                    <Text style={styles.tripSeats}>{trip.availableSeats} places dispo.</Text>
                  ) : null}
                </View>
                <View style={styles.tripPrice}>
                  <Text style={styles.tripPriceText}>{trip.price?.toLocaleString()}</Text>
                  <Text style={styles.tripPriceSub}>FCFA</Text>
                </View>
                {selectedTrip?.id === trip.id && (
                  <Ionicons name="checkmark-circle" size={20} color={G} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="person-outline" size={15} color={G} /> Informations passager
          </Text>
          <Text style={styles.label}>Nom complet *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Kouamé Jean"
            value={passengerName}
            onChangeText={setPassengerName}
          />
          <Text style={styles.label}>Téléphone *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 07 12 34 56 78"
            value={passengerPhone}
            onChangeText={setPassengerPhone}
            keyboardType="phone-pad"
          />
          <Text style={styles.label}>Nombre de passagers</Text>
          <View style={styles.countRow}>
            <TouchableOpacity
              style={styles.countBtn}
              onPress={() => setPassengerCount(c => String(Math.max(1, parseInt(c) - 1)))}
            >
              <Ionicons name="remove" size={18} color={G} />
            </TouchableOpacity>
            <TextInput
              style={styles.countInput}
              value={passengerCount}
              onChangeText={setPassengerCount}
              keyboardType="number-pad"
              textAlign="center"
            />
            <TouchableOpacity
              style={styles.countBtn}
              onPress={() => setPassengerCount(c => String(Math.min(10, parseInt(c) + 1)))}
            >
              <Ionicons name="add" size={18} color={G} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="wallet-outline" size={15} color={G} /> Mode de paiement
          </Text>
          <View style={styles.paymentGrid}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity
                key={pm.id}
                style={[styles.paymentItem, paymentMethod === pm.id && styles.paymentItemSelected]}
                onPress={() => setPaymentMethod(pm.id)}
              >
                <Ionicons name={pm.icon} size={22} color={paymentMethod === pm.id ? G : "#9CA3AF"} />
                <Text style={[styles.paymentLabel, paymentMethod === pm.id && styles.paymentLabelSelected]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedTrip && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Récapitulatif</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Trajet</Text>
              <Text style={styles.summaryVal}>{selectedTrip.from} → {selectedTrip.to}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Passagers</Text>
              <Text style={styles.summaryVal}>{passengerCount}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: "#D1FAE5", paddingTop: 10, marginTop: 4 }]}>
              <Text style={[styles.summaryKey, { fontWeight: "700", color: "#111827" }]}>Total</Text>
              <Text style={[styles.summaryVal, { fontWeight: "800", color: G, fontSize: 16 }]}>
                {(selectedTrip.price * (parseInt(passengerCount) || 1)).toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.submitBtnText}>Valider la vente</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: G_DARK },
  denied: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText: { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header: { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#A7F3D0", fontSize: 13, marginTop: 1 },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 16, paddingBottom: 30 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },

  emptyTrips: { alignItems: "center", gap: 6, padding: 12 },
  emptyTripsText: { color: "#9CA3AF", fontSize: 14 },

  tripItem: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  tripItemSelected: { borderColor: G, backgroundColor: G_LIGHT },
  tripRoute: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripTime: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tripSeats: { fontSize: 12, color: G, marginTop: 2 },
  tripPrice: { alignItems: "flex-end" },
  tripPriceText: { fontSize: 15, fontWeight: "800", color: G },
  tripPriceSub: { fontSize: 11, color: "#9CA3AF" },

  label: { fontSize: 13, fontWeight: "500", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },

  countRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: G, alignItems: "center", justifyContent: "center" },
  countInput: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, width: 64, paddingVertical: 8, fontSize: 16, fontWeight: "700", color: "#111827", backgroundColor: G_LIGHT },

  paymentGrid: { flexDirection: "row", gap: 10 },
  paymentItem: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, alignItems: "center", gap: 6 },
  paymentItemSelected: { borderColor: G, backgroundColor: G_LIGHT },
  paymentLabel: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  paymentLabelSelected: { color: G, fontWeight: "600" },

  summaryCard: { backgroundColor: G_LIGHT, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#D1FAE5", gap: 8 },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: G_DARK, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryKey: { fontSize: 13, color: "#6B7280" },
  summaryVal: { fontSize: 13, fontWeight: "600", color: "#111827" },

  submitBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  successCircle: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  successRef: { fontSize: 15, fontWeight: "600", color: G, marginTop: 4 },
  successTotal: { fontSize: 15, color: "#374151", marginTop: 4 },
  successSub: { fontSize: 13, color: "#6B7280", marginTop: 8 },
  newSaleBtn: { marginTop: 24, backgroundColor: G, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  newSaleBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
