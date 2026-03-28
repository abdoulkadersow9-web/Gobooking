import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const P   = "#166534";
const PA  = "#D1FAE5";
const AMBER = "#D97706";

/* ─── Types ─────────────────────────────────────────────────── */
interface Waypoint {
  id: string;
  city: string;
  stopOrder: number;
  scheduledTime: string | null;
  arrivedAt: string | null;
  passengersBoarding: number;
  passengersAlighting: number;
  seatsFreedHere: number;
  isArrived: boolean;
  isOrigin: boolean;
  isDestination: boolean;
}
interface SegmentInfo {
  from: string;
  to: string;
  totalSeats: number;
  occupied: number;
  available: number;
}
interface WaypointsData {
  tripId: string;
  totalSeats: number;
  totalSeatsFreed: number;
  waypoints: Waypoint[];
}
interface SegmentData {
  segments: SegmentInfo[];
  totalSeats: number;
}

/* ─── Component ─────────────────────────────────────────────── */
export default function WaypointsScreen() {
  const router = useRouter();
  const { token: authToken, logoutIfActiveToken } = useAuth();
  const token = authToken ?? "";
  const { tripId, tripName } = useLocalSearchParams<{ tripId: string; tripName?: string }>();

  const [waypointsData, setWaypointsData] = useState<WaypointsData | null>(null);
  const [segmentData,   setSegmentData]   = useState<SegmentData | null>(null);
  const [loading,       setLoading]        = useState(true);
  const [refreshing,    setRefreshing]     = useState(false);
  const [arriving,      setArriving]       = useState<string | null>(null);
  const [lastUpdated,   setLastUpdated]    = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [wpRes, segRes] = await Promise.all([
        fetch(`${API}/agent/trips/${tripId}/waypoints`,      { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/agent/trips/${tripId}/segment-seats`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      /* 401 = token invalide → logout.  403 = RBAC (mauvais rôle) → ne jamais déconnecter */
      if (wpRes.status === 401) {
        logoutIfActiveToken(token); return;
      }
      if (wpRes.ok)  setWaypointsData(await wpRes.json());
      if (segRes.ok) setSegmentData(await segRes.json());
      setLastUpdated(new Date());
    } catch {}
    if (!silent) {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, token, logoutIfActiveToken]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const markArrival = async (city: string) => {
    Alert.alert(
      "Confirmer l'arrivée",
      `Confirmer l'arrivée à ${city} ?\n\nLes places des passagers qui descendent ici seront automatiquement libérées.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "default",
          onPress: async () => {
            setArriving(city);
            try {
              const r = await fetch(`${API}/agent/trips/${tripId}/waypoint-arrive`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ city }),
              });
              const data = await r.json();
              if (r.ok) {
                Alert.alert(
                  "Arrivée enregistrée ✓",
                  `${data.passengersAlighted} passager(s) descendu(s)\n${data.seatsFreed} place(s) libérée(s) et disponibles`,
                );
                load();
              } else {
                Alert.alert("Erreur", data.error ?? "Impossible d'enregistrer l'arrivée");
              }
            } catch {
              Alert.alert("Erreur", "Problème réseau");
            }
            setArriving(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={SL.center}>
        <ActivityIndicator color={P} size="large" />
        <Text style={SL.loadTxt}>Chargement des escales…</Text>
      </View>
    );
  }

  const wps  = waypointsData?.waypoints ?? [];
  const segs = segmentData?.segments ?? [];
  const totalFreed = waypointsData?.totalSeatsFreed ?? 0;
  const arrivedCount = wps.filter(w => w.isArrived).length;
  const pendingAlighting = wps.filter(w => !w.isArrived).reduce((s, w) => s + w.passengersAlighting, 0);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <View style={SL.root}>
      {/* Header */}
      <View style={SL.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home")} style={SL.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={SL.headerTitle}>Escales & Segments</Text>
          <Text style={SL.headerSub}>{tripName ?? tripId}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={SL.liveBadge}>
            <View style={SL.liveDot} />
            <Text style={SL.liveTxt}>Live</Text>
          </View>
          {lastUpdated && (
            <Text style={{ color: "#A7F3D0", fontSize: 9, marginTop: 2 }}>
              {fmtTime(lastUpdated)}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P} />}
      >
        {/* ── Résumé statistiques ── */}
        <View style={SL.summaryRow}>
          <View style={SL.summaryCard}>
            <Text style={SL.summaryNum}>{waypointsData?.totalSeats ?? "–"}</Text>
            <Text style={SL.summaryLbl}>Places totales</Text>
          </View>
          <View style={SL.summaryCard}>
            <Text style={[SL.summaryNum, { color: P }]}>
              {arrivedCount}/{wps.length}
            </Text>
            <Text style={SL.summaryLbl}>Escales faites</Text>
          </View>
          <View style={SL.summaryCard}>
            <Text style={[SL.summaryNum, { color: totalFreed > 0 ? P : "#94A3B8" }]}>
              {totalFreed}
            </Text>
            <Text style={SL.summaryLbl}>Places libérées</Text>
          </View>
        </View>

        {/* ── Bilan rotation si des places ont été libérées ── */}
        {totalFreed > 0 && (
          <View style={SL.rotationBanner}>
            <View style={SL.rotationIcon}>
              <Feather name="refresh-cw" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={SL.rotationTitle}>
                {totalFreed} place{totalFreed > 1 ? "s" : ""} libérée{totalFreed > 1 ? "s" : ""} par rotation
              </Text>
              <Text style={SL.rotationSub}>
                Disponibles pour nouvelles réservations sur les segments suivants
              </Text>
            </View>
          </View>
        )}

        {/* ── Prévision descentes futures ── */}
        {pendingAlighting > 0 && (
          <View style={SL.forecastBanner}>
            <Feather name="clock" size={14} color={AMBER} />
            <Text style={SL.forecastTxt}>
              {pendingAlighting} passager{pendingAlighting > 1 ? "s" : ""} prévu{pendingAlighting > 1 ? "s" : ""} à descendre aux prochaines escales
            </Text>
          </View>
        )}

        {/* ── Section escales ── */}
        <Text style={SL.sectionTitle}>Trajet en cours</Text>
        {wps.map((wp, idx) => {
          const arrived   = wp.isArrived;
          const isLast    = idx === wps.length - 1;
          const canArrive = !arrived && !isLast && !wp.isOrigin;
          return (
            <View key={wp.id} style={[SL.wpCard, arrived && SL.wpArrived]}>
              {idx < wps.length - 1 && <View style={[SL.vline, arrived && SL.vlineArrived]} />}

              {/* Dot */}
              <View style={[SL.dot, arrived && SL.dotArrived, wp.isOrigin && SL.dotOrigin, wp.isDestination && SL.dotDest]}>
                {arrived ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : wp.isOrigin ? (
                  <Ionicons name="play" size={10} color="#fff" />
                ) : wp.isDestination ? (
                  <Ionicons name="flag" size={10} color="#fff" />
                ) : (
                  <View style={SL.dotInner} />
                )}
              </View>

              {/* Content */}
              <View style={SL.wpContent}>
                <View style={SL.wpTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[SL.cityName, arrived && { color: "#6B7280" }]}>{wp.city}</Text>
                    {wp.scheduledTime && (
                      <Text style={SL.wpTime}>
                        <Feather name="clock" size={11} color="#9CA3AF" /> {wp.scheduledTime}
                        {arrived && " · Arrivé ✓"}
                      </Text>
                    )}
                  </View>
                  {canArrive && (
                    <TouchableOpacity
                      style={[SL.arriveBtn, arriving === wp.city && { opacity: 0.6 }]}
                      onPress={() => markArrival(wp.city)}
                      disabled={arriving === wp.city}
                    >
                      {arriving === wp.city ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={SL.arriveBtnTxt}>Marquer arrivée</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Passagers embarquement / descente */}
                <View style={SL.paxRow}>
                  {wp.passengersBoarding > 0 && (
                    <View style={SL.paxChip}>
                      <Feather name="user-plus" size={12} color={P} />
                      <Text style={[SL.paxTxt, { color: P }]}> +{wp.passengersBoarding} montent</Text>
                    </View>
                  )}
                  {wp.passengersAlighting > 0 && (
                    <View style={[SL.paxChip, arrived ? { backgroundColor: "#D1FAE5" } : { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="user-minus" size={12} color={arrived ? P : AMBER} />
                      <Text style={[SL.paxTxt, { color: arrived ? P : AMBER }]}>
                        {" "}{arrived ? "" : "-"}{wp.passengersAlighting} {arrived ? "descendus" : "descendent"}
                      </Text>
                    </View>
                  )}
                  {/* Places libérées badge */}
                  {arrived && wp.seatsFreedHere > 0 && (
                    <View style={SL.freedChip}>
                      <Feather name="unlock" size={11} color="#fff" />
                      <Text style={SL.freedTxt}>
                        {" "}{wp.seatsFreedHere} libérée{wp.seatsFreedHere > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  {/* Libérations prévues */}
                  {!arrived && wp.passengersAlighting > 0 && (
                    <View style={SL.forecastChip}>
                      <Feather name="clock" size={11} color="#64748B" />
                      <Text style={SL.forecastChipTxt}>
                        {" "}{wp.passengersAlighting} lib. prévue{wp.passengersAlighting > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* ── Section segments ── */}
        {segs.length > 0 && (
          <>
            <Text style={[SL.sectionTitle, { marginTop: 24 }]}>Disponibilité par segment</Text>
            {segs.map((seg, i) => {
              const pct    = seg.totalSeats > 0 ? (seg.occupied / seg.totalSeats) * 100 : 0;
              const isFull = seg.available === 0;
              const isLow  = seg.available > 0 && seg.available < 5;
              const color  = isFull ? "#EF4444" : isLow ? AMBER : P;
              return (
                <View key={i} style={[SL.segCard, isFull && SL.segCardFull, isLow && SL.segCardLow]}>
                  <View style={SL.segRow}>
                    <Text style={SL.segRoute}>{seg.from}</Text>
                    <Feather name="arrow-right" size={14} color="#9CA3AF" style={{ marginHorizontal: 8 }} />
                    <Text style={SL.segRoute}>{seg.to}</Text>
                    <View style={{ flex: 1 }} />
                    {isFull && (
                      <View style={[SL.statusBadge, { backgroundColor: "#FEE2E2" }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#DC2626" }}>COMPLET</Text>
                      </View>
                    )}
                    {isLow && (
                      <View style={[SL.statusBadge, { backgroundColor: "#FEF3C7" }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#92400E" }}>PRESQUE PLEIN</Text>
                      </View>
                    )}
                    <Text style={[SL.segAvail, { color }]}>{seg.available} libre{seg.available !== 1 ? "s" : ""}</Text>
                  </View>
                  <View style={SL.barBg}>
                    <View style={[SL.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={SL.segDetail}>{seg.occupied} occupée{seg.occupied !== 1 ? "s" : ""} / {seg.totalSeats} total</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const SL = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#F8FAFC" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadTxt:     { color: "#64748B", fontSize: 14 },
  header:      { backgroundColor: P, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  backBtn:     { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub:   { color: "#A7F3D0", fontSize: 12, marginTop: 2 },

  liveBadge:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: "#6EE7B7" },
  liveTxt:    { color: "#fff", fontSize: 11, fontWeight: "600" },

  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  summaryNum:  { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  summaryLbl:  { fontSize: 11, color: "#94A3B8", marginTop: 2, textAlign: "center" },

  rotationBanner: { backgroundColor: P, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  rotationIcon:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  rotationTitle:  { fontSize: 13, fontWeight: "700", color: "#fff" },
  rotationSub:    { fontSize: 11, color: "#A7F3D0", marginTop: 2 },

  forecastBanner: { backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, borderWidth: 1, borderColor: "#FDE68A" },
  forecastTxt:    { fontSize: 12, color: "#92400E", flex: 1 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },

  wpCard:     { flexDirection: "row", marginBottom: 4, minHeight: 60 },
  wpArrived:  { opacity: 0.8 },
  vline:      { position: "absolute", left: 15, top: 28, bottom: -4, width: 2, backgroundColor: "#E2E8F0" },
  vlineArrived: { backgroundColor: P },
  dot:        { width: 32, height: 32, borderRadius: 16, backgroundColor: "#CBD5E1", alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 4, zIndex: 1 },
  dotArrived: { backgroundColor: P },
  dotOrigin:  { backgroundColor: "#1D4ED8" },
  dotDest:    { backgroundColor: "#7C3AED" },
  dotInner:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },

  wpContent:  { flex: 1, paddingBottom: 16 },
  wpTop:      { flexDirection: "row", alignItems: "center" },
  cityName:   { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  wpTime:     { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  arriveBtn:   { backgroundColor: P, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  arriveBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  paxRow:  { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  paxChip: { flexDirection: "row", alignItems: "center", backgroundColor: PA, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  paxTxt:  { fontSize: 12, fontWeight: "600" },

  freedChip:    { flexDirection: "row", alignItems: "center", backgroundColor: P, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  freedTxt:     { fontSize: 11, fontWeight: "700", color: "#fff" },
  forecastChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  forecastChipTxt: { fontSize: 11, color: "#64748B" },

  segCard:      { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  segCardFull:  { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  segCardLow:   { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" },
  segRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 },
  segRoute:     { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  segAvail:     { fontSize: 14, fontWeight: "700" },
  statusBadge:  { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  barBg:        { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  barFill:      { height: 6, borderRadius: 3 },
  segDetail:    { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
