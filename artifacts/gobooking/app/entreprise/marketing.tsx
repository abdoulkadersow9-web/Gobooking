import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Pressable, FlatList, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiFetch } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ──────────────────────────────────────────────────── */
interface MarketingLog {
  id: string; campaign: string; channel: string;
  userId?: string; phone?: string; message: string;
  status: string; refId?: string; createdAt: string;
}
interface MarketingStats {
  total: number; sent: number;
  byCampaign: Record<string, number>;
}
interface MarketingData { logs: MarketingLog[]; stats: MarketingStats }

/* ─── Campaign config ────────────────────────────────────────── */
const CAMPAIGNS: Record<string, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  reengagement:   { label: "Ré-engagement",   icon: "refresh-cw",    color: "#7C3AED", bg: "#F5F3FF", desc: "Clients inactifs > 7 jours" },
  post_trip:      { label: "Post-voyage",      icon: "check-circle",  color: "#059669", bg: "#ECFDF5", desc: "Remerciements après voyage" },
  low_occupancy:  { label: "Promo bus vide",   icon: "trending-up",   color: "#D97706", bg: "#FFFBEB", desc: "Occupancy < 50%" },
  birthday:       { label: "Anniversaires",    icon: "gift",          color: "#DB2777", bg: "#FDF2F8", desc: "Message d'anniversaire" },
  parcel_arrived: { label: "Colis arrivé",     icon: "package",       color: "#0369A1", bg: "#E0F2FE", desc: "Notification destinataire" },
};

const ALL_CAMPAIGNS = ["all", ...Object.keys(CAMPAIGNS)];

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

/* ─── Main ─────────────────────────────────────────────────────── */
export default function MarketingScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [data, setData]       = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<MarketingData>("/company/marketing/logs", { token: token ?? undefined });
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, []);

  const filtered = data?.logs.filter(l => filter === "all" || l.campaign === filter) ?? [];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard" as never)} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Feather name="zap" size={20} color="white" />
          <Text style={styles.headerTitle}>Marketing Auto</Text>
        </View>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="white" />
        </Pressable>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : !data ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={36} color="#CBD5E1" />
          <Text style={styles.errText}>Impossible de charger les données</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* KPI Strip */}
          <View style={styles.kpiStrip}>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#7C3AED" }]}>{data.stats.total}</Text>
              <Text style={styles.kpiLabel}>Total envois</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#059669" }]}>{data.stats.sent}</Text>
              <Text style={styles.kpiLabel}>Réussis</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#D97706" }]}>
                {data.stats.total > 0 ? Math.round((data.stats.sent / data.stats.total) * 100) : 0}%
              </Text>
              <Text style={styles.kpiLabel}>Taux succès</Text>
            </View>
          </View>

          {/* Campaign cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.campaignScroll}
            contentContainerStyle={styles.campaignRow}>
            {Object.entries(CAMPAIGNS).map(([key, cfg]) => (
              <View key={key} style={[styles.campaignCard, { borderColor: cfg.color + "40" }]}>
                <View style={[styles.campaignIcon, { backgroundColor: cfg.bg }]}>
                  <Feather name={cfg.icon as never} size={16} color={cfg.color} />
                </View>
                <Text style={[styles.campaignCount, { color: cfg.color }]}>
                  {data.stats.byCampaign[key] ?? 0}
                </Text>
                <Text style={styles.campaignLabel}>{cfg.label}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}>
            {ALL_CAMPAIGNS.map(c => {
              const cfg = CAMPAIGNS[c];
              const isAll = c === "all";
              const active = filter === c;
              return (
                <Pressable key={c} style={[styles.filterChip, active && { backgroundColor: cfg?.color ?? "#7C3AED", borderColor: cfg?.color ?? "#7C3AED" }]}
                  onPress={() => setFilter(c)}>
                  {!isAll && <Feather name={(cfg?.icon ?? "list") as never} size={12} color={active ? "white" : (cfg?.color ?? "#64748B")} />}
                  <Text style={[styles.filterText, active && { color: "white" }]}>
                    {isAll ? "Tout" : cfg?.label ?? c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Log list */}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={36} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Aucune action dans cette campagne</Text>
              <Text style={styles.emptySub}>Le scheduler s'exécute toutes les heures automatiquement.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={l => l.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const cfg = CAMPAIGNS[item.campaign];
                return (
                  <View style={styles.logCard}>
                    <View style={styles.logTop}>
                      <View style={[styles.logBadge, { backgroundColor: cfg?.bg ?? "#F1F5F9" }]}>
                        <Feather name={(cfg?.icon ?? "zap") as never} size={12} color={cfg?.color ?? "#64748B"} />
                        <Text style={[styles.logBadgeText, { color: cfg?.color ?? "#64748B" }]}>
                          {cfg?.label ?? item.campaign}
                        </Text>
                      </View>
                      <View style={styles.logMeta}>
                        <View style={[styles.channelPill, { backgroundColor: item.channel === "sms" ? "#FFFBEB" : item.channel === "push" ? "#EFF6FF" : "#F0FDF4" }]}>
                          <Feather
                            name={item.channel === "sms" ? "message-square" : item.channel === "push" ? "bell" : "send"}
                            size={10}
                            color={item.channel === "sms" ? "#D97706" : item.channel === "push" ? "#3B82F6" : "#059669"}
                          />
                          <Text style={[styles.channelText, { color: item.channel === "sms" ? "#D97706" : item.channel === "push" ? "#3B82F6" : "#059669" }]}>
                            {item.channel.toUpperCase()}
                          </Text>
                        </View>
                        <View style={[styles.statusDot, { backgroundColor: item.status === "sent" ? "#059669" : item.status === "skipped" ? "#D97706" : "#EF4444" }]} />
                      </View>
                    </View>
                    <Text style={styles.logMsg} numberOfLines={2}>{item.message}</Text>
                    <View style={styles.logFoot}>
                      {item.phone && (
                        <View style={styles.logPhoneRow}>
                          <Feather name="phone" size={11} color="#94A3B8" />
                          <Text style={styles.logPhone}>{item.phone}</Text>
                        </View>
                      )}
                      <Text style={styles.logDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle:  { fontSize: 17, fontWeight: "700", color: "white" },

  center:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  errText:   { fontSize: 14, color: "#94A3B8", textAlign: "center" },
  retryBtn:  { backgroundColor: "#7C3AED", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: "white", fontWeight: "600", fontSize: 14 },

  kpiStrip:   { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  kpiItem:    { flex: 1, alignItems: "center", paddingVertical: 12 },
  kpiVal:     { fontSize: 22, fontWeight: "900" },
  kpiLabel:   { fontSize: 10, color: "#94A3B8", marginTop: 1 },
  kpiDivider: { width: 1, backgroundColor: "#E2E8F0", marginVertical: 8 },

  campaignScroll: { maxHeight: 110 },
  campaignRow:    { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  campaignCard:   { width: 90, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", gap: 5, borderWidth: 1 },
  campaignIcon:   { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  campaignCount:  { fontSize: 20, fontWeight: "900" },
  campaignLabel:  { fontSize: 9, color: "#64748B", textAlign: "center" },

  filterScroll: { maxHeight: 48 },
  filterRow:    { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: "#E2E8F0" },
  filterText:   { fontSize: 12, color: "#64748B", fontWeight: "500" },

  empty:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptySub:   { fontSize: 12, color: "#94A3B8", textAlign: "center" },

  logCard:    { backgroundColor: "white", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  logTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  logBadgeText:{ fontSize: 11, fontWeight: "700" },
  logMeta:    { flexDirection: "row", alignItems: "center", gap: 8 },
  channelPill:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  channelText:{ fontSize: 10, fontWeight: "700" },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  logMsg:     { fontSize: 13, color: "#475569", lineHeight: 19 },
  logFoot:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logPhoneRow:{ flexDirection: "row", alignItems: "center", gap: 4 },
  logPhone:   { fontSize: 11, color: "#94A3B8" },
  logDate:    { fontSize: 11, color: "#94A3B8" },
});
