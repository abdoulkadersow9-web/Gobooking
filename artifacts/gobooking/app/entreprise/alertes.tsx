import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
type AlertType   = "urgence" | "panne" | "controle" | "sos";
type AlertStatus = "active" | "resolved";

interface CompanyAlert {
  id: string;
  type: AlertType;
  status: AlertStatus;
  agentName: string | null;
  busName: string | null;
  tripId: string | null;
  lat: number | null;
  lon: number | null;
  message: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

/* ─── Config ─────────────────────────────────────────────────────────── */
const ALERT_CFG: Record<AlertType, { label: string; icon: string; bg: string; light: string; text: string }> = {
  urgence:  { label: "URGENCE",  icon: "alert-octagon", bg: "#EF4444", light: "#FEE2E2", text: "#DC2626" },
  panne:    { label: "PANNE",    icon: "tool",          bg: "#F59E0B", light: "#FEF3C7", text: "#D97706" },
  controle: { label: "CONTRÔLE", icon: "shield",        bg: "#3B82F6", light: "#EFF6FF", text: "#2563EB" },
  sos:      { label: "SOS",      icon: "life-buoy",     bg: "#7C3AED", light: "#F5F3FF", text: "#6D28D9" },
};

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  return `il y a ${Math.floor(s / 3600)}h`;
}

/* ─── Alert Card ─────────────────────────────────────────────────────── */
function AlertCard({ alert, onResolve }: { alert: CompanyAlert; onResolve: (id: string) => void }) {
  const cfg      = ALERT_CFG[alert.type] ?? ALERT_CFG.urgence;
  const isActive = alert.status === "active";

  return (
    <View style={[styles.card, isActive && styles.cardActive, { borderLeftColor: cfg.bg }]}>
      {/* Pulsing active indicator */}
      {isActive && <View style={[styles.activeDot, { backgroundColor: cfg.bg }]} />}

      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={13} color="#fff" />
          <Text style={styles.typeBadgeText}>{cfg.label}</Text>
        </View>
        <Text style={styles.timeText}>{timeAgo(alert.createdAt)}</Text>
      </View>

      {/* Details */}
      <View style={styles.cardBody}>
        {alert.agentName && (
          <View style={styles.detailRow}>
            <Feather name="user" size={13} color="#64748B" />
            <Text style={styles.detailText}>{alert.agentName}</Text>
          </View>
        )}
        {alert.busName && (
          <View style={styles.detailRow}>
            <Feather name="truck" size={13} color="#64748B" />
            <Text style={styles.detailText}>{alert.busName}</Text>
          </View>
        )}
        {alert.lat != null && alert.lon != null && (
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={13} color="#64748B" />
            <Text style={[styles.detailText, { fontFamily: "monospace" }]}>
              {alert.lat.toFixed(4)}, {alert.lon.toFixed(4)}
            </Text>
          </View>
        )}
        {alert.message && (
          <View style={[styles.msgBox, { backgroundColor: cfg.light }]}>
            <Text style={[styles.msgText, { color: cfg.text }]}>"{alert.message}"</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        {isActive ? (
          <>
            <View style={styles.activeChip}>
              <View style={[styles.activeDotSmall, { backgroundColor: cfg.bg }]} />
              <Text style={[styles.statusText, { color: cfg.text }]}>En cours</Text>
            </View>
            <Pressable
              style={[styles.resolveBtn, { backgroundColor: cfg.bg }]}
              onPress={() => onResolve(alert.id)}
            >
              <Feather name="check" size={13} color="#fff" />
              <Text style={styles.resolveBtnText}>Résoudre</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.resolvedText}>
            ✓ Résolue {alert.resolvedAt ? timeAgo(alert.resolvedAt) : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function AlertesScreen() {
  const { token }  = useAuth();
  const insets     = useSafeAreaInsets();

  const [alerts,     setAlerts]     = useState<CompanyAlert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<"all" | "active" | "resolved">("active");
  const [resolving,  setResolving]  = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const qs = filter !== "all" ? `?status=${filter}` : "";
      const data = await apiFetch<CompanyAlert[]>(`/company/alerts${qs}`, { token: token ?? undefined });
      setAlerts(data ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter]);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
    const id = setInterval(fetchAlerts, 10_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const handleResolve = useCallback(async (alertId: string) => {
    setResolving(alertId);
    try {
      await apiFetch(`/company/alerts/${alertId}/resolve`, { method: "PATCH", token: token ?? undefined });
      fetchAlerts();
    } catch { /* silent */ } finally {
      setResolving(null);
    }
  }, [token, fetchAlerts]);

  /* Counts */
  const activeCount = alerts.filter(a => a.status === "active").length;

  /* Filter tabs */
  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "active",   label: `Actives${activeCount > 0 ? ` (${activeCount})` : ""}` },
    { key: "all",      label: "Toutes" },
    { key: "resolved", label: "Résolues" },
  ];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Alertes Sécurité</Text>
          {activeCount > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => { setRefreshing(true); fetchAlerts(); }} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-circle" size={48} color="#D1FAE5" />
          <Text style={styles.emptyTitle}>Aucune alerte</Text>
          <Text style={styles.emptySubtitle}>
            {filter === "active" ? "Tous les bus fonctionnent normalement" : "Aucune alerte trouvée"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onResolve={handleResolve}
            />
          )}
          contentContainerStyle={{ padding: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAlerts(); }}
              tintColor="#EF4444"
            />
          }
        />
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F1F5F9" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },

  header:         { backgroundColor: "#0B3C5D", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14 },
  backBtn:        { padding: 4 },
  headerCenter:   { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, gap: 8 },
  headerTitle:    { color: "#fff", fontSize: 18, fontWeight: "700" },
  alertBadge:     { backgroundColor: "#EF4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  alertBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  refreshBtn:     { padding: 4 },

  filterRow:      { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterTab:      { flex: 1, paddingVertical: 12, alignItems: "center" },
  filterTabActive:{ borderBottomWidth: 2, borderBottomColor: "#EF4444" },
  filterText:     { fontSize: 13, color: "#64748B", fontWeight: "500" },
  filterTextActive:{ color: "#EF4444", fontWeight: "700" },

  emptyTitle:     { fontSize: 16, fontWeight: "600", color: "#94A3B8" },
  emptySubtitle:  { fontSize: 13, color: "#CBD5E1", textAlign: "center" },

  card:           { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardActive:     { shadowOpacity: 0.12, elevation: 4 },
  activeDot:      { position: "absolute", top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },

  cardHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingBottom: 6 },
  typeBadge:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  timeText:       { fontSize: 12, color: "#94A3B8" },

  cardBody:       { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  detailRow:      { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText:     { fontSize: 13, color: "#374151" },
  msgBox:         { borderRadius: 8, padding: 10, marginTop: 4 },
  msgText:        { fontSize: 13, fontStyle: "italic" },

  cardFooter:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  activeChip:     { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDotSmall: { width: 8, height: 8, borderRadius: 4 },
  statusText:     { fontSize: 12, fontWeight: "600" },
  resolveBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  resolveBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  resolvedText:   { color: "#059669", fontSize: 12, fontWeight: "500" },
});
