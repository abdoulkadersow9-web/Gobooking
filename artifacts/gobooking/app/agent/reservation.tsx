import { Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const TEAL   = "#0E7490";
const TEAL_L = "#ECFEFF";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface OnlineBooking {
  id: string;
  bookingRef: string;
  status: string;
  bookingSource: string | null;
  totalAmount: number;
  paymentMethod: string;
  contactPhone: string;
  passengers: { name: string; age?: number; gender?: string }[];
  seatNumbers: string[];
  createdAt: string;
  trip: {
    id: string;
    from: string;
    to: string;
    date: string;
    departureTime: string;
    busName: string;
    guichetSeats: number;
    onlineSeats: number;
    totalSeats: number;
  } | null;
}

/* ── Status helpers ─────────────────────────────────────────────────────── */
function statusLabel(s: string) {
  switch (s) {
    case "pending":    return { label: "En attente", color: "#D97706", bg: "#FEF3C7" };
    case "confirmed":  return { label: "Confirmé",   color: "#16A34A", bg: "#DCFCE7" };
    case "cancelled":  return { label: "Annulé",     color: "#DC2626", bg: "#FEE2E2" };
    case "boarded":    return { label: "Embarqué",   color: "#7C3AED", bg: "#EDE9FE" };
    default:           return { label: s,             color: "#6B7280", bg: "#F3F4F6" };
  }
}

function paymentLabel(p: string) {
  if (p === "mobile_money") return "Mobile Money";
  if (p === "card")         return "Carte bancaire";
  if (p === "cash")         return "Espèces";
  return p;
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────────────────────── */
export default function AgentReservation() {
  const { user, token } = useAuth();
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState<"all" | "pending" | "confirmed">("pending");
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<OnlineBooking[]>("/agent/online-bookings", { token: token ?? undefined });
      setBookings(data);
    } catch (e: any) {
      if (!silent) Alert.alert("Erreur", e?.message ?? "Impossible de charger les réservations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const displayed = bookings.filter(b => {
    if (filter === "pending")   return b.status === "pending";
    if (filter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    return true;
  });

  const pendingCount = bookings.filter(b => b.status === "pending").length;

  const confirmBooking = async (booking: OnlineBooking) => {
    Alert.alert(
      "Confirmer la réservation",
      `Confirmer ${booking.bookingRef} pour ${booking.passengers[0]?.name ?? "client"} ?\n\nTrajet : ${booking.trip?.from} → ${booking.trip?.to}\nDate : ${booking.trip?.date} à ${booking.trip?.departureTime}\nMontant : ${booking.totalAmount.toLocaleString()} FCFA`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: async () => {
          setConfirming(booking.id);
          try {
            await apiFetch(`/agent/online-bookings/${booking.id}/confirm`, {
              token: token ?? undefined,
              method: "POST",
              body: {},
            });
            Alert.alert("Succès", `Réservation ${booking.bookingRef} confirmée !`);
            await load(true);
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Impossible de confirmer la réservation");
          } finally {
            setConfirming(null);
          }
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={S.root} edges={["top"]}>
      {/* Header */}
      <LinearGradient colors={["#164E63", "#0E7490"]} style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={S.headerTitle}>Réservations en ligne</Text>
          <Text style={S.headerSub}>🌐 En ligne uniquement · {user?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => load()} style={S.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats bar */}
      <View style={S.statsBar}>
        <View style={S.statItem}>
          <Text style={[S.statNum, { color: "#D97706" }]}>{pendingCount}</Text>
          <Text style={S.statLabel}>En attente</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statItem}>
          <Text style={[S.statNum, { color: "#16A34A" }]}>{bookings.filter(b => b.status === "confirmed" || b.status === "boarded").length}</Text>
          <Text style={S.statLabel}>Confirmées</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statItem}>
          <Text style={[S.statNum, { color: TEAL }]}>{bookings.length}</Text>
          <Text style={S.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={S.filterRow}>
        {([
          { key: "pending",   label: `⏳ En attente${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { key: "confirmed", label: "✅ Confirmées" },
          { key: "all",       label: "📋 Toutes" },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[S.chip, filter === f.key && S.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[S.chipTxt, filter === f.key && S.chipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main list */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={{ color: "#6B7280", marginTop: 10 }}>Chargement des réservations...</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 48 }}>🖥️</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151" }}>
            {filter === "pending" ? "Aucune réservation en attente" : "Aucune réservation"}
          </Text>
          <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 40 }}>
            {filter === "pending"
              ? "Les nouvelles réservations en ligne apparaîtront ici"
              : "Modifiez le filtre pour voir d'autres réservations"}
          </Text>
          <TouchableOpacity onPress={() => load()} style={{ marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: TEAL, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={TEAL} />}
        >
          {displayed.map(b => {
            const st = statusLabel(b.status);
            const paxCount = b.passengers?.length ?? 1;
            const seatNums = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "À assigner";
            const isPending = b.status === "pending";
            const isConfirming = confirming === b.id;

            return (
              <View key={b.id} style={[S.card, isPending && { borderColor: "#FCD34D", borderWidth: 2 }]}>
                {/* Card header */}
                <View style={S.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.cardRef}>{b.bookingRef}</Text>
                    {b.trip && (
                      <Text style={S.cardRoute}>{b.trip.from} → {b.trip.to}</Text>
                    )}
                  </View>
                  <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Trip info */}
                {b.trip && (
                  <View style={S.tripRow}>
                    <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                    <Text style={S.tripInfo}>{b.trip.date} à {b.trip.departureTime}</Text>
                    <Text style={S.tripBus}>· {b.trip.busName}</Text>
                  </View>
                )}

                {/* Seat availability for the trip */}
                {b.trip && (b.trip.guichetSeats > 0 || b.trip.onlineSeats > 0) && (
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: 8, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontSize: 11, color: "#16A34A", fontWeight: "700" }}>🏢 Guichet</Text>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#166534" }}>{b.trip.guichetSeats} places</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: TEAL_L, borderRadius: 8, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontSize: 11, color: TEAL, fontWeight: "700" }}>🌐 En ligne</Text>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#164E63" }}>{b.trip.onlineSeats} places</Text>
                    </View>
                  </View>
                )}

                {/* Passenger info */}
                <View style={S.infoGrid}>
                  <InfoRow icon="person-outline" label="Client" val={b.passengers?.[0]?.name ?? "—"} />
                  <InfoRow icon="call-outline" label="Téléphone" val={b.contactPhone || "—"} />
                  <InfoRow icon="people-outline" label="Passagers" val={`${paxCount} personne${paxCount > 1 ? "s" : ""}`} />
                  <InfoRow icon="seat-outline" label="Sièges" val={seatNums} />
                  <InfoRow icon="cash-outline" label="Montant" val={`${b.totalAmount.toLocaleString()} FCFA`} />
                  <InfoRow icon="card-outline" label="Paiement" val={paymentLabel(b.paymentMethod)} />
                </View>

                {/* Source badge */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <View style={{ backgroundColor: "#DBEAFE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: "#1D4ED8", fontWeight: "700" }}>
                      🌐 Réservation {b.bookingSource === "mobile" ? "Mobile" : "En ligne"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {new Date(b.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>

                {/* Confirm button */}
                {isPending && (
                  <TouchableOpacity
                    style={[S.confirmBtn, isConfirming && { opacity: 0.7 }]}
                    onPress={() => confirmBooking(b)}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={S.confirmTxt}>Confirmer la réservation</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!isPending && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 6 }}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
                    <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "700" }}>Réservation traitée</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Rapport button */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14, margin: 14, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="alert-triangle" size={16} color="#fff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>📋 Faire un rapport</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ── Info row helper ─────────────────────────────────────────────────────── */
function InfoRow({ icon, label, val }: { icon: string; label: string; val: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderColor: "#F3F4F6" }}>
      <Ionicons name={icon as any} size={14} color="#9CA3AF" />
      <Text style={{ fontSize: 12, color: "#6B7280", width: 100 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827", flex: 1 }}>{val}</Text>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0FDFF" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  refreshBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },

  statsBar: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 14, marginTop: 14, borderRadius: 14, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6 },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statNum:  { fontSize: 22, fontWeight: "900" },
  statLabel:{ fontSize: 11, color: "#6B7280", fontWeight: "600", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },

  filterRow:   { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB" },
  chipActive:  { backgroundColor: TEAL, borderColor: TEAL },
  chipTxt:     { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  chipTxtActive: { color: "#fff" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: "#E5E7EB" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardRef:    { fontSize: 16, fontWeight: "900", color: TEAL },
  cardRoute:  { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 2 },
  tripRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  tripInfo:   { fontSize: 12, color: "#6B7280" },
  tripBus:    { fontSize: 12, color: "#9CA3AF" },
  statusBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:  { fontSize: 12, fontWeight: "700" },

  infoGrid:   { gap: 0, marginBottom: 10 },

  confirmBtn: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 13, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, elevation: 2 },
  confirmTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
