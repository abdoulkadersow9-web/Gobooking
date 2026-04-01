/**
 * Réservations en ligne — Dashboard opérationnel
 *
 * CYCLE MÉTIER OBLIGATOIRE :
 *   AGENCE → À VENIR → EN GARE → EN ROUTE → TERMINÉ
 *
 * Hiérarchie UI stricte :
 *   ① Cycle pipeline visuel (bannière état global)
 *   ② Sélecteur d'agence (toutes les agences de la compagnie)
 *   ③ Filtre état du départ (À venir / En gare / En route / Terminés / Tous)
 *   ④ Filtre statut réservation (En attente / Confirmées / Annulées / Toutes)
 *   ⑤ Groupement par trajet (trié : En route → En gare → À venir → Terminés)
 *   ⑥ Cartes réservation sous chaque trajet
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

/* ── Design tokens ──────────────────────────────────────────────── */
const C = {
  teal:     "#0E7490", tealDk: "#164E63", tealMd: "#0891B2",
  tealSoft: "#ECFEFF", tealBd: "#A5F3FC",
  green:    "#059669", greenSoft: "#ECFDF5", greenDk: "#047857",
  amber:    "#D97706", amberSoft: "#FFFBEB", amberBd: "#FDE68A",
  red:      "#DC2626", redSoft: "#FEF2F2",
  purple:   "#7C3AED", purpleSoft: "#F5F3FF",
  navy:     "#1E3A8A", navySoft: "#EFF6FF",
  text:     "#111827", sub: "#6B7280", border: "#E5E7EB",
  bg:       "#F0F4F8", white: "#FFFFFF",
};

/* ── Types ──────────────────────────────────────────────────────── */
interface Agence { id: string; name: string; city: string }

interface Trip {
  id: string; from: string; to: string; date: string;
  departureTime: string; busName: string; status?: string;
  guichetSeats: number; onlineSeats: number; totalSeats: number;
}

interface OnlineBooking {
  id: string; bookingRef: string; status: string;
  bookingSource: string | null; totalAmount: number;
  paymentMethod: string; contactPhone: string;
  passengers: { name: string; age?: number; gender?: string }[];
  seatNumbers: string[]; createdAt: string;
  baggageCount: number; baggageType: string | null;
  baggageDescription: string | null; bagageStatus: string | null;
  bagagePrice: number; trip: Trip | null;
}

type DepartFilter = "all" | "scheduled" | "boarding" | "active" | "done";
type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

/* ── Trip-state helpers ─────────────────────────────────────────── */
const isActive    = (s?: string) => s === "en_route" || s === "in_progress";
const isBoarding  = (s?: string) => s === "boarding";
const isScheduled = (s?: string) => !s || s === "scheduled";
const isDone      = (s?: string) => s === "arrived" || s === "completed" || s === "cancelled";

function tripCyclePos(s?: string): 0 | 1 | 2 | 3 {
  if (isActive(s))   return 0;  // urgence — premier
  if (isBoarding(s)) return 1;
  if (isScheduled(s))return 2;
  return 3;                     // terminé — dernier
}

interface TripMeta {
  label: string; color: string; bg: string; border: string;
  icon: string; cycleIdx: number; gradColors: [string, string];
}
function getTripMeta(s?: string): TripMeta {
  if (isActive(s))   return { label:"EN ROUTE", color:C.green,  bg:C.greenSoft, border:"#6EE7B7",  icon:"navigation",  cycleIdx:2, gradColors:["#059669","#047857"] };
  if (isBoarding(s)) return { label:"EN GARE",  color:C.purple, bg:C.purpleSoft,border:"#C4B5FD",  icon:"user-check",  cycleIdx:1, gradColors:["#7C3AED","#6D28D9"] };
  if (isDone(s))     return { label:"TERMINÉ",  color:C.sub,    bg:"#F3F4F6",   border:C.border,   icon:"check-circle",cycleIdx:3, gradColors:["#6B7280","#4B5563"] };
  return               { label:"À VENIR",  color:C.amber,  bg:C.amberSoft, border:C.amberBd,  icon:"clock",       cycleIdx:0, gradColors:["#D97706","#B45309"] };
}

function bkMeta(s: string): { label: string; color: string; bg: string } {
  if (s === "pending")   return { label:"En attente", color:C.amber, bg:C.amberSoft };
  if (s === "confirmed") return { label:"Confirmé",   color:C.green, bg:C.greenSoft };
  if (s === "cancelled") return { label:"Annulé",     color:C.red,   bg:C.redSoft   };
  if (s === "boarded")   return { label:"Embarqué",   color:C.purple,bg:C.purpleSoft};
  return { label: s, color: C.sub, bg: "#F3F4F6" };
}

function payLabel(p: string) {
  if (p === "mobile_money") return "Mobile Money";
  if (p === "card") return "Carte";
  if (p === "cash") return "Espèces";
  return p ?? "—";
}

function cityMatch(from?: string | null, city?: string): boolean {
  if (!from || !city) return false;
  const f = from.toLowerCase(), c = city.toLowerCase();
  return f.includes(c) || c.includes(f);
}

/* ════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { token, logoutIfActiveToken } = useAuth();

  /* Data */
  const [agencies,   setAgencies]   = useState<Agence[]>([]);
  const [myAgence,   setMyAgence]   = useState<Agence | null>(null);
  const [bookings,   setBookings]   = useState<OnlineBooking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date | null>(null);

  /* Filtres — défauts "Toutes" pour voir la réalité opérationnelle */
  const [selAgence,     setSelAgence]     = useState<string | null>(null);
  const [departFilter,  setDepartFilter]  = useState<DepartFilter>("all");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");

  /* Actions */
  const [confirming,  setConfirming]  = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<OnlineBooking | null>(null);
  const [cancelReason,setCancelReason]= useState("");
  const [cancelling,  setCancelling]  = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ── Load ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<any>("/agent/online-bookings", { token: token ?? undefined });
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

  /* Auto-sélectionner l'agence de l'agent */
  useEffect(() => {
    if (myAgence && selAgence === null) setSelAgence(myAgence.id);
  }, [myAgence]);

  /* Pulse sur réservations en attente */
  const selAgenceObj = agencies.find(a => a.id === selAgence) ?? null;
  const scopedBk = selAgence && selAgenceObj
    ? bookings.filter(b => cityMatch(b.trip?.from, selAgenceObj.city))
    : bookings;
  const pendingCount   = scopedBk.filter(b => b.status === "pending").length;

  useEffect(() => {
    if (pendingCount > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.08, duration:900, useNativeDriver:true }),
        Animated.timing(pulseAnim, { toValue:1,    duration:900, useNativeDriver:true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [pendingCount]);

  /* ── Filtrage ── */
  const displayed = scopedBk.filter(b => {
    const ts = b.trip?.status;
    if (departFilter === "active"    && !isActive(ts))    return false;
    if (departFilter === "boarding"  && !isBoarding(ts))  return false;
    if (departFilter === "scheduled" && !isScheduled(ts)) return false;
    if (departFilter === "done"      && !isDone(ts))      return false;
    if (statusFilter === "pending")   return b.status === "pending";
    if (statusFilter === "confirmed") return b.status === "confirmed" || b.status === "boarded";
    if (statusFilter === "cancelled") return b.status === "cancelled";
    return true;
  });

  /* ── Groupement par trajet, trié cycle ── */
  type TripGroup = { key: string; trip: Trip | null; bks: OnlineBooking[] };
  const groups: TripGroup[] = [];
  displayed.forEach(b => {
    const k = b.trip?.id ?? "__none__";
    let g = groups.find(x => x.key === k);
    if (!g) { g = { key: k, trip: b.trip ?? null, bks: [] }; groups.push(g); }
    g.bks.push(b);
  });
  groups.sort((a, b) => {
    const diff = tripCyclePos(a.trip?.status) - tripCyclePos(b.trip?.status);
    if (diff !== 0) return diff;
    const aPending = a.bks.some(x => x.status === "pending") ? 0 : 1;
    const bPending = b.bks.some(x => x.status === "pending") ? 0 : 1;
    return aPending - bPending;
  });

  /* Compteurs cycle */
  const activeCount   = scopedBk.filter(b => isActive(b.trip?.status)).length;
  const boardingCount = scopedBk.filter(b => isBoarding(b.trip?.status)).length;
  const scheduledCount= scopedBk.filter(b => isScheduled(b.trip?.status)).length;
  const doneCount     = scopedBk.filter(b => isDone(b.trip?.status)).length;
  const confirmedCount= scopedBk.filter(b => b.status === "confirmed" || b.status === "boarded").length;

  /* Trips distincts par état */
  const uniqTrips = (pred: (s?: string) => boolean) =>
    [...new Set(scopedBk.filter(b => pred(b.trip?.status)).map(b => b.trip?.id))].filter(Boolean).length;

  const syncStr = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}:${String(lastSync.getSeconds()).padStart(2,"0")}`
    : null;

  /* ── Actions ── */
  const confirmBooking = (b: OnlineBooking) => {
    const hasBag = b.baggageCount > 0;
    Alert.alert(
      "Confirmer la réservation",
      [
        `Réf : ${b.bookingRef}`,
        `Client : ${b.passengers[0]?.name ?? "—"}`,
        `Trajet : ${b.trip?.from ?? "?"} → ${b.trip?.to ?? "?"}  ${b.trip?.date} ${b.trip?.departureTime}`,
        `Montant : ${(b.totalAmount ?? 0).toLocaleString()} FCFA`,
        hasBag ? `Bagage × ${b.baggageCount} inclus` : "",
      ].filter(Boolean).join("\n"),
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer ✓", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token: token ?? undefined, method:"POST", body:{} });
            Alert.alert("✅ Confirmée", `${b.bookingRef} confirmée avec succès !`);
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
        token: token ?? undefined, method:"POST",
        body: { reason: cancelReason || undefined },
      });
      setCancelModal(null); setCancelReason("");
      Alert.alert("Annulée", `${cancelModal.bookingRef} annulée.`);
      await load(true);
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible d'annuler"); }
    finally { setCancelling(null); }
  };

  /* ════════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDk} />

      {/* ══ HEADER ══ */}
      <LinearGradient colors={[C.tealDk, C.teal]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={10}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:14 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub} numberOfLines={1}>
            {selAgenceObj ? selAgenceObj.name : "Toutes les agences"}
            {syncStr ? `  ·  Sync ${syncStr}` : ""}
          </Text>
        </View>
        <Pressable onPress={() => load()} style={s.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ══ ① CYCLE PIPELINE ══ */}
      <View style={s.pipeline}>
        {([
          { label:"À venir",  count:scheduledCount, trips:uniqTrips(isScheduled), color:C.amber,  bg:C.amberSoft,  icon:"clock"       as const, fKey:"scheduled" },
          { label:"En gare",  count:boardingCount,  trips:uniqTrips(isBoarding),  color:C.purple, bg:C.purpleSoft, icon:"user-check"  as const, fKey:"boarding"  },
          { label:"En route", count:activeCount,    trips:uniqTrips(isActive),    color:C.green,  bg:C.greenSoft,  icon:"navigation"  as const, fKey:"active"    },
          { label:"Terminés", count:doneCount,      trips:uniqTrips(isDone),      color:C.sub,    bg:"#F3F4F6",    icon:"check-circle"as const, fKey:"done"      },
        ] as const).map((p, i) => {
          const on = departFilter === p.fKey;
          return (
            <React.Fragment key={p.fKey}>
              <Pressable style={[s.pipeCell, on && { backgroundColor:p.color, borderColor:p.color }]}
                onPress={() => setDepartFilter(departFilter === p.fKey ? "all" : p.fKey)}>
                <Feather name={p.icon} size={12} color={on ? "#fff" : p.color} />
                <Text style={[s.pipeCellCount, on && {color:"#fff"}]}>{p.count}</Text>
                <Text style={[s.pipeCellLabel, on && {color:"rgba(255,255,255,0.85)"}]}>{p.label}</Text>
                {p.trips > 0 && <Text style={[s.pipeCellTrips, on && {color:"rgba(255,255,255,0.7)"}]}>{p.trips} départ{p.trips>1?"s":""}</Text>}
              </Pressable>
              {i < 3 && <Feather name="chevron-right" size={12} color={C.border} style={{ alignSelf:"center" }} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* ══ ② SÉLECTEUR AGENCE ══ */}
      <View style={s.agenceBar}>
        <View style={s.agenceTopRow}>
          <Feather name="map-pin" size={11} color={C.teal} />
          <Text style={s.agenceLabel}>AGENCE</Text>
          <View style={{ flex:1 }} />
          <Animated.View style={[s.miniStat, { backgroundColor:C.amberSoft, transform:[{scale:pulseAnim}] }]}>
            <Text style={[s.miniNum, {color:C.amber}]}>{pendingCount}</Text>
            <Text style={[s.miniLbl, {color:C.amber}]}>att.</Text>
          </Animated.View>
          <View style={[s.miniStat, {backgroundColor:C.greenSoft}]}>
            <Text style={[s.miniNum, {color:C.green}]}>{confirmedCount}</Text>
            <Text style={[s.miniLbl, {color:C.green}]}>conf.</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.agenceChips}>
          <Pressable style={[s.chip, selAgence===null && {backgroundColor:C.teal, borderColor:C.teal}]}
            onPress={() => setSelAgence(null)}>
            <Feather name="grid" size={11} color={selAgence===null ? "#fff" : C.teal} />
            <Text style={[s.chipTxt, selAgence===null && {color:"#fff"}]}>Toutes</Text>
          </Pressable>
          {agencies.map(a => {
            const on = selAgence === a.id;
            const isMine = myAgence?.id === a.id;
            return (
              <Pressable key={a.id} style={[s.chip, on && {backgroundColor:C.teal, borderColor:C.teal}]}
                onPress={() => setSelAgence(on ? null : a.id)}>
                <Feather name="map-pin" size={11} color={on ? "#fff" : C.teal} />
                <Text style={[s.chipTxt, on && {color:"#fff"}]} numberOfLines={1}>{a.name}</Text>
                {isMine && !on && <View style={s.myDot} />}
              </Pressable>
            );
          })}
        </ScrollView>
        {selAgenceObj && (
          <View style={s.agenceInfo}>
            <Text style={s.agenceInfoTxt}>{selAgenceObj.city}  ·  {scopedBk.length} réservation{scopedBk.length>1?"s":""}  ·  {groups.length} départ{groups.length>1?"s":""}</Text>
          </View>
        )}
      </View>

      {/* ══ ③ FILTRE STATUT RÉSERVATION ══ */}
      <View style={s.statusBar}>
        {([
          { key:"all",       label:"Toutes",     count:scopedBk.length,  col:C.teal   },
          { key:"pending",   label:"En attente", count:pendingCount,     col:C.amber  },
          { key:"confirmed", label:"Confirmées", count:confirmedCount,   col:C.green  },
          { key:"cancelled", label:"Annulées",   count:scopedBk.filter(b=>b.status==="cancelled").length, col:C.red },
        ] as const).map(f => {
          const on = statusFilter === f.key;
          return (
            <Pressable key={f.key} style={[s.statusChip, on && {backgroundColor:f.col, borderColor:f.col}]}
              onPress={() => setStatusFilter(f.key)}>
              <Text style={[s.statusTxt, on && {color:"#fff"}]}>{f.label}</Text>
              {f.count > 0 && (
                <View style={[s.statusBadge, on && {backgroundColor:"rgba(255,255,255,0.25)"}]}>
                  <Text style={[s.statusBadgeTxt, on && {color:"#fff"}]}>{f.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ══ ④⑤⑥ LISTE ══ */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={s.centerTxt}>Chargement…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Feather name="inbox" size={26} color={C.teal} /></View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>
            {pendingCount === 0
              ? "Toutes les réservations de cette agence sont traitées"
              : "Modifiez les filtres pour voir d'autres réservations"}
          </Text>
          <Pressable onPress={() => { setDepartFilter("all"); setStatusFilter("all"); setSelAgence(null); }} style={s.resetBtn}>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={s.resetBtnTxt}>Réinitialiser les filtres</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{flex:1}} contentContainerStyle={{padding:12, paddingBottom:56}}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true);load(true);}} tintColor={C.teal} />}>

          <Text style={s.listSummary}>
            {displayed.length} réservation{displayed.length>1?"s":""}  ·  {groups.length} départ{groups.length>1?"s":""}
          </Text>

          {groups.map(group => {
            const trip = group.trip;
            const meta = getTripMeta(trip?.status);
            const grpPending = group.bks.filter(b => b.status === "pending").length;
            const grpConf    = group.bks.filter(b => b.status === "confirmed" || b.status === "boarded").length;

            return (
              <View key={group.key} style={s.groupWrap}>

                {/* ══ ④ HEADER TRAJET — visuel cycle fort ══ */}
                <LinearGradient
                  colors={[meta.gradColors[0]+"22", meta.gradColors[1]+"11"]}
                  style={[s.tripHeader, {borderLeftColor: meta.color}]}>
                  <View style={{flex:1}}>
                    {trip ? (
                      <>
                        {/* Route */}
                        <View style={s.tripRoute}>
                          <View style={s.cityPill}>
                            <Text style={s.cityTxt}>{trip.from}</Text>
                          </View>
                          <Feather name="arrow-right" size={14} color={meta.color} />
                          <View style={s.cityPill}>
                            <Text style={s.cityTxt}>{trip.to}</Text>
                          </View>
                        </View>
                        {/* Méta */}
                        <View style={s.tripMetas}>
                          <View style={s.tripMeta}><Feather name="calendar" size={10} color={C.sub} /><Text style={s.tripMetaTxt}>{trip.date}</Text></View>
                          <View style={s.tripMeta}><Feather name="clock"    size={10} color={C.sub} /><Text style={s.tripMetaTxt}>{trip.departureTime}</Text></View>
                          <View style={s.tripMeta}><Feather name="truck"    size={10} color={C.sub} /><Text style={s.tripMetaTxt}>{trip.busName}</Text></View>
                        </View>
                      </>
                    ) : (
                      <Text style={[s.cityTxt, {color:C.sub}]}>Trajet non précisé</Text>
                    )}
                  </View>

                  {/* Badges droite */}
                  <View style={{alignItems:"flex-end", gap:5}}>
                    {/* État du cycle */}
                    <View style={[s.cycleTag, {backgroundColor: meta.color}]}>
                      <Feather name={meta.icon as any} size={10} color="#fff" />
                      <Text style={s.cycleTagTxt}>{meta.label}</Text>
                    </View>
                    {/* Compteurs */}
                    <View style={{flexDirection:"row", gap:5}}>
                      {grpPending > 0 && (
                        <View style={[s.countBadge, {backgroundColor:C.amber}]}>
                          <Text style={s.countBadgeTxt}>{grpPending} att.</Text>
                        </View>
                      )}
                      {grpConf > 0 && (
                        <View style={[s.countBadge, {backgroundColor:C.green}]}>
                          <Text style={s.countBadgeTxt}>{grpConf} conf.</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </LinearGradient>

                {/* ══ ⑥ CARTES RÉSERVATION ══ */}
                <View style={s.bkList}>
                  {group.bks.map(b => <BookingCard key={b.id}
                    b={b} confirming={confirming}
                    onConfirm={() => confirmBooking(b)}
                    onCancel={() => { setCancelModal(b); setCancelReason(""); }}
                  />)}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── MODAL ANNULATION ── */}
      <Modal visible={!!cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={{flexDirection:"row", justifyContent:"space-between", marginBottom:14}}>
              <View>
                <Text style={s.modalTitle}>Annuler la réservation</Text>
                <Text style={{fontSize:12, color:C.sub, marginTop:2}}>
                  {cancelModal?.bookingRef}  ·  {cancelModal?.passengers?.[0]?.name ?? "Client"}
                </Text>
              </View>
              <Pressable onPress={() => setCancelModal(null)} hitSlop={10}>
                <Feather name="x" size={20} color={C.sub} />
              </Pressable>
            </View>
            <TextInput style={s.reasonInput} placeholder="Motif d'annulation (optionnel)"
              placeholderTextColor={C.sub} value={cancelReason}
              onChangeText={setCancelReason} multiline numberOfLines={3} />
            <Pressable style={[s.dangerBtn, cancelling && {opacity:0.65}]} onPress={cancelBooking} disabled={!!cancelling}>
              {cancelling === cancelModal?.id
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="x-circle" size={16} color="#fff" /><Text style={s.actionBtnTxt}>Confirmer l'annulation</Text></>}
            </Pressable>
            <Pressable style={{alignItems:"center", paddingVertical:8}} onPress={() => setCancelModal(null)}>
              <Text style={{color:C.sub, fontSize:13, fontWeight:"600"}}>Garder la réservation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ════════════════════════════════════════════════════════════════
   BOOKING CARD (composant séparé pour clarté)
════════════════════════════════════════════════════════════════ */
function BookingCard({ b, confirming, onConfirm, onCancel }: {
  b: OnlineBooking;
  confirming: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const bk       = bkMeta(b.status);
  const isPending = b.status === "pending";
  const isCancelled = b.status === "cancelled";
  const isConf    = confirming === b.id;
  const hasBag    = b.baggageCount > 0;
  const paxCount  = b.passengers?.length ?? 1;
  const seats     = b.seatNumbers?.length > 0 ? b.seatNumbers.join(", ") : "—";
  const initial   = (b.passengers?.[0]?.name ?? "?").charAt(0).toUpperCase();

  return (
    <View style={[card.wrap, isPending && card.wrapPending]}>

      {/* Ref + statut */}
      <View style={card.topRow}>
        <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
          <Text style={card.ref}>{b.bookingRef}</Text>
          {b.bookingSource && (
            <View style={card.sourceBadge}>
              <Text style={card.sourceTxt}>{b.bookingSource === "mobile" ? "📱" : "🌐"} {b.bookingSource}</Text>
            </View>
          )}
        </View>
        <View style={[card.statusBadge, {backgroundColor:bk.bg}]}>
          <Text style={[card.statusTxt, {color:bk.color}]}>{bk.label}</Text>
        </View>
      </View>

      <View style={card.div} />

      {/* Client */}
      <View style={card.clientRow}>
        <View style={card.avatar}><Text style={card.avatarTxt}>{initial}</Text></View>
        <View style={{flex:1}}>
          <Text style={card.name} numberOfLines={1}>{b.passengers?.[0]?.name ?? "Client inconnu"}</Text>
          {b.contactPhone
            ? <Pressable onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
                <Text style={card.phone}>{b.contactPhone}</Text>
              </Pressable>
            : <Text style={card.noPhone}>Pas de téléphone</Text>}
        </View>
        {b.contactPhone && (
          <Pressable style={card.callBtn} onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}>
            <Feather name="phone" size={15} color={C.teal} />
          </Pressable>
        )}
      </View>

      <View style={card.div} />

      {/* Grid infos */}
      <View style={card.grid}>
        <View style={card.cell}><Text style={card.cellLbl}>Passagers</Text><Text style={card.cellVal}>{paxCount}</Text></View>
        <View style={card.sep} />
        <View style={card.cell}><Text style={card.cellLbl}>Sièges</Text><Text style={card.cellVal} numberOfLines={1}>{seats}</Text></View>
        <View style={card.sep} />
        <View style={card.cell}><Text style={card.cellLbl}>Montant</Text><Text style={[card.cellVal,{color:C.teal}]}>{(b.totalAmount??0).toLocaleString()} F</Text></View>
        <View style={card.sep} />
        <View style={card.cell}><Text style={card.cellLbl}>Paiement</Text><Text style={card.cellVal} numberOfLines={1}>{payLabel(b.paymentMethod)}</Text></View>
      </View>

      {/* Bagage */}
      {hasBag && (
        <>
          <View style={card.div} />
          <View style={card.bagRow}>
            <View style={card.bagIcon}><Feather name="package" size={13} color={C.purple} /></View>
            <View style={{flex:1}}>
              <View style={{flexDirection:"row", alignItems:"center", gap:6}}>
                <Text style={card.bagTitle}>{b.baggageType ?? "Bagage"} × {b.baggageCount}</Text>
                {b.bagageStatus && (
                  <View style={[card.bagPill, {backgroundColor:b.bagageStatus==="accepté"?C.greenSoft:C.amberSoft}]}>
                    <Text style={[card.bagPillTxt, {color:b.bagageStatus==="accepté"?C.green:C.amber}]}>
                      {b.bagageStatus === "accepté" ? "Validé" : "En attente"}
                    </Text>
                  </View>
                )}
              </View>
              {b.baggageDescription && <Text style={card.bagDesc} numberOfLines={1}>{b.baggageDescription}</Text>}
            </View>
            {b.bagagePrice > 0 && <Text style={[card.cellVal,{color:C.purple}]}>{b.bagagePrice.toLocaleString()} F</Text>}
          </View>
        </>
      )}

      {/* Actions si en attente */}
      {isPending && (
        <>
          <View style={card.div} />
          <View style={card.actions}>
            <Pressable style={[card.confirmBtn, isConf && {opacity:0.65}]}
              onPress={onConfirm} disabled={isConf}>
              {isConf
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="check-circle" size={16} color="#fff" /><Text style={card.confirmTxt}>Confirmer{hasBag?" + bagage":""}</Text></>}
            </Pressable>
            <Pressable style={card.cancelBtn} onPress={onCancel} disabled={isConf}>
              <Text style={card.cancelTxt}>Annuler</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Statut final */}
      {!isPending && (
        <View style={[card.finalRow, {backgroundColor: isCancelled ? C.redSoft : bk.bg}]}>
          <Feather name={isCancelled?"x-circle":"check-circle"} size={13}
            color={isCancelled ? C.red : bk.color} />
          <Text style={[card.finalTxt, {color: isCancelled ? C.red : bk.color}]}>
            {isCancelled ? "Annulée — siège libéré"
              : b.status === "boarded" ? "Passager embarqué"
              : "Réservation confirmée — siège tenu"}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:C.bg },

  /* Header */
  header:     { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14 },
  hTitle:     { fontSize:17, fontWeight:"800", color:"#fff" },
  hSub:       { fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:2 },
  refreshBtn: { width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.15)", alignItems:"center", justifyContent:"center" },

  /* ① Pipeline cycle */
  pipeline: { flexDirection:"row", alignItems:"center", backgroundColor:C.white, paddingHorizontal:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border, gap:2 },
  pipeCell: { flex:1, alignItems:"center", gap:2, padding:7, borderRadius:10, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white },
  pipeCellCount: { fontSize:16, fontWeight:"900", color:C.text },
  pipeCellLabel: { fontSize:8, fontWeight:"800", color:C.sub, textTransform:"uppercase", letterSpacing:0.5 },
  pipeCellTrips: { fontSize:8, color:C.sub, fontWeight:"600" },

  /* ② Sélecteur agence */
  agenceBar:    { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, paddingBottom:8 },
  agenceTopRow: { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:14, paddingTop:8, paddingBottom:4 },
  agenceLabel:  { fontSize:9, fontWeight:"800", color:C.sub, textTransform:"uppercase", letterSpacing:1 },
  miniStat:     { flexDirection:"row", alignItems:"center", gap:3, borderRadius:8, paddingHorizontal:7, paddingVertical:3 },
  miniNum:      { fontSize:13, fontWeight:"900" },
  miniLbl:      { fontSize:9, fontWeight:"700", textTransform:"uppercase" },
  agenceChips:  { flexDirection:"row", gap:6, paddingHorizontal:12 },
  chip:         { flexDirection:"row", alignItems:"center", gap:5, paddingHorizontal:11, paddingVertical:7, borderRadius:20, borderWidth:1.5, borderColor:C.tealBd, backgroundColor:C.tealSoft },
  chipTxt:      { fontSize:12, fontWeight:"700", color:C.teal },
  myDot:        { width:6, height:6, borderRadius:3, backgroundColor:C.green },
  agenceInfo:   { paddingHorizontal:14, paddingTop:5 },
  agenceInfoTxt:{ fontSize:11, color:C.sub, fontWeight:"600" },

  /* ③ Filtre statut */
  statusBar:    { flexDirection:"row", gap:6, paddingHorizontal:12, paddingVertical:8, backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  statusChip:   { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:5, paddingVertical:8, borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white },
  statusTxt:    { fontSize:11, fontWeight:"700", color:C.text },
  statusBadge:  { borderRadius:8, paddingHorizontal:5, paddingVertical:1, backgroundColor:C.border },
  statusBadgeTxt:{ fontSize:10, fontWeight:"800", color:C.text },

  /* ④ Groupe trajet */
  groupWrap:  { marginBottom:16 },
  tripHeader: { flexDirection:"row", alignItems:"flex-start", padding:13, borderLeftWidth:5, borderRadius:14, marginBottom:2, borderWidth:1, borderColor:C.border, gap:10 },
  tripRoute:  { flexDirection:"row", alignItems:"center", gap:8, marginBottom:6 },
  cityPill:   { backgroundColor:"rgba(0,0,0,0.07)", borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  cityTxt:    { fontSize:14, fontWeight:"900", color:C.text },
  tripMetas:  { flexDirection:"row", flexWrap:"wrap", gap:10 },
  tripMeta:   { flexDirection:"row", alignItems:"center", gap:4 },
  tripMetaTxt:{ fontSize:10, color:C.sub, fontWeight:"500" },
  cycleTag:   { flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:9, paddingVertical:4 },
  cycleTagTxt:{ fontSize:10, fontWeight:"900", color:"#fff" },
  countBadge: { borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  countBadgeTxt:{ fontSize:10, fontWeight:"800", color:"#fff" },

  /* ⑥ Liste */
  bkList:    { paddingLeft:10, gap:8 },
  listSummary:{ fontSize:12, color:C.sub, fontWeight:"600", marginBottom:10 },

  /* Empty / center */
  center:    { flex:1, justifyContent:"center", alignItems:"center", gap:10, paddingHorizontal:40 },
  centerTxt: { fontSize:13, color:C.sub, marginTop:8 },
  emptyIcon: { width:56, height:56, borderRadius:28, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  emptyTitle:{ fontSize:16, fontWeight:"800", color:C.text, textAlign:"center" },
  emptySub:  { fontSize:12, color:C.sub, textAlign:"center", lineHeight:18 },
  resetBtn:  { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:18, paddingVertical:10, backgroundColor:C.teal, borderRadius:12, marginTop:4 },
  resetBtnTxt:{ color:"#fff", fontWeight:"700", fontSize:13 },

  /* Modal */
  overlay:     { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalCard:   { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:20, gap:12 },
  modalTitle:  { fontSize:16, fontWeight:"900", color:C.text },
  reasonInput: { backgroundColor:C.bg, borderRadius:11, borderWidth:1, borderColor:C.border, padding:13, fontSize:14, color:C.text, minHeight:70, textAlignVertical:"top" },
  dangerBtn:   { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:C.red, borderRadius:12, paddingVertical:13 },
  actionBtnTxt:{ color:"#fff", fontSize:14, fontWeight:"800" },
});

/* ── Booking card styles ── */
const card = StyleSheet.create({
  wrap:       { backgroundColor:C.white, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  wrapPending:{ borderColor:C.amberBd },
  topRow:     { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:12, paddingBottom:10 },
  ref:        { fontSize:12, fontWeight:"900", color:C.text, letterSpacing:0.5 },
  sourceBadge:{ borderRadius:5, paddingHorizontal:6, paddingVertical:2, backgroundColor:C.navySoft },
  sourceTxt:  { fontSize:9, fontWeight:"700", color:C.navy },
  statusBadge:{ borderRadius:7, paddingHorizontal:9, paddingVertical:3 },
  statusTxt:  { fontSize:10, fontWeight:"800" },
  div:        { height:1, backgroundColor:C.border },
  clientRow:  { flexDirection:"row", alignItems:"center", gap:10, padding:12 },
  avatar:     { width:36, height:36, borderRadius:18, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center" },
  avatarTxt:  { fontSize:15, fontWeight:"900", color:C.teal },
  name:       { fontSize:13, fontWeight:"800", color:C.text },
  phone:      { fontSize:11, color:C.teal, fontWeight:"600", marginTop:2 },
  noPhone:    { fontSize:11, color:C.sub, marginTop:2 },
  callBtn:    { width:34, height:34, borderRadius:17, backgroundColor:C.tealSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.tealBd },
  grid:       { flexDirection:"row", paddingHorizontal:12, paddingVertical:10 },
  cell:       { flex:1, alignItems:"center" },
  sep:        { width:1, backgroundColor:C.border, marginVertical:4 },
  cellLbl:    { fontSize:9, color:C.sub, fontWeight:"700", textTransform:"uppercase", marginBottom:3 },
  cellVal:    { fontSize:12, fontWeight:"800", color:C.text, textAlign:"center" },
  bagRow:     { flexDirection:"row", alignItems:"flex-start", gap:10, padding:12 },
  bagIcon:    { width:30, height:30, borderRadius:8, backgroundColor:C.purpleSoft, alignItems:"center", justifyContent:"center" },
  bagTitle:   { fontSize:12, fontWeight:"800", color:C.text },
  bagDesc:    { fontSize:10, color:C.sub, marginTop:2 },
  bagPill:    { borderRadius:5, paddingHorizontal:6, paddingVertical:2 },
  bagPillTxt: { fontSize:9, fontWeight:"700" },
  actions:    { padding:12, gap:8 },
  confirmBtn: { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:C.green, borderRadius:11, paddingVertical:13 },
  confirmTxt: { color:"#fff", fontSize:14, fontWeight:"800" },
  cancelBtn:  { alignItems:"center", paddingVertical:6 },
  cancelTxt:  { fontSize:12, color:C.red, fontWeight:"700" },
  finalRow:   { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, margin:10, borderRadius:9, paddingVertical:8 },
  finalTxt:   { fontSize:11, fontWeight:"700" },
});
