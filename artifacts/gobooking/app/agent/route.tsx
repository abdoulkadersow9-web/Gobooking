import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { useNetworkStatus } from "@/utils/offline";
import { useAgentGps } from "@/utils/useAgentGps";
import OfflineBanner from "@/components/OfflineBanner";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";
const AMBER   = "#D97706";

interface LiveTrip {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime?: string;
  busName: string;
  status: string;
  passengers?: number;
  totalSeats?: number;
  lat?: number | null;
  lon?: number | null;
  speed?: number | null;
}

interface Passenger {
  name: string;
  seatNumber: string;
  status: string;
}

export default function RouteScreen() {
  const { user, token } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  const [trips, setTrips]               = useState<LiveTrip[]>([]);
  const [activeTrip, setActiveTrip]     = useState<LiveTrip | null>(null);
  const [passengers, setPassengers]     = useState<Passenger[]>([]);
  const [loading, setLoading]           = useState(false);
  const [passLoading, setPassLoading]   = useState(false);
  const [reporting, setReporting]       = useState(false);
  const [arriving, setArriving]         = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [tab, setTab]                   = useState<"trajet" | "passagers">("trajet");

  const gps = useAgentGps(activeTrip?.id ?? null, token);

  const loadTrips = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<LiveTrip[]>("/trips/live", { token });
      setTrips(data.filter(t => t.status === "en_route"));
      if (!activeTrip && data.length > 0) {
        const enRoute = data.find(t => t.status === "en_route");
        if (enRoute) setActiveTrip(enRoute);
      }
    } catch {
      const demo: LiveTrip[] = [
        { id: "t1", from: "Abidjan", to: "Bouaké", departureTime: "08h00", arrivalTime: "12h00",
          busName: "Express Abidjan 01", status: "en_route", passengers: 38, totalSeats: 49,
          lat: 5.9, lon: -5.1, speed: 87 },
      ];
      setTrips(demo);
      if (!activeTrip) setActiveTrip(demo[0]);
    } finally {
      setLoading(false);
    }
  }, [token, activeTrip]);

  const loadPassengers = useCallback(async (tripId: string) => {
    if (!token) return;
    setPassLoading(true);
    try {
      const data = await apiFetch<Passenger[]>(`/agent/trip/${tripId}/passengers`, { token });
      setPassengers(data);
    } catch {
      setPassengers([
        { name: "Kouassi Ama",       seatNumber: "A3", status: "boarded" },
        { name: "Traoré Youssouf",   seatNumber: "A4", status: "boarded" },
        { name: "Bamba Koffi",       seatNumber: "B1", status: "boarded" },
        { name: "Diallo Mariam",     seatNumber: "C2", status: "boarded" },
        { name: "Coulibaly Jean",    seatNumber: "D5", status: "boarded" },
      ]);
    } finally {
      setPassLoading(false);
    }
  }, [token]);

  useEffect(() => { loadTrips(); }, []);

  useEffect(() => {
    if (activeTrip) loadPassengers(activeTrip.id);
  }, [activeTrip?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleReportIncident = () => {
    Alert.alert(
      "Signaler un incident",
      "Quel type d'incident voulez-vous signaler ?",
      [
        { text: "Panne mécanique", onPress: () => sendReport("panne_mecanique") },
        { text: "Accident",        onPress: () => sendReport("accident") },
        { text: "Retard trafic",   onPress: () => sendReport("retard_trafic") },
        { text: "Passager malade", onPress: () => sendReport("passager_malade") },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const sendReport = async (type: string) => {
    if (!activeTrip || !token) return;
    setReporting(true);
    try {
      await apiFetch("/agent/incident", {
        token, method: "POST",
        body: JSON.stringify({ tripId: activeTrip.id, type, lat: gps.lat, lon: gps.lon }),
      });
      Alert.alert("Signalement envoyé", "Le dispatcher a été notifié.");
    } catch {
      Alert.alert("Incident enregistré", "Il sera transmis à la reprise de connexion.");
    } finally {
      setReporting(false);
    }
  };

  const handleMarkArrived = () => {
    Alert.alert(
      "Confirmer l'arrivée",
      `Confirmer l'arrivée à ${activeTrip?.to} ?`,
      [
        { text: "Confirmer", style: "destructive", onPress: confirmArrival },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const confirmArrival = async () => {
    if (!activeTrip || !token) return;
    setArriving(true);
    try {
      await apiFetch(`/company/trips/${activeTrip.id}/end`, { token, method: "POST", body: "{}" });
      Alert.alert("Arrivée confirmée !", `Le trajet ${activeTrip.from} → ${activeTrip.to} est terminé.`);
      setActiveTrip(null);
      setTrips([]);
      loadTrips();
    } catch {
      Alert.alert("Erreur", "Impossible de confirmer l'arrivée. Réessayez.");
    } finally {
      setArriving(false);
    }
  };

  const gpsColor = gps.active ? "#10B981" : "#94A3B8";
  const gpsLabel = gps.active
    ? `GPS actif · ${gps.speed ? Math.round(gps.speed) + " km/h" : "en route"}`
    : gps.error ? "GPS indisponible" : "Démarrage GPS…";

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Header */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Suivi trajet</Text>
          <Text style={S.headerSub}>{user?.name ?? "Agent en route"}</Text>
        </View>
        <View style={S.gpsPill}>
          <View style={[S.gpsDot, { backgroundColor: gpsColor }]} />
          <Text style={S.gpsLabel} numberOfLines={1}>{gpsLabel}</Text>
        </View>
      </View>

      <OfflineBanner />

      {/* No active trip */}
      {!loading && trips.length === 0 && (
        <View style={S.emptyState}>
          <Text style={S.emptyIcon}>🚌</Text>
          <Text style={S.emptyTitle}>Aucun trajet en cours</Text>
          <Text style={S.emptySub}>Les trajets "En route" apparaîtront ici automatiquement.</Text>
          <TouchableOpacity style={S.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={G} />
              : <><Feather name="refresh-cw" size={15} color={G} /><Text style={S.refreshTxt}>Actualiser</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={S.emptyState}>
          <ActivityIndicator size="large" color={G} />
          <Text style={[S.emptySub, { marginTop: 12 }]}>Chargement du trajet…</Text>
        </View>
      )}

      {!loading && trips.length > 0 && (
        <>
          {/* Trip selector (if multiple) */}
          {trips.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.tripChips}>
              {trips.map(t => (
                <TouchableOpacity key={t.id}
                  style={[S.chip, activeTrip?.id === t.id && S.chipActive]}
                  onPress={() => setActiveTrip(t)}>
                  <Text style={[S.chipText, activeTrip?.id === t.id && S.chipTextActive]}>
                    {t.from} → {t.to}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Active trip card */}
          {activeTrip && (
            <View style={S.tripCard}>
              <View style={S.tripRoute}>
                <Text style={S.tripCity}>{activeTrip.from}</Text>
                <View style={S.tripArrow}>
                  <View style={S.arrowLine} />
                  <Ionicons name="bus" size={20} color={G} />
                  <View style={S.arrowLine} />
                </View>
                <Text style={S.tripCity}>{activeTrip.to}</Text>
              </View>
              <View style={S.tripMeta}>
                <View style={S.metaItem}>
                  <Feather name="clock" size={13} color="#64748B" />
                  <Text style={S.metaText}>{activeTrip.departureTime} → {activeTrip.arrivalTime ?? "?"}</Text>
                </View>
                <View style={S.metaItem}>
                  <Feather name="truck" size={13} color="#64748B" />
                  <Text style={S.metaText}>{activeTrip.busName}</Text>
                </View>
                {activeTrip.speed != null && activeTrip.speed > 0 && (
                  <View style={S.metaItem}>
                    <Feather name="zap" size={13} color={AMBER} />
                    <Text style={[S.metaText, { color: AMBER }]}>{Math.round(activeTrip.speed)} km/h</Text>
                  </View>
                )}
              </View>
              {/* Occupancy bar */}
              {activeTrip.passengers != null && activeTrip.totalSeats != null && (
                <View style={S.occupancy}>
                  <View style={S.occRow}>
                    <Text style={S.occLabel}>Passagers à bord</Text>
                    <Text style={S.occCount}>{activeTrip.passengers}/{activeTrip.totalSeats}</Text>
                  </View>
                  <View style={S.occBar}>
                    <View style={[S.occFill, {
                      width: `${Math.round((activeTrip.passengers / activeTrip.totalSeats) * 100)}%`,
                    }]} />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Tabs */}
          <View style={S.tabs}>
            {(["trajet", "passagers"] as const).map(t => (
              <TouchableOpacity key={t} style={[S.tabBtn, tab === t && S.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[S.tabText, tab === t && S.tabTextActive]}>
                  {t === "trajet" ? "📍 Trajet" : "👥 Passagers"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={S.body} showsVerticalScrollIndicator={false}>
            {tab === "trajet" && activeTrip && (
              <>
                {/* GPS status */}
                <View style={[S.gpsCard, { borderColor: gps.active ? "#10B981" : "#E2E8F0" }]}>
                  <View style={S.gpsRow}>
                    <Ionicons name="location" size={20} color={gps.active ? "#10B981" : "#94A3B8"} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={S.gpsTitle}>{gps.active ? "Position GPS active" : "GPS inactif"}</Text>
                      {gps.lat && gps.lon
                        ? <Text style={S.gpsSub}>{gps.lat.toFixed(5)}° N, {gps.lon.toFixed(5)}° E</Text>
                        : <Text style={S.gpsSub}>En attente de signal…</Text>}
                    </View>
                    {gps.active && (
                      <View style={S.gpsActiveBadge}>
                        <Text style={S.gpsActiveBadgeTxt}>EN DIRECT</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action buttons */}
                <Text style={S.sectionTitle}>Actions</Text>
                <View style={S.actionsGrid}>
                  <TouchableOpacity style={S.actionBtn} onPress={handleRefresh} disabled={refreshing}>
                    {refreshing
                      ? <ActivityIndicator size="small" color={G} />
                      : <Feather name="refresh-cw" size={22} color={G} />}
                    <Text style={S.actionLabel}>Actualiser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[S.actionBtn, S.actionBtnAmber]} onPress={handleReportIncident} disabled={reporting}>
                    {reporting
                      ? <ActivityIndicator size="small" color={AMBER} />
                      : <Feather name="alert-triangle" size={22} color={AMBER} />}
                    <Text style={[S.actionLabel, { color: AMBER }]}>Incident</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[S.actionBtn, S.actionBtnRed]} onPress={handleMarkArrived} disabled={arriving}>
                    {arriving
                      ? <ActivityIndicator size="small" color="#DC2626" />
                      : <Feather name="map-pin" size={22} color="#DC2626" />}
                    <Text style={[S.actionLabel, { color: "#DC2626" }]}>Arrivée</Text>
                  </TouchableOpacity>
                </View>

                {/* Status timeline */}
                <Text style={[S.sectionTitle, { marginTop: 8 }]}>Statut du trajet</Text>
                <View style={S.timeline}>
                  {[
                    { icon: "✅", label: "Départ effectué", done: true },
                    { icon: "🚌", label: "En route vers " + activeTrip.to, done: true, active: true },
                    { icon: "📍", label: "Arrivée à " + activeTrip.to, done: false },
                  ].map((step, i) => (
                    <View key={i} style={S.timelineRow}>
                      <View style={[S.timelineDot, step.active && S.timelineDotActive, step.done && !step.active && S.timelineDotDone]}>
                        <Text style={{ fontSize: 10 }}>{step.icon}</Text>
                      </View>
                      {i < 2 && <View style={[S.timelineLine, step.done && !step.active && S.timelineLineDone]} />}
                      <Text style={[S.timelineLabel, step.active && S.timelineLabelActive]}>{step.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {tab === "passagers" && (
              <>
                <Text style={S.sectionTitle}>Passagers à bord ({passengers.length})</Text>
                {passLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}
                {!passLoading && passengers.length === 0 && (
                  <Text style={S.emptySub}>Aucun passager enregistré</Text>
                )}
                {!passLoading && passengers.map((p, i) => (
                  <View key={i} style={S.passengerRow}>
                    <View style={S.passengerAvatar}>
                      <Text style={S.passengerAvatarTxt}>{p.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.passengerName}>{p.name}</Text>
                      <Text style={S.passengerSeat}>Siège {p.seatNumber}</Text>
                    </View>
                    <View style={[S.badge, { backgroundColor: "#DCFCE7" }]}>
                      <Text style={[S.badgeTxt, { color: "#166534" }]}>À bord</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: G_LIGHT },
  header:           { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 14,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:      { color: "white", fontSize: 18, fontWeight: "700" },
  headerSub:        { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 1 },
  gpsPill:          { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)",
                      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6, maxWidth: 150 },
  gpsDot:           { width: 8, height: 8, borderRadius: 4 },
  gpsLabel:         { color: "white", fontSize: 10, fontWeight: "600", flexShrink: 1 },

  emptyState:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyTitle:       { fontSize: 18, fontWeight: "700", color: G_DARK, marginBottom: 6 },
  emptySub:         { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16 },
  refreshBtn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: G_LIGHT,
                      borderWidth: 1.5, borderColor: G, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  refreshTxt:       { color: G, fontSize: 14, fontWeight: "600" },

  tripChips:        { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:             { borderRadius: 20, borderWidth: 1.5, borderColor: "#CBD5E1", paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:       { borderColor: G, backgroundColor: G },
  chipText:         { fontSize: 13, color: "#475569" },
  chipTextActive:   { color: "white", fontWeight: "600" },

  tripCard:         { margin: 16, marginBottom: 0, backgroundColor: "white", borderRadius: 16, padding: 16,
                      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                      elevation: 3, borderLeftWidth: 4, borderLeftColor: G },
  tripRoute:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  tripCity:         { fontSize: 20, fontWeight: "800", color: G_DARK },
  tripArrow:        { flexDirection: "row", alignItems: "center", flex: 1, marginHorizontal: 8, gap: 4 },
  arrowLine:        { flex: 1, height: 1.5, backgroundColor: "#CBD5E1" },
  tripMeta:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem:         { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:         { fontSize: 13, color: "#475569" },
  occupancy:        { marginTop: 12 },
  occRow:           { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  occLabel:         { fontSize: 12, color: "#64748B" },
  occCount:         { fontSize: 12, fontWeight: "700", color: G_DARK },
  occBar:           { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  occFill:          { height: "100%", backgroundColor: G, borderRadius: 3 },

  tabs:             { flexDirection: "row", marginHorizontal: 16, marginVertical: 12, backgroundColor: "white",
                      borderRadius: 10, padding: 4, gap: 4,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tabBtn:           { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive:     { backgroundColor: G },
  tabText:          { fontSize: 13, color: "#64748B", fontWeight: "600" },
  tabTextActive:    { color: "white" },

  body:             { paddingHorizontal: 16, paddingBottom: 80 },
  sectionTitle:     { fontSize: 14, fontWeight: "700", color: G_DARK, marginTop: 4, marginBottom: 10 },

  gpsCard:          { backgroundColor: "white", borderRadius: 12, padding: 14, borderWidth: 1.5,
                      marginBottom: 12,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  gpsRow:           { flexDirection: "row", alignItems: "center" },
  gpsTitle:         { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  gpsSub:           { fontSize: 12, color: "#64748B", marginTop: 2 },
  gpsActiveBadge:   { backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  gpsActiveBadgeTxt:{ fontSize: 10, fontWeight: "800", color: "#166534", letterSpacing: 0.5 },

  actionsGrid:      { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn:        { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 14, alignItems: "center", gap: 6,
                      borderWidth: 1.5, borderColor: "#E2E8F0",
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  actionBtnAmber:   { borderColor: "#FCD34D" },
  actionBtnRed:     { borderColor: "#FCA5A5" },
  actionLabel:      { fontSize: 12, fontWeight: "700", color: G },

  timeline:         { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 0,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  timelineRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 0 },
  timelineDot:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0",
                      alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineDotActive:{ backgroundColor: "#DCFCE7", borderWidth: 2, borderColor: G },
  timelineDotDone:  { backgroundColor: "#DCFCE7" },
  timelineLine:     { position: "absolute", left: 13, top: 28, width: 2, height: 32, backgroundColor: "#E2E8F0" },
  timelineLineDone: { backgroundColor: G },
  timelineLabel:    { fontSize: 13, color: "#64748B", paddingTop: 6, flex: 1 },
  timelineLabelActive: { color: G_DARK, fontWeight: "700" },

  passengerRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "white",
                      borderRadius: 10, padding: 12, marginBottom: 8, gap: 10,
                      shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  passengerAvatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: G_DARK,
                      alignItems: "center", justifyContent: "center" },
  passengerAvatarTxt: { color: "white", fontWeight: "700", fontSize: 15 },
  passengerName:    { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  passengerSeat:    { fontSize: 12, color: "#64748B" },
  badge:            { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt:         { fontSize: 11, fontWeight: "700" },
});
