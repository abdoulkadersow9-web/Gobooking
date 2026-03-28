import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const IS_WEB = Platform.OS === "web";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MapNative = IS_WEB ? null : (() => { try { return require("react-native-maps"); } catch { return null; } })();
const MapView = MapNative?.default ?? View;
const Marker = MapNative?.Marker ?? View;
const Polyline = MapNative?.Polyline ?? View;
const PROVIDER_DEFAULT = MapNative?.PROVIDER_DEFAULT ?? null;
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface BusGps {
  lat: number;
  lon: number;
  speed: number | null;
  heading: number | null;
}

interface LiveBus {
  tripId: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  busName: string;
  busPlate: string | null;
  busType: string | null;
  gps: BusGps | null;
  lastUpdated: number | null;
  isOffline: boolean;
  isStopped: boolean;
}

interface HistoryPoint {
  lat: number;
  lon: number;
  speed: number | null;
  recordedAt: string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
const ABIDJAN = { latitude: 5.3599, longitude: -4.0083, latitudeDelta: 4.5, longitudeDelta: 4.5 };

function busColor(bus: LiveBus): string {
  if (bus.isOffline) return "#EF4444";
  if (bus.isStopped) return "#F59E0B";
  return "#10B981";
}

function busStatusLabel(bus: LiveBus): string {
  if (bus.isOffline) return "Hors ligne";
  if (bus.isStopped) return "Arrêté";
  return "En route";
}

function secondsAgo(ts: number | null): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `il y a ${s}s`;
  return `il y a ${Math.floor(s / 60)}min`;
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function LiveTrackingScreen() {
  const { token } = useAuth();
  const insets    = useSafeAreaInsets();
  const mapRef    = useRef<any>(null);

  const [buses,      setBuses]      = useState<LiveBus[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [history,    setHistory]    = useState<HistoryPoint[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Fetch live buses ── */
  const fetchBuses = useCallback(async () => {
    try {
      const data = await apiFetch<LiveBus[]>("/company/live-buses", { token: token ?? undefined });
      setBuses(data ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  /* ── Poll every 5 s ── */
  useEffect(() => {
    fetchBuses();
    const id = setInterval(fetchBuses, 5_000);
    return () => clearInterval(id);
  }, [fetchBuses]);

  /* ── Fetch GPS history for selected bus ── */
  const fetchHistory = useCallback(async (tripId: string) => {
    try {
      const data = await apiFetch<HistoryPoint[]>(`/company/trip/${tripId}/history`, { token: token ?? undefined });
      setHistory(data ?? []);
    } catch {
      setHistory([]);
    }
  }, [token]);

  const selectBus = useCallback((tripId: string) => {
    if (selected === tripId) {
      setSelected(null);
      setHistory([]);
      return;
    }
    setSelected(tripId);
    fetchHistory(tripId);
    const bus = buses.find(b => b.tripId === tripId);
    if (bus?.gps && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: bus.gps.lat,
        longitude: bus.gps.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }, 600);
    }
  }, [selected, buses, fetchHistory]);

  /* ── Counts ── */
  const onlineCount  = buses.filter(b => !b.isOffline).length;
  const stoppedCount = buses.filter(b => b.isStopped && !b.isOffline).length;
  const offlineCount = buses.filter(b => b.isOffline).length;

  /* ── Header ── */
  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.headerTitle}>Suivi en temps réel</Text>
      <Pressable onPress={() => { setRefreshing(true); fetchBuses(); }} style={styles.refreshBtn}>
        <Feather name="refresh-cw" size={18} color="#fff" />
      </Pressable>
    </View>
  );

  /* ── Stats bar ── */
  const StatsBar = (
    <View style={styles.statsBar}>
      <View style={[styles.statChip, { backgroundColor: "#D1FAE5" }]}>
        <Feather name="wifi" size={13} color="#059669" />
        <Text style={[styles.statChipText, { color: "#059669" }]}>{onlineCount} en route</Text>
      </View>
      <View style={[styles.statChip, { backgroundColor: "#FEF3C7" }]}>
        <Feather name="alert-triangle" size={13} color="#D97706" />
        <Text style={[styles.statChipText, { color: "#D97706" }]}>{stoppedCount} arrêté{stoppedCount > 1 ? "s" : ""}</Text>
      </View>
      <View style={[styles.statChip, { backgroundColor: "#FEE2E2" }]}>
        <Feather name="wifi-off" size={13} color="#EF4444" />
        <Text style={[styles.statChipText, { color: "#EF4444" }]}>{offlineCount} hors ligne</Text>
      </View>
    </View>
  );

  /* ── Map markers ── */
  const busesWithGps = buses.filter(b => b.gps);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {Header}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D97706" />
          <Text style={styles.loadingText}>Chargement des positions...</Text>
        </View>
      ) : (
        <>
          {/* ── Map ── */}
          {IS_WEB ? (
            <View style={[styles.map, { justifyContent: "center", alignItems: "center", backgroundColor: "#E8F4FD" }]}>
              <Feather name="map" size={48} color="#94A3B8" />
              <Text style={{ color: "#64748B", fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10, textAlign: "center", paddingHorizontal: 20 }}>
                Carte disponible uniquement sur l'application mobile
              </Text>
              <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>
                {busesWithGps.length} bus en circulation
              </Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={ABIDJAN}
              showsUserLocation={false}
              showsCompass
            >
              {selected && history.length > 1 && (
                <Polyline
                  coordinates={history.map(h => ({ latitude: h.lat, longitude: h.lon }))}
                  strokeColor="#0B3C5D"
                  strokeWidth={2}
                  lineDashPattern={[4, 3]}
                />
              )}
              {busesWithGps.map(bus => (
                <Marker
                  key={bus.tripId}
                  coordinate={{ latitude: bus.gps!.lat, longitude: bus.gps!.lon }}
                  onPress={() => selectBus(bus.tripId)}
                >
                  <View style={[styles.markerContainer, { borderColor: busColor(bus) }]}>
                    <View style={[styles.markerDot, { backgroundColor: busColor(bus) }]}>
                      <Feather name="truck" size={12} color="#fff" />
                    </View>
                    <View style={[styles.markerLabel, { backgroundColor: busColor(bus) }]}>
                      <Text style={styles.markerName} numberOfLines={1}>
                        {bus.busName.length > 10 ? bus.busName.slice(0, 10) + "…" : bus.busName}
                      </Text>
                    </View>
                  </View>
                </Marker>
              ))}
            </MapView>
          )}

          {/* ── Stats bar ── */}
          {StatsBar}

          {/* ── Bus list ── */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>
              {buses.length === 0 ? "Aucun bus en route actuellement" : `${buses.length} bus actif${buses.length > 1 ? "s" : ""}`}
            </Text>

            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBuses(); }} tintColor="#D97706" />}
              showsVerticalScrollIndicator={false}
            >
              {buses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="map" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyText}>Aucun bus n&apos;est actuellement en route</Text>
                  <Text style={styles.emptySubtext}>Les bus apparaîtront ici dès qu&apos;un agent démarrera un trajet</Text>
                </View>
              ) : (
                buses.map(bus => (
                  <Pressable
                    key={bus.tripId}
                    style={[
                      styles.busCard,
                      selected === bus.tripId && styles.busCardSelected,
                      bus.isOffline && styles.busCardOffline,
                      bus.isStopped && !bus.isOffline && styles.busCardStopped,
                    ]}
                    onPress={() => selectBus(bus.tripId)}
                  >
                    {/* Status stripe */}
                    <View style={[styles.statusStripe, { backgroundColor: busColor(bus) }]} />

                    <View style={styles.busCardContent}>
                      <View style={styles.busCardRow}>
                        {/* Bus icon */}
                        <View style={[styles.busIconBadge, { backgroundColor: busColor(bus) + "22" }]}>
                          <Feather name="truck" size={18} color={busColor(bus)} />
                        </View>

                        <View style={styles.busInfo}>
                          <Text style={styles.busName}>{bus.busName}</Text>
                          <Text style={styles.busRoute}>
                            {bus.from} → {bus.to}
                          </Text>
                          {bus.busPlate && (
                            <Text style={styles.busPlate}>{bus.busPlate}</Text>
                          )}
                        </View>

                        <View style={styles.busRight}>
                          {/* Status badge */}
                          <View style={[styles.statusBadge, { backgroundColor: busColor(bus) + "22" }]}>
                            <View style={[styles.statusDot, { backgroundColor: busColor(bus) }]} />
                            <Text style={[styles.statusText, { color: busColor(bus) }]}>
                              {busStatusLabel(bus)}
                            </Text>
                          </View>
                          {/* Speed */}
                          {bus.gps?.speed != null && (
                            <Text style={styles.speedText}>
                              {Math.round(bus.gps.speed)} km/h
                            </Text>
                          )}
                          <Text style={styles.lastSeenText}>
                            {secondsAgo(bus.lastUpdated)}
                          </Text>
                        </View>
                      </View>

                      {/* Alert banner */}
                      {(bus.isOffline || bus.isStopped) && (
                        <View style={[styles.alertBanner, { backgroundColor: busColor(bus) + "18" }]}>
                          <Feather
                            name={bus.isOffline ? "wifi-off" : "alert-triangle"}
                            size={13}
                            color={busColor(bus)}
                          />
                          <Text style={[styles.alertText, { color: busColor(bus) }]}>
                            {bus.isOffline
                              ? "GPS inactif — plus de signal depuis +30s"
                              : "Bus immobile — pas de mouvement détecté"}
                          </Text>
                        </View>
                      )}

                      {/* GPS coords (only when selected) */}
                      {selected === bus.tripId && bus.gps && (
                        <View style={styles.gpsRow}>
                          <Feather name="map-pin" size={12} color="#64748B" />
                          <Text style={styles.gpsText}>
                            {bus.gps.lat.toFixed(4)}, {bus.gps.lon.toFixed(4)}
                          </Text>
                          {bus.gps.heading != null && (
                            <Text style={styles.gpsText}>  Cap: {Math.round(bus.gps.heading)}°</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#F1F5F9" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:     { color: "#64748B", fontSize: 14 },

  /* Header */
  header:          { backgroundColor: "#0B3C5D", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  backBtn:         { padding: 4 },
  headerTitle:     { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700" },
  refreshBtn:      { padding: 4 },

  /* Map */
  map:             { height: 280 },

  /* Stats bar */
  statsBar:        { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  statChip:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statChipText:    { fontSize: 12, fontWeight: "600" },

  /* Bus list */
  listContainer:   { flex: 1, backgroundColor: "#F1F5F9" },
  listTitle:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, fontSize: 13, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 },

  /* Empty */
  emptyState:      { alignItems: "center", paddingTop: 48, gap: 10 },
  emptyText:       { fontSize: 15, fontWeight: "600", color: "#94A3B8" },
  emptySubtext:    { fontSize: 13, color: "#CBD5E1", textAlign: "center", paddingHorizontal: 32 },

  /* Bus card */
  busCard:         { marginHorizontal: 12, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, flexDirection: "row" },
  busCardSelected: { shadowOpacity: 0.14, shadowRadius: 8, elevation: 4, borderWidth: 1.5, borderColor: "#0B3C5D" },
  busCardOffline:  { opacity: 0.88 },
  busCardStopped:  {},
  statusStripe:    { width: 4 },
  busCardContent:  { flex: 1, padding: 12 },
  busCardRow:      { flexDirection: "row", alignItems: "center", gap: 10 },

  /* Bus icon */
  busIconBadge:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  /* Bus info */
  busInfo:         { flex: 1 },
  busName:         { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  busRoute:        { fontSize: 13, color: "#475569", marginTop: 2 },
  busPlate:        { fontSize: 11, color: "#94A3B8", marginTop: 2, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  /* Bus right */
  busRight:        { alignItems: "flex-end", gap: 3 },
  statusBadge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusText:      { fontSize: 11, fontWeight: "600" },
  speedText:       { fontSize: 12, fontWeight: "700", color: "#334155" },
  lastSeenText:    { fontSize: 10, color: "#94A3B8" },

  /* Alert */
  alertBanner:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  alertText:       { fontSize: 12, fontWeight: "500", flex: 1 },

  /* GPS row */
  gpsRow:          { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  gpsText:         { fontSize: 11, color: "#64748B", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  /* Map markers */
  markerContainer: { alignItems: "center" },
  markerDot:       { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  markerLabel:     { marginTop: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  markerName:      { fontSize: 9, color: "#fff", fontWeight: "700" },
});
