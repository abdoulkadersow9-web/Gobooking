/**
 * Réservations en ligne — Agent de vente
 *
 * Hiérarchie stricte par réservation :
 *   1. TRAJET (header de groupe, le plus visible)
 *   2. IDENTIFICATION (ref + statut)
 *   3. CLIENT (nom + téléphone)
 *   4. RÉSERVATION (passagers, sièges, montant, paiement)
 *   5. BAGAGE / COLIS (section séparée, seulement si présent)
 *   6. ACTIONS (Confirmer = principal · Annuler = secondaire)
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }  from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ── Design tokens ─────────────────────────────────────────── */
const C = {
  teal:       "#0E7490",
  tealDark:   "#164E63",
  tealSoft:   "#ECFEFF",
  tealBorder: "#A5F3FC",
  green:      "#059669",
  greenSoft:  "#ECFDF5",
  amber:      "#D97706",
  amberSoft:  "#FFFBEB",
  amberBorder:"#FDE68A",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
  purple:     "#7C3AED",
  purpleSoft: "#F5F3FF",
  text:       "#111827",
  textSub:    "#6B7280",
  border:     "#E5E7EB",
  bg:         "#F5F6FA",
  white:      "#FFFFFF",
};

/* ── Types ─────────────────────────────────────────────────── */
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
    status?: string;
    guichetSeats: number;
    onlineSeats: number;
    totalSeats: number;
  } | null;
}

/* ── Helpers ───────────────────────────────────────────────── */
function bookingStatusStyle(s: string): { label: string; color: string; bg: string } {
  if (s === "pending")   return { label: "En attente",  color: C.amber,  bg: C.amberSoft };
  if (s === "confirmed") return { label: "Confirmé",    color: C.green,  bg: C.greenSoft };
  if (s === "cancelled") return { label: "Annulé",      color: C.red,    bg: C.redSoft  };
  if (s === "boarded")   return { label: "Embarqué",    color: C.purple, bg: C.purpleSoft };
  return { label: s, color: C.textSub, bg: "#F3F4F6" };
}

function tripStatusStyle(s?: string): { label: string; color: string; bg: string; icon: string } | null {
  if (!s) return null;
  if (s === "en_route" || s === "in_progress") return { label: "En route",      color: C.green,  bg: C.greenSoft,  icon: "navigation" };
  if (s === "boarding")                        return { label: "Embarquement",   color: C.purple, bg: C.purpleSoft, icon: "user-check" };
  if (s === "scheduled")                       return { label: "Programmé",      color: C.amber,  bg: C.amberSoft,  icon: "clock"      };
  if (s === "arrived" || s === "completed")    return { label: "Arrivé",         color: C.teal,   bg: C.tealSoft,   icon: "check-circle" };
  if (s === "cancelled")                       return { label: "Annulé",         color: C.red,    bg: C.redSoft,    icon: "x-circle"   };
  return null;
}

function paymentLabel(p: string): string {
  if (p === "mobile_money") return "Mobile Money";
  if (p === "card")         return "Carte bancaire";
  if (p === "cash")         return "Espèces";
  return p ?? "—";
}

function baggageLabel(t: string | null): string {
  if (t === "léger") return "Léger (sac, cartable)";
  if (t === "lourd") return "Lourd (valise, carton)";
  if (t === "colis") return "Colis / envoi groupé";
  return t ?? "Non précisé";
}

const isEnRouteTrip = (t: OnlineBooking["trip"]) =>
  t?.status === "en_route" || t?.status === "in_progress" || t?.status === "boarding";

/* ════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { user, token, logoutIfActiveToken } = useAuth();

  const [bookings,   setBookings]   = useState<OnlineBooking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<"pending" | "confirmed" | "cancelled" | "all">("pending");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<OnlineBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ── Pulse animation quand des réservations sont en attente ── */
  useEffect(() => {
    const pending = bookings.filter(b => b.status === "pending").length;
    if (pending > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [bookings.length]);

  /* ── Chargement ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<OnlineBooking[]>("/agent/online-bookings", { token: token ?? undefined });
      setBookings(Array.isArray(data) ? data : []);
      setLastSync(new Date());
    } catch (e: any) {
      if (e?.httpStatus === 401) { logoutIfActiveToken(token ?? ""); return; }
      if (!silent) Alert.alert("Erreur", e?.message ?? "Impossible de charger");
    } finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  /* ── Confirmer ── */
  const confirmBooking = async (b: OnlineBooking) => {
    const bagInfo = b.baggageCount > 0 ? `\nBagage : ${baggageLabel(b.baggageType)} (×${b.baggageCount})` : "";
    Alert.alert(
      "Confirmer la réservation",
      `${b.bookingRef} — ${b.passengers[0]?.name ?? "client"}\n\nTrajet : ${b.trip?.from} → ${b.trip?.to}\nDate : ${b.trip?.date} à ${b.trip?.departureTime}\nMontant : ${(b.totalAmount ?? 0).toLocaleString()} FCFA${bagInfo}`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer ✓", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token: token ?? undefined, method: "POST", body: {} });
            Alert.alert("✅ Confirmée", `${b.bookingRef} confirmée${b.baggageCount > 0 ? " avec le bagage" : ""} !`);
            await load(true);
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Impossible de confirmer");
          } finally { setConfirming(null); }
        }},
      ]
    );
  };

  /* ── Annuler ── */
  const cancelBooking = async () => {
    if (!cancelModal) return;
    setCancelling(cancelModal.id);
    try {
      await apiFetch(`/agent/online-bookings/${cancelModal.id}/cancel`, {
        token: token ?? undefined, method: "POST",
        body: { reason: cancelReason || undefined },
      });
      setCancelModal(null); setCancelReason("");
      Alert.alert("Annulée", `${cancelModal.bookingRef} annulée. Siège libéré.`);
      await load(true);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'annuler");
    } finally { setCancelling(null); }
  };

  /* ── Compteurs ── */
  const pendingCount   = bookings.filter(b => b.status === "pending").length;
  const confirmedCount = bookings.filter(b => b.status === "confirmed" || b.status === "boarded").length;
  const cancelledCount = bookings.filter(b => b.status === "cancelled").length;

  /* ── Filtrage ── */
  const displayed = bookings.filter(b => {
    if (filter === "pending")   return b.status === "pending";
    if (filter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    if (filter === "cancelled") return b.status === "cancelled";
    return true;
  });

  /* ── Groupement par trajet ── */
  type TripGroup = { tripKey: string; tripInfo: OnlineBooking["trip"]; bookings: OnlineBooking[] };
  const groupedByTrip = displayed.reduce<TripGroup[]>((acc, b) => {
    const key = b.trip?.id ?? "no-trip";
    const existing = acc.find(g => g.tripKey === key);
    if (existing) { existing.bookings.push(b); }
    else { acc.push({ tripKey: key, tripInfo: b.trip ?? null, bookings: [b] }); }
    return acc;
  }, []);
  groupedByTrip.sort((a, b) => {
    const diff = (isEnRouteTrip(a.tripInfo) ? 0 : 1) - (isEnRouteTrip(b.tripInfo) ? 0 : 1);
    if (diff !== 0) return diff;
    return (a.bookings.some(x => x.status === "pending") ? 0 : 1) -
           (b.bookings.some(x => x.status === "pending") ? 0 : 1);
  });

  /* ── Sync time ── */
  const syncTime = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}:${String(lastSync.getSeconds()).padStart(2,"0")}`
    : null;

  /* ════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      {/* ── HEADER ── */}
      <LinearGradient colors={[C.tealDark, C.teal, "#0891B2"]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:14 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub}>
            {syncTime ? `Sync ${syncTime} · Auto 30s` : `Chargement · ${user?.name}`}
          </Text>
        </View>
        <Pressable onPress={() => load()} style={s.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ── BANDEAU STATISTIQUES ── */}
      <View style={s.statsRow}>
        <View style={s.statCell}>
          <Animated.Text style={[s.statNum, { color: C.amber, transform: [{ scale: pulseAnim }] }]}>
            {pendingCount}
          </Animated.Text>
          <Text style={s.statLabel}>En attente</Text>
        </View>
        <View style={s.statSep} />
        <View style={s.statCell}>
          <Text style={[s.statNum, { color: C.green }]}>{confirmedCount}</Text>
          <Text style={s.statLabel}>Confirmées</Text>
        </View>
        <View style={s.statSep} />
        <View style={s.statCell}>
          <Text style={[s.statNum, { color: C.red }]}>{cancelledCount}</Text>
          <Text style={s.statLabel}>Annulées</Text>
        </View>
        <View style={s.statSep} />
        <View style={s.statCell}>
          <Text style={[s.statNum, { color: C.teal }]}>{bookings.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
      </View>

      {/* ── FILTRES ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow:0 }} contentContainerStyle={s.filterRow}>
        {([
          { key:"pending",   label:"En attente",  count:pendingCount,   activeColor:"#fff", activeBg: C.amber  },
          { key:"confirmed", label:"Confirmées",   count:confirmedCount, activeColor:"#fff", activeBg: C.green  },
          { key:"cancelled", label:"Annulées",     count:cancelledCount, activeColor:"#fff", activeBg: C.red    },
          { key:"all",       label:"Toutes",       count:bookings.length,activeColor:"#fff", activeBg: "#374151"},
        ] as const).map(f => (
          <Pressable
            key={f.key}
            style={[s.filterChip, filter === f.key && { backgroundColor: f.activeBg, borderColor: f.activeBg }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterTxt, filter === f.key && { color: f.activeColor }]}>{f.label}</Text>
            {f.count > 0 && (
              <View style={[s.filterBadge, filter === f.key && { backgroundColor:"rgba(255,255,255,0.25)" }]}>
                <Text style={[s.filterBadgeTxt, filter === f.key && { color: f.activeColor }]}>{f.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* ── LISTE PRINCIPALE ── */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={{ color:C.textSub, marginTop:10 }}>Chargement…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.centerBox}>
          <Feather name="calendar" size={48} color="#CBD5E1" />
          <Text style={s.emptyTitle}>
            {filter === "pending" ? "Aucune réservation en attente" : "Aucune réservation"}
          </Text>
          <Text style={s.emptySub}>
            {filter === "pending"
              ? "Les nouvelles réservations en ligne apparaîtront ici"
              : "Modifiez le filtre pour voir d'autres réservations"}
          </Text>
          <Pressable onPress={() => load()} style={s.emptyBtn}>
            <Text style={{ color:"#fff", fontWeight:"700" }}>Actualiser</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex:1 }}
          contentContainerStyle={{ padding:14, paddingBottom:48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.teal} />}
        >
          {groupedByTrip.map((group) => {
            const trip        = group.tripInfo;
            const isActive    = isEnRouteTrip(trip);
            const groupPending = group.bookings.filter(b => b.status === "pending").length;
            const ts          = tripStatusStyle(trip?.status);

            return (
              <View key={group.tripKey} style={{ marginBottom:16 }}>

                {/* ════ BLOC 1 : TRAJET (en-tête de groupe) ════
                    Le plus visible — route large + statut + compteur
                ═══════════════════════════════════════════════ */}
                <View style={[s.tripHeader, { borderLeftColor: isActive ? C.green : groupPending > 0 ? C.amber : C.teal }]}>
                  {/* Route */}
                  <View style={{ flex:1 }}>
                    {trip ? (
                      <>
                        <Text style={s.tripRoute}>
                          {trip.from}
                          <Text style={{ color:C.textSub }}> → </Text>
                          {trip.to}
                        </Text>
                        <View style={{ flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:12, marginTop:5 }}>
                          <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
                            <Feather name="calendar" size={11} color={C.textSub} />
                            <Text style={s.tripMeta}>{trip.date}</Text>
                          </View>
                          <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
                            <Feather name="clock" size={11} color={C.textSub} />
                            <Text style={s.tripMeta}>{trip.departureTime}</Text>
                          </View>
                          <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
                            <Feather name="truck" size={11} color={C.textSub} />
                            <Text style={s.tripMeta}>{trip.busName}</Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={[s.tripRoute, { color:C.textSub }]}>Trajet non précisé</Text>
                    )}
                  </View>

                  {/* Statut + compteur */}
                  <View style={{ alignItems:"flex-end", gap:6 }}>
                    {ts && (
                      <View style={[s.tripStatusPill, { backgroundColor: ts.bg }]}>
                        <Feather name={ts.icon as any} size={10} color={ts.color} />
                        <Text style={[s.tripStatusTxt, { color: ts.color }]}>{ts.label}</Text>
                      </View>
                    )}
                    <View style={[s.countPill, { backgroundColor: groupPending > 0 ? C.amber : C.teal }]}>
                      <Text style={s.countPillTxt}>
                        {group.bookings.length} rés.{groupPending > 0 ? ` · ${groupPending} att.` : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ════ CARTES RÉSERVATION ════ */}
                {group.bookings.map(b => {
                  const bst        = bookingStatusStyle(b.status);
                  const paxCount   = b.passengers?.length ?? 1;
                  const seatNums   = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "À assigner";
                  const isPending  = b.status === "pending";
                  const isCancelled = b.status === "cancelled";
                  const isConfirming = confirming === b.id;
                  const hasBaggage = b.baggageCount > 0;
                  const initial    = (b.passengers?.[0]?.name ?? "?").charAt(0).toUpperCase();

                  return (
                    <View key={b.id} style={[s.card, isPending && s.cardPending]}>

                      {/* ── Ligne 1 : Référence + statut ── */}
                      <View style={s.cardTopRow}>
                        <Text style={s.cardRef}>{b.bookingRef}</Text>
                        <View style={[s.statusBadge, { backgroundColor: bst.bg }]}>
                          <Text style={[s.statusTxt, { color: bst.color }]}>{bst.label}</Text>
                        </View>
                      </View>

                      <View style={s.cardDivider} />

                      {/* ── BLOC 2 : CLIENT ── */}
                      <View style={s.clientRow}>
                        <View style={s.clientAvatar}>
                          <Text style={s.clientAvatarTxt}>{initial}</Text>
                        </View>
                        <View style={{ flex:1 }}>
                          <Text style={s.clientName} numberOfLines={1}>
                            {b.passengers?.[0]?.name ?? "Client inconnu"}
                          </Text>
                          {b.contactPhone ? (
                            <Pressable onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)} hitSlop={4}>
                              <Text style={s.clientPhone}>{b.contactPhone}</Text>
                            </Pressable>
                          ) : (
                            <Text style={s.clientNoPhone}>Pas de téléphone</Text>
                          )}
                        </View>
                        {b.contactPhone && (
                          <Pressable
                            style={s.callBtn}
                            onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}
                            hitSlop={4}
                          >
                            <Feather name="phone" size={16} color={C.teal} />
                          </Pressable>
                        )}
                      </View>

                      <View style={s.cardDivider} />

                      {/* ── BLOC 3 : RÉSERVATION ── */}
                      <View style={s.resvGrid}>
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Passagers</Text>
                          <Text style={s.resvVal}>{paxCount} pers.</Text>
                        </View>
                        <View style={s.resvCellSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Sièges</Text>
                          <Text style={s.resvVal} numberOfLines={1}>{seatNums}</Text>
                        </View>
                        <View style={s.resvCellSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Montant</Text>
                          <Text style={[s.resvVal, { color: C.teal }]}>
                            {(b.totalAmount ?? 0).toLocaleString()} F
                          </Text>
                        </View>
                        <View style={s.resvCellSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Paiement</Text>
                          <Text style={s.resvVal} numberOfLines={1}>{paymentLabel(b.paymentMethod)}</Text>
                        </View>
                      </View>

                      {/* ── BLOC 4 : BAGAGE / COLIS (seulement si présent) ── */}
                      {hasBaggage && (
                        <>
                          <View style={s.cardDivider} />
                          <View style={s.bagRow}>
                            <View style={[s.bagIcon, { backgroundColor: C.purpleSoft }]}>
                              <Feather name="package" size={14} color={C.purple} />
                            </View>
                            <View style={{ flex:1 }}>
                              <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                                <Text style={s.bagTitle}>
                                  {baggageLabel(b.baggageType)} × {b.baggageCount}
                                </Text>
                                {b.bagageStatus && (
                                  <View style={[s.bagStatusPill, {
                                    backgroundColor: b.bagageStatus === "accepté" ? C.greenSoft : C.amberSoft
                                  }]}>
                                    <Text style={[s.bagStatusTxt, {
                                      color: b.bagageStatus === "accepté" ? C.green : C.amber
                                    }]}>
                                      {b.bagageStatus === "accepté" ? "Validé" : "En attente"}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {b.baggageDescription && (
                                <Text style={s.bagDesc} numberOfLines={1}>{b.baggageDescription}</Text>
                              )}
                            </View>
                            {b.bagagePrice > 0 && (
                              <Text style={[s.resvVal, { color: C.purple }]}>
                                {b.bagagePrice.toLocaleString()} F
                              </Text>
                            )}
                          </View>
                        </>
                      )}

                      {/* ── BLOC 5 : ACTIONS ── */}
                      {isPending && (
                        <>
                          <View style={s.cardDivider} />
                          <View style={s.actionsBlock}>
                            {/* Bouton principal : CONFIRMER */}
                            <Pressable
                              style={[s.confirmBtn, isConfirming && { opacity:0.65 }]}
                              onPress={() => confirmBooking(b)}
                              disabled={isConfirming || cancelling === b.id}
                            >
                              {isConfirming
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <>
                                    <Feather name="check-circle" size={17} color="#fff" />
                                    <Text style={s.confirmTxt}>
                                      Confirmer{hasBaggage ? " + bagage" : ""}
                                    </Text>
                                  </>
                              }
                            </Pressable>
                            {/* Bouton secondaire : ANNULER */}
                            <Pressable
                              style={s.cancelBtn}
                              onPress={() => { setCancelModal(b); setCancelReason(""); }}
                              disabled={isConfirming || cancelling === b.id}
                            >
                              <Text style={s.cancelTxt}>Annuler la réservation</Text>
                            </Pressable>
                          </View>
                        </>
                      )}

                      {/* Statut final (confirmé / annulé) */}
                      {!isPending && (
                        <View style={[s.finalStatus, {
                          backgroundColor: isCancelled ? C.redSoft : bst.bg,
                        }]}>
                          <Feather
                            name={isCancelled ? "x-circle" : "check-circle"}
                            size={14}
                            color={isCancelled ? C.red : bst.color}
                          />
                          <Text style={[s.finalStatusTxt, { color: isCancelled ? C.red : bst.color }]}>
                            {isCancelled
                              ? "Réservation annulée — siège libéré"
                              : b.status === "boarded"
                                ? "Passager embarqué"
                                : "Réservation confirmée"}
                          </Text>
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

      {/* ── MODAL ANNULATION ── */}
      <Modal visible={!!cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Annuler la réservation</Text>
                <Text style={s.modalSub}>{cancelModal?.bookingRef} · {cancelModal?.passengers?.[0]?.name ?? "Client"}</Text>
              </View>
              <Pressable onPress={() => setCancelModal(null)} hitSlop={8}>
                <Feather name="x" size={20} color={C.textSub} />
              </Pressable>
            </View>
            <TextInput
              style={s.modalInput}
              placeholder="Motif d'annulation (optionnel)"
              placeholderTextColor={C.textSub}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={2}
            />
            <View style={{ gap:10 }}>
              <Pressable
                style={[s.modalCancelBtn, cancelling === cancelModal?.id && { opacity:0.65 }]}
                onPress={cancelBooking}
                disabled={!!cancelling}
              >
                {cancelling === cancelModal?.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Feather name="x-circle" size={16} color="#fff" />
                      <Text style={s.modalCancelTxt}>Confirmer l'annulation</Text>
                    </>
                }
              </Pressable>
              <Pressable style={s.modalKeepBtn} onPress={() => setCancelModal(null)}>
                <Text style={s.modalKeepTxt}>Garder la réservation</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex:1, backgroundColor: C.bg },

  /* Header */
  header:     { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14 },
  hTitle:     { fontSize:17, fontWeight:"800", color:"#fff" },
  hSub:       { fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 },
  refreshBtn: { width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },

  /* Stats */
  statsRow:  { flexDirection:"row", backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  statCell:  { flex:1, alignItems:"center", paddingVertical:12 },
  statNum:   { fontSize:22, fontWeight:"900", lineHeight:24 },
  statLabel: { fontSize:9, color:C.textSub, fontWeight:"600", marginTop:3, textTransform:"uppercase" },
  statSep:   { width:1, backgroundColor:C.border, marginVertical:10 },

  /* Filtres */
  filterRow:  { flexDirection:"row", gap:8, padding:12, paddingBottom:8 },
  filterChip: { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white },
  filterTxt:  { fontSize:13, fontWeight:"700", color:C.text },
  filterBadge:{ backgroundColor:C.border, borderRadius:10, paddingHorizontal:6, paddingVertical:1 },
  filterBadgeTxt:{ fontSize:10, fontWeight:"800", color:C.text },

  /* États vides / chargement */
  centerBox:  { flex:1, justifyContent:"center", alignItems:"center", gap:12, paddingHorizontal:40 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:C.text, textAlign:"center" },
  emptySub:   { fontSize:13, color:C.textSub, textAlign:"center", lineHeight:19 },
  emptyBtn:   { paddingHorizontal:24, paddingVertical:11, backgroundColor:C.teal, borderRadius:12 },

  /* ── TRIP HEADER (Bloc 1 TRAJET) ── */
  tripHeader: {
    backgroundColor:C.white, borderRadius:14, padding:14, marginBottom:8,
    borderLeftWidth:5, borderWidth:1, borderColor:C.border,
    flexDirection:"row", alignItems:"center", gap:12,
  },
  tripRoute:       { fontSize:17, fontWeight:"900", color:C.text },
  tripMeta:        { fontSize:11, color:C.textSub, fontWeight:"500" },
  tripStatusPill:  { flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  tripStatusTxt:   { fontSize:10, fontWeight:"800" },
  countPill:       { borderRadius:10, paddingHorizontal:9, paddingVertical:3 },
  countPillTxt:    { fontSize:10, fontWeight:"800", color:"#fff" },

  /* ── CARTE RÉSERVATION ── */
  card:       { backgroundColor:C.white, borderRadius:14, marginBottom:8, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  cardPending:{ borderColor:C.amberBorder, borderWidth:1.5 },
  cardTopRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:14, paddingBottom:12 },
  cardRef:    { fontSize:13, fontWeight:"900", color:C.text, letterSpacing:0.4 },
  statusBadge:{ borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  statusTxt:  { fontSize:11, fontWeight:"800" },
  cardDivider:{ height:1, backgroundColor:C.border },

  /* Client */
  clientRow:    { flexDirection:"row", alignItems:"center", gap:12, padding:14 },
  clientAvatar: { width:40, height:40, borderRadius:20, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  clientAvatarTxt:{ fontSize:17, fontWeight:"900", color:C.teal },
  clientName:   { fontSize:14, fontWeight:"800", color:C.text },
  clientPhone:  { fontSize:12, color:C.teal, fontWeight:"600", marginTop:2 },
  clientNoPhone:{ fontSize:12, color:C.textSub, marginTop:2 },
  callBtn:      { width:38, height:38, borderRadius:19, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.tealBorder },

  /* Réservation grid (2×2) */
  resvGrid:    { flexDirection:"row", padding:14, gap:0 },
  resvCell:    { flex:1, alignItems:"center" },
  resvCellSep: { width:1, backgroundColor:C.border, marginVertical:2 },
  resvLabel:   { fontSize:9, color:C.textSub, fontWeight:"700", textTransform:"uppercase", marginBottom:4, letterSpacing:0.3 },
  resvVal:     { fontSize:13, fontWeight:"800", color:C.text, textAlign:"center" },

  /* Bagage */
  bagRow:      { flexDirection:"row", alignItems:"flex-start", gap:10, padding:14 },
  bagIcon:     { width:36, height:36, borderRadius:10, alignItems:"center", justifyContent:"center" },
  bagTitle:    { fontSize:12, fontWeight:"800", color:C.text },
  bagDesc:     { fontSize:11, color:C.textSub, marginTop:2 },
  bagStatusPill:{ borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  bagStatusTxt: { fontSize:10, fontWeight:"700" },

  /* Actions */
  actionsBlock: { padding:14, gap:8 },
  confirmBtn:   { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:C.green, borderRadius:12, paddingVertical:14 },
  confirmTxt:   { color:"#fff", fontSize:15, fontWeight:"800" },
  cancelBtn:    { alignItems:"center", paddingVertical:8 },
  cancelTxt:    { fontSize:13, color:C.red, fontWeight:"700" },

  /* Statut final */
  finalStatus:    { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:10, paddingHorizontal:14, margin:10, borderRadius:10 },
  finalStatusTxt: { fontSize:12, fontWeight:"700" },

  /* Modal */
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalCard:    { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:22, gap:16 },
  modalHeader:  { flexDirection:"row", alignItems:"flex-start", justifyContent:"space-between" },
  modalTitle:   { fontSize:17, fontWeight:"900", color:C.text },
  modalSub:     { fontSize:13, color:C.textSub, marginTop:3 },
  modalInput:   { backgroundColor:C.bg, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:14, color:C.text, minHeight:70, textAlignVertical:"top" },
  modalCancelBtn:{ flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:C.red, borderRadius:12, paddingVertical:14 },
  modalCancelTxt:{ color:"#fff", fontSize:15, fontWeight:"800" },
  modalKeepBtn: { alignItems:"center", paddingVertical:10 },
  modalKeepTxt: { fontSize:14, color:C.textSub, fontWeight:"600" },
});
