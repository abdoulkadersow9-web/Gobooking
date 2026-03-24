import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const GREEN  = "#059669";
const GREEN_D = "#047857";

interface EarningsScan {
  id: string;
  type: string;
  ref: string;
  status: string;
  commission: number;
  createdAt: string;
}
interface DayEntry { date: string; amount: number }
interface EarningsData {
  agentName: string;
  agentRole: string;
  today:  { scans: number; earnings: number };
  week:   { scans: number; earnings: number };
  month:  { scans: number; earnings: number };
  recentScans: EarningsScan[];
  dailyChart: DayEntry[];
}

export default function AgentGains() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData]       = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await apiFetch<EarningsData>("/agent/earnings", { token: token ?? undefined });
      setData(res);
    } catch {
      /* keep existing data */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n.toLocaleString("fr-CI") + " FCFA";

  const TYPE_LABEL: Record<string, string> = {
    passager: "Embarquement",
    colis:    "Colis",
    bagage:   "Bagage",
    scan:     "Scan",
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[GREEN_D, GREEN]} style={S.header}>
        <Pressable style={S.backBtn} onPress={() => router.replace("/agent/home")}>
          <Feather name="arrow-left" size={18} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Mes gains</Text>
          {data && <Text style={S.headerSub}>{data.agentName}</Text>}
        </View>
        <View style={S.roleBadge}>
          <Feather name="trending-up" size={12} color="white" />
          <Text style={S.roleBadgeTxt}>Commission</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={{ color: GREEN, marginTop: 12, fontSize: 14 }}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={GREEN} />}
        >
          {/* ── KPI strip ── */}
          <View style={S.kpiRow}>
            {([
              { label: "Aujourd'hui", scans: data?.today.scans ?? 0, earnings: data?.today.earnings ?? 0, color: "#059669", bg: "#DCFCE7" },
              { label: "Cette semaine", scans: data?.week.scans ?? 0, earnings: data?.week.earnings ?? 0, color: "#2563EB", bg: "#DBEAFE" },
              { label: "Ce mois",      scans: data?.month.scans ?? 0, earnings: data?.month.earnings ?? 0, color: "#D97706", bg: "#FEF3C7" },
            ]).map(k => (
              <View key={k.label} style={[S.kpiCard, { borderTopColor: k.color }]}>
                <Text style={[S.kpiAmt, { color: k.color }]}>{(k.earnings / 1000).toFixed(1)}K</Text>
                <Text style={S.kpiLabel}>{k.label}</Text>
                <Text style={[S.kpiScans, { color: k.color }]}>{k.scans} scan{k.scans !== 1 ? "s" : ""}</Text>
              </View>
            ))}
          </View>

          {/* ── Monthly total hero ── */}
          <LinearGradient colors={[GREEN_D, GREEN]} style={S.heroCard}>
            <Feather name="award" size={28} color="white" style={{ marginBottom: 8 }} />
            <Text style={S.heroAmt}>{fmt(data?.month.earnings ?? 0)}</Text>
            <Text style={S.heroLabel}>Gains totaux ce mois</Text>
            <View style={S.heroStat}>
              <Feather name="check-circle" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={S.heroStatTxt}>{data?.month.scans ?? 0} validations</Text>
              <View style={S.heroDot} />
              <Feather name="zap" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={S.heroStatTxt}>200 FCFA / scan</Text>
            </View>
          </LinearGradient>

          {/* ── Mini bar chart ── */}
          {(data?.dailyChart?.length ?? 0) > 0 && (
            <View style={S.chartCard}>
              <Text style={S.sectionTitle}>Activité — 14 derniers jours</Text>
              <View style={S.barRow}>
                {(data?.dailyChart ?? []).map((d, i) => {
                  const max = Math.max(...(data?.dailyChart ?? []).map(x => x.amount), 1);
                  const pct = (d.amount / max) * 100;
                  return (
                    <View key={i} style={S.barWrap}>
                      <View style={S.barTrack}>
                        <View style={[S.barFill, { height: `${pct}%` as never, backgroundColor: GREEN }]} />
                      </View>
                      <Text style={S.barLabel}>{d.date.slice(8)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Recent scans ── */}
          <Text style={S.sectionTitle}>Dernières validations</Text>
          {(data?.recentScans?.length ?? 0) === 0 ? (
            <View style={S.emptyBox}>
              <Feather name="inbox" size={32} color="#9ca3af" />
              <Text style={S.emptyTxt}>Aucune validation ce mois</Text>
            </View>
          ) : (
            data!.recentScans.map(s => (
              <View key={s.id} style={S.scanRow}>
                <View style={[S.scanIcon, { backgroundColor: s.status === "validé" ? "#DCFCE7" : "#FEF3C7" }]}>
                  <Feather name="check-circle" size={16} color={s.status === "validé" ? GREEN : "#D97706"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.scanRef}>{s.ref}</Text>
                  <Text style={S.scanType}>{TYPE_LABEL[s.type] ?? s.type} · {new Date(s.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <Text style={S.scanComm}>+{s.commission.toLocaleString()} FCFA</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F0FDF4" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },

  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "white" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  roleBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  roleBadgeTxt: { color: "white", fontSize: 11, fontWeight: "700" },

  kpiRow:      { flexDirection: "row", gap: 8 },
  kpiCard:     { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 12, borderTopWidth: 3, alignItems: "center", gap: 2, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  kpiAmt:      { fontSize: 17, fontWeight: "800" },
  kpiLabel:    { fontSize: 10, color: "#6b7280", fontWeight: "600", textAlign: "center" },
  kpiScans:    { fontSize: 11, fontWeight: "600", marginTop: 2 },

  heroCard:    { borderRadius: 20, padding: 24, alignItems: "center", gap: 4, elevation: 4, shadowColor: GREEN, shadowOpacity: 0.25, shadowRadius: 12 },
  heroAmt:     { fontSize: 28, fontWeight: "800", color: "white", letterSpacing: -0.5 },
  heroLabel:   { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  heroStat:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  heroStatTxt: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  heroDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)" },

  chartCard:   { backgroundColor: "white", borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: GREEN, marginBottom: 12 },
  barRow:      { flexDirection: "row", gap: 4, height: 80, alignItems: "flex-end" },
  barWrap:     { flex: 1, alignItems: "center", gap: 4 },
  barTrack:    { flex: 1, width: "100%", backgroundColor: "#DCFCE7", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill:     { width: "100%", borderRadius: 4 },
  barLabel:    { fontSize: 8, color: "#9ca3af", fontWeight: "600" },

  emptyBox:    { backgroundColor: "white", borderRadius: 16, padding: 32, alignItems: "center", gap: 10 },
  emptyTxt:    { fontSize: 14, color: "#9ca3af", fontWeight: "500" },

  scanRow:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  scanIcon:    { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  scanRef:     { fontSize: 13, fontWeight: "700", color: "#111827" },
  scanType:    { fontSize: 11, color: "#6b7280", marginTop: 2 },
  scanComm:    { fontSize: 14, fontWeight: "800", color: GREEN },
});
