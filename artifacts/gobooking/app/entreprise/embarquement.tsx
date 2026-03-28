import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Colors ─────────────────────────────────────────────────────── */
const AMBER      = "#D97706";
const AMBER_DARK = "#92400E";
const AMBER_BG   = "#FFFBEB";
const AMBER_MID  = "#F59E0B";
const PRIMARY    = "#0B3C5D";
const GREEN      = "#059669";
const GREEN_BG   = "#ECFDF5";

/* ─── Types ─────────────────────────────────────────────────────── */
interface TripFilter {
  id: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
}

interface BoardingLog {
  id: string;
  ref: string;
  bookingId: string;
  agentId: string;
  agentName: string;
  tripId: string | null;
  passengerName: string;
  seats: string;
  route: string;
  tripDate: string;
  departureTime: string;
  busName: string;
  validatedAt: string;
}

/* ─── Helper ─────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso || "—"; }
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

/* ═══════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════ */
export default function Embarquement() {
  const { token }    = useAuth();
  const insets       = useSafeAreaInsets();

  const [logs, setLogs]       = useState<BoardingLog[]>([]);
  const [trips, setTrips]     = useState<TripFilter[]>([]);
  const [tripId, setTripId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  /* ── Load data ── */
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const url = tripId
        ? `/company/boarding-logs?tripId=${encodeURIComponent(tripId)}`
        : "/company/boarding-logs";
      const data = await apiFetch<{ logs: BoardingLog[]; trips: TripFilter[]; total: number }>(url, {
        token: token ?? undefined,
      });
      setLogs(data.logs);
      setTrips(data.trips);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tripId]);

  useEffect(() => { load(); }, [load]);

  /* ── Stats ── */
  const today = new Date().toLocaleDateString("fr-FR");
  const todayCount = logs.filter(l => fmtDate(l.validatedAt) === today).length;

  /* ─── Row ─────────────────────────────────────────────────────── */
  const renderLog = ({ item, index }: { item: BoardingLog; index: number }) => (
    <View style={[S.logCard, index === 0 && { marginTop: 0 }]}>
      {/* Avatar + name */}
      <View style={S.logLeft}>
        <View style={S.avatar}>
          <Text style={S.avatarText}>{initials(item.passengerName)}</Text>
        </View>
        <View style={S.logInfo}>
          <Text style={S.logName} numberOfLines={1}>{item.passengerName}</Text>
          <View style={S.logMeta}>
            <Feather name="grid" size={11} color="#6b7280" />
            <Text style={S.logMetaTxt}>Siège {item.seats}</Text>
            <Text style={S.dot}>·</Text>
            <Text style={S.logRef}>#{item.ref}</Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={S.logDivider} />

      {/* Route + details */}
      <View style={S.logBottom}>
        <View style={S.logDetail}>
          <Feather name="map-pin" size={12} color={AMBER} />
          <Text style={S.logDetailTxt} numberOfLines={1}>{item.route}</Text>
        </View>
        <View style={S.logDetail}>
          <Feather name="clock" size={12} color="#6b7280" />
          <Text style={S.logDetailTxt}>{fmtTime(item.validatedAt)}</Text>
        </View>
        <View style={S.logDetail}>
          <Feather name="user-check" size={12} color={GREEN} />
          <Text style={S.logDetailTxt} numberOfLines={1}>{item.agentName}</Text>
        </View>
      </View>

      {/* Validated badge */}
      <View style={S.validBadge}>
        <Feather name="check" size={10} color={GREEN} />
        <Text style={S.validBadgeTxt}>Embarqué</Text>
      </View>
    </View>
  );

  /* ─── Empty ───────────────────────────────────────────────────── */
  const ListEmpty = () => (
    <View style={S.empty}>
      <View style={S.emptyIcon}>
        <Feather name="users" size={36} color="#d1d5db" />
      </View>
      <Text style={S.emptyTitle}>Aucun embarquement</Text>
      <Text style={S.emptySub}>
        {tripId
          ? "Aucun passager validé pour ce trajet."
          : "L'historique d'embarquement apparaîtra ici après les premiers scans."}
      </Text>
    </View>
  );

  /* ─── Main render ─────────────────────────────────────────────── */
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={S.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={S.headerText}>
          <Text style={S.headerTitle}>Historique d'embarquement</Text>
          <Text style={S.headerSub}>Passagers validés par scan QR</Text>
        </View>
        <Pressable onPress={() => load(true)} style={S.refreshBtn}>
          <Feather name="refresh-cw" size={18} color="white" />
        </Pressable>
      </View>

      {/* ── Stats strip ── */}
      <View style={S.stats}>
        <View style={S.statBox}>
          <Text style={S.statNum}>{logs.length}</Text>
          <Text style={S.statLbl}>Total</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>{todayCount}</Text>
          <Text style={S.statLbl}>Aujourd'hui</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>{trips.length}</Text>
          <Text style={S.statLbl}>Trajets</Text>
        </View>
      </View>

      {/* ── Trip filter chips ── */}
      {trips.length > 0 && (
        <View style={S.filterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterRow}
          >
            {/* All chip */}
            <Pressable
              style={[S.chip, !tripId && S.chipActive]}
              onPress={() => setTripId(null)}
            >
              <Text style={[S.chipTxt, !tripId && S.chipTxtActive]}>Tous les trajets</Text>
            </Pressable>

            {trips.map(t => (
              <Pressable
                key={t.id}
                style={[S.chip, tripId === t.id && S.chipActive]}
                onPress={() => setTripId(t.id)}
              >
                <Text style={[S.chipTxt, tripId === t.id && S.chipTxtActive]} numberOfLines={1}>
                  {t.from} → {t.to}
                </Text>
                <Text style={[S.chipDate, tripId === t.id && S.chipDateActive]}>
                  {t.date} {t.departureTime}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Content ── */}
      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={S.loadingTxt}>Chargement de l'historique…</Text>
        </View>
      ) : error ? (
        <View style={S.center}>
          <Feather name="alert-circle" size={36} color="#ef4444" />
          <Text style={S.errorTxt}>{error}</Text>
          <Pressable onPress={() => load()} style={S.retryBtn}>
            <Text style={S.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          ListEmptyComponent={<ListEmpty />}
          contentContainerStyle={[
            S.list,
            logs.length === 0 && { flex: 1 },
            { paddingBottom: insets.bottom + 20 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={AMBER}
              colors={[AMBER]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },

  /* Header */
  header: {
    backgroundColor: AMBER,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },

  /* Stats */
  stats: {
    flexDirection: "row", backgroundColor: "white",
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 14 },
  statNum:     { fontSize: 22, fontFamily: "Inter_700Bold", color: PRIMARY },
  statLbl:     { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94a3b8",
                 textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },

  /* Filter */
  filterWrap: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  filterRow:  { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0",
    alignItems: "center",
  },
  chipActive:    { backgroundColor: AMBER_BG, borderColor: AMBER },
  chipTxt:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  chipTxtActive: { color: AMBER_DARK },
  chipDate:      { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 1 },
  chipDateActive: { color: "#B45309" },

  /* List */
  list: { paddingHorizontal: 16, paddingTop: 14 },

  /* Log card */
  logCard: {
    backgroundColor: "white", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#F1F5F9",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    position: "relative",
  },
  logLeft: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: AMBER_BG, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#FDE68A",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: AMBER_DARK },
  logInfo:    { flex: 1 },
  logName:    { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  logMeta:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  logMetaTxt: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280" },
  dot:        { color: "#d1d5db", fontSize: 12 },
  logRef:     { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94a3b8" },

  logDivider: { height: 1, backgroundColor: "#F8FAFC", marginBottom: 10 },

  logBottom:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  logDetail:  { flexDirection: "row", alignItems: "center", gap: 4 },
  logDetailTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#374151", maxWidth: 140 },

  /* Validated badge */
  validBadge: {
    position: "absolute", top: 14, right: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: GREEN_BG, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  validBadgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: GREEN },

  /* Empty */
  empty:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3F4F6",
                justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 6 },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9ca3af",
                textAlign: "center", lineHeight: 21 },

  /* Loading / error */
  loadingTxt: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6b7280" },
  errorTxt:   { fontSize: 14, fontFamily: "Inter_500Medium", color: "#ef4444", textAlign: "center" },
  retryBtn:   { backgroundColor: AMBER, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt:   { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
