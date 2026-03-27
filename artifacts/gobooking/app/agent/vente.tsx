import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import OfflineBanner from "@/components/OfflineBanner";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";

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
}

const PAYMENT_METHODS = [
  { id: "cash",         label: "Espèces",      icon: "cash-outline"           as const },
  { id: "mobile_money", label: "Mobile Money", icon: "phone-portrait-outline" as const },
  { id: "card",         label: "Carte",         icon: "card-outline"           as const },
];

export default function VenteScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  const [trips, setTrips]               = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const [passengerName,  setPassengerName]  = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [paymentMethod,  setPaymentMethod]  = useState("cash");

  // Villes montée / descente
  const [boardingCity,  setBoardingCity]  = useState("");
  const [alightingCity, setAlightingCity] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed]   = useState<{
    bookingRef: string; total: number;
    seatNumbers?: string[]; boardingCity?: string; alightingCity?: string;
  } | null>(null);

  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const res = await apiFetch<Trip[]>("/agent/trips", { token: token ?? undefined });
      const all  = Array.isArray(res) ? res : [];
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
  };

  useEffect(() => { fetchTrips(); }, []);

  // Quand le trajet change, réinitialiser les villes
  const selectTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    const cities = trip.allCities ?? [trip.fromCity ?? trip.from, trip.toCity ?? trip.to];
    setBoardingCity(cities[0] ?? "");
    setAlightingCity(cities[cities.length - 1] ?? "");
  };

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={s.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={s.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
    if (!selectedTrip)       { Alert.alert("Erreur", "Sélectionnez un trajet."); return; }
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
            passengerPhone: passengerPhone.trim(), passengerCount: count, paymentMethod } as any,
          token: token ?? "",
          createdAt: Date.now(),
        });
        setConfirmed({ bookingRef: offlineRef, total: selectedTrip.price * count });
        return;
      }
      const res = await apiFetch<{
        bookingRef?: string; id?: string;
        seatNumbers?: string[]; boardingCity?: string; alightingCity?: string;
      }>("/agent/reservations", {
        token: token ?? undefined,
        method: "POST",
        body: {
          tripId:        selectedTrip.id,
          clientName:    passengerName.trim(),
          clientPhone:   passengerPhone.trim(),
          seatCount:     count,
          paymentMethod,
          boardingCity:  boardingCity  || (selectedTrip.fromCity ?? selectedTrip.from),
          alightingCity: alightingCity || (selectedTrip.toCity   ?? selectedTrip.to),
        },
      });
      setConfirmed({
        bookingRef:   res.bookingRef ?? res.id ?? "—",
        total:        selectedTrip.price * count,
        seatNumbers:  res.seatNumbers,
        boardingCity: res.boardingCity,
        alightingCity: res.alightingCity,
      });
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
    setBoardingCity("");
    setAlightingCity("");
  };

  /* ─── Succès ──────────────────────────────────────────────────────── */
  if (confirmed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={s.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
            <View><Text style={s.headerTitle}>Espace Vente</Text><Text style={s.headerSub}>Vente de billets</Text></View>
          </View>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={[s.content, { alignItems: "center", paddingTop: 40 }]}>
          <View style={{ marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={72} color={G} />
          </View>
          <Text style={s.successTitle}>Réservation créée !</Text>
          <Text style={s.successRef}>Réf: {confirmed.bookingRef}</Text>
          <Text style={s.successTotal}>Total encaissé: {(confirmed.total ?? 0).toLocaleString()} FCFA</Text>

          {/* Sièges assignés */}
          {confirmed.seatNumbers && confirmed.seatNumbers.length > 0 && (
            <View style={{ backgroundColor: G_LIGHT, borderRadius: 12, padding: 14, marginTop: 12, width: "100%", borderWidth: 1, borderColor: "#A7F3D0" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Ionicons name="grid-outline" size={16} color={G} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: G_DARK }}>Sièges attribués</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {confirmed.seatNumbers.map(sn => (
                  <View key={sn} style={{ backgroundColor: G, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{sn}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Villes montée / descente */}
          {(confirmed.boardingCity || confirmed.alightingCity) && (
            <View style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginTop: 10, width: "100%", borderWidth: 1, borderColor: "#BFDBFE" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="log-in-outline" size={16} color="#2563EB" />
                  <Text style={{ fontSize: 10, color: "#2563EB", marginTop: 2 }}>Monte à</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1D4ED8", marginTop: 2 }}>{confirmed.boardingCity}</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#94A3B8" style={{ marginTop: 10 }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  <Text style={{ fontSize: 10, color: "#DC2626", marginTop: 2 }}>Descend à</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626", marginTop: 2 }}>{confirmed.alightingCity}</Text>
                </View>
              </View>
            </View>
          )}

          {confirmed.bookingRef.startsWith("OFFLINE-") ? (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8, width: "100%" }}>
              <Ionicons name="cloud-offline-outline" size={18} color="#D97706" />
              <Text style={{ color: "#92400E", fontSize: 12, flex: 1, lineHeight: 18 }}>
                Sauvegardé hors ligne — sera synchronisé automatiquement dès le retour de la connexion.
              </Text>
            </View>
          ) : (
            <Text style={s.successSub}>Imprimez ou envoyez le billet au client</Text>
          )}
          <TouchableOpacity style={[s.submitBtn, { marginTop: 24, width: "100%" }]} onPress={reset}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.submitBtnText}>Nouvelle vente</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── Formulaire principal ──────────────────────────────────────────── */
  const cityList = selectedTrip?.allCities ?? (selectedTrip
    ? [selectedTrip.fromCity ?? selectedTrip.from, selectedTrip.toCity ?? selectedTrip.to]
    : []);
  const hasWaypoints = cityList.length > 2;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
      <OfflineBanner status={networkStatus} />

      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerIcon}><Ionicons name="ticket" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Espace Vente</Text>
            <Text style={s.headerSub}>{networkStatus.isOnline ? "Vente de billets en gare" : "Mode hors ligne actif"}</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            hitSlop={8}
            onPress={() => Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
            ])}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ── Sélection trajet ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="bus-outline" size={15} color={G} /> Sélectionner un trajet</Text>
          {loadingTrips ? <ActivityIndicator color={G} /> : trips.length === 0 ? (
            <View style={s.emptyTrips}>
              <Text style={s.emptyTripsText}>Aucun trajet disponible</Text>
              <TouchableOpacity onPress={fetchTrips}><Text style={{ color: G, fontSize: 13 }}>Actualiser</Text></TouchableOpacity>
            </View>
          ) : (
            trips.map(trip => {
              const isTransit = trip.status === "en_route" || trip.status === "in_progress";
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[s.tripItem, selectedTrip?.id === trip.id && s.tripItemSelected, isTransit && { borderLeftWidth: 3, borderLeftColor: G }]}
                  onPress={() => selectTrip(trip)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={s.tripRoute}>{trip.from} → {trip.to}</Text>
                      {isTransit && (
                        <View style={{ backgroundColor: G + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: G }}>En transit</Text>
                        </View>
                      )}
                      {(trip.stops?.length ?? 0) > 0 && (
                        <View style={{ backgroundColor: "#EFF6FF", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: "600", color: "#2563EB" }}>{trip.stops!.length} escale{trip.stops!.length > 1 ? "s" : ""}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.tripTime}>{trip.departureTime} · {trip.date}</Text>
                    {trip.availableSeats !== undefined && (
                      <Text style={s.tripSeats}>{trip.availableSeats} places dispo.</Text>
                    )}
                  </View>
                  <View style={s.tripPrice}>
                    <Text style={s.tripPriceText}>{trip.price?.toLocaleString()}</Text>
                    <Text style={s.tripPriceSub}>FCFA</Text>
                  </View>
                  {selectedTrip?.id === trip.id && <Ionicons name="checkmark-circle" size={20} color={G} />}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Villes de montée et descente (si escales disponibles) ── */}
        {selectedTrip && cityList.length >= 2 && (
          <View style={s.card}>
            <Text style={s.cardTitle}><Ionicons name="map-outline" size={15} color={G} /> Trajet du passager</Text>
            {hasWaypoints ? (
              <>
                <Text style={s.label}>Ville de montée</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {cityList.slice(0, -1).map(city => (
                      <Pressable
                        key={city}
                        style={[s.cityChip, boardingCity === city && s.cityChipActive]}
                        onPress={() => {
                          setBoardingCity(city);
                          // Si la ville de descente est avant ou égale à la montée, la réinitialiser
                          const bIdx = cityList.indexOf(city);
                          const aIdx = cityList.indexOf(alightingCity);
                          if (aIdx <= bIdx) setAlightingCity(cityList[bIdx + 1] ?? "");
                        }}
                      >
                        <Ionicons name="log-in-outline" size={13} color={boardingCity === city ? "#fff" : "#374151"} />
                        <Text style={[s.cityChipText, boardingCity === city && s.cityChipTextActive]}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={s.label}>Ville de descente</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {cityList.slice(1).map(city => {
                      const bIdx = cityList.indexOf(boardingCity);
                      const cIdx = cityList.indexOf(city);
                      const disabled = cIdx <= bIdx;
                      return (
                        <Pressable
                          key={city}
                          style={[s.cityChip, alightingCity === city && s.cityChipActiveRed, disabled && s.cityChipDisabled]}
                          onPress={() => !disabled && setAlightingCity(city)}
                        >
                          <Ionicons name="log-out-outline" size={13} color={alightingCity === city ? "#fff" : disabled ? "#9CA3AF" : "#374151"} />
                          <Text style={[s.cityChipText, alightingCity === city && s.cityChipTextActive, disabled && { color: "#9CA3AF" }]}>{city}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : (
              /* Trajet direct sans escale — afficher simplement */
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: G_LIGHT, borderRadius: 10, padding: 12 }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: G, fontWeight: "600" }}>Monte à</Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: G_DARK, marginTop: 2 }}>{cityList[0]}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: "#DC2626", fontWeight: "600" }}>Descend à</Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#DC2626", marginTop: 2 }}>{cityList[cityList.length - 1]}</Text>
                </View>
              </View>
            )}

            {/* Prix calculé selon le segment */}
            {hasWaypoints && boardingCity && alightingCity && (
              <View style={{ backgroundColor: "#FEF9C3", borderRadius: 8, padding: 8, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="information-circle-outline" size={14} color="#D97706" />
                <Text style={{ fontSize: 12, color: "#92400E" }}>
                  Segment {boardingCity} → {alightingCity} · Tarif plein appliqué
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Infos passager ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="person-outline" size={15} color={G} /> Informations passager</Text>
          <Text style={s.label}>Nom complet *</Text>
          <TextInput style={s.input} placeholder="Ex: Kouamé Jean" value={passengerName} onChangeText={setPassengerName} />
          <Text style={s.label}>Téléphone *</Text>
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

        {/* ── Mode paiement ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="wallet-outline" size={15} color={G} /> Mode de paiement</Text>
          <View style={s.paymentGrid}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.id} style={[s.paymentItem, paymentMethod === pm.id && s.paymentItemSelected]} onPress={() => setPaymentMethod(pm.id)}>
                <Ionicons name={pm.icon} size={22} color={paymentMethod === pm.id ? G : "#9CA3AF"} />
                <Text style={[s.paymentLabel, paymentMethod === pm.id && s.paymentLabelSelected]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Récapitulatif ── */}
        {selectedTrip && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Récapitulatif</Text>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Trajet</Text>
              <Text style={s.summaryVal}>{selectedTrip.from} → {selectedTrip.to}</Text>
            </View>
            {boardingCity && boardingCity !== selectedTrip.from && (
              <View style={s.summaryRow}>
                <Text style={s.summaryKey}>Monte à</Text>
                <Text style={[s.summaryVal, { color: "#2563EB" }]}>{boardingCity}</Text>
              </View>
            )}
            {alightingCity && alightingCity !== selectedTrip.to && (
              <View style={s.summaryRow}>
                <Text style={s.summaryKey}>Descend à</Text>
                <Text style={[s.summaryVal, { color: "#DC2626" }]}>{alightingCity}</Text>
              </View>
            )}
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Passagers</Text>
              <Text style={s.summaryVal}>{passengerCount}</Text>
            </View>
            <View style={[s.summaryRow, { borderTopWidth: 1, borderColor: "#D1FAE5", paddingTop: 10, marginTop: 4 }]}>
              <Text style={[s.summaryKey, { fontWeight: "700", color: "#111827" }]}>Total</Text>
              <Text style={[s.summaryVal, { fontWeight: "800", color: G, fontSize: 16 }]}>
                {(selectedTrip.price * (parseInt(passengerCount) || 1)).toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={s.submitBtnText}>Valider la vente</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: G_DARK },
  denied:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText:  { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header:     { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 16 },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "#A7F3D0", fontSize: 13, marginTop: 1 },

  scroll:  { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 16, paddingBottom: 30 },

  card:      { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },

  emptyTrips:     { alignItems: "center", gap: 6, padding: 12 },
  emptyTripsText: { color: "#9CA3AF", fontSize: 14 },

  tripItem:         { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  tripItemSelected: { borderColor: G, backgroundColor: G_LIGHT },
  tripRoute:        { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripTime:         { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tripSeats:        { fontSize: 12, color: G, marginTop: 2 },
  tripPrice:        { alignItems: "flex-end" },
  tripPriceText:    { fontSize: 15, fontWeight: "800", color: G },
  tripPriceSub:     { fontSize: 11, color: "#9CA3AF" },

  label: { fontSize: 13, fontWeight: "500", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },

  cityChip:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "#E5E7EB" },
  cityChipActive:   { backgroundColor: G, borderColor: G },
  cityChipActiveRed:{ backgroundColor: "#DC2626", borderColor: "#DC2626" },
  cityChipDisabled: { opacity: 0.4 },
  cityChipText:     { fontSize: 13, fontWeight: "600", color: "#374151" },
  cityChipTextActive: { color: "#fff" },

  countRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn:   { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: G, alignItems: "center", justifyContent: "center" },
  countInput: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, width: 64, paddingVertical: 8, fontSize: 16, fontWeight: "700", color: "#111827", backgroundColor: G_LIGHT },

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
  successSub:   { fontSize: 13, color: "#6B7280", marginTop: 8 },
});
