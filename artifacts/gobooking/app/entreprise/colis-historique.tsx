import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Colors ─────────────────────────────────────────────────────── */
const AMBER      = "#D97706";
const AMBER_DARK = "#92400E";
const AMBER_BG   = "#FFFBEB";
const PRIMARY    = "#0B3C5D";

/* ─── Action config ─────────────────────────────────────────────── */
const ACTION_CONFIG: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  "créé":        { label: "Créé",          color: "#6366F1", icon: "plus-circle",   bg: "#EEF2FF" },
  "en_attente":  { label: "En attente",    color: "#6366F1", icon: "clock",         bg: "#EEF2FF" },
  "en_gare":     { label: "En gare",       color: "#0284C7", icon: "map-pin",       bg: "#E0F2FE" },
  "chargé_bus":  { label: "Chargé bus",    color: "#7C3AED", icon: "truck",         bg: "#F5F3FF" },
  "en_transit":  { label: "En transit",    color: "#D97706", icon: "navigation",    bg: "#FFFBEB" },
  "reçu":        { label: "Reçu",          color: "#059669", icon: "inbox",         bg: "#ECFDF5" },
  "arrivé":      { label: "Arrivé",        color: "#059669", icon: "check-circle",  bg: "#ECFDF5" },
  "livré":       { label: "Livré",         color: "#16A34A", icon: "package",       bg: "#F0FDF4" },
  "annulé":      { label: "Annulé",        color: "#DC2626", icon: "x-circle",      bg: "#FEF2F2" },
};

function getActionCfg(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, color: "#6b7280", icon: "activity", bg: "#F3F4F6" };
}

/* ─── Types ─────────────────────────────────────────────────────── */
interface ColisLog {
  id: string;
  colisId: string;
  trackingRef: string | null;
  action: string;
  agentId: string | null;
  agentName: string | null;
  companyId: string | null;
  notes: string | null;
  createdAt: string;
  /* enriched */
  senderName?: string;
  receiverName?: string;
  fromCity?: string;
  toCity?: string;
}

interface ApiResponse {
  logs: ColisLog[];
  total: number;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

/* ═══════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════ */
export default function ColisHistorique() {
  const { token } = useAuth();
  const insets    = useSafeAreaInsets();

  const [logs, setLogs]             = useState<ColisLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  /* ── Filters ── */
  const [searchRef, setSearchRef]   = useState("");
  const [dateFilter, setDateFilter] = useState("");

  /* ── Load ── */
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchRef.trim()) params.set("trackingRef", searchRef.trim().toUpperCase());
      if (dateFilter.trim()) params.set("date", dateFilter.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<ApiResponse>(`/company/colis-historique${qs}`, {
        token: token ?? undefined,
      });
      setLogs(data.logs);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, searchRef, dateFilter]);

  useEffect(() => { load(); }, [load]);

  /* ── Stats ── */
  const today = new Date().toLocaleDateString("fr-FR");
  const todayCount = logs.filter(l => fmtDate(l.createdAt) === today).length;
  const uniqueColis = new Set(logs.map(l => l.colisId)).size;

  /* ── Group by colisId for timeline ── */
  type GroupedEntry = { colisId: string; trackingRef: string; senderName: string; receiverName: string; route: string; logs: ColisLog[] };

  const grouped: GroupedEntry[] = (() => {
    const map = new Map<string, GroupedEntry>();
    for (const l of logs) {
      if (!map.has(l.colisId)) {
        map.set(l.colisId, {
          colisId: l.colisId,
          trackingRef: l.trackingRef || l.colisId.slice(-8),
          senderName: l.senderName || "—",
          receiverName: l.receiverName || "—",
          route: l.fromCity && l.toCity ? `${l.fromCity} → ${l.toCity}` : "—",
          logs: [],
        });
      }
      map.get(l.colisId)!.logs.push(l);
    }
    return Array.from(map.values());
  })();

  /* ── Render timeline item ── */
  const renderTimelineEvent = (log: ColisLog, idx: number, isLast: boolean) => {
    const cfg = getActionCfg(log.action);
    return (
      <View key={log.id} style={S.timelineRow}>
        {/* Line */}
        <View style={S.timelineLeft}>
          <View style={[S.dot, { backgroundColor: cfg.color }]}>
            <Feather name={cfg.icon as any} size={10} color="white" />
          </View>
          {!isLast && <View style={[S.line, { backgroundColor: cfg.color + "40" }]} />}
        </View>
        {/* Content */}
        <View style={[S.timelineCard, { borderLeftColor: cfg.color }]}>
          <View style={S.timelineHeader}>
            <View style={[S.actionBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[S.actionBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={S.timelineTime}>{fmtDate(log.createdAt)} {fmtTime(log.createdAt)}</Text>
          </View>
          {log.agentName && (
            <View style={S.agentRow}>
              <Feather name="user" size={11} color="#94a3b8" />
              <Text style={S.agentTxt}>{log.agentName}</Text>
            </View>
          )}
          {log.notes && <Text style={S.notesTxt}>{log.notes}</Text>}
        </View>
      </View>
    );
  };

  /* ── Render parcel group ── */
  const renderGroup = ({ item }: { item: GroupedEntry }) => {
    const lastLog = item.logs[item.logs.length - 1];
    const lastCfg = getActionCfg(lastLog?.action || "créé");
    return (
      <View style={S.groupCard}>
        {/* Group header */}
        <View style={S.groupHeader}>
          <View style={S.groupLeft}>
            <View style={[S.groupIcon, { backgroundColor: lastCfg.bg }]}>
              <Feather name="package" size={18} color={lastCfg.color} />
            </View>
            <View style={S.groupInfo}>
              <Text style={S.groupRef}>{item.trackingRef}</Text>
              <Text style={S.groupRoute} numberOfLines={1}>{item.route}</Text>
            </View>
          </View>
          <View style={[S.statusPill, { backgroundColor: lastCfg.bg }]}>
            <Feather name={lastCfg.icon as any} size={10} color={lastCfg.color} />
            <Text style={[S.statusPillTxt, { color: lastCfg.color }]}>{lastCfg.label}</Text>
          </View>
        </View>

        {/* People */}
        <View style={S.peopleRow}>
          <Feather name="user" size={11} color="#6b7280" />
          <Text style={S.peopleTxt}>{item.senderName}</Text>
          <Feather name="arrow-right" size={11} color="#d1d5db" />
          <Feather name="user-check" size={11} color="#6b7280" />
          <Text style={S.peopleTxt}>{item.receiverName}</Text>
        </View>

        {/* Timeline */}
        <View style={S.timeline}>
          {item.logs.map((l, idx) => renderTimelineEvent(l, idx, idx === item.logs.length - 1))}
        </View>
      </View>
    );
  };

  /* ─── Main render ─────────────────────────────────────────────── */
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={S.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={S.headerText}>
          <Text style={S.headerTitle}>Historique des colis</Text>
          <Text style={S.headerSub}>Traçabilité complète</Text>
        </View>
        <Pressable onPress={() => load(true)} style={S.refreshBtn}>
          <Feather name="refresh-cw" size={18} color="white" />
        </Pressable>
      </View>

      {/* ── Stats strip ── */}
      <View style={S.stats}>
        <View style={S.statBox}>
          <Text style={S.statNum}>{logs.length}</Text>
          <Text style={S.statLbl}>Événements</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>{uniqueColis}</Text>
          <Text style={S.statLbl}>Colis</Text>
        </View>
        <View style={S.statDivider} />
        <View style={S.statBox}>
          <Text style={S.statNum}>{todayCount}</Text>
          <Text style={S.statLbl}>Aujourd'hui</Text>
        </View>
      </View>

      {/* ── Filters ── */}
      <View style={S.filters}>
        <View style={S.searchRow}>
          <View style={S.searchBox}>
            <Feather name="search" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={S.searchInput}
              placeholder="N° de suivi (GBX-XXXX-XXXX)"
              placeholderTextColor="#94a3b8"
              value={searchRef}
              onChangeText={setSearchRef}
              onSubmitEditing={() => load()}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {searchRef.length > 0 && (
              <Pressable onPress={() => { setSearchRef(""); }}>
                <Feather name="x" size={15} color="#94a3b8" />
              </Pressable>
            )}
          </View>
          <View style={S.searchBox}>
            <Feather name="calendar" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={S.searchInput}
              placeholder="Date (AAAA-MM-JJ)"
              placeholderTextColor="#94a3b8"
              value={dateFilter}
              onChangeText={setDateFilter}
              onSubmitEditing={() => load()}
              returnKeyType="search"
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
            />
            {dateFilter.length > 0 && (
              <Pressable onPress={() => { setDateFilter(""); }}>
                <Feather name="x" size={15} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>
        {(searchRef || dateFilter) && (
          <Pressable style={S.applyBtn} onPress={() => load()}>
            <Feather name="filter" size={14} color="white" />
            <Text style={S.applyBtnTxt}>Filtrer</Text>
          </Pressable>
        )}
      </View>

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
          data={grouped}
          keyExtractor={item => item.colisId}
          renderItem={renderGroup}
          ListEmptyComponent={
            <View style={S.empty}>
              <View style={S.emptyIcon}>
                <Feather name="package" size={36} color="#d1d5db" />
              </View>
              <Text style={S.emptyTitle}>Aucun historique</Text>
              <Text style={S.emptySub}>
                Les événements de colis apparaîtront ici dès la première action.
              </Text>
            </View>
          }
          contentContainerStyle={[
            S.list,
            grouped.length === 0 && { flex: 1 },
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
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 12 },
  statNum:     { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  statLbl:     { fontSize: 10, fontFamily: "Inter_500Medium", color: "#94a3b8",
                 textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F1F5F9", marginVertical: 8 },

  /* Filters */
  filters:   { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", padding: 12, gap: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0",
    paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#111827" },
  applyBtn:    {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: AMBER, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: "flex-start",
  },
  applyBtnTxt: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 13 },

  /* List */
  list: { paddingHorizontal: 16, paddingTop: 14 },

  /* Group card */
  groupCard: {
    backgroundColor: "white", borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: "#F1F5F9",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  groupHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#F8FAFC",
  },
  groupLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  groupIcon: { width: 42, height: 42, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  groupInfo: { flex: 1 },
  groupRef:  { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  groupRoute: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280", marginTop: 1 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusPillTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  /* People */
  peopleRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "#FAFAFA", borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  peopleTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#374151" },

  /* Timeline */
  timeline: { padding: 14, gap: 0 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timelineLeft: { alignItems: "center", width: 24 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    zIndex: 1,
  },
  line: { flex: 1, width: 2, marginTop: 2, marginBottom: -2, marginLeft: 11 },
  timelineCard: {
    flex: 1, backgroundColor: "#FAFAFA", borderRadius: 10,
    padding: 10, marginBottom: 10,
    borderLeftWidth: 3,
  },
  timelineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 },
  actionBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  actionBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  timelineTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  agentTxt: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6b7280" },
  notesTxt: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 4, fontStyle: "italic" },

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
