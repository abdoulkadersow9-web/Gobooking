import React, { useState, useCallback } from "react";
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

/* ─── Types ─────────────────────────────────────────────────── */
interface Waypoint {
  id: string;
  city: string;
  stopOrder: number;
  scheduledTime: string | null;
  arrivedAt: string | null;
  passengersBoarding: number;
  passengersAlighting: number;
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
  waypoints: Waypoint[];
}
interface SegmentData {
  segments: SegmentInfo[];
  totalSeats: number;
}

/* ─── Component ─────────────────────────────────────────────── */
export default function WaypointsScreen() {
  const router = useRouter();
  const { token: authToken } = useAuth();
  const token = authToken ?? "";
  const { tripId, tripName } = useLocalSearchParams<{ tripId: string; tripName?: string }>();

  const [waypointsData, setWaypointsData] = useState<WaypointsData | null>(null);
  const [segmentData,   setSegmentData]   = useState<SegmentData | null>(null);
  const [loading,       setLoading]        = useState(true);
  const [refreshing,    setRefreshing]     = useState(false);
  const [arriving,      setArriving]       = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [wpRes, segRes] = await Promise.all([
        fetch(`${API}/agent/trips/${tripId}/waypoints`,      { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/agent/trips/${tripId}/segment-seats`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (wpRes.ok)  setWaypointsData(await wpRes.json());
      if (segRes.ok) setSegmentData(await segRes.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [tripId, token]);

  React.useEffect(() => { load(); }, [load]);

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
                  "Arrivée enregistrée",
                  `✓ ${data.passengersAlighted} passager(s) descendu(s)\n✓ ${data.seatsFreed} place(s) libérée(s)`,
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

  const wps = waypointsData?.waypoints ?? [];
  const segs = segmentData?.segments ?? [];

  return (
    <View style={SL.root}>
      {/* Header */}
      <View style={SL.header}>
        <TouchableOpacity onPress={() => router.back()} style={SL.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={SL.headerTitle}>Escales & Segments</Text>
          <Text style={SL.headerSub}>{tripName ?? tripId}</Text>
        </View>
        <Feather name="map-pin" size={22} color="#fff" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P} />}
      >
        {/* Résumé total */}
        <View style={SL.summaryRow}>
          <View style={SL.summaryCard}>
            <Text style={SL.summaryNum}>{waypointsData?.totalSeats ?? "–"}</Text>
            <Text style={SL.summaryLbl}>Places totales</Text>
          </View>
          <View style={SL.summaryCard}>
            <Text style={[SL.summaryNum, { color: P }]}>{wps.length}</Text>
            <Text style={SL.summaryLbl}>Escales</Text>
          </View>
          <View style={SL.summaryCard}>
            <Text style={[SL.summaryNum, { color: "#D97706" }]}>
              {wps.filter(w => w.arrivedAt).length}/{wps.length}
            </Text>
            <Text style={SL.summaryLbl}>Arrivées</Text>
          </View>
        </View>

        {/* Section escales */}
        <Text style={SL.sectionTitle}>Trajet en cours</Text>
        {wps.map((wp, idx) => {
          const arrived   = !!wp.arrivedAt;
          const isLast    = idx === wps.length - 1;
          const canArrive = !arrived && !isLast && !wp.isOrigin;
          return (
            <View key={wp.id} style={[SL.wpCard, arrived && SL.wpArrived]}>
              {/* Ligne verticale */}
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
                        {arrived && " · Arrivé"}
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

                {/* Passagers */}
                {(wp.passengersBoarding > 0 || wp.passengersAlighting > 0) && (
                  <View style={SL.paxRow}>
                    {wp.passengersBoarding > 0 && (
                      <View style={SL.paxChip}>
                        <Feather name="user-plus" size={12} color={P} />
                        <Text style={[SL.paxTxt, { color: P }]}> +{wp.passengersBoarding} montent</Text>
                      </View>
                    )}
                    {wp.passengersAlighting > 0 && (
                      <View style={[SL.paxChip, { backgroundColor: "#FEF3C7" }]}>
                        <Feather name="user-minus" size={12} color="#D97706" />
                        <Text style={[SL.paxTxt, { color: "#D97706" }]}> -{wp.passengersAlighting} descendent</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Section segments */}
        {segs.length > 0 && (
          <>
            <Text style={[SL.sectionTitle, { marginTop: 24 }]}>Places disponibles par segment</Text>
            {segs.map((seg, i) => {
              const pct = seg.totalSeats > 0 ? (seg.occupied / seg.totalSeats) * 100 : 0;
              const color = seg.available === 0 ? "#EF4444" : seg.available < 5 ? "#F59E0B" : P;
              return (
                <View key={i} style={SL.segCard}>
                  <View style={SL.segRow}>
                    <Text style={SL.segRoute}>{seg.from}</Text>
                    <Feather name="arrow-right" size={14} color="#9CA3AF" style={{ marginHorizontal: 8 }} />
                    <Text style={SL.segRoute}>{seg.to}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[SL.segAvail, { color }]}>{seg.available} libre{seg.available > 1 ? "s" : ""}</Text>
                  </View>
                  <View style={SL.barBg}>
                    <View style={[SL.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={SL.segDetail}>{seg.occupied}/{seg.totalSeats} occupées</Text>
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

  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  summaryNum:  { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  summaryLbl:  { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },

  wpCard:     { flexDirection: "row", marginBottom: 4, minHeight: 60 },
  wpArrived:  { opacity: 0.7 },
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

  paxRow:  { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  paxChip: { flexDirection: "row", alignItems: "center", backgroundColor: PA, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  paxTxt:  { fontSize: 12, fontWeight: "600" },

  segCard:   { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  segRow:    { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  segRoute:  { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  segAvail:  { fontSize: 14, fontWeight: "700" },
  barBg:     { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  barFill:   { height: 6, borderRadius: 3 },
  segDetail: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
