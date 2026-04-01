/**
 * Réservations en ligne — Dashboard opérationnel par agence
 *
 * Hiérarchie stricte :
 *   ① Sélecteur d'agence  (toutes les agences de la compagnie)
 *   ② Filtre départ       (À venir / En gare / En route / Terminés)
 *   ③ Filtre statut       (En attente / Confirmées / Annulées / Toutes)
 *   ④ Groupement par trajet
 *   ⑤ Cartes réservation
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
  teal:       "#0E7490",  tealDark: "#164E63", tealMid: "#0891B2",
  tealSoft:   "#ECFEFF",  tealBorder: "#A5F3FC",
  green:      "#059669",  greenSoft: "#ECFDF5", greenDark: "#065F46",
  amber:      "#D97706",  amberSoft: "#FFFBEB", amberBorder: "#FDE68A",
  red:        "#DC2626",  redSoft: "#FEF2F2",
  purple:     "#7C3AED",  purpleSoft: "#F5F3FF",
  text:       "#111827",  textSub: "#6B7280",
  border:     "#E5E7EB",  bg: "#F1F5F9",  white: "#FFFFFF",
};

/* ── Types ─────────────────────────────────────────────────── */
interface Agence    { id: string; name: string; city: string }

interface OnlineBooking {
  id: string; bookingRef: string; status: string; bookingSource: string | null;
  totalAmount: number; paymentMethod: string; contactPhone: string;
  passengers: { name: string; age?: number; gender?: string }[];
  seatNumbers: string[]; createdAt: string;
  baggageCount: number; baggageType: string | null; baggageDescription: string | null;
  bagageStatus: string | null; bagagePrice: number;
  trip: {
    id: string; from: string; to: string; date: string; departureTime: string;
    busName: string; status?: string;
    guichetSeats: number; onlineSeats: number; totalSeats: number;
  } | null;
}

type DepartFilter = "all" | "scheduled" | "boarding" | "active" | "done";
type StatusFilter = "pending" | "confirmed" | "cancelled" | "all";

/* ── Helpers ───────────────────────────────────────────────── */
function bkStyle(s: string) {
  if (s === "pending")   return { label: "En attente", color: C.amber,  bg: C.amberSoft };
  if (s === "confirmed") return { label: "Confirmé",   color: C.green,  bg: C.greenSoft };
  if (s === "cancelled") return { label: "Annulé",     color: C.red,    bg: C.redSoft   };
  if (s === "boarded")   return { label: "Embarqué",   color: C.purple, bg: C.purpleSoft };
  return { label: s, color: C.textSub, bg: "#F3F4F6" };
}

function tripStyle(s?: string): { label: string; color: string; bg: string; icon: string } | null {
  if (!s) return null;
  if (s === "en_route" || s === "in_progress") return { label: "En route",      color: C.green,  bg: C.greenSoft,  icon: "navigation"   };
  if (s === "boarding")                        return { label: "En gare",        color: C.purple, bg: C.purpleSoft, icon: "user-check"   };
  if (s === "scheduled")                       return { label: "À venir",        color: C.amber,  bg: C.amberSoft,  icon: "clock"        };
  if (s === "arrived" || s === "completed")    return { label: "Terminé",        color: C.teal,   bg: C.tealSoft,   icon: "check-circle" };
  if (s === "cancelled")                       return { label: "Annulé",         color: C.red,    bg: C.redSoft,    icon: "x-circle"     };
  return null;
}

function payLabel(p: string) {
  if (p === "mobile_money") return "Mobile Money";
  if (p === "card")         return "Carte";
  if (p === "cash")         return "Espèces";
  return p ?? "—";
}

function bagLabel(t: string | null) {
  if (t === "léger") return "Léger"; if (t === "lourd") return "Lourd";
  if (t === "colis") return "Colis"; return t ?? "Bagage";
}

/* Trip state helpers */
const isActive    = (s?: string) => s === "en_route" || s === "in_progress";
const isBoarding  = (s?: string) => s === "boarding";
const isScheduled = (s?: string) => s === "scheduled" || !s;
const isDone      = (s?: string) => s === "arrived" || s === "completed" || s === "cancelled";

/* City match: trip.from matches agency city */
function cityMatch(tripFrom: string | null | undefined, agenceCity: string): boolean {
  if (!tripFrom) return false;
  const from = tripFrom.toLowerCase();
  const city = agenceCity.toLowerCase();
  return from.includes(city) || city.includes(from);
}

/* ════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { user, token, logoutIfActiveToken } = useAuth();

  /* State */
  const [agencies,    setAgencies]    = useState<Agence[]>([]);
  const [myAgence,    setMyAgence]    = useState<Agence | null>(null);
  const [bookings,    setBookings]    = useState<OnlineBooking[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  /* Sélecteur d'agence — null = Toutes */
  const [selectedAgence, setSelectedAgence] = useState<string | null>(null);

  /* Filtres */
  const [departFilter, setDepartFilter] = useState<DepartFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  /* Actions */
  const [confirming,   setConfirming]   = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [cancelModal,  setCancelModal]  = useState<OnlineBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [lastSync,     setLastSync]     = useState<Date | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* Pulse quand des réservations en attente */
  const pendingTotal = bookings.filter(b => b.status === "pending").length;
  useEffect(() => {
    if (pendingTotal > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [pendingTotal]);

  /* ── Chargement ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await apiFetch<any>("/agent/online-bookings", { token: token ?? undefined });
      const data = resp as any;
      if (Array.isArray(data)) {
        setBookings(data);
      } else {
        setAgencies(Array.isArray(data?.agencies) ? data.agencies : []);
        setMyAgence(data?.myAgence ?? null);
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

  /* ── Initialiser le sélecteur sur l'agence de l'agent ── */
  useEffect(() => {
    if (myAgence && selectedAgence === null) {
      setSelectedAgence(myAgence.id);
    }
  }, [myAgence]);

  /* ── Actions ── */
  const confirmBooking = async (b: OnlineBooking) => {
    Alert.alert("Confirmer", `${b.bookingRef} — ${b.passengers[0]?.name ?? "client"}\nTrajet : ${b.trip?.from} → ${b.trip?.to}\nDate : ${b.trip?.date} à ${b.trip?.departureTime}\nMontant : ${(b.totalAmount ?? 0).toLocaleString()} FCFA`,
      [{ text: "Annuler", style: "cancel" },
       { text: "Confirmer ✓", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token: token ?? undefined, method: "POST", body: {} });
            Alert.alert("✅ Confirmée", `${b.bookingRef} confirmée !`);
            await load(true);
          } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible de confirmer"); }
          finally { setConfirming(null); }
       }}]
    );
  };

  const cancelBooking = async () => {
    if (!cancelModal) return;
    setCancelling(cancelModal.id);
    try {
      await apiFetch(`/agent/online-bookings/${cancelModal.id}/cancel`, {
        token: token ?? undefined, method: "POST", body: { reason: cancelReason || undefined },
      });
      setCancelModal(null); setCancelReason("");
      Alert.alert("Annulée", `${cancelModal.bookingRef} annulée.`);
      await load(true);
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible d'annuler"); }
    finally { setCancelling(null); }
  };

  /* ── Filtrage triple : agence × départ × statut ── */
  const selectedAgenceObj = agencies.find(a => a.id === selectedAgence) ?? null;

  const displayed = bookings.filter(b => {
    /* ① Filtre agence */
    if (selectedAgence && selectedAgenceObj) {
      if (!cityMatch(b.trip?.from, selectedAgenceObj.city)) return false;
    }
    /* ② Filtre départ */
    const ts = b.trip?.status;
    if (departFilter === "scheduled" && !isScheduled(ts))  return false;
    if (departFilter === "boarding"  && !isBoarding(ts))   return false;
    if (departFilter === "active"    && !isActive(ts))     return false;
    if (departFilter === "done"      && !isDone(ts))       return false;
    /* ③ Filtre statut */
    if (statusFilter === "pending")   return b.status === "pending";
    if (statusFilter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    if (statusFilter === "cancelled") return b.status === "cancelled";
    return true;
  });

  /* Stats pour l'agence sélectionnée */
  const agenceBookings = selectedAgence && selectedAgenceObj
    ? bookings.filter(b => cityMatch(b.trip?.from, selectedAgenceObj.city))
    : bookings;
  const pendingCount   = agenceBookings.filter(b => b.status === "pending").length;
  const confirmedCount = agenceBookings.filter(b => b.status === "confirmed" || b.status === "boarded").length;
  const cancelledCount = agenceBookings.filter(b => b.status === "cancelled").length;
  const activeTripsCount = [...new Set(agenceBookings.filter(b => isActive(b.trip?.status)).map(b => b.trip?.id))].filter(Boolean).length;

  /* ── Groupement par trajet ── */
  type TripGroup = { tripKey: string; tripInfo: OnlineBooking["trip"]; bookings: OnlineBooking[] };
  const groups = displayed.reduce<TripGroup[]>((acc, b) => {
    const key = b.trip?.id ?? "no-trip";
    const existing = acc.find(g => g.tripKey === key);
    if (existing) { existing.bookings.push(b); }
    else { acc.push({ tripKey: key, tripInfo: b.trip ?? null, bookings: [b] }); }
    return acc;
  }, []);

  /* Tri : en route → embarquement → programmé → terminé */
  const tripOrder = (t: OnlineBooking["trip"]) =>
    isActive(t?.status) ? 0 : isBoarding(t?.status) ? 1 : isScheduled(t?.status) ? 2 : 3;
  groups.sort((a, b) => {
    const diff = tripOrder(a.tripInfo) - tripOrder(b.tripInfo);
    if (diff !== 0) return diff;
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

      {/* ── HEADER ── */}
      <LinearGradient colors={[C.tealDark, C.teal, C.tealMid]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:14 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub} numberOfLines={1}>
            {selectedAgenceObj ? selectedAgenceObj.name : "Toutes les agences"}
            {syncTime ? `  ·  ${syncTime}` : ""}
          </Text>
        </View>
        <Pressable onPress={() => load()} style={s.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ════════════════════════════════════════════════════
          ① SÉLECTEUR D'AGENCE
      ════════════════════════════════════════════════════ */}
      <View style={s.agenceSection}>
        <View style={s.agenceSectionRow}>
          <Feather name="map-pin" size={12} color={C.teal} />
          <Text style={s.agenceSectionLabel}>AGENCE</Text>
          {/* Stats compactes */}
          <View style={{ flex:1 }} />
          <Animated.View style={[s.miniStat, { backgroundColor: C.amberSoft, transform:[{scale:pulseAnim}] }]}>
            <Text style={[s.miniStatNum, { color: C.amber }]}>{pendingCount}</Text>
            <Text style={[s.miniStatLabel, { color: C.amber }]}>att.</Text>
          </Animated.View>
          <View style={[s.miniStat, { backgroundColor: C.greenSoft }]}>
            <Text style={[s.miniStatNum, { color: C.green }]}>{confirmedCount}</Text>
            <Text style={[s.miniStatLabel, { color: C.green }]}>conf.</Text>
          </View>
          {activeTripsCount > 0 && (
            <View style={[s.miniStat, { backgroundColor: C.greenSoft }]}>
              <Feather name="navigation" size={9} color={C.green} />
              <Text style={[s.miniStatNum, { color: C.greenDark ?? "#065F46" }]}>{activeTripsCount}</Text>
            </View>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.agenceRow}>
          {/* Chip "Toutes" */}
          <Pressable
            style={[s.agenceChip, selectedAgence === null && s.agenceChipActive]}
            onPress={() => setSelectedAgence(null)}
          >
            <Feather name="grid" size={11} color={selectedAgence === null ? "#fff" : C.teal} />
            <Text style={[s.agenceChipTxt, selectedAgence === null && { color:"#fff" }]}>Toutes</Text>
          </Pressable>
          {agencies.map(a => {
            const isSelected = selectedAgence === a.id;
            const isMyAgence = myAgence?.id === a.id;
            return (
              <Pressable
                key={a.id}
                style={[s.agenceChip, isSelected && s.agenceChipActive]}
                onPress={() => setSelectedAgence(isSelected ? null : a.id)}
              >
                <Feather name="map-pin" size={11} color={isSelected ? "#fff" : C.teal} />
                <Text style={[s.agenceChipTxt, isSelected && { color:"#fff" }]} numberOfLines={1}>
                  {a.name}
                </Text>
                {isMyAgence && !isSelected && (
                  <View style={s.myAgenceDot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {selectedAgenceObj && (
          <View style={s.agenceInfoBar}>
            <Feather name="map-pin" size={11} color={C.teal} />
            <Text style={s.agenceInfoTxt}>{selectedAgenceObj.city}</Text>
            <Text style={{ color: C.border }}>·</Text>
            <Text style={s.agenceInfoTxt}>{agenceBookings.length} réservation{agenceBookings.length>1?"s":""}</Text>
          </View>
        )}
      </View>

      {/* ════════════════════════════════════════════════════
          ② FILTRE DÉPART
      ════════════════════════════════════════════════════ */}
      <View style={s.filterSection}>
        <Text style={s.filterLabel}>ÉTAT DU DÉPART</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {([
            { key:"all",       label:"Tous",          icon:"list"        as const, col:C.teal   },
            { key:"active",    label:"En route",      icon:"navigation"  as const, col:C.green  },
            { key:"boarding",  label:"En gare",       icon:"user-check"  as const, col:C.purple },
            { key:"scheduled", label:"À venir",       icon:"clock"       as const, col:C.amber  },
            { key:"done",      label:"Terminés",      icon:"check-circle"as const, col:C.textSub},
          ] as const).map(f => {
            const on = departFilter === f.key;
            return (
              <Pressable key={f.key}
                style={[s.chip, on && { backgroundColor: f.col, borderColor: f.col }]}
                onPress={() => setDepartFilter(f.key)}
              >
                <Feather name={f.icon} size={11} color={on ? "#fff" : f.col} />
                <Text style={[s.chipTxt, on && { color:"#fff" }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ════════════════════════════════════════════════════
          ③ FILTRE STATUT RÉSERVATION
      ════════════════════════════════════════════════════ */}
      <View style={s.filterSection}>
        <Text style={s.filterLabel}>STATUT RÉSERVATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {([
            { key:"pending",   label:"En attente", count:pendingCount,   col:C.amber  },
            { key:"confirmed", label:"Confirmées", count:confirmedCount, col:C.green  },
            { key:"cancelled", label:"Annulées",   count:cancelledCount, col:C.red    },
            { key:"all",       label:"Toutes",     count:agenceBookings.length, col:C.teal },
          ] as const).map(f => {
            const on = statusFilter === f.key;
            return (
              <Pressable key={f.key}
                style={[s.chip, on && { backgroundColor: f.col, borderColor: f.col }]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[s.chipTxt, on && { color:"#fff" }]}>{f.label}</Text>
                {f.count > 0 && (
                  <View style={[s.chipBadge, on && { backgroundColor:"rgba(255,255,255,0.28)" }]}>
                    <Text style={[s.chipBadgeTxt, on && { color:"#fff" }]}>{f.count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ════════════════════════════════════════════════════
          ④ LISTE
      ════════════════════════════════════════════════════ */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={{ color:C.textSub, marginTop:10, fontSize:13 }}>Chargement…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.centerBox}>
          <View style={s.emptyIcon}>
            <Feather name="inbox" size={26} color={C.teal} />
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
          <Text style={s.listSummary}>
            {displayed.length} réservation{displayed.length>1?"s":""} · {groups.length} départ{groups.length>1?"s":""}
          </Text>

          {groups.map((group) => {
            const trip         = group.tripInfo;
            const active       = isActive(trip?.status);
            const boarding     = isBoarding(trip?.status);
            const done         = isDone(trip?.status);
            const grpPending   = group.bookings.filter(b => b.status === "pending").length;
            const ts           = tripStyle(trip?.status);
            const accentColor  = active ? C.green : boarding ? C.purple : done ? C.textSub : grpPending > 0 ? C.amber : C.teal;

            return (
              <View key={group.tripKey} style={{ marginBottom:16 }}>

                {/* ════ ④ HEADER TRAJET ════ */}
                <View style={[s.tripHeader, { borderLeftColor: accentColor }]}>
                  <View style={{ flex:1 }}>
                    {trip ? (
                      <>
                        <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:5 }}>
                          <Text style={s.tripFrom}>{trip.from}</Text>
                          <Feather name="arrow-right" size={13} color={accentColor} />
                          <Text style={s.tripTo}>{trip.to}</Text>
                        </View>
                        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10 }}>
                          <View style={s.tripMeta}><Feather name="calendar" size={10} color={C.textSub} /><Text style={s.tripMetaTxt}>{trip.date}</Text></View>
                          <View style={s.tripMeta}><Feather name="clock"    size={10} color={C.textSub} /><Text style={s.tripMetaTxt}>{trip.departureTime}</Text></View>
                          <View style={s.tripMeta}><Feather name="truck"    size={10} color={C.textSub} /><Text style={s.tripMetaTxt}>{trip.busName}</Text></View>
                        </View>
                      </>
                    ) : <Text style={[s.tripFrom, { color:C.textSub }]}>Trajet non précisé</Text>}
                  </View>
                  <View style={{ alignItems:"flex-end", gap:5 }}>
                    {ts && (
                      <View style={[s.tripStatusPill, { backgroundColor:ts.bg }]}>
                        <Feather name={ts.icon as any} size={9} color={ts.color} />
                        <Text style={[s.tripStatusTxt, { color:ts.color }]}>{ts.label}</Text>
                      </View>
                    )}
                    <View style={[s.countPill, { backgroundColor: grpPending > 0 ? C.amber : accentColor }]}>
                      <Text style={s.countTxt}>
                        {group.bookings.length} rés.{grpPending > 0 ? `  ·  ${grpPending} att.` : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ════ ⑤ CARTES RÉSERVATION ════ */}
                {group.bookings.map(b => {
                  const bst        = bkStyle(b.status);
                  const paxCount   = b.passengers?.length ?? 1;
                  const seatNums   = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "À assigner";
                  const isPending  = b.status === "pending";
                  const isCancelled= b.status === "cancelled";
                  const isConf     = confirming === b.id;
                  const hasBaggage = b.baggageCount > 0;
                  const initial    = (b.passengers?.[0]?.name ?? "?").charAt(0).toUpperCase();

                  return (
                    <View key={b.id} style={[s.card, isPending && s.cardPending, { marginLeft:8 }]}>

                      {/* Ligne ref + statut */}
                      <View style={s.cardTop}>
                        <Text style={s.cardRef}>{b.bookingRef}</Text>
                        <View style={[s.statusBadge, { backgroundColor:bst.bg }]}>
                          <Text style={[s.statusTxt, { color:bst.color }]}>{bst.label}</Text>
                        </View>
                      </View>

                      <View style={s.divider} />

                      {/* Client */}
                      <View style={s.clientRow}>
                        <View style={s.avatar}><Text style={s.avatarTxt}>{initial}</Text></View>
                        <View style={{ flex:1 }}>
                          <Text style={s.clientName} numberOfLines={1}>{b.passengers?.[0]?.name ?? "Client inconnu"}</Text>
                          {b.contactPhone
                            ? <Pressable onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
                                <Text style={s.clientPhone}>{b.contactPhone}</Text>
                              </Pressable>
                            : <Text style={s.clientNoPhone}>Pas de téléphone</Text>
                          }
                        </View>
                        {b.contactPhone && (
                          <Pressable style={s.callBtn} onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
                            <Feather name="phone" size={15} color={C.teal} />
                          </Pressable>
                        )}
                      </View>

                      <View style={s.divider} />

                      {/* Réservation grid */}
                      <View style={s.resvGrid}>
                        <View style={s.resvCell}><Text style={s.resvLabel}>Passagers</Text><Text style={s.resvVal}>{paxCount}</Text></View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}><Text style={s.resvLabel}>Sièges</Text><Text style={s.resvVal} numberOfLines={1}>{seatNums}</Text></View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}><Text style={s.resvLabel}>Montant</Text><Text style={[s.resvVal, { color:C.teal }]}>{(b.totalAmount ?? 0).toLocaleString()} F</Text></View>
                        <View style={s.resvSep} />
                        <View style={s.resvCell}><Text style={s.resvLabel}>Paiement</Text><Text style={s.resvVal} numberOfLines={1}>{payLabel(b.paymentMethod)}</Text></View>
                      </View>

                      {/* Bagage */}
                      {hasBaggage && (
                        <>
                          <View style={s.divider} />
                          <View style={s.bagRow}>
                            <View style={s.bagIcon}><Feather name="package" size={13} color={C.purple} /></View>
                            <View style={{ flex:1 }}>
                              <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                                <Text style={s.bagTitle}>{bagLabel(b.baggageType)} × {b.baggageCount}</Text>
                                {b.bagageStatus && (
                                  <View style={[s.bagPill, { backgroundColor: b.bagageStatus === "accepté" ? C.greenSoft : C.amberSoft }]}>
                                    <Text style={[s.bagPillTxt, { color: b.bagageStatus === "accepté" ? C.green : C.amber }]}>
                                      {b.bagageStatus === "accepté" ? "Validé" : "En attente"}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {b.baggageDescription && <Text style={s.bagDesc} numberOfLines={1}>{b.baggageDescription}</Text>}
                            </View>
                            {b.bagagePrice > 0 && <Text style={[s.resvVal, { color:C.purple }]}>{b.bagagePrice.toLocaleString()} F</Text>}
                          </View>
                        </>
                      )}

                      {/* Actions */}
                      {isPending && (
                        <>
                          <View style={s.divider} />
                          <View style={s.actionsBlock}>
                            <Pressable style={[s.confirmBtn, isConf && { opacity:0.65 }]}
                              onPress={() => confirmBooking(b)} disabled={isConf || cancelling === b.id}>
                              {isConf ? <ActivityIndicator color="#fff" size="small" />
                                : <><Feather name="check-circle" size={16} color="#fff" /><Text style={s.confirmTxt}>Confirmer{hasBaggage ? " + bagage" : ""}</Text></>
                              }
                            </Pressable>
                            <Pressable style={s.cancelBtn}
                              onPress={() => { setCancelModal(b); setCancelReason(""); }}
                              disabled={isConf || cancelling === b.id}>
                              <Text style={s.cancelTxt}>Annuler</Text>
                            </Pressable>
                          </View>
                        </>
                      )}

                      {/* Statut final */}
                      {!isPending && (
                        <View style={[s.finalStatus, { backgroundColor: isCancelled ? C.redSoft : bst.bg }]}>
                          <Feather name={isCancelled ? "x-circle" : "check-circle"} size={13}
                            color={isCancelled ? C.red : bst.color} />
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
              <Pressable onPress={() => setCancelModal(null)} hitSlop={8}><Feather name="x" size={20} color={C.textSub} /></Pressable>
            </View>
            <TextInput style={s.modalInput} placeholder="Motif d'annulation (optionnel)"
              placeholderTextColor={C.textSub} value={cancelReason} onChangeText={setCancelReason} multiline numberOfLines={2} />
            <Pressable style={[s.confirmBtn, { backgroundColor:C.red }, cancelling === cancelModal?.id && { opacity:0.65 }]}
              onPress={cancelBooking} disabled={!!cancelling}>
              {cancelling === cancelModal?.id ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="x-circle" size={16} color="#fff" /><Text style={s.confirmTxt}>Confirmer l'annulation</Text></>
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

  /* Header */
  header:     { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14 },
  hTitle:     { fontSize:17, fontWeight:"800", color:"#fff" },
  hSub:       { fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 },
  refreshBtn: { width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },

  /* ① Sélecteur agence */
  agenceSection:    { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, paddingBottom:8 },
  agenceSectionRow: { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:14, paddingTop:10, paddingBottom:6 },
  agenceSectionLabel:{ fontSize:9, fontWeight:"800", color:C.textSub, letterSpacing:1, textTransform:"uppercase" },
  miniStat:         { flexDirection:"row", alignItems:"center", gap:3, borderRadius:8, paddingHorizontal:7, paddingVertical:3 },
  miniStatNum:      { fontSize:13, fontWeight:"900" },
  miniStatLabel:    { fontSize:9,  fontWeight:"700", textTransform:"uppercase" },
  agenceRow:        { flexDirection:"row", gap:6, paddingHorizontal:12 },
  agenceChip:       { flexDirection:"row", alignItems:"center", gap:5, paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:C.tealBorder, backgroundColor:C.tealSoft },
  agenceChipActive: { backgroundColor:C.teal, borderColor:C.teal },
  agenceChipTxt:    { fontSize:12, fontWeight:"700", color:C.teal },
  myAgenceDot:      { width:6, height:6, borderRadius:3, backgroundColor:C.green },
  agenceInfoBar:    { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:14, paddingTop:6 },
  agenceInfoTxt:    { fontSize:11, color:C.textSub, fontWeight:"600" },

  /* ②③ Filtres */
  filterSection: { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, paddingTop:8, paddingBottom:6 },
  filterLabel:   { fontSize:9, fontWeight:"800", color:C.textSub, letterSpacing:1, paddingHorizontal:14, marginBottom:4, textTransform:"uppercase" },
  filterRow:     { flexDirection:"row", gap:6, paddingHorizontal:12 },
  chip:          { flexDirection:"row", alignItems:"center", gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white },
  chipTxt:       { fontSize:12, fontWeight:"700", color:C.text },
  chipBadge:     { backgroundColor:C.border, borderRadius:10, paddingHorizontal:5, paddingVertical:1 },
  chipBadgeTxt:  { fontSize:10, fontWeight:"800", color:C.text },

  /* Liste */
  listSummary: { fontSize:12, color:C.textSub, fontWeight:"600", marginBottom:10 },
  centerBox:   { flex:1, justifyContent:"center", alignItems:"center", gap:10, paddingHorizontal:40 },
  emptyIcon:   { width:56, height:56, borderRadius:28, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  emptyTitle:  { fontSize:15, fontWeight:"800", color:C.text, textAlign:"center" },
  emptySub:    { fontSize:12, color:C.textSub, textAlign:"center", lineHeight:18 },
  emptyBtn:    { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:20, paddingVertical:10, backgroundColor:C.teal, borderRadius:12 },

  /* Trip header */
  tripHeader:    { backgroundColor:C.white, borderRadius:14, padding:13, marginBottom:6, borderLeftWidth:5, borderWidth:1, borderColor:C.border, flexDirection:"row", alignItems:"center", gap:12 },
  tripFrom:      { fontSize:15, fontWeight:"900", color:C.text },
  tripTo:        { fontSize:15, fontWeight:"900", color:C.text },
  tripMeta:      { flexDirection:"row", alignItems:"center", gap:4 },
  tripMetaTxt:   { fontSize:11, color:C.textSub, fontWeight:"500" },
  tripStatusPill:{ flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  tripStatusTxt: { fontSize:10, fontWeight:"800" },
  countPill:     { borderRadius:10, paddingHorizontal:9, paddingVertical:3 },
  countTxt:      { fontSize:10, fontWeight:"800", color:"#fff" },

  /* Carte */
  card:       { backgroundColor:C.white, borderRadius:12, marginBottom:8, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  cardPending:{ borderColor:C.amberBorder },
  cardTop:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:12, paddingBottom:10 },
  cardRef:    { fontSize:12, fontWeight:"900", color:C.text, letterSpacing:0.5 },
  statusBadge:{ borderRadius:7, paddingHorizontal:9, paddingVertical:3 },
  statusTxt:  { fontSize:10, fontWeight:"800" },
  divider:    { height:1, backgroundColor:C.border },

  /* Client */
  clientRow:   { flexDirection:"row", alignItems:"center", gap:10, padding:12 },
  avatar:      { width:36, height:36, borderRadius:18, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  avatarTxt:   { fontSize:15, fontWeight:"900", color:C.teal },
  clientName:  { fontSize:13, fontWeight:"800", color:C.text },
  clientPhone: { fontSize:11, color:C.teal, fontWeight:"600", marginTop:2 },
  clientNoPhone:{ fontSize:11, color:C.textSub, marginTop:2 },
  callBtn:     { width:34, height:34, borderRadius:17, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.tealBorder },

  /* Grid réservation */
  resvGrid: { flexDirection:"row", paddingHorizontal:12, paddingVertical:10 },
  resvCell: { flex:1, alignItems:"center" },
  resvSep:  { width:1, backgroundColor:C.border, marginVertical:4 },
  resvLabel:{ fontSize:9, color:C.textSub, fontWeight:"700", textTransform:"uppercase", marginBottom:3 },
  resvVal:  { fontSize:12, fontWeight:"800", color:C.text, textAlign:"center" },

  /* Bagage */
  bagRow:   { flexDirection:"row", alignItems:"flex-start", gap:10, padding:12 },
  bagIcon:  { width:30, height:30, borderRadius:8, backgroundColor:C.purpleSoft, alignItems:"center", justifyContent:"center" },
  bagTitle: { fontSize:12, fontWeight:"800", color:C.text },
  bagDesc:  { fontSize:10, color:C.textSub, marginTop:2 },
  bagPill:  { borderRadius:5, paddingHorizontal:6, paddingVertical:2 },
  bagPillTxt:{ fontSize:9, fontWeight:"700" },

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
