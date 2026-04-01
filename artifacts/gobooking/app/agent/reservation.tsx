/**
 * Réservations en ligne — Dashboard opérationnel par agence
 *
 * Architecture :
 *   ┌─ HEADER AGENCE ──────────────────────────────────┐
 *   │  Nom agence + ville + stats temps réel            │
 *   └──────────────────────────────────────────────────┘
 *   ┌─ FILTRE DÉPART ───────────────────────────────────┐
 *   │  Tous · Programmés · En route · Terminés          │
 *   └──────────────────────────────────────────────────┘
 *   ┌─ FILTRE STATUT ───────────────────────────────────┐
 *   │  En attente · Confirmées · Annulées · Toutes      │
 *   └──────────────────────────────────────────────────┘
 *   ┌─ GROUPE TRAJET ────────────────────────────────────┐
 *   │  Abidjan → Bouaké  07:00  [En route]  3 rés.      │
 *   │  ┌─ CARTE RÉSERVATION ──────────────────────────┐  │
 *   │  │  MOBRES001                     En attente    │  │
 *   │  │  ─────────────────────────────────────────── │  │
 *   │  │  👤 Koné Mamadou          ☎ +225 07 xx xx   │  │
 *   │  │  ─────────────────────────────────────────── │  │
 *   │  │  2 pers. │ A3,A4 │ 12 000 F │ Mobile Money  │  │
 *   │  │  ─────────────────────────────────────────── │  │
 *   │  │  📦 Colis ×1   En attente   3 500 F          │  │
 *   │  │  ─────────────────────────────────────────── │  │
 *   │  │  [   ✓ CONFIRMER    ]  ·  Annuler            │  │
 *   │  └──────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────┘
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
  tealMid:    "#0891B2",
  tealSoft:   "#ECFEFF",
  tealBorder: "#A5F3FC",
  green:      "#059669",
  greenSoft:  "#ECFDF5",
  greenDark:  "#065F46",
  amber:      "#D97706",
  amberSoft:  "#FFFBEB",
  amberBorder:"#FDE68A",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
  purple:     "#7C3AED",
  purpleSoft: "#F5F3FF",
  indigo:     "#4F46E5",
  indigoSoft: "#EEF2FF",
  text:       "#111827",
  textSub:    "#6B7280",
  border:     "#E5E7EB",
  bg:         "#F1F5F9",
  white:      "#FFFFFF",
};

/* ── Types ─────────────────────────────────────────────────── */
interface AgenceInfo { id: string; name: string; city: string }

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

type DepartFilter = "all" | "scheduled" | "active" | "done";
type StatusFilter = "pending" | "confirmed" | "cancelled" | "all";

/* ── Helpers ───────────────────────────────────────────────── */
function bookingStatusStyle(s: string) {
  if (s === "pending")   return { label: "En attente",  color: C.amber,  bg: C.amberSoft };
  if (s === "confirmed") return { label: "Confirmé",    color: C.green,  bg: C.greenSoft };
  if (s === "cancelled") return { label: "Annulé",      color: C.red,    bg: C.redSoft  };
  if (s === "boarded")   return { label: "Embarqué",    color: C.purple, bg: C.purpleSoft };
  return { label: s, color: C.textSub, bg: "#F3F4F6" };
}

function tripStatusStyle(s?: string): { label: string; color: string; bg: string; icon: string } | null {
  if (!s) return null;
  if (s === "en_route" || s === "in_progress") return { label: "En route",    color: C.green,  bg: C.greenSoft,  icon: "navigation" };
  if (s === "boarding")                        return { label: "Embarquement",color: C.purple, bg: C.purpleSoft, icon: "user-check" };
  if (s === "scheduled")                       return { label: "Programmé",   color: C.amber,  bg: C.amberSoft,  icon: "clock"      };
  if (s === "arrived" || s === "completed")    return { label: "Arrivé",      color: C.teal,   bg: C.tealSoft,   icon: "check-circle" };
  if (s === "cancelled")                       return { label: "Annulé",      color: C.red,    bg: C.redSoft,    icon: "x-circle"   };
  return null;
}

function paymentLabel(p: string) {
  if (p === "mobile_money") return "Mobile Money";
  if (p === "card")         return "Carte";
  if (p === "cash")         return "Espèces";
  return p ?? "—";
}

function baggageLabel(t: string | null) {
  if (t === "léger") return "Léger";
  if (t === "lourd") return "Lourd";
  if (t === "colis") return "Colis";
  return t ?? "Bagage";
}

function isTripActive(s?: string) {
  return s === "en_route" || s === "in_progress" || s === "boarding";
}
function isTripDone(s?: string) {
  return s === "arrived" || s === "completed" || s === "cancelled";
}
function isTripScheduled(s?: string) {
  return s === "scheduled" || !s;
}

/* ════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { user, token, logoutIfActiveToken } = useAuth();

  const [agence,     setAgence]     = useState<AgenceInfo | null>(null);
  const [bookings,   setBookings]   = useState<OnlineBooking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [departFilter, setDepartFilter] = useState<DepartFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const [confirming,   setConfirming]   = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [cancelModal,  setCancelModal]  = useState<OnlineBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [lastSync,     setLastSync]     = useState<Date | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ── Pulse quand des réservations sont en attente ── */
  useEffect(() => {
    const pending = bookings.filter(b => b.status === "pending").length;
    if (pending > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [bookings.length]);

  /* ── Chargement ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await apiFetch<{ agence: AgenceInfo | null; bookings: OnlineBooking[] }>(
        "/agent/online-bookings", { token: token ?? undefined }
      );
      const data = resp as any;
      /* Support both old array format and new object format */
      if (Array.isArray(data)) {
        setBookings(data);
      } else {
        setAgence(data?.agence ?? null);
        setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      }
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

  /* ── Actions ── */
  const confirmBooking = async (b: OnlineBooking) => {
    const bagInfo = b.baggageCount > 0 ? `\nBagage : ${baggageLabel(b.baggageType)} (×${b.baggageCount})` : "";
    Alert.alert("Confirmer", `${b.bookingRef} — ${b.passengers[0]?.name ?? "client"}\nTrajet : ${b.trip?.from} → ${b.trip?.to}\nDate : ${b.trip?.date} à ${b.trip?.departureTime}\nMontant : ${(b.totalAmount ?? 0).toLocaleString()} FCFA${bagInfo}`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer ✓", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token: token ?? undefined, method: "POST", body: {} });
            Alert.alert("✅ Confirmée", `${b.bookingRef} confirmée !`);
            await load(true);
          } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible de confirmer"); }
          finally { setConfirming(null); }
        }},
      ]
    );
  };

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
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible d'annuler"); }
    finally { setCancelling(null); }
  };

  /* ── Compteurs bruts ── */
  const pendingCount   = bookings.filter(b => b.status === "pending").length;
  const confirmedCount = bookings.filter(b => b.status === "confirmed" || b.status === "boarded").length;
  const cancelledCount = bookings.filter(b => b.status === "cancelled").length;
  const activeTrips    = [...new Set(bookings.filter(b => isTripActive(b.trip?.status)).map(b => b.trip?.id))].length;

  /* ── Double filtrage : départ × statut ── */
  const displayed = bookings.filter(b => {
    /* Filtre départ */
    if (departFilter === "scheduled" && !isTripScheduled(b.trip?.status)) return false;
    if (departFilter === "active"    && !isTripActive(b.trip?.status))    return false;
    if (departFilter === "done"      && !isTripDone(b.trip?.status))      return false;

    /* Filtre statut réservation */
    if (statusFilter === "pending")   return b.status === "pending";
    if (statusFilter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    if (statusFilter === "cancelled") return b.status === "cancelled";
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

  /* Tri : en route d'abord, puis programmés, puis terminés */
  groupedByTrip.sort((a, b) => {
    const order = (t: OnlineBooking["trip"]) =>
      isTripActive(t?.status) ? 0 : isTripScheduled(t?.status) ? 1 : 2;
    const diff = order(a.tripInfo) - order(b.tripInfo);
    if (diff !== 0) return diff;
    /* À statut égal, les groupes avec réservations en attente en premier */
    return (a.bookings.some(x => x.status === "pending") ? 0 : 1) -
           (b.bookings.some(x => x.status === "pending") ? 0 : 1);
  });

  const syncTime = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}:${String(lastSync.getSeconds()).padStart(2,"0")}`
    : null;

  /* ════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      {/* ── HEADER GRADIENT ── */}
      <LinearGradient colors={[C.tealDark, C.teal, C.tealMid]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:14 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub} numberOfLines={1}>
            {agence ? `${agence.name} · ${agence.city}` : user?.name ?? "…"}
            {syncTime ? `  ·  ${syncTime}` : ""}
          </Text>
        </View>
        <Pressable onPress={() => load()} style={s.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ── BANNIÈRE AGENCE ── */}
      <View style={s.agenceBanner}>
        {/* Icône agence */}
        <View style={s.agenceIcon}>
          <Feather name="map-pin" size={16} color={C.teal} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={s.agenceName} numberOfLines={1}>
            {agence?.name ?? "Mon Agence"}
          </Text>
          <Text style={s.agenceCity}>{agence?.city ?? "Chargement…"}</Text>
        </View>
        {/* Mini stats en temps réel */}
        <View style={s.agenceStats}>
          <Animated.View style={[s.agenceStatChip, { backgroundColor: C.amberSoft, transform:[{scale: pulseAnim}] }]}>
            <Text style={[s.agenceStatNum, { color: C.amber }]}>{pendingCount}</Text>
            <Text style={[s.agenceStatLabel, { color: C.amber }]}>attente</Text>
          </Animated.View>
          <View style={[s.agenceStatChip, { backgroundColor: C.greenSoft }]}>
            <Text style={[s.agenceStatNum, { color: C.green }]}>{confirmedCount}</Text>
            <Text style={[s.agenceStatLabel, { color: C.green }]}>confirmées</Text>
          </View>
          {activeTrips > 0 && (
            <View style={[s.agenceStatChip, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="navigation" size={10} color={C.green} />
              <Text style={[s.agenceStatNum, { color: C.greenDark }]}>{activeTrips}</Text>
              <Text style={[s.agenceStatLabel, { color: C.greenDark }]}>en route</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── FILTRE DÉPART ── */}
      <View style={s.filterSection}>
        <Text style={s.filterSectionLabel}>DÉPART</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {([
            { key:"all",       label:"Tous",        icon:"list"       as const },
            { key:"active",    label:"En route",    icon:"navigation" as const },
            { key:"scheduled", label:"À venir",     icon:"clock"      as const },
            { key:"done",      label:"Terminés",    icon:"check-circle" as const },
          ] as const).map(f => {
            const isActive = departFilter === f.key;
            const color = f.key === "active" ? C.green : f.key === "done" ? C.textSub : C.teal;
            return (
              <Pressable
                key={f.key}
                style={[s.chip, isActive && { backgroundColor: color, borderColor: color }]}
                onPress={() => setDepartFilter(f.key)}
              >
                <Feather name={f.icon} size={11} color={isActive ? "#fff" : color} />
                <Text style={[s.chipTxt, isActive && { color:"#fff" }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── FILTRE STATUT RÉSERVATION ── */}
      <View style={s.filterSection}>
        <Text style={s.filterSectionLabel}>RÉSERVATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {([
            { key:"pending",   label:"En attente",  count:pendingCount,   color:C.amber },
            { key:"confirmed", label:"Confirmées",  count:confirmedCount, color:C.green },
            { key:"cancelled", label:"Annulées",    count:cancelledCount, color:C.red   },
            { key:"all",       label:"Toutes",      count:bookings.length, color:C.teal },
          ] as const).map(f => {
            const isActive = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[s.chip, isActive && { backgroundColor: f.color, borderColor: f.color }]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[s.chipTxt, isActive && { color:"#fff" }]}>{f.label}</Text>
                {f.count > 0 && (
                  <View style={[s.chipBadge, isActive && { backgroundColor:"rgba(255,255,255,0.28)" }]}>
                    <Text style={[s.chipBadgeTxt, isActive && { color:"#fff" }]}>{f.count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LISTE ── */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={{ color:C.textSub, marginTop:10, fontSize:13 }}>Chargement des réservations…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.centerBox}>
          <View style={{ width:64, height:64, borderRadius:32, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", marginBottom:6 }}>
            <Feather name="inbox" size={28} color={C.teal} />
          </View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>
            {statusFilter === "pending"
              ? "Aucune réservation en attente pour ce filtre"
              : "Modifiez les filtres pour voir d'autres réservations"}
          </Text>
          <Pressable onPress={() => load()} style={s.emptyBtn}>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={{ color:"#fff", fontWeight:"700", fontSize:13 }}>Actualiser</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex:1 }}
          contentContainerStyle={{ padding:12, paddingBottom:48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.teal} />}
        >
          {/* Résumé du filtre actif */}
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <Text style={{ fontSize:12, color:C.textSub, fontWeight:"600" }}>
              {displayed.length} réservation{displayed.length > 1 ? "s" : ""} · {groupedByTrip.length} départ{groupedByTrip.length > 1 ? "s" : ""}
            </Text>
            <Text style={{ fontSize:11, color:C.textSub }}>
              {syncTime ? `Mis à jour ${syncTime}` : ""}
            </Text>
          </View>

          {groupedByTrip.map((group) => {
            const trip         = group.tripInfo;
            const isActive     = isTripActive(trip?.status);
            const isDone       = isTripDone(trip?.status);
            const groupPending = group.bookings.filter(b => b.status === "pending").length;
            const ts           = tripStatusStyle(trip?.status);

            const accentColor = isActive ? C.green : isDone ? C.textSub : groupPending > 0 ? C.amber : C.teal;

            return (
              <View key={group.tripKey} style={{ marginBottom:14 }}>

                {/* ════ HEADER TRAJET (Bloc départ) ════ */}
                <View style={[s.tripHeader, { borderLeftColor: accentColor }]}>
                  <View style={{ flex:1 }}>
                    {trip ? (
                      <>
                        {/* Route en grande taille */}
                        <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:5 }}>
                          <Text style={s.tripFrom}>{trip.from}</Text>
                          <Feather name="arrow-right" size={14} color={accentColor} />
                          <Text style={s.tripTo}>{trip.to}</Text>
                        </View>
                        {/* Métadonnées */}
                        <View style={{ flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                          <View style={s.tripMetaItem}>
                            <Feather name="calendar" size={10} color={C.textSub} />
                            <Text style={s.tripMetaTxt}>{trip.date}</Text>
                          </View>
                          <View style={s.tripMetaItem}>
                            <Feather name="clock" size={10} color={C.textSub} />
                            <Text style={s.tripMetaTxt}>{trip.departureTime}</Text>
                          </View>
                          <View style={s.tripMetaItem}>
                            <Feather name="truck" size={10} color={C.textSub} />
                            <Text style={s.tripMetaTxt}>{trip.busName}</Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={[s.tripFrom, { color:C.textSub }]}>Trajet non précisé</Text>
                    )}
                  </View>

                  {/* Côté droit : statut + compteur */}
                  <View style={{ alignItems:"flex-end", gap:5 }}>
                    {ts && (
                      <View style={[s.tripStatusPill, { backgroundColor: ts.bg }]}>
                        <Feather name={ts.icon as any} size={9} color={ts.color} />
                        <Text style={[s.tripStatusTxt, { color: ts.color }]}>{ts.label}</Text>
                      </View>
                    )}
                    <View style={[s.countPill, { backgroundColor: groupPending > 0 ? C.amber : accentColor }]}>
                      <Text style={s.countTxt}>
                        {group.bookings.length} rés.{groupPending > 0 ? `  ·  ${groupPending} att.` : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ════ CARTES RÉSERVATIONS ════ */}
                {group.bookings.map(b => {
                  const bst         = bookingStatusStyle(b.status);
                  const paxCount    = b.passengers?.length ?? 1;
                  const seatNums    = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "À assigner";
                  const isPending   = b.status === "pending";
                  const isCancelled = b.status === "cancelled";
                  const isConf      = confirming === b.id;
                  const hasBaggage  = b.baggageCount > 0;
                  const initial     = (b.passengers?.[0]?.name ?? "?").charAt(0).toUpperCase();

                  return (
                    <View key={b.id} style={[s.card, isPending && s.cardPending, { marginLeft:8 }]}>

                      {/* ── Ligne référence + statut ── */}
                      <View style={s.cardTopRow}>
                        <Text style={s.cardRef}>{b.bookingRef}</Text>
                        <View style={[s.statusBadge, { backgroundColor: bst.bg }]}>
                          <Text style={[s.statusTxt, { color: bst.color }]}>{bst.label}</Text>
                        </View>
                      </View>

                      <View style={s.divider} />

                      {/* ── CLIENT ── */}
                      <View style={s.clientRow}>
                        <View style={s.clientAvatar}>
                          <Text style={s.clientInitial}>{initial}</Text>
                        </View>
                        <View style={{ flex:1 }}>
                          <Text style={s.clientName} numberOfLines={1}>
                            {b.passengers?.[0]?.name ?? "Client inconnu"}
                          </Text>
                          {b.contactPhone
                            ? <Pressable onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
                                <Text style={s.clientPhone}>{b.contactPhone}</Text>
                              </Pressable>
                            : <Text style={s.clientNoPhone}>Pas de téléphone</Text>
                          }
                        </View>
                        {b.contactPhone && (
                          <Pressable style={s.callBtn}
                            onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
                            <Feather name="phone" size={15} color={C.teal} />
                          </Pressable>
                        )}
                      </View>

                      <View style={s.divider} />

                      {/* ── RÉSERVATION (grille 4 colonnes) ── */}
                      <View style={s.resvGrid}>
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Passagers</Text>
                          <Text style={s.resvVal}>{paxCount}</Text>
                        </View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Sièges</Text>
                          <Text style={s.resvVal} numberOfLines={1}>{seatNums}</Text>
                        </View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Montant</Text>
                          <Text style={[s.resvVal, { color:C.teal }]}>
                            {(b.totalAmount ?? 0).toLocaleString()} F
                          </Text>
                        </View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}>
                          <Text style={s.resvLabel}>Paiement</Text>
                          <Text style={s.resvVal} numberOfLines={1}>{paymentLabel(b.paymentMethod)}</Text>
                        </View>
                      </View>

                      {/* ── BAGAGE / COLIS ── */}
                      {hasBaggage && (
                        <>
                          <View style={s.divider} />
                          <View style={s.bagRow}>
                            <View style={s.bagIcon}>
                              <Feather name="package" size={13} color={C.purple} />
                            </View>
                            <View style={{ flex:1 }}>
                              <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
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
                              <Text style={[s.resvVal, { color:C.purple }]}>
                                {b.bagagePrice.toLocaleString()} F
                              </Text>
                            )}
                          </View>
                        </>
                      )}

                      {/* ── ACTIONS ── */}
                      {isPending && (
                        <>
                          <View style={s.divider} />
                          <View style={s.actionsBlock}>
                            <Pressable
                              style={[s.confirmBtn, isConf && { opacity:0.65 }]}
                              onPress={() => confirmBooking(b)}
                              disabled={isConf || cancelling === b.id}
                            >
                              {isConf
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <>
                                    <Feather name="check-circle" size={16} color="#fff" />
                                    <Text style={s.confirmTxt}>
                                      Confirmer{hasBaggage ? " + bagage" : ""}
                                    </Text>
                                  </>
                              }
                            </Pressable>
                            <Pressable
                              style={s.cancelBtn}
                              onPress={() => { setCancelModal(b); setCancelReason(""); }}
                              disabled={isConf || cancelling === b.id}
                            >
                              <Text style={s.cancelTxt}>Annuler</Text>
                            </Pressable>
                          </View>
                        </>
                      )}

                      {/* Statut final (confirmé / embarqué / annulé) */}
                      {!isPending && (
                        <View style={[s.finalStatus, { backgroundColor: isCancelled ? C.redSoft : bst.bg }]}>
                          <Feather
                            name={isCancelled ? "x-circle" : "check-circle"}
                            size={13}
                            color={isCancelled ? C.red : bst.color}
                          />
                          <Text style={[s.finalStatusTxt, { color: isCancelled ? C.red : bst.color }]}>
                            {isCancelled ? "Annulée — siège libéré"
                              : b.status === "boarded" ? "Passager embarqué"
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
            <View style={{ flexDirection:"row", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
              <View>
                <Text style={s.modalTitle}>Annuler la réservation</Text>
                <Text style={{ fontSize:12, color:C.textSub, marginTop:3 }}>
                  {cancelModal?.bookingRef} · {cancelModal?.passengers?.[0]?.name ?? "Client"}
                </Text>
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
            <Pressable
              style={[s.confirmBtn, { backgroundColor: C.red }, cancelling === cancelModal?.id && { opacity:0.65 }]}
              onPress={cancelBooking}
              disabled={!!cancelling}
            >
              {cancelling === cancelModal?.id
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Feather name="x-circle" size={16} color="#fff" />
                    <Text style={s.confirmTxt}>Confirmer l'annulation</Text>
                  </>
              }
            </Pressable>
            <Pressable style={s.cancelBtn} onPress={() => setCancelModal(null)}>
              <Text style={[s.cancelTxt, { color:C.textSub }]}>Garder la réservation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex:1, backgroundColor: C.bg },

  /* Header gradient */
  header:     { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14 },
  hTitle:     { fontSize:17, fontWeight:"800", color:"#fff" },
  hSub:       { fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 },
  refreshBtn: { width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },

  /* Bannière agence */
  agenceBanner:    { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:C.white, paddingHorizontal:14, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
  agenceIcon:      { width:38, height:38, borderRadius:10, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.tealBorder },
  agenceName:      { fontSize:14, fontWeight:"800", color:C.text },
  agenceCity:      { fontSize:11, color:C.textSub, marginTop:1 },
  agenceStats:     { flexDirection:"row", gap:6 },
  agenceStatChip:  { alignItems:"center", borderRadius:10, paddingHorizontal:8, paddingVertical:5, flexDirection:"row", gap:3 },
  agenceStatNum:   { fontSize:15, fontWeight:"900" },
  agenceStatLabel: { fontSize:9, fontWeight:"700", textTransform:"uppercase" },

  /* Filtres */
  filterSection:     { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, paddingTop:8, paddingBottom:4 },
  filterSectionLabel:{ fontSize:9, fontWeight:"800", color:C.textSub, letterSpacing:1, paddingHorizontal:14, marginBottom:4, textTransform:"uppercase" },
  filterRow:         { flexDirection:"row", gap:6, paddingHorizontal:12, paddingBottom:8 },
  chip:              { flexDirection:"row", alignItems:"center", gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white },
  chipTxt:           { fontSize:12, fontWeight:"700", color:C.text },
  chipBadge:         { backgroundColor:C.border, borderRadius:10, paddingHorizontal:5, paddingVertical:1 },
  chipBadgeTxt:      { fontSize:10, fontWeight:"800", color:C.text },

  /* États vides */
  centerBox:  { flex:1, justifyContent:"center", alignItems:"center", gap:10, paddingHorizontal:40 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:C.text, textAlign:"center" },
  emptySub:   { fontSize:13, color:C.textSub, textAlign:"center", lineHeight:19 },
  emptyBtn:   { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:20, paddingVertical:11, backgroundColor:C.teal, borderRadius:12 },

  /* Header trajet */
  tripHeader:     { backgroundColor:C.white, borderRadius:14, padding:13, marginBottom:6, borderLeftWidth:5, borderWidth:1, borderColor:C.border, flexDirection:"row", alignItems:"center", gap:12 },
  tripFrom:       { fontSize:16, fontWeight:"900", color:C.text },
  tripTo:         { fontSize:16, fontWeight:"900", color:C.text },
  tripMetaItem:   { flexDirection:"row", alignItems:"center", gap:4 },
  tripMetaTxt:    { fontSize:11, color:C.textSub, fontWeight:"500" },
  tripStatusPill: { flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  tripStatusTxt:  { fontSize:10, fontWeight:"800" },
  countPill:      { borderRadius:10, paddingHorizontal:9, paddingVertical:3 },
  countTxt:       { fontSize:10, fontWeight:"800", color:"#fff" },

  /* Carte réservation */
  card:       { backgroundColor:C.white, borderRadius:12, marginBottom:8, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  cardPending:{ borderColor:C.amberBorder },
  cardTopRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:12, paddingBottom:10 },
  cardRef:    { fontSize:12, fontWeight:"900", color:C.text, letterSpacing:0.5 },
  statusBadge:{ borderRadius:7, paddingHorizontal:9, paddingVertical:3 },
  statusTxt:  { fontSize:10, fontWeight:"800" },
  divider:    { height:1, backgroundColor:C.border },

  /* Client */
  clientRow:    { flexDirection:"row", alignItems:"center", gap:10, padding:12 },
  clientAvatar: { width:36, height:36, borderRadius:18, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  clientInitial:{ fontSize:15, fontWeight:"900", color:C.teal },
  clientName:   { fontSize:13, fontWeight:"800", color:C.text },
  clientPhone:  { fontSize:11, color:C.teal, fontWeight:"600", marginTop:2 },
  clientNoPhone:{ fontSize:11, color:C.textSub, marginTop:2 },
  callBtn:      { width:34, height:34, borderRadius:17, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.tealBorder },

  /* Réservation grid */
  resvGrid:  { flexDirection:"row", paddingHorizontal:12, paddingVertical:10 },
  resvCell:  { flex:1, alignItems:"center" },
  resvSep:   { width:1, backgroundColor:C.border, marginVertical:4 },
  resvLabel: { fontSize:9, color:C.textSub, fontWeight:"700", textTransform:"uppercase", marginBottom:3 },
  resvVal:   { fontSize:12, fontWeight:"800", color:C.text, textAlign:"center" },

  /* Bagage */
  bagRow:        { flexDirection:"row", alignItems:"flex-start", gap:10, padding:12 },
  bagIcon:       { width:30, height:30, borderRadius:8, backgroundColor:C.purpleSoft, alignItems:"center", justifyContent:"center" },
  bagTitle:      { fontSize:12, fontWeight:"800", color:C.text },
  bagDesc:       { fontSize:10, color:C.textSub, marginTop:2 },
  bagStatusPill: { borderRadius:5, paddingHorizontal:6, paddingVertical:2 },
  bagStatusTxt:  { fontSize:9, fontWeight:"700" },

  /* Actions */
  actionsBlock: { padding:12, gap:8 },
  confirmBtn:   { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:C.green, borderRadius:11, paddingVertical:13 },
  confirmTxt:   { color:"#fff", fontSize:14, fontWeight:"800" },
  cancelBtn:    { alignItems:"center", paddingVertical:6 },
  cancelTxt:    { fontSize:12, color:C.red, fontWeight:"700" },

  /* Statut final */
  finalStatus:    { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, margin:10, borderRadius:9, paddingVertical:8 },
  finalStatusTxt: { fontSize:11, fontWeight:"700" },

  /* Modal */
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalCard:    { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:20, gap:12 },
  modalTitle:   { fontSize:16, fontWeight:"900", color:C.text },
  modalInput:   { backgroundColor:C.bg, borderRadius:11, borderWidth:1, borderColor:C.border, padding:13, fontSize:14, color:C.text, minHeight:65, textAlignVertical:"top" },
});
