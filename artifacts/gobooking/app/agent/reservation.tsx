import { Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
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
  baggageCount: number;
  baggageType: string | null;
  baggageDescription: string | null;
  bagageStatus: string | null;
  bagagePrice: number;
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

function baggageTypeLabel(t: string | null) {
  if (t === "léger") return { label: "Léger (sac, cartable)", icon: "briefcase" as const };
  if (t === "lourd") return { label: "Lourd (valise, carton)", icon: "briefcase-outline" as const };
  if (t === "colis") return { label: "Colis / envoi groupé", icon: "cube-outline" as const };
  return { label: t ?? "Non précisé", icon: "briefcase" as const };
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
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Cancel modal state */
  const [cancelModal, setCancelModal] = useState<OnlineBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<OnlineBooking[]>("/agent/online-bookings", { token: token ?? undefined });
      setBookings(Array.isArray(data) ? data : []);
      setLastSync(new Date());
    } catch (e: any) {
      if (!silent) Alert.alert("Erreur", e?.message ?? "Impossible de charger les réservations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  /* Auto-polling every 15 seconds */
  useEffect(() => {
    load();
    pollRef.current = setInterval(() => { load(true); }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const displayed = bookings.filter(b => {
    if (filter === "pending")   return b.status === "pending";
    if (filter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    return true;
  });

  const pendingCount = bookings.filter(b => b.status === "pending").length;

  /* ── Group displayed bookings by trip ── */
  type TripGroup = { tripKey: string; tripInfo: OnlineBooking["trip"]; bookings: OnlineBooking[] };
  const groupedByTrip = displayed.reduce<TripGroup[]>((acc, b) => {
    const key = b.trip?.id ?? "no-trip";
    const existing = acc.find(g => g.tripKey === key);
    if (existing) { existing.bookings.push(b); }
    else { acc.push({ tripKey: key, tripInfo: b.trip ?? null, bookings: [b] }); }
    return acc;
  }, []);
  /* Sort: groups with pending bookings first */
  groupedByTrip.sort((a, b) => {
    const aHasPending = a.bookings.some(x => x.status === "pending") ? 0 : 1;
    const bHasPending = b.bookings.some(x => x.status === "pending") ? 0 : 1;
    return aHasPending - bHasPending;
  });

  /* ── Confirm ── */
  const confirmBooking = async (booking: OnlineBooking) => {
    const bagInfo = booking.baggageCount > 0
      ? `\nBagage : ${baggageTypeLabel(booking.baggageType).label} (×${booking.baggageCount})`
      : "";
    Alert.alert(
      "Confirmer la réservation",
      `Confirmer ${booking.bookingRef} pour ${booking.passengers[0]?.name ?? "client"} ?\n\nTrajet : ${booking.trip?.from} → ${booking.trip?.to}\nDate : ${booking.trip?.date} à ${booking.trip?.departureTime}\nMontant : ${(booking.totalAmount ?? 0).toLocaleString()} FCFA${bagInfo}`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer ✓", onPress: async () => {
          setConfirming(booking.id);
          try {
            await apiFetch(`/agent/online-bookings/${booking.id}/confirm`, {
              token: token ?? undefined,
              method: "POST",
              body: {},
            });
            Alert.alert("Succès", `Réservation ${booking.bookingRef} confirmée${booking.baggageCount > 0 ? " avec le bagage" : ""} !`);
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

  /* ── Cancel ── */
  const cancelBooking = async () => {
    if (!cancelModal) return;
    setCancelling(cancelModal.id);
    try {
      await apiFetch(`/agent/online-bookings/${cancelModal.id}/cancel`, {
        token: token ?? undefined,
        method: "POST",
        body: { reason: cancelReason || undefined },
      });
      setCancelModal(null);
      setCancelReason("");
      Alert.alert("Annulée", `Réservation ${cancelModal.bookingRef} annulée. Le siège a été libéré.`);
      await load(true);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'annuler la réservation");
    } finally {
      setCancelling(null);
    }
  };

  return (
    <SafeAreaView style={S.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#164E63" />
      {/* Header */}
      <LinearGradient colors={["#164E63", "#0E7490"]} style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={S.headerTitle}>Réservations</Text>
          <Text style={S.headerSub}>
            {lastSync
              ? `Sync ${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")}:${lastSync.getSeconds().toString().padStart(2,"0")} · Auto 15s`
              : `Chargement… · ${user?.name}`}
          </Text>
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
          { key: "pending",   label: `En attente${pendingCount > 0 ? ` (${pendingCount})` : ""}`, icon: "time-outline" as const },
          { key: "confirmed", label: "Confirmées",  icon: "checkmark-circle-outline" as const },
          { key: "all",       label: "Toutes",      icon: "list-outline" as const },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[S.chip, filter === f.key && S.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons name={f.icon} size={13} color={filter === f.key ? TEAL : "#6B7280"} />
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
          <Ionicons name="calendar-outline" size={52} color="#CBD5E1" />
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
          contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={TEAL} />}
        >
          {groupedByTrip.map(group => {
            const trip = group.tripInfo;
            const groupPending = group.bookings.filter(b => b.status === "pending").length;
            return (
              <View key={group.tripKey} style={{ marginBottom: 8 }}>
                {/* Departure header */}
                <View style={{
                  flexDirection: "row", alignItems: "center", backgroundColor: groupPending > 0 ? "#FEF3C7" : "#F0F9FF",
                  borderRadius: 12, padding: 12, marginBottom: 8, gap: 10,
                  borderLeftWidth: 4, borderLeftColor: groupPending > 0 ? "#D97706" : TEAL,
                }}>
                  <Ionicons name="bus" size={18} color={groupPending > 0 ? "#D97706" : TEAL} />
                  <View style={{ flex: 1 }}>
                    {trip
                      ? <>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>{trip.from} → {trip.to}</Text>
                          <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>
                            {trip.date} · {trip.departureTime} · {trip.busName}
                          </Text>
                        </>
                      : <Text style={{ fontSize: 14, fontWeight: "700", color: "#374151" }}>Trajet non précisé</Text>
                    }
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <View style={{ backgroundColor: groupPending > 0 ? "#D97706" : "#0E7490", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{group.bookings.length} rés.</Text>
                    </View>
                    {groupPending > 0 && (
                      <Text style={{ fontSize: 10, color: "#D97706", fontWeight: "700" }}>{groupPending} en attente</Text>
                    )}
                  </View>
                </View>

                {/* Bookings in this group */}
                {group.bookings.map(b => {
            const st = statusLabel(b.status);
            const paxCount = b.passengers?.length ?? 1;
            const seatNums = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "À assigner";
            const isPending = b.status === "pending";
            const isCancelled = b.status === "cancelled";
            const isConfirming = confirming === b.id;
            const hasBaggage = b.baggageCount > 0;

            return (
              <View key={b.id} style={[S.card, isPending && { borderColor: "#FCD34D", borderWidth: 2 }, { marginBottom: 10 }]}>

                {/* ── Ligne référence + statut ── */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={S.cardRef}>{b.bookingRef}</Text>
                  <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* ── Bloc client (nom + téléphone cliquable) ── */}
                <View style={S.clientBlock}>
                  <View style={S.clientAvatar}>
                    <Text style={S.clientAvatarTxt}>{(b.passengers?.[0]?.name ?? "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.clientName}>{b.passengers?.[0]?.name ?? "Client inconnu"}</Text>
                    {b.contactPhone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g, "")}`)} activeOpacity={0.7}>
                        <Text style={S.clientPhone}>{b.contactPhone}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Pas de téléphone</Text>
                    )}
                  </View>
                  {b.contactPhone && (
                    <TouchableOpacity
                      style={S.callBtn}
                      onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g, "")}`)}
                      activeOpacity={0.7}
                    >
                      <Feather name="phone" size={18} color={TEAL} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* ── Trajet (de → à + heure + bus) ── */}
                {b.trip && (
                  <View style={S.tripBlock}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Ionicons name="bus" size={16} color={TEAL} />
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>{b.trip.from} → {b.trip.to}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                        <Text style={S.tripInfo}>{b.trip.date}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={13} color="#6B7280" />
                        <Text style={S.tripInfo}>{b.trip.departureTime}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="truck" size={12} color="#6B7280" />
                        <Text style={S.tripBus}>{b.trip.busName}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ── Places disponibles ── */}
                {b.trip && (b.trip.guichetSeats > 0 || b.trip.onlineSeats > 0) && (
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                    <View style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, alignItems: "center" }}>
                      <Text style={{ fontSize: 11, color: "#16A34A", fontWeight: "700", marginBottom: 2 }}>Guichet</Text>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: "#166534" }}>{b.trip.guichetSeats}</Text>
                      <Text style={{ fontSize: 10, color: "#4ADE80" }}>places dispo</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: TEAL_L, borderRadius: 10, padding: 10, alignItems: "center" }}>
                      <Text style={{ fontSize: 11, color: TEAL, fontWeight: "700", marginBottom: 2 }}>En ligne</Text>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: "#164E63" }}>{b.trip.onlineSeats}</Text>
                      <Text style={{ fontSize: 10, color: TEAL }}>places dispo</Text>
                    </View>
                  </View>
                )}

                {/* ── Détails réservation ── */}
                <View style={S.detailsBlock}>
                  <InfoRow icon="people-outline" label="Passagers"  val={`${paxCount} personne${paxCount > 1 ? "s" : ""}`} />
                  <InfoRow icon="apps-outline"   label="Sièges"     val={seatNums} />
                  <InfoRow icon="cash-outline"   label="Montant"    val={`${(b.totalAmount ?? 0).toLocaleString()} FCFA`} />
                  <InfoRow icon="card-outline"   label="Paiement"   val={paymentLabel(b.paymentMethod)} />
                </View>

                {/* ── Baggage section ── */}
                <View style={S.baggageBlock}>
                  <View style={S.baggageHeaderRow}>
                    <Feather name="briefcase" size={13} color={hasBaggage ? "#7C3AED" : "#9CA3AF"} />
                    <Text style={[S.baggageHeaderTxt, { color: hasBaggage ? "#7C3AED" : "#9CA3AF" }]}>
                      Bagage{hasBaggage ? ` (×${b.baggageCount})` : ""}
                    </Text>
                    {hasBaggage && b.bagageStatus && (
                      <View style={[S.bagStatusPill, { backgroundColor: b.bagageStatus === "accepté" ? "#DCFCE7" : "#FEF3C7" }]}>
                        <Text style={[S.bagStatusTxt, { color: b.bagageStatus === "accepté" ? "#16A34A" : "#D97706" }]}>
                          {b.bagageStatus === "accepté" ? "Validé" : "En attente"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {hasBaggage ? (
                    <View style={S.baggageDetails}>
                      <View style={S.baggageDetailRow}>
                        <Feather name={baggageTypeLabel(b.baggageType).icon} size={14} color="#6B7280" />
                        <Text style={S.baggageDetailTxt}>{baggageTypeLabel(b.baggageType).label}</Text>
                      </View>
                      {b.baggageDescription ? (
                        <View style={S.baggageDetailRow}>
                          <Feather name="file-text" size={14} color="#6B7280" />
                          <Text style={S.baggageDetailTxt}>{b.baggageDescription}</Text>
                        </View>
                      ) : null}
                      {isPending && (
                        <Text style={S.baggageValidationNote}>
                          Le bagage sera automatiquement validé à la confirmation de la réservation.
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={S.noBaggageTxt}>Aucun bagage déclaré</Text>
                  )}
                </View>

                {/* Source badge */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <View style={{ backgroundColor: "#DBEAFE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: "#1D4ED8", fontWeight: "700" }}>
                      Réservation {b.bookingSource === "mobile" ? "Mobile" : "En ligne"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {new Date(b.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>

                {/* Action buttons */}
                {isPending && (
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={[S.confirmBtn, isConfirming && { opacity: 0.7 }]}
                      onPress={() => confirmBooking(b)}
                      disabled={isConfirming || cancelling === b.id}
                    >
                      {isConfirming ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={S.confirmTxt}>Confirmer la réservation{hasBaggage ? " + bagage" : ""}</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[S.cancelBtn, cancelling === b.id && { opacity: 0.7 }]}
                      onPress={() => { setCancelModal(b); setCancelReason(""); }}
                      disabled={isConfirming || cancelling === b.id}
                    >
                      <Ionicons name="close-circle-outline" size={17} color="#DC2626" />
                      <Text style={S.cancelTxt}>Annuler la réservation</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!isPending && !isCancelled && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 6 }}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
                    <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "700" }}>Réservation traitée</Text>
                  </View>
                )}

                {isCancelled && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 6 }}>
                    <Ionicons name="close-circle" size={18} color="#DC2626" />
                    <Text style={{ fontSize: 13, color: "#DC2626", fontWeight: "700" }}>Réservation annulée</Text>
                  </View>
                )}
              </View>
            );
          })}
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
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>Faire un rapport</Text>
      </TouchableOpacity>

      {/* Cancel modal */}
      <Modal visible={!!cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(null)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Annuler la réservation</Text>
              <TouchableOpacity onPress={() => setCancelModal(null)}>
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={S.modalRef}>{cancelModal?.bookingRef} — {cancelModal?.passengers?.[0]?.name}</Text>
            <Text style={S.modalInfo}>
              Le siège sera libéré et le client sera notifié. Cette action est irréversible.
            </Text>
            <Text style={S.modalLabel}>Motif d'annulation <Text style={{ color: "#9CA3AF" }}>(optionnel)</Text></Text>
            <TextInput
              style={S.modalInput}
              placeholder="Ex : Doublon, erreur de trajet, demande client..."
              placeholderTextColor="#9CA3AF"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={2}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[S.modalBtn, { flex: 1, backgroundColor: "#F3F4F6" }]} onPress={() => setCancelModal(null)}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#6B7280" }}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalBtn, { flex: 1, backgroundColor: "#DC2626" }, cancelling ? { opacity: 0.7 } : {}]}
                onPress={cancelBooking}
                disabled={!!cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Confirmer l'annulation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Info row helper ─────────────────────────────────────────────────────── */
function InfoRow({ icon, label, val }: { icon: string; label: string; val: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderColor: "#F3F4F6" }}>
      <Ionicons name={icon as any} size={15} color="#6B7280" />
      <Text style={{ fontSize: 13, color: "#6B7280", width: 90 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", flex: 1 }}>{val}</Text>
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
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", gap: 5 },
  chipActive:  { backgroundColor: TEAL, borderColor: TEAL },
  chipTxt:     { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  chipTxtActive: { color: "#fff" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: "#E5E7EB" },
  cardRef:    { fontSize: 17, fontWeight: "900", color: TEAL, letterSpacing: 0.3 },
  cardRoute:  { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 2 },
  statusBadge:{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  statusTxt:  { fontSize: 12, fontWeight: "700" },

  /* Client block */
  clientBlock:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FAFF", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E0E7FF" },
  clientAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" },
  clientAvatarTxt:{ fontSize: 19, fontWeight: "800", color: "#fff" },
  clientName:     { fontSize: 15, fontWeight: "800", color: "#111827" },
  clientPhone:    { fontSize: 13, color: TEAL, fontWeight: "600", marginTop: 3 },
  callBtn:        { backgroundColor: TEAL_L, borderRadius: 12, padding: 10, alignItems: "center", justifyContent: "center" },

  /* Trip block */
  tripBlock:  { backgroundColor: "#F0F9FF", borderRadius: 12, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: TEAL },
  tripRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  tripInfo:   { fontSize: 12, color: "#374151", fontWeight: "600" },
  tripBus:    { fontSize: 12, color: "#6B7280" },

  /* Details block */
  detailsBlock: { backgroundColor: "#FAFAFA", borderRadius: 12, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  infoGrid:   { gap: 0, marginBottom: 10 },

  /* Baggage block */
  baggageBlock: {
    backgroundColor: "#FAFAFF", borderRadius: 12, borderWidth: 1, borderColor: "#EDE9FE",
    padding: 12, marginBottom: 10,
  },
  baggageHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  baggageHeaderTxt: { fontSize: 13, fontWeight: "700", flex: 1 },
  bagStatusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  bagStatusTxt: { fontSize: 10, fontWeight: "700" },
  baggageDetails: { gap: 4 },
  baggageDetailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  baggageDetailTxt: { fontSize: 12, color: "#374151", flex: 1 },
  baggageValidationNote: { fontSize: 11, color: "#059669", fontStyle: "italic", marginTop: 4 },
  noBaggageTxt: { fontSize: 12, color: "#9CA3AF", fontStyle: "italic" },

  confirmBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 8 },
  confirmTxt: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },

  cancelBtn:  { borderRadius: 14, paddingVertical: 13, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  cancelTxt:  { color: "#DC2626", fontSize: 14, fontWeight: "700" },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  modalRef:   { fontSize: 13, color: TEAL, fontWeight: "700", marginBottom: 8 },
  modalInfo:  { fontSize: 12, color: "#6B7280", marginBottom: 14, lineHeight: 18 },
  modalLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
  modalInput: { borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#111827", minHeight: 60, textAlignVertical: "top" },
  modalBtn:   { paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
