/**
 * RÉSERVATIONS EN LIGNE — Aviation / Fintech style
 * Hiérarchie : TRAJET dominant (agence + bus + état) → RÉSERVATION compacte (tapable)
 * Détail passager : bottom sheet (siège, tél, paiement, bagages + photo)
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Image, Linking, Modal,
  Platform, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }  from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const IS_WEB = Platform.OS === "web";

/* ── Palette ─────────────────────────────────────────────── */
const P = {
  teal: "#0E7490", tealDk: "#0C6B82", tealLt: "#E0F7FA",
  amber: "#D97706", amberSoft: "#FFFBEB",
  purple: "#7C3AED", purpleSoft: "#F5F3FF",
  green: "#059669", greenSoft: "#ECFDF5",
  slate: "#475569", slateSoft: "#F8FAFC",
  red: "#DC2626",   redSoft: "#FEF2F2",
  text: "#0F172A", sub: "#64748B", border: "#E2E8F0",
  bg: "#F1F5F9", white: "#FFFFFF",
  gradAVenir:  ["#D97706", "#B45309"] as [string, string],
  gradGare:    ["#7C3AED", "#6D28D9"] as [string, string],
  gradRoute:   ["#059669", "#047857"] as [string, string],
  gradDone:    ["#64748B", "#475569"] as [string, string],
};

/* ── Types ───────────────────────────────────────────────── */
interface Agence { id: string; name: string; city: string }
interface TripInfo {
  id: string; from: string; to: string;
  date: string; departureTime: string; busName: string; status?: string;
  guichetSeats: number; onlineSeats: number; totalSeats: number;
  agenceName?: string | null; agenceCity?: string | null;
}
interface BagItem {
  photoUrl: string | null; type: string | null;
  description: string | null; status: string | null; price: number;
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
  bagageItems: BagItem[];
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
  label: string; icon: string; short: string;
  color: string; soft: string; grad: [string, string]; fKey: DepartF;
}
const CYCLE: CycleMeta[] = [
  { label:"À venir",  icon:"clock",        short:"VENIR",  color:P.amber,  soft:P.amberSoft,  grad:P.gradAVenir, fKey:"scheduled" },
  { label:"En gare",  icon:"user-check",   short:"GARE",   color:P.purple, soft:P.purpleSoft, grad:P.gradGare,   fKey:"boarding"  },
  { label:"En route", icon:"navigation",   short:"ROUTE",  color:P.green,  soft:"#ECFDF5",    grad:P.gradRoute,  fKey:"active"    },
  { label:"Terminés", icon:"check-circle", short:"DONE",   color:P.slate,  soft:P.slateSoft,  grad:P.gradDone,   fKey:"done"      },
];

function getCycle(s?: string): CycleMeta {
  if (isActive(s))   return CYCLE[2];
  if (isBoarding(s)) return CYCLE[1];
  if (isDone(s))     return CYCLE[3];
  return CYCLE[0];
}

function bkColor(s: string) {
  if (s === "pending")   return { label:"En attente", color:P.amber,  bg:P.amberSoft  };
  if (s === "confirmed") return { label:"Confirmé",   color:P.green,  bg:P.greenSoft  };
  if (s === "boarded")   return { label:"Embarqué",   color:P.purple, bg:P.purpleSoft };
  if (s === "cancelled") return { label:"Annulé",     color:P.red,    bg:P.redSoft    };
  return { label:s, color:P.sub, bg:"#F3F4F6" };
}

function payLabel(p: string) {
  if (p === "mobile_money") return "💱 Mobile Money";
  if (p === "card")         return "💳 Carte bancaire";
  if (p === "cash")         return "💵 Espèces";
  return p;
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
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
  } catch { return iso; }
}

/* ════════════════════════════════════════════════════════════ PAGE */
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

  const [detail,       setDetail]       = useState<Booking | null>(null);
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

  const pendingCount   = scoped.filter(b => b.status === "pending").length;
  const confirmedCount = scoped.filter(b => b.status === "confirmed" || b.status === "boarded").length;
  const cancelledCount = scoped.filter(b => b.status === "cancelled").length;

  useEffect(() => {
    if (pendingCount > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue:1.1, duration:800, useNativeDriver:true }),
        Animated.timing(pulse, { toValue:1,   duration:800, useNativeDriver:true }),
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
      const ts = b.trip?.status;
      if (c.fKey === "scheduled") return isScheduled(ts);
      if (c.fKey === "boarding")  return isBoarding(ts);
      if (c.fKey === "active")    return isActive(ts);
      return isDone(ts);
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
    if (!g) { g = { key:k, trip:b.trip ?? null, bks:[] }; groups.push(g); }
    g.bks.push(b);
  });
  groups.sort((a, b) => {
    const d = cycleOrder(a.trip?.status) - cycleOrder(b.trip?.status);
    if (d !== 0) return d;
    const aPend = a.bks.some(x => x.status === "pending") ? 0 : 1;
    const bPend = b.bks.some(x => x.status === "pending") ? 0 : 1;
    return aPend - bPend;
  });

  const syncStr = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}`
    : null;

  /* ── Actions ── */
  const confirmBooking = (b: Booking) => {
    setDetail(null);
    Alert.alert(
      "Confirmer la réservation",
      `${b.bookingRef} — ${b.passengers[0]?.name ?? "Client"}\n${(b.totalAmount ?? 0).toLocaleString()} FCFA`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "✓ Confirmer", onPress: async () => {
          setConfirming(b.id);
          try {
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`, { token:token??undefined, method:"POST", body:{} });
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
        token:token??undefined, method:"POST",
        body: { reason: cancelReason || undefined },
      });
      setCancelModal(null); setCancelReason(""); setDetail(null);
      await load(true);
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible"); }
    finally { setCancelling(null); }
  };

  /* ════════════════════════════════════════════════════════════ RENDER */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={P.tealDk} />

      {/* ──────── HEADER ──────── */}
      <LinearGradient colors={[P.tealDk, P.teal]} style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home" as never)} hitSlop={12}>
          <Feather name="arrow-left" size={21} color="#fff" />
        </Pressable>
        <View style={{ flex:1, marginLeft:10 }}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub} numberOfLines={1}>
            {agenceObj ? `${agenceObj.name} · ${agenceObj.city}` : "Toutes les agences"}
            {syncStr ? `  ·  ${syncStr}` : ""}
          </Text>
        </View>
        {pendingCount > 0 && (
          <Animated.View style={[s.hPill, { backgroundColor:"rgba(217,119,6,0.9)", transform:[{scale:pulse}] }]}>
            <Text style={s.hPillN}>{pendingCount}</Text>
            <Text style={s.hPillL}>att.</Text>
          </Animated.View>
        )}
        {confirmedCount > 0 && (
          <View style={[s.hPill, { backgroundColor:"rgba(5,150,105,0.75)" }]}>
            <Text style={s.hPillN}>{confirmedCount}</Text>
            <Text style={s.hPillL}>conf.</Text>
          </View>
        )}
        <Pressable style={s.hRefresh} onPress={() => load()} hitSlop={8}>
          <Feather name="refresh-cw" size={16} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* ──────── ① CYCLE PIPELINE ──────── */}
      <View style={s.pipeline}>
        {cyCounts.map((c, i) => {
          const on = departFilter === c.fKey;
          return (
            <React.Fragment key={c.fKey}>
              <Pressable style={[s.pipe, on && { backgroundColor:c.color, borderColor:c.color }]}
                onPress={() => setDepartFilter(departFilter === c.fKey ? "all" : c.fKey)}>
                <Feather name={c.icon as any} size={10} color={on ? "#fff" : c.color} />
                <Text style={[s.pipeCnt, { color:on?"#fff":P.text }]}>{c.count}</Text>
                <Text style={[s.pipeLbl, { color:on?"rgba(255,255,255,0.75)":P.sub }]}>{c.label}</Text>
              </Pressable>
              {i < 3 && <Feather name="chevron-right" size={9} color={P.border} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* ──────── ② AGENCE ──────── */}
      <View style={s.agWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.agRow}>
          <Pressable style={[s.agChip, selAgence===null && s.agChipOn]}
            onPress={() => setSelAgence(null)}>
            <Feather name="grid" size={10} color={selAgence===null?"#fff":P.teal} />
            <Text style={[s.agTxt, selAgence===null && {color:"#fff"}]}>Toutes</Text>
            <View style={[s.agBadge, selAgence===null && {backgroundColor:"rgba(255,255,255,0.2)"}]}>
              <Text style={[s.agBadgeTxt, selAgence===null && {color:"#fff"}]}>{bookings.length}</Text>
            </View>
          </Pressable>
          {agencies.map(a => {
            const on   = selAgence === a.id;
            const mine = myAgence?.id === a.id;
            const cnt  = bookings.filter(b => cityMatch(b.trip?.from, a.city)).length;
            return (
              <Pressable key={a.id} style={[s.agChip, on && s.agChipOn]}
                onPress={() => setSelAgence(on ? null : a.id)}>
                <Feather name="map-pin" size={10} color={on?"#fff":P.teal} />
                <Text style={[s.agTxt, on && {color:"#fff"}]} numberOfLines={1}>{a.name}</Text>
                {mine && <View style={[s.mineDot, on && {backgroundColor:"rgba(255,255,255,0.8)"}]} />}
                <View style={[s.agBadge, on && {backgroundColor:"rgba(255,255,255,0.2)"}]}>
                  <Text style={[s.agBadgeTxt, on && {color:"#fff"}]}>{cnt}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ──────── ③ STATUT ──────── */}
      <View style={s.stBar}>
        {([
          { k:"all"       as StatusF, lbl:"Toutes",     n:scoped.length,  col:P.teal  },
          { k:"pending"   as StatusF, lbl:"En attente", n:pendingCount,   col:P.amber },
          { k:"confirmed" as StatusF, lbl:"Confirmées", n:confirmedCount, col:P.green },
          { k:"cancelled" as StatusF, lbl:"Annulées",   n:cancelledCount, col:P.red   },
        ]).map(f => {
          const on = statusFilter === f.k;
          return (
            <Pressable key={f.k} style={[s.stChip, on && {backgroundColor:f.col, borderColor:f.col}]}
              onPress={() => setStatusFilter(f.k)}>
              <Text style={[s.stTxt, on && {color:"#fff"}]}>{f.lbl}</Text>
              {f.n > 0 && (
                <View style={[s.stN, on && {backgroundColor:"rgba(255,255,255,0.22)"}]}>
                  <Text style={[s.stNTxt, on && {color:"#fff"}]}>{f.n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ──────── ④ LISTE ──────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={P.teal} />
          <Text style={s.centerSub}>Chargement…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyCircle}><Feather name="inbox" size={22} color={P.teal} /></View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>Aucun résultat avec les filtres actuels</Text>
          <Pressable style={s.resetBtn} onPress={() => { setDepartFilter("all"); setStatusFilter("all"); setSelAgence(null); }}>
            <Text style={s.resetBtnTxt}>Réinitialiser les filtres</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{flex:1}} contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }} tintColor={P.teal} />}>

          <Text style={s.summary}>
            {displayed.length} réservation{displayed.length>1?"s":""}  ·  {groups.length} départ{groups.length>1?"s":""}
            {departFilter !== "all" ? `  ·  ${CYCLE.find(c=>c.fKey===departFilter)?.label}` : ""}
          </Text>

          {groups.map(group => {
            const trip = group.trip;
            const cy = getCycle(trip?.status);
            const gPend = group.bks.filter(b => b.status === "pending").length;
            const gConf = group.bks.filter(b => b.status==="confirmed"||b.status==="boarded").length;
            const gCan  = group.bks.filter(b => b.status === "cancelled").length;

            return (
              <View key={group.key} style={s.groupCard}>

                {/* ════ TRAJET HEADER (dominant) ════ */}
                <LinearGradient
                  colors={[cy.grad[0] + "22", cy.grad[0] + "05"]}
                  style={[s.tripHead, { borderLeftColor:cy.color }]}>

                  {trip ? (
                    <>
                      {/* Ligne 1: Agence + état */}
                      <View style={s.tripRow1}>
                        <View style={s.tripAgenceBox}>
                          <Feather name="map-pin" size={9} color={cy.color} />
                          <Text style={[s.tripAgence, { color:cy.color }]} numberOfLines={1}>
                            {trip.agenceName ?? trip.from}
                          </Text>
                        </View>
                        <View style={{ flex:1 }} />
                        {/* Compteurs */}
                        {gPend > 0 && (
                          <View style={[s.tripCnt, { backgroundColor:P.amberSoft }]}>
                            <Text style={[s.tripCntTxt, { color:P.amber }]}>{gPend} att.</Text>
                          </View>
                        )}
                        {gConf > 0 && (
                          <View style={[s.tripCnt, { backgroundColor:P.greenSoft }]}>
                            <Text style={[s.tripCntTxt, { color:P.green }]}>{gConf} conf.</Text>
                          </View>
                        )}
                        {gCan > 0 && (
                          <View style={[s.tripCnt, { backgroundColor:P.redSoft }]}>
                            <Text style={[s.tripCntTxt, { color:P.red }]}>{gCan} ann.</Text>
                          </View>
                        )}
                        {/* Badge état */}
                        <View style={[s.cycBadge, { backgroundColor:cy.color }]}>
                          <Feather name={cy.icon as any} size={8} color="#fff" />
                          <Text style={s.cycBadgeTxt}>{cy.short}</Text>
                        </View>
                      </View>

                      {/* Ligne 2: Route principale — DOMINANT */}
                      <View style={s.tripRow2}>
                        <Text style={s.tripCity}>{trip.from}</Text>
                        <Feather name="arrow-right" size={16} color={cy.color} style={{marginHorizontal:8}} />
                        <Text style={s.tripCity}>{trip.to}</Text>
                      </View>

                      {/* Ligne 3: Détails bus, heure, date */}
                      <View style={s.tripRow3}>
                        <Feather name="clock" size={9} color={P.sub} />
                        <Text style={s.tripDetail}>{trip.departureTime}</Text>
                        <Text style={s.tripDot}>·</Text>
                        <Feather name="calendar" size={9} color={P.sub} />
                        <Text style={s.tripDetail}>{trip.date}</Text>
                        <Text style={s.tripDot}>·</Text>
                        <Feather name="truck" size={9} color={cy.color} />
                        <Text style={[s.tripDetail, { color:cy.color, fontWeight:"700" }]}>{trip.busName}</Text>
                        <View style={{flex:1}} />
                        <Text style={s.tripSeats}>{group.bks.length}/{trip.onlineSeats} pl.</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[s.tripCity, { color:P.sub }]}>Trajet non précisé</Text>
                  )}
                </LinearGradient>

                {/* ════ LIGNES RÉSERVATION COMPACTES ════ */}
                <View style={s.bkList}>
                  {group.bks.map((b, idx) => {
                    const bk      = bkColor(b.status);
                    const isPend  = b.status === "pending";
                    const isConf  = confirming === b.id;
                    const name    = b.passengers?.[0]?.name ?? "Client";
                    const init    = name.charAt(0).toUpperCase();
                    const seats   = b.seatNumbers?.length ? b.seatNumbers.slice(0,3).join(",") : "—";
                    const hasBag  = b.baggageCount > 0;

                    return (
                      <View key={b.id}>
                        {idx > 0 && <View style={s.bkDiv} />}
                        <Pressable style={[s.bkRow, isPend && s.bkRowPend]}
                          onPress={() => setDetail(b)}>

                          {/* Avatar */}
                          <View style={[s.av, { backgroundColor:bk.bg }]}>
                            <Text style={[s.avTxt, { color:bk.color }]}>{init}</Text>
                          </View>

                          {/* Main info */}
                          <View style={s.bkInfo}>
                            <View style={s.bkNameRow}>
                              <Text style={s.bkName} numberOfLines={1}>{name}</Text>
                              {hasBag && <Feather name="package" size={10} color={P.purple} style={{marginLeft:4}} />}
                            </View>
                            <Text style={s.bkSub}>
                              {b.bookingRef}  ·  siège {seats}  ·  {payShort(b.paymentMethod)}
                            </Text>
                          </View>

                          {/* Amount */}
                          <Text style={s.bkAmt}>{(b.totalAmount ?? 0).toLocaleString()} F</Text>

                          {/* Actions / status */}
                          {isPend ? (
                            isConf ? (
                              <ActivityIndicator size="small" color={P.green} />
                            ) : (
                              <View style={s.bkBtns}>
                                <Pressable style={s.btnConf}
                                  onPress={e => { e.stopPropagation?.(); confirmBooking(b); }}>
                                  <Feather name="check" size={13} color="#fff" />
                                </Pressable>
                                <Pressable style={s.btnCan}
                                  onPress={e => { e.stopPropagation?.(); setCancelModal(b); setCancelReason(""); }}>
                                  <Feather name="x" size={13} color={P.red} />
                                </Pressable>
                              </View>
                            )
                          ) : (
                            <View style={[s.bkPill, { backgroundColor:bk.bg }]}>
                              <Text style={[s.bkPillTxt, { color:bk.color }]}>{bk.label}</Text>
                            </View>
                          )}

                          <Feather name="chevron-right" size={12} color={P.border} style={{marginLeft:2}} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ════════════════════════════════════════
          MODAL DÉTAIL PASSAGER
      ════════════════════════════════════════ */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={s.overlay} onPress={() => setDetail(null)}>
          <Pressable style={s.detailSheet} onPress={e => e.stopPropagation?.()}>
            {detail && <PassengerDetail
              booking={detail}
              onConfirm={() => confirmBooking(detail)}
              onCancel={() => { setDetail(null); setTimeout(() => { setCancelModal(detail); setCancelReason(""); }, 300); }}
              onClose={() => setDetail(null)}
              confirming={confirming === detail.id}
            />}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════════════════════════════════════════
          MODAL ANNULATION
      ════════════════════════════════════════ */}
      <Modal visible={!!cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.modalTitle}>Annuler la réservation</Text>
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
              <Text style={s.modalCancelTxt}>Garder la réservation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════
   PASSENGER DETAIL SHEET
══════════════════════════════════════════ */
function PassengerDetail({
  booking, onConfirm, onCancel, onClose, confirming,
}: {
  booking: Booking;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
  confirming: boolean;
}) {
  const bk     = bkColor(booking.status);
  const isPend = booking.status === "pending";
  const name   = booking.passengers?.[0]?.name ?? "Client";
  const hasBag = booking.baggageCount > 0;
  const items  = booking.bagageItems ?? [];
  const mainPhoto = items.find(i => i.photoUrl)?.photoUrl ?? null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Handle bar */}
      <View style={ds.handleWrap}>
        <View style={ds.handle} />
      </View>

      {/* Header */}
      <View style={ds.head}>
        <View style={[ds.bigAv, { backgroundColor:bk.bg }]}>
          <Text style={[ds.bigAvTxt, { color:bk.color }]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={ds.headInfo}>
          <Text style={ds.headName} numberOfLines={2}>{name}</Text>
          <View style={[ds.statusPill, { backgroundColor:bk.bg }]}>
            <Text style={[ds.statusTxt, { color:bk.color }]}>{bk.label}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={ds.closeBtn}>
          <Feather name="x" size={18} color={P.sub} />
        </Pressable>
      </View>

      {/* Ref */}
      <View style={ds.refRow}>
        <Feather name="hash" size={12} color={P.sub} />
        <Text style={ds.refTxt}>{booking.bookingRef}</Text>
        <Text style={ds.refDot}>·</Text>
        <Feather name="calendar" size={12} color={P.sub} />
        <Text style={ds.refTxt}>{fmtDate(booking.createdAt)}</Text>
        <Text style={ds.refDot}>·</Text>
        <Text style={ds.refTxt}>{booking.bookingSource === "mobile" ? "📱 App" : booking.bookingSource === "online" ? "🌐 Web" : "🏢 Guichet"}</Text>
      </View>

      {/* Section Trajet */}
      {booking.trip && (
        <View style={ds.section}>
          <Text style={ds.sLabel}>TRAJET</Text>
          <View style={ds.infoRow}>
            <Feather name="arrow-right" size={14} color={P.teal} />
            <Text style={ds.infoVal}>{booking.trip.from}  →  {booking.trip.to}</Text>
          </View>
          <View style={ds.infoRow}>
            <Feather name="clock" size={13} color={P.sub} />
            <Text style={ds.infoTxt}>{booking.trip.departureTime}  ·  {booking.trip.date}</Text>
          </View>
          <View style={ds.infoRow}>
            <Feather name="truck" size={13} color={P.sub} />
            <Text style={ds.infoTxt}>{booking.trip.busName}</Text>
          </View>
          {booking.trip.agenceName && (
            <View style={ds.infoRow}>
              <Feather name="map-pin" size={13} color={P.sub} />
              <Text style={ds.infoTxt}>{booking.trip.agenceName}{booking.trip.agenceCity ? ` · ${booking.trip.agenceCity}` : ""}</Text>
            </View>
          )}
        </View>
      )}

      {/* Section Passager */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PASSAGER</Text>
        {booking.passengers.map((p, i) => (
          <View key={i} style={ds.infoRow}>
            <Feather name="user" size={13} color={P.sub} />
            <Text style={ds.infoVal}>{p.name}</Text>
            {booking.seatNumbers[i] && (
              <View style={ds.seatBadge}>
                <Text style={ds.seatTxt}>Siège {booking.seatNumbers[i]}</Text>
              </View>
            )}
          </View>
        ))}
        {booking.contactPhone ? (
          <Pressable style={ds.phoneBtn}
            onPress={() => Linking.openURL(`tel:${booking.contactPhone.replace(/\s/g,"")}`)}
          >
            <Feather name="phone" size={14} color={P.teal} />
            <Text style={ds.phoneTxt}>{booking.contactPhone}</Text>
            <Feather name="external-link" size={11} color={P.teal} />
          </Pressable>
        ) : (
          <View style={ds.infoRow}>
            <Feather name="phone-off" size={13} color={P.sub} />
            <Text style={[ds.infoTxt, { color:P.sub }]}>Téléphone non renseigné</Text>
          </View>
        )}
      </View>

      {/* Section Paiement */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PAIEMENT</Text>
        <View style={ds.payCard}>
          <View>
            <Text style={ds.payAmt}>{(booking.totalAmount ?? 0).toLocaleString()} FCFA</Text>
            <Text style={ds.payMethod}>{payLabel(booking.paymentMethod)}</Text>
          </View>
          <View style={[ds.statusPill, { backgroundColor:bk.bg }]}>
            <Text style={[ds.statusTxt, { color:bk.color }]}>{bk.label}</Text>
          </View>
        </View>
      </View>

      {/* Section Bagages */}
      {hasBag && (
        <View style={ds.section}>
          <Text style={ds.sLabel}>BAGAGES — {booking.baggageCount} article{booking.baggageCount>1?"s":""}</Text>

          {/* Photo principale */}
          {mainPhoto ? (
            <View style={ds.photoWrap}>
              <Image source={{ uri: mainPhoto }} style={ds.photo} resizeMode="cover" />
              <View style={ds.photoOverlay}>
                <Feather name="package" size={14} color="#fff" />
                <Text style={ds.photoLbl}>{booking.baggageType ?? "Bagage"}</Text>
              </View>
            </View>
          ) : (
            <View style={ds.photoPlaceholder}>
              <Feather name="package" size={24} color={P.purple} />
              <Text style={ds.photoPlaceholderTxt}>Aucune photo disponible</Text>
            </View>
          )}

          {/* Détails bagages */}
          {booking.baggageDescription ? (
            <View style={ds.infoRow}>
              <Feather name="info" size={13} color={P.sub} />
              <Text style={ds.infoTxt}>{booking.baggageDescription}</Text>
            </View>
          ) : null}
          {booking.bagageStatus && (
            <View style={ds.infoRow}>
              <Feather name="check-circle" size={13} color={booking.bagageStatus==="accepté"?P.green:P.amber} />
              <Text style={[ds.infoTxt, { color:booking.bagageStatus==="accepté"?P.green:P.amber, fontWeight:"700" }]}>
                Statut : {booking.bagageStatus}
              </Text>
            </View>
          )}
          {booking.bagagePrice > 0 && (
            <View style={ds.infoRow}>
              <Feather name="dollar-sign" size={13} color={P.sub} />
              <Text style={ds.infoTxt}>Frais bagages : {booking.bagagePrice.toLocaleString()} FCFA</Text>
            </View>
          )}

          {/* Items individuels avec photos */}
          {items.length > 1 && items.map((item, i) => (
            <View key={i} style={ds.bagItem}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={ds.bagThumb} resizeMode="cover" />
              ) : (
                <View style={[ds.bagThumb, { backgroundColor:P.purpleSoft, alignItems:"center", justifyContent:"center" }]}>
                  <Feather name="package" size={14} color={P.purple} />
                </View>
              )}
              <View style={{flex:1}}>
                <Text style={ds.bagItemType}>{item.type ?? "Valise"}</Text>
                {item.description && <Text style={ds.bagItemDesc} numberOfLines={1}>{item.description}</Text>}
                {item.status && <Text style={[ds.bagItemStatus, {color:item.status==="chargé"?P.green:P.amber}]}>{item.status}</Text>}
              </View>
              {item.price > 0 && <Text style={ds.bagItemPrice}>{item.price.toLocaleString()} F</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      {isPend && (
        <View style={ds.actRow}>
          <Pressable style={[ds.actBtn, { backgroundColor:P.green }]}
            onPress={onConfirm} disabled={confirming}>
            {confirming
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Feather name="check" size={16} color="#fff" /><Text style={ds.actBtnTxt}>Confirmer</Text></>}
          </Pressable>
          <Pressable style={[ds.actBtn, { backgroundColor:P.white, borderWidth:1.5, borderColor:P.red }]}
            onPress={onCancel}>
            <Feather name="x" size={16} color={P.red} />
            <Text style={[ds.actBtnTxt, { color:P.red }]}>Annuler</Text>
          </Pressable>
        </View>
      )}
      <View style={{ height:24 }} />
    </ScrollView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const shadow = IS_WEB
  ? { boxShadow: "0 2px 10px rgba(0,0,0,0.08)" } as any
  : { shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:3 };

const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:P.bg },
  /* Header */
  header:   { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:10, gap:8 },
  hTitle:   { fontSize:16, fontWeight:"800", color:"#fff" },
  hSub:     { fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:1 },
  hPill:    { borderRadius:8, paddingHorizontal:7, paddingVertical:4, alignItems:"center", minWidth:36 },
  hPillN:   { fontSize:13, fontWeight:"900", color:"#fff" },
  hPillL:   { fontSize:8,  fontWeight:"700", color:"rgba(255,255,255,0.8)", textTransform:"uppercase" },
  hRefresh: { width:32, height:32, borderRadius:16, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },
  /* ① Pipeline */
  pipeline: { flexDirection:"row", alignItems:"center", backgroundColor:P.white, paddingHorizontal:8, paddingVertical:6, borderBottomWidth:1, borderBottomColor:P.border, gap:3 },
  pipe:     { flex:1, alignItems:"center", gap:2, paddingVertical:6, borderRadius:9, borderWidth:1.5, borderColor:P.border },
  pipeCnt:  { fontSize:14, fontWeight:"900" },
  pipeLbl:  { fontSize:8,  fontWeight:"700", textTransform:"uppercase", letterSpacing:0.3 },
  /* ② Agence */
  agWrap:   { backgroundColor:P.white, paddingVertical:6, borderBottomWidth:1, borderBottomColor:P.border },
  agRow:    { flexDirection:"row", gap:5, paddingHorizontal:10 },
  agChip:   { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:9, paddingVertical:5, borderRadius:15, borderWidth:1.5, borderColor:"#BAE6FD", backgroundColor:"#F0FDFF" },
  agChipOn: { backgroundColor:P.teal, borderColor:P.teal },
  agTxt:    { fontSize:11, fontWeight:"700", color:P.teal },
  agBadge:  { backgroundColor:P.border, borderRadius:6, paddingHorizontal:5, paddingVertical:1 },
  agBadgeTxt:{ fontSize:10, fontWeight:"800", color:P.sub },
  mineDot:  { width:5, height:5, borderRadius:3, backgroundColor:P.green },
  /* ③ Statut */
  stBar:    { flexDirection:"row", gap:5, paddingHorizontal:10, paddingVertical:6, backgroundColor:P.white, borderBottomWidth:1, borderBottomColor:P.border },
  stChip:   { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:3, paddingVertical:7, borderRadius:9, borderWidth:1.5, borderColor:P.border, backgroundColor:P.white },
  stTxt:    { fontSize:11, fontWeight:"700", color:P.text },
  stN:      { backgroundColor:P.border, borderRadius:6, paddingHorizontal:5, paddingVertical:1 },
  stNTxt:   { fontSize:10, fontWeight:"800", color:P.text },
  /* List */
  list:     { padding:10, paddingBottom:60, gap:10 },
  summary:  { fontSize:11, color:P.sub, fontWeight:"600", marginBottom:2 },
  /* Groupe trajet */
  groupCard:  { borderRadius:14, overflow:"hidden", ...shadow },
  tripHead:   { padding:12, borderLeftWidth:4, borderWidth:1, borderColor:P.border, borderRadius:14, borderBottomLeftRadius:0, borderBottomRightRadius:0 },
  tripRow1:   { flexDirection:"row", alignItems:"center", marginBottom:7, gap:5 },
  tripAgenceBox:{ flexDirection:"row", alignItems:"center", gap:4 },
  tripAgence: { fontSize:11, fontWeight:"700" },
  tripCnt:    { borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  tripCntTxt: { fontSize:10, fontWeight:"800" },
  cycBadge:   { flexDirection:"row", alignItems:"center", gap:3, borderRadius:7, paddingHorizontal:8, paddingVertical:3 },
  cycBadgeTxt:{ fontSize:8, fontWeight:"900", color:"#fff", letterSpacing:0.5 },
  tripRow2:   { flexDirection:"row", alignItems:"center", marginBottom:8 },
  tripCity:   { fontSize:18, fontWeight:"900", color:P.text },
  tripRow3:   { flexDirection:"row", alignItems:"center", gap:4 },
  tripDetail: { fontSize:10, color:P.sub, fontWeight:"500" },
  tripDot:    { fontSize:10, color:P.border },
  tripSeats:  { fontSize:10, fontWeight:"700", color:P.sub },
  /* Booking rows */
  bkList:     { backgroundColor:P.white, borderWidth:1, borderTopWidth:0, borderColor:P.border, borderBottomLeftRadius:14, borderBottomRightRadius:14 },
  bkDiv:      { height:1, backgroundColor:P.border, marginLeft:50 },
  bkRow:      { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:10, gap:8 },
  bkRowPend:  { backgroundColor:"#FFFBEB" },
  av:         { width:32, height:32, borderRadius:16, alignItems:"center", justifyContent:"center" },
  avTxt:      { fontSize:14, fontWeight:"900" },
  bkInfo:     { flex:1 },
  bkNameRow:  { flexDirection:"row", alignItems:"center" },
  bkName:     { fontSize:13, fontWeight:"700", color:P.text },
  bkSub:      { fontSize:10, color:P.sub, marginTop:1 },
  bkAmt:      { fontSize:12, fontWeight:"800", color:P.teal, minWidth:58, textAlign:"right" },
  bkBtns:     { flexDirection:"row", gap:5 },
  btnConf:    { width:30, height:30, borderRadius:9, backgroundColor:P.green, alignItems:"center", justifyContent:"center" },
  btnCan:     { width:30, height:30, borderRadius:9, backgroundColor:P.redSoft, borderWidth:1, borderColor:"#FECACA", alignItems:"center", justifyContent:"center" },
  bkPill:     { borderRadius:7, paddingHorizontal:8, paddingVertical:3 },
  bkPillTxt:  { fontSize:10, fontWeight:"700" },
  /* Center / empty */
  center:       { flex:1, justifyContent:"center", alignItems:"center", gap:10, paddingHorizontal:40 },
  centerSub:    { fontSize:13, color:P.sub, marginTop:8 },
  emptyCircle:  { width:52, height:52, borderRadius:26, backgroundColor:P.tealLt, alignItems:"center", justifyContent:"center" },
  emptyTitle:   { fontSize:15, fontWeight:"800", color:P.text },
  emptySub:     { fontSize:12, color:P.sub, textAlign:"center", lineHeight:17 },
  resetBtn:     { paddingHorizontal:18, paddingVertical:9, backgroundColor:P.teal, borderRadius:10, marginTop:4 },
  resetBtnTxt:  { color:"#fff", fontWeight:"700", fontSize:13 },
  /* Modal detail */
  overlay:      { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  detailSheet:  { backgroundColor:P.white, borderTopLeftRadius:22, borderTopRightRadius:22, maxHeight:"88%", paddingHorizontal:18, ...shadow },
  /* Cancel modal */
  modal:        { backgroundColor:P.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:18, gap:10 },
  modalHead:    { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start" },
  modalTitle:   { fontSize:16, fontWeight:"900", color:P.text },
  modalSub:     { fontSize:12, color:P.sub, marginTop:2 },
  modalInput:   { backgroundColor:P.bg, borderRadius:10, borderWidth:1, borderColor:P.border, padding:11, fontSize:14, color:P.text, minHeight:60, textAlignVertical:"top" },
  modalBtn:     { backgroundColor:P.red, borderRadius:10, paddingVertical:12, alignItems:"center" },
  modalBtnTxt:  { color:"#fff", fontSize:14, fontWeight:"800" },
  modalCancel:  { alignItems:"center", paddingVertical:6 },
  modalCancelTxt:{ fontSize:13, color:P.sub, fontWeight:"600" },
});

/* ── Detail sheet styles ─── */
const ds = StyleSheet.create({
  handleWrap:  { alignItems:"center", paddingTop:10, paddingBottom:4 },
  handle:      { width:36, height:4, borderRadius:2, backgroundColor:P.border },
  head:        { flexDirection:"row", alignItems:"flex-start", gap:12, paddingTop:6, paddingBottom:12 },
  bigAv:       { width:48, height:48, borderRadius:24, alignItems:"center", justifyContent:"center" },
  bigAvTxt:    { fontSize:20, fontWeight:"900" },
  headInfo:    { flex:1, gap:6 },
  headName:    { fontSize:17, fontWeight:"900", color:P.text },
  statusPill:  { alignSelf:"flex-start", borderRadius:8, paddingHorizontal:10, paddingVertical:3 },
  statusTxt:   { fontSize:11, fontWeight:"700" },
  closeBtn:    { padding:4 },
  refRow:      { flexDirection:"row", alignItems:"center", gap:5, paddingBottom:14, borderBottomWidth:1, borderBottomColor:P.border },
  refTxt:      { fontSize:11, color:P.sub, fontWeight:"500" },
  refDot:      { fontSize:11, color:P.border },
  section:     { paddingVertical:12, borderBottomWidth:1, borderBottomColor:P.border, gap:7 },
  sLabel:      { fontSize:9, fontWeight:"900", color:P.sub, letterSpacing:1, textTransform:"uppercase", marginBottom:2 },
  infoRow:     { flexDirection:"row", alignItems:"center", gap:8 },
  infoVal:     { fontSize:14, fontWeight:"700", color:P.text, flex:1 },
  infoTxt:     { fontSize:13, color:P.text, flex:1 },
  seatBadge:   { backgroundColor:P.tealLt, borderRadius:6, paddingHorizontal:8, paddingVertical:2 },
  seatTxt:     { fontSize:11, fontWeight:"700", color:P.teal },
  phoneBtn:    { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:P.tealLt, borderRadius:10, paddingHorizontal:12, paddingVertical:10 },
  phoneTxt:    { fontSize:14, fontWeight:"700", color:P.teal, flex:1 },
  payCard:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", backgroundColor:P.bg, borderRadius:10, padding:12 },
  payAmt:      { fontSize:18, fontWeight:"900", color:P.text },
  payMethod:   { fontSize:12, color:P.sub, marginTop:2 },
  photoWrap:   { borderRadius:12, overflow:"hidden", position:"relative", height:170 },
  photo:       { width:"100%", height:170 },
  photoOverlay:{ position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", alignItems:"center", gap:6, padding:10, backgroundColor:"rgba(0,0,0,0.45)" },
  photoLbl:    { color:"#fff", fontWeight:"700", fontSize:13 },
  photoPlaceholder:{ height:120, borderRadius:12, backgroundColor:P.purpleSoft, alignItems:"center", justifyContent:"center", gap:8 },
  photoPlaceholderTxt:{ fontSize:12, color:P.purple, fontWeight:"600" },
  bagItem:     { flexDirection:"row", alignItems:"center", gap:10, paddingVertical:6, borderTopWidth:1, borderTopColor:P.border },
  bagThumb:    { width:44, height:44, borderRadius:8 },
  bagItemType: { fontSize:12, fontWeight:"700", color:P.text },
  bagItemDesc: { fontSize:11, color:P.sub },
  bagItemStatus:{ fontSize:11, fontWeight:"700" },
  bagItemPrice:{ fontSize:12, fontWeight:"800", color:P.teal },
  actRow:      { flexDirection:"row", gap:10, paddingTop:16, paddingBottom:4 },
  actBtn:      { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, paddingVertical:13, borderRadius:12 },
  actBtnTxt:   { fontSize:14, fontWeight:"800", color:"#fff" },
});
