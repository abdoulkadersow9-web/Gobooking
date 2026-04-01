/**
 * RÉSERVATIONS EN LIGNE — Style aviation/fintech
 * Hiérarchie stricte : TRAJET (dominant) → RÉSERVATION (compact)
 *
 * CYCLE : À venir → En gare → En route → Terminé
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Linking, Modal,
  Platform, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }  from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const IS_WEB = Platform.OS === "web";

/* ── Palette ─────────────────────────────────────────────── */
const P = {
  /* Brand */
  teal: "#0E7490", tealDk: "#0C6B82", tealSoft: "#E0F7FA",
  /* Cycle states */
  amber: "#D97706", amberSoft: "#FFFBEB", amberBd: "#FDE68A",
  purple: "#7C3AED", purpleSoft: "#F5F3FF",
  green: "#059669",  greenSoft: "#ECFDF5",
  slate: "#475569",  slateSoft: "#F8FAFC",
  /* UI */
  red: "#DC2626", redSoft: "#FEF2F2",
  text: "#0F172A", sub: "#64748B", border: "#E2E8F0",
  bg: "#F1F5F9", white: "#FFFFFF",
  /* Cycle gradient pairs */
  gradAVenir:  ["#D97706", "#B45309"] as [string, string],
  gradGare:    ["#7C3AED", "#6D28D9"] as [string, string],
  gradRoute:   ["#059669", "#047857"] as [string, string],
  gradDone:    ["#64748B", "#475569"] as [string, string],
};

/* ── Types ───────────────────────────────────────────────── */
interface Agence { id: string; name: string; city: string }
interface TripInfo {
  id: string; from: string; to: string;
  date: string; departureTime: string; busName: string;
  status?: string;
  guichetSeats: number; onlineSeats: number; totalSeats: number;
}
interface Booking {
  id: string; bookingRef: string; status: string;
  bookingSource: string | null; totalAmount: number;
  paymentMethod: string; contactPhone: string;
  passengers: { name: string; age?: number }[];
  seatNumbers: string[]; createdAt: string;
  baggageCount: number; baggageType: string | null;
  baggageDescription: string | null;
  bagageStatus: string | null; bagagePrice: number;
  trip: TripInfo | null;
}
type DepartF = "all" | "scheduled" | "boarding" | "active" | "done";
type StatusF = "all" | "pending" | "confirmed" | "cancelled";

/* ── Helpers ─────────────────────────────────────────────── */
const isActive    = (s?: string) => s === "en_route" || s === "in_progress";
const isBoarding  = (s?: string) => s === "boarding";
const isScheduled = (s?: string) => !s || s === "scheduled";
const isDone      = (s?: string) => s === "arrived" || s === "completed" || s === "cancelled";

function cycleOrder(s?: string): number {
  if (isActive(s))    return 0;
  if (isBoarding(s))  return 1;
  if (isScheduled(s)) return 2;
  return 3;
}

interface CycleMeta {
  label: string; short: string; icon: string;
  color: string; soft: string; bd: string;
  grad: [string, string]; fKey: DepartF;
}
const CYCLE: CycleMeta[] = [
  { label:"À venir",  short:"VENIR",  icon:"clock",        color:P.amber,  soft:P.amberSoft,  bd:P.amberBd, grad:P.gradAVenir, fKey:"scheduled" },
  { label:"En gare",  short:"GARE",   icon:"user-check",   color:P.purple, soft:P.purpleSoft, bd:"#DDD6FE", grad:P.gradGare,   fKey:"boarding"  },
  { label:"En route", short:"ROUTE",  icon:"navigation",   color:P.green,  soft:P.greenSoft,  bd:"#A7F3D0", grad:P.gradRoute,  fKey:"active"    },
  { label:"Terminés", short:"DONE",   icon:"check-circle", color:P.slate,  soft:P.slateSoft,  bd:P.border,  grad:P.gradDone,   fKey:"done"      },
];

function getCycle(s?: string): CycleMeta {
  if (isActive(s))    return CYCLE[2];
  if (isBoarding(s))  return CYCLE[1];
  if (isDone(s))      return CYCLE[3];
  return CYCLE[0];
}

function bkColor(s: string): { label: string; color: string; bg: string } {
  if (s === "pending")   return { label: "En attente", color: P.amber,  bg: P.amberSoft  };
  if (s === "confirmed") return { label: "Confirmé",   color: P.green,  bg: P.greenSoft  };
  if (s === "boarded")   return { label: "Embarqué",   color: P.purple, bg: P.purpleSoft };
  if (s === "cancelled") return { label: "Annulé",     color: P.red,    bg: P.redSoft    };
  return { label: s, color: P.sub, bg: "#F3F4F6" };
}

function payShort(p: string) {
  if (p === "mobile_money") return "📱";
  if (p === "card")         return "💳";
  if (p === "cash")         return "💵";
  return "—";
}

function cityMatch(from?: string | null, city?: string): boolean {
  if (!from || !city) return false;
  const f = from.toLowerCase(), c = city.toLowerCase();
  return f.includes(c) || c.includes(f);
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { token, logoutIfActiveToken } = useAuth();

  const [agencies,   setAgencies]   = useState<Agence[]>([]);
  const [myAgence,   setMyAgence]   = useState<Agence | null>(null);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date | null>(null);

  const [selAgence,    setSelAgence]    = useState<string | null>(null);
  const [departFilter, setDepartFilter] = useState<DepartF>("all");
  const [statusFilter, setStatusFilter] = useState<StatusF>("all");

  const [confirming,   setConfirming]   = useState<string | null>(null);
  const [cancelModal,  setCancelModal]  = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling,   setCancelling]   = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse   = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (myAgence && selAgence === null) setSelAgence(myAgence.id);
  }, [myAgence]);

  /* ── Compute ── */
  const agenceObj = agencies.find(a => a.id === selAgence) ?? null;
  const scoped = selAgence && agenceObj
    ? bookings.filter(b => cityMatch(b.trip?.from, agenceObj.city))
    : bookings;

  const pendingCount = scoped.filter(b => b.status === "pending").length;
  const confirmedCount = scoped.filter(b => b.status === "confirmed" || b.status === "boarded").length;

  /* Pulse animation */
  useEffect(() => {
    if (pendingCount > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [pendingCount]);

  /* Cycle counts */
  const cyCounts = CYCLE.map(c => ({
    ...c,
    count: scoped.filter(b => {
      if (c.fKey === "scheduled") return isScheduled(b.trip?.status);
      if (c.fKey === "boarding")  return isBoarding(b.trip?.status);
      if (c.fKey === "active")    return isActive(b.trip?.status);
      return isDone(b.trip?.status);
    }).length,
  }));

  /* Filtered */
  const displayed = scoped.filter(b => {
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

  /* Group by trip */
  type Group = { key: string; trip: TripInfo | null; bks: Booking[] };
  const groups: Group[] = [];
  displayed.forEach(b => {
    const k = b.trip?.id ?? "__none__";
    let g = groups.find(x => x.key === k);
    if (!g) { g = { key: k, trip: b.trip ?? null, bks: [] }; groups.push(g); }
    g.bks.push(b);
  });
  groups.sort((a, b) => {
    const d = cycleOrder(a.trip?.status) - cycleOrder(b.trip?.status);
    if (d !== 0) return d;
    return (a.bks.some(x => x.status === "pending") ? 0 : 1)
         - (b.bks.some(x => x.status === "pending") ? 0 : 1);
  });

  const syncStr = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}`
    : null;

  /* ── Actions ── */
  const confirmBooking = (b: Booking) => {
    Alert.alert(
      "Confirmer",
      `${b.bookingRef} — ${b.passengers[0]?.name ?? "Client"}\n${(b.totalAmount ?? 0).toLocaleString()} FCFA`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "✓ Confirmer", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token: token ?? undefined, method:"POST", body:{} });
            await load(true);
          } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible"); }
          finally { setConfirming(null); }
        }},
      ]
    );
  };

  const doCancel = async () => {
    if (!cancelModal) return;
    setCancelling(cancelModal.id);
    try {
      await apiFetch(`/agent/online-bookings/${cancelModal.id}/cancel`, {
        token: token ?? undefined, method:"POST",
        body: { reason: cancelReason || undefined },
      });
      setCancelModal(null); setCancelReason("");
      await load(true);
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible"); }
    finally { setCancelling(null); }
  };

  /* ════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={P.tealDk} />

      {/* ── HEADER COMPACT ── */}
      <LinearGradient colors={[P.tealDk, P.teal]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={12}>
          <Feather name="arrow-left" size={21} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:12 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub} numberOfLines={1}>
            {agenceObj ? agenceObj.name : "Toutes les agences"}
            {syncStr ? `  ·  ${syncStr}` : ""}
          </Text>
        </View>
        {/* Indicateurs compacts */}
        <Animated.View style={[s.hBadge, { backgroundColor: "rgba(217,119,6,0.85)", transform:[{scale:pulse}] }]}>
          <Text style={s.hBadgeTxt}>{pendingCount}</Text>
          <Text style={s.hBadgeSub}>att.</Text>
        </Animated.View>
        <View style={[s.hBadge, { backgroundColor: "rgba(5,150,105,0.7)" }]}>
          <Text style={s.hBadgeTxt}>{confirmedCount}</Text>
          <Text style={s.hBadgeSub}>conf.</Text>
        </View>
        <Pressable onPress={() => load()} style={s.hRefresh}>
          <Feather name="refresh-cw" size={16} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ── ① CYCLE PIPELINE ── */}
      <View style={s.pipeline}>
        {cyCounts.map((c, i) => {
          const on = departFilter === c.fKey;
          return (
            <React.Fragment key={c.fKey}>
              <Pressable style={[s.pipe, on && { backgroundColor: c.color }]}
                onPress={() => setDepartFilter(departFilter === c.fKey ? "all" : c.fKey)}>
                <Feather name={c.icon as any} size={11} color={on ? "#fff" : c.color} />
                <Text style={[s.pipeCnt, on && { color:"#fff" }]}>{c.count}</Text>
                <Text style={[s.pipeLbl, on && { color:"rgba(255,255,255,0.8)" }]}>{c.label}</Text>
              </Pressable>
              {i < 3 && <Feather name="chevron-right" size={10} color={P.border} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* ── ② AGENCE ── */}
      <View style={s.agBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.agRow}>
          <Pressable style={[s.agChip, selAgence===null && s.agChipOn]}
            onPress={() => setSelAgence(null)}>
            <Feather name="grid" size={10} color={selAgence===null ? "#fff" : P.teal} />
            <Text style={[s.agChipTxt, selAgence===null && {color:"#fff"}]}>Toutes</Text>
          </Pressable>
          {agencies.map(a => {
            const on = selAgence === a.id;
            const mine = myAgence?.id === a.id;
            return (
              <Pressable key={a.id} style={[s.agChip, on && s.agChipOn]}
                onPress={() => setSelAgence(on ? null : a.id)}>
                <Feather name="map-pin" size={10} color={on ? "#fff" : P.teal} />
                <Text style={[s.agChipTxt, on && {color:"#fff"}]} numberOfLines={1}>{a.name}</Text>
                {mine && !on && <View style={s.mineDot} />}
              </Pressable>
            );
          })}
        </ScrollView>
        {agenceObj && (
          <Text style={s.agInfo}>{agenceObj.city}  ·  {scoped.length} rés.  ·  {groups.length} départ{groups.length>1?"s":""}</Text>
        )}
      </View>

      {/* ── ③ STATUT ── */}
      <View style={s.stBar}>
        {([
          { key:"all",       label:"Toutes",     n:scoped.length,         col:P.teal   },
          { key:"pending",   label:"En attente", n:pendingCount,          col:P.amber  },
          { key:"confirmed", label:"Confirmées", n:confirmedCount,        col:P.green  },
          { key:"cancelled", label:"Annulées",   n:scoped.filter(b=>b.status==="cancelled").length, col:P.red },
        ] as const).map(f => {
          const on = statusFilter === f.key;
          return (
            <Pressable key={f.key} style={[s.stChip, on && { backgroundColor:f.col, borderColor:f.col }]}
              onPress={() => setStatusFilter(f.key)}>
              <Text style={[s.stTxt, on && {color:"#fff"}]}>{f.label}</Text>
              {f.n > 0 && <View style={[s.stBadge, on && {backgroundColor:"rgba(255,255,255,0.22)"}]}>
                <Text style={[s.stBadgeTxt, on && {color:"#fff"}]}>{f.n}</Text>
              </View>}
            </Pressable>
          );
        })}
      </View>

      {/* ── ④⑤⑥ LISTE ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={P.teal} />
          <Text style={s.centerSub}>Chargement…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyRound}><Feather name="inbox" size={24} color={P.teal} /></View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>Aucune réservation ne correspond aux filtres sélectionnés</Text>
          <Pressable style={s.resetBtn}
            onPress={() => { setDepartFilter("all"); setStatusFilter("all"); setSelAgence(null); }}>
            <Text style={s.resetBtnTxt}>Réinitialiser les filtres</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{flex:1}} contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => {setRefreshing(true); load(true);}} tintColor={P.teal} />}>

          <Text style={s.summary}>
            {displayed.length} rés.  ·  {groups.length} départ{groups.length>1?"s":""}
            {departFilter !== "all" ? `  ·  ${CYCLE.find(c=>c.fKey===departFilter)?.label}` : ""}
          </Text>

          {groups.map(group => {
            const trip = group.trip;
            const cy   = getCycle(trip?.status);
            const gPending  = group.bks.filter(b => b.status === "pending").length;
            const gConf     = group.bks.filter(b => b.status === "confirmed" || b.status === "boarded").length;
            const gCancelled= group.bks.filter(b => b.status === "cancelled").length;

            return (
              <View key={group.key} style={s.groupWrap}>

                {/* ════ HEADER TRAJET — DOMINANT ════ */}
                <LinearGradient
                  colors={[cy.grad[0] + "18", cy.grad[1] + "08"]}
                  style={[s.tripHead, { borderLeftColor: cy.color }]}>
                  {trip ? (
                    <>
                      {/* Ligne principale: villes + badge cycle */}
                      <View style={s.tripMain}>
                        <Text style={s.tripFrom}>{trip.from}</Text>
                        <Feather name="arrow-right" size={14} color={cy.color} style={{marginHorizontal:6}} />
                        <Text style={s.tripTo}>{trip.to}</Text>
                        <View style={{ flex:1 }} />
                        <View style={[s.cycBadge, { backgroundColor: cy.color }]}>
                          <Feather name={cy.icon as any} size={9} color="#fff" />
                          <Text style={s.cycBadgeTxt}>{cy.short}</Text>
                        </View>
                      </View>
                      {/* Ligne secondaire: détails + compteurs */}
                      <View style={s.tripSub}>
                        <Feather name="clock" size={10} color={P.sub} />
                        <Text style={s.tripSubTxt}>{trip.departureTime}</Text>
                        <Text style={s.tripSubDot}>·</Text>
                        <Feather name="calendar" size={10} color={P.sub} />
                        <Text style={s.tripSubTxt}>{trip.date}</Text>
                        <Text style={s.tripSubDot}>·</Text>
                        <Feather name="truck" size={10} color={P.sub} />
                        <Text style={s.tripSubTxt}>{trip.busName}</Text>
                        <View style={{ flex:1 }} />
                        {/* Compteurs inline */}
                        {gPending > 0 && (
                          <View style={[s.gCount, { backgroundColor: P.amberSoft }]}>
                            <Text style={[s.gCountTxt, { color: P.amber }]}>{gPending}↺</Text>
                          </View>
                        )}
                        {gConf > 0 && (
                          <View style={[s.gCount, { backgroundColor: P.greenSoft }]}>
                            <Text style={[s.gCountTxt, { color: P.green }]}>{gConf}✓</Text>
                          </View>
                        )}
                        {gCancelled > 0 && (
                          <View style={[s.gCount, { backgroundColor: P.redSoft }]}>
                            <Text style={[s.gCountTxt, { color: P.red }]}>{gCancelled}✗</Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={[s.tripFrom, { color: P.sub }]}>Trajet non précisé</Text>
                  )}
                </LinearGradient>

                {/* ════ LIGNES RÉSERVATION COMPACTES ════ */}
                <View style={s.bkBlock}>
                  {group.bks.map((b, idx) => {
                    const bk       = bkColor(b.status);
                    const isPending = b.status === "pending";
                    const isConf    = confirming === b.id;
                    const name      = b.passengers?.[0]?.name ?? "Client";
                    const initial   = name.charAt(0).toUpperCase();
                    const seat      = b.seatNumbers?.length > 0 ? b.seatNumbers.slice(0,2).join(",") : "—";
                    const hasBag    = b.baggageCount > 0;

                    return (
                      <View key={b.id}>
                        {idx > 0 && <View style={s.bkDiv} />}
                        <View style={[s.bkRow, isPending && s.bkRowPending]}>

                          {/* Avatar */}
                          <View style={[s.av, { backgroundColor: bk.bg }]}>
                            <Text style={[s.avTxt, { color: bk.color }]}>{initial}</Text>
                          </View>

                          {/* Infos principales */}
                          <View style={s.bkMain}>
                            <View style={s.bkNameRow}>
                              <Text style={s.bkName} numberOfLines={1}>{name}</Text>
                              {hasBag && <Feather name="package" size={10} color={P.purple} style={{marginLeft:4}} />}
                            </View>
                            <Text style={s.bkRef}>{b.bookingRef}  ·  {seat}  ·  {payShort(b.paymentMethod)}</Text>
                          </View>

                          {/* Montant */}
                          <Text style={s.bkAmt}>{(b.totalAmount ?? 0).toLocaleString()} F</Text>

                          {/* Actions / statut */}
                          {isPending ? (
                            <View style={s.bkActions}>
                              {isConf ? (
                                <ActivityIndicator size="small" color={P.green} />
                              ) : (
                                <>
                                  <Pressable style={s.btnConf}
                                    onPress={() => confirmBooking(b)} disabled={isConf}>
                                    <Feather name="check" size={13} color="#fff" />
                                  </Pressable>
                                  <Pressable style={s.btnCancel}
                                    onPress={() => { setCancelModal(b); setCancelReason(""); }}>
                                    <Feather name="x" size={13} color={P.red} />
                                  </Pressable>
                                </>
                              )}
                            </View>
                          ) : (
                            <View style={[s.bkStatusPill, { backgroundColor: bk.bg }]}>
                              <Text style={[s.bkStatusTxt, { color: bk.color }]}>{bk.label}</Text>
                            </View>
                          )}
                        </View>

                        {/* Tel tappable (sous la row si dispo) */}
                        {b.contactPhone && (
                          <Pressable style={s.phoneRow}
                            onPress={() => Linking.openURL(`tel:${b.contactPhone.replace(/\s/g,"")}`)}
                          >
                            <Feather name="phone" size={10} color={P.teal} />
                            <Text style={s.phoneTxt}>{b.contactPhone}</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>

              </View>
            );
          })}

        </ScrollView>
      )}

      {/* ── MODAL ANNULATION ── */}
      <Modal visible={!!cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.modalTitle}>Annuler</Text>
                <Text style={s.modalSub}>{cancelModal?.bookingRef}  ·  {cancelModal?.passengers?.[0]?.name}</Text>
              </View>
              <Pressable onPress={() => setCancelModal(null)} hitSlop={12}>
                <Feather name="x" size={20} color={P.sub} />
              </Pressable>
            </View>
            <TextInput style={s.modalInput} placeholder="Motif (optionnel)"
              placeholderTextColor={P.sub} value={cancelReason}
              onChangeText={setCancelReason} multiline numberOfLines={2} />
            <Pressable style={[s.modalBtn, cancelling && {opacity:0.6}]}
              onPress={doCancel} disabled={!!cancelling}>
              {cancelling === cancelModal?.id
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.modalBtnTxt}>Confirmer l'annulation</Text>}
            </Pressable>
            <Pressable style={s.modalCancel} onPress={() => setCancelModal(null)}>
              <Text style={s.modalCancelTxt}>Garder</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex:1, backgroundColor: P.bg },

  /* Header */
  header:    { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:11, gap:8 },
  hTitle:    { fontSize:16, fontWeight:"800", color:"#fff" },
  hSub:      { fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:1 },
  hBadge:    { borderRadius:8, paddingHorizontal:7, paddingVertical:4, alignItems:"center" },
  hBadgeTxt: { fontSize:13, fontWeight:"900", color:"#fff" },
  hBadgeSub: { fontSize:8,  fontWeight:"700", color:"rgba(255,255,255,0.8)", textTransform:"uppercase" },
  hRefresh:  { width:32, height:32, borderRadius:16, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },

  /* ① Pipeline */
  pipeline:  { flexDirection:"row", alignItems:"center", backgroundColor:P.white, paddingHorizontal:8, paddingVertical:7, borderBottomWidth:1, borderBottomColor:P.border, gap:4 },
  pipe:      { flex:1, alignItems:"center", gap:2, paddingVertical:6, borderRadius:9, borderWidth:1.5, borderColor:P.border },
  pipeCnt:   { fontSize:15, fontWeight:"900", color:P.text },
  pipeLbl:   { fontSize:8,  fontWeight:"700", color:P.sub, textTransform:"uppercase", letterSpacing:0.3 },

  /* ② Agence */
  agBar:    { backgroundColor:P.white, paddingVertical:6, borderBottomWidth:1, borderBottomColor:P.border },
  agRow:    { flexDirection:"row", gap:5, paddingHorizontal:10 },
  agChip:   { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:10, paddingVertical:6, borderRadius:16, borderWidth:1.5, borderColor:"#BAE6FD", backgroundColor:"#F0FDFF" },
  agChipOn: { backgroundColor:P.teal, borderColor:P.teal },
  agChipTxt:{ fontSize:11, fontWeight:"700", color:P.teal },
  mineDot:  { width:5, height:5, borderRadius:3, backgroundColor:P.green },
  agInfo:   { fontSize:10, color:P.sub, fontWeight:"500", paddingHorizontal:12, paddingTop:4 },

  /* ③ Status */
  stBar:      { flexDirection:"row", gap:5, paddingHorizontal:10, paddingVertical:7, backgroundColor:P.white, borderBottomWidth:1, borderBottomColor:P.border },
  stChip:     { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingVertical:7, borderRadius:10, borderWidth:1.5, borderColor:P.border, backgroundColor:P.white },
  stTxt:      { fontSize:11, fontWeight:"700", color:P.text },
  stBadge:    { borderRadius:7, paddingHorizontal:5, paddingVertical:1, backgroundColor:P.border },
  stBadgeTxt: { fontSize:10, fontWeight:"800", color:P.text },

  /* List */
  list:    { padding:10, paddingBottom:56, gap:10 },
  summary: { fontSize:11, color:P.sub, fontWeight:"600", marginBottom:2 },

  /* ④ Groupe trajet */
  groupWrap: { borderRadius:12, overflow:"hidden", ...(IS_WEB ? {boxShadow:"0 1px 6px rgba(0,0,0,0.07)"} as any : {shadowColor:"#000",shadowOffset:{width:0,height:1},shadowOpacity:0.06,shadowRadius:4,elevation:2}) },
  tripHead:  { flexDirection:"column", padding:12, borderLeftWidth:4, borderWidth:1, borderColor:P.border, borderRadius:12, borderBottomLeftRadius:0, borderBottomRightRadius:0 },
  tripMain:  { flexDirection:"row", alignItems:"center", marginBottom:6 },
  tripFrom:  { fontSize:16, fontWeight:"900", color:P.text },
  tripTo:    { fontSize:16, fontWeight:"900", color:P.text },
  cycBadge:  { flexDirection:"row", alignItems:"center", gap:3, borderRadius:7, paddingHorizontal:8, paddingVertical:3 },
  cycBadgeTxt:{ fontSize:9, fontWeight:"900", color:"#fff", letterSpacing:0.5 },
  tripSub:   { flexDirection:"row", alignItems:"center", gap:4 },
  tripSubTxt:{ fontSize:10, color:P.sub, fontWeight:"500" },
  tripSubDot:{ fontSize:10, color:P.border, marginHorizontal:1 },
  gCount:    { borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  gCountTxt: { fontSize:10, fontWeight:"800" },

  /* ⑤ Lignes réservation */
  bkBlock:    { backgroundColor:P.white, borderWidth:1, borderTopWidth:0, borderColor:P.border, borderBottomLeftRadius:12, borderBottomRightRadius:12, overflow:"hidden" },
  bkDiv:      { height:1, backgroundColor:P.border, marginLeft:44 },
  bkRow:      { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:9, gap:8 },
  bkRowPending:{ backgroundColor:"#FFFBEB" },
  av:         { width:30, height:30, borderRadius:15, alignItems:"center", justifyContent:"center" },
  avTxt:      { fontSize:13, fontWeight:"900" },
  bkMain:     { flex:1 },
  bkNameRow:  { flexDirection:"row", alignItems:"center" },
  bkName:     { fontSize:13, fontWeight:"700", color:P.text },
  bkRef:      { fontSize:10, color:P.sub, marginTop:1 },
  bkAmt:      { fontSize:12, fontWeight:"800", color:P.teal, minWidth:60, textAlign:"right" },
  bkActions:  { flexDirection:"row", gap:5 },
  btnConf:    { width:30, height:30, borderRadius:10, backgroundColor:P.green, alignItems:"center", justifyContent:"center" },
  btnCancel:  { width:30, height:30, borderRadius:10, backgroundColor:P.redSoft, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:"#FECACA" },
  bkStatusPill:{ borderRadius:7, paddingHorizontal:8, paddingVertical:3 },
  bkStatusTxt: { fontSize:10, fontWeight:"700" },
  phoneRow:   { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:48, paddingBottom:6 },
  phoneTxt:   { fontSize:10, color:P.teal, fontWeight:"600" },

  /* Empty / center */
  center:    { flex:1, justifyContent:"center", alignItems:"center", gap:10, paddingHorizontal:40 },
  centerSub: { fontSize:13, color:P.sub, marginTop:8 },
  emptyRound:{ width:52, height:52, borderRadius:26, backgroundColor:P.tealSoft, alignItems:"center", justifyContent:"center" },
  emptyTitle:{ fontSize:15, fontWeight:"800", color:P.text, textAlign:"center" },
  emptySub:  { fontSize:12, color:P.sub, textAlign:"center", lineHeight:17 },
  resetBtn:  { paddingHorizontal:18, paddingVertical:9, backgroundColor:P.teal, borderRadius:10, marginTop:4 },
  resetBtnTxt:{ color:"#fff", fontWeight:"700", fontSize:13 },

  /* Modal */
  overlay:     { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" },
  modal:       { backgroundColor:P.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:18, gap:10 },
  modalHead:   { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start" },
  modalTitle:  { fontSize:16, fontWeight:"900", color:P.text },
  modalSub:    { fontSize:12, color:P.sub, marginTop:2 },
  modalInput:  { backgroundColor:P.bg, borderRadius:10, borderWidth:1, borderColor:P.border, padding:11, fontSize:14, color:P.text, minHeight:60, textAlignVertical:"top" },
  modalBtn:    { backgroundColor:P.red, borderRadius:10, paddingVertical:12, alignItems:"center" },
  modalBtnTxt: { color:"#fff", fontSize:14, fontWeight:"800" },
  modalCancel: { alignItems:"center", paddingVertical:6 },
  modalCancelTxt:{ fontSize:13, color:P.sub, fontWeight:"600" },
});
