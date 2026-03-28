import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
type Period = "today" | "week" | "month";

interface DayPoint { date: string; revenue: number; bookings: number }

interface AnalyticsData {
  period: string;
  revenue:   { total: number; booking: number; parcel: number };
  occupancy: { rate: number; booked: number; total: number };
  parcels:   { total: number; delivered: number; pending: number };
  bookings:  { total: number; paid: number };
  trips:     { total: number };
  agents:    { agentId: string; agentName: string; agentRole: string; scans: number; ventes: number; colis: number }[];
  dailyChart: DayPoint[];
}

/* ─── Formatters ─────────────────────────────────────────────────────── */
const fmtCFA = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` :
  String(Math.round(n));

const fmtDate = (iso: string, period: Period) => {
  const d = new Date(iso);
  if (period === "month") return d.getDate().toString();
  return ["Di","Lu","Ma","Me","Je","Ve","Sa"][d.getDay()] ?? "";
};

/* ─── Mini SVG Bar Chart ─────────────────────────────────────────────── */
function BarChart({
  data, color, valueKey, height = 140, period,
}: {
  data: DayPoint[]; color: string; valueKey: "revenue" | "bookings";
  height?: number; period: Period;
}) {
  const W         = 320;
  const PAD_L     = 36;
  const PAD_B     = 28;
  const PAD_TOP   = 10;
  const chartW    = W - PAD_L - 8;
  const chartH    = height - PAD_B - PAD_TOP;
  const vals      = data.map(d => d[valueKey] as number);
  const maxVal    = Math.max(...vals, 1);
  const barCount  = data.length;
  const gap       = 4;
  const barW      = Math.max(4, (chartW - gap * (barCount - 1)) / barCount);

  /* Y-axis ticks */
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ frac: f, val: Math.round(maxVal * f) }));

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
      {/* Y-axis guides */}
      {ticks.map(t => {
        const y = PAD_TOP + chartH * (1 - t.frac);
        return (
          <G key={t.frac}>
            <Line x1={PAD_L} y1={y} x2={W - 8} y2={y} stroke="#E2E8F0" strokeWidth={1} />
            <SvgText x={PAD_L - 4} y={y + 4} fontSize={8} fill="#94A3B8" textAnchor="end">
              {valueKey === "revenue" ? fmtCFA(t.val) : String(t.val)}
            </SvgText>
          </G>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const val  = d[valueKey] as number;
        const frac = maxVal > 0 ? val / maxVal : 0;
        const bh   = Math.max(frac * chartH, val > 0 ? 3 : 0);
        const x    = PAD_L + i * (barW + gap);
        const y    = PAD_TOP + chartH - bh;
        const label = fmtDate(d.date, period);

        return (
          <G key={d.date}>
            <Rect
              x={x} y={y} width={barW} height={bh}
              rx={3} ry={3} fill={color} opacity={val > 0 ? 1 : 0.15}
            />
            {/* X label */}
            {(period !== "month" || i % 5 === 0 || i === data.length - 1) && (
              <SvgText
                x={x + barW / 2} y={height - 8}
                fontSize={8} fill="#94A3B8" textAnchor="middle"
              >
                {label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, sub, color, light,
}: {
  icon: string; label: string; value: string;
  sub?: string; color: string; light: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: light }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

/* ─── Occupancy Ring ─────────────────────────────────────────────────── */
function OccupancyRing({ rate }: { rate: number }) {
  const SIZE   = 96;
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;
  const R      = 34;
  const STROKE = 8;
  const C      = 2 * Math.PI * R;
  const dash   = ((rate / 100) * C).toFixed(2);
  const color  = rate >= 80 ? "#059669" : rate >= 50 ? "#D97706" : "#EF4444";

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Track */}
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke="#E2E8F0" strokeWidth={STROKE} />
      {/* Fill */}
      <Circle
        cx={CX} cy={CY} r={R}
        fill="none" stroke={color} strokeWidth={STROKE}
        strokeDasharray={`${dash} ${C.toFixed(2)}`}
        strokeLinecap="round"
        rotation="-90" origin={`${CX},${CY}`}
      />
      {/* Labels */}
      <SvgText x={CX} y={CY - 4} textAnchor="middle" fontSize={16} fontWeight="700" fill={color}>
        {rate}%
      </SvgText>
      <SvgText x={CX} y={CY + 12} textAnchor="middle" fontSize={9} fill="#94A3B8">
        remplissage
      </SvgText>
    </Svg>
  );
}

/* ─── Section ────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function AnalytiquesScreen() {
  const { token }  = useAuth();
  const insets     = useSafeAreaInsets();

  const [period,     setPeriod]     = useState<Period>("week");
  const [data,       setData]       = useState<AnalyticsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode,  setChartMode]  = useState<"revenue" | "bookings">("revenue");

  const fetchData = useCallback(async (p: Period) => {
    try {
      const res = await apiFetch<AnalyticsData>(`/company/analytics?period=${p}`, { token: token ?? undefined });
      setData(res);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    fetchData(period);
  }, [fetchData, period]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week",  label: "7 jours" },
    { key: "month", label: "Ce mois" },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>Chargement des analytics…</Text>
      </View>
    );
  }

  const d = data;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub}>Performances de la compagnie</Text>
        </View>
        <Pressable
          onPress={() => { setRefreshing(true); fetchData(period); }}
          style={styles.refreshBtn}
        >
          <Feather name="refresh-cw" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Period filter */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <Pressable
            key={p.key}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(period); }}
            tintColor="#D97706"
          />
        }
      >
        {/* ── Revenue hero ── */}
        <View style={styles.revenueHero}>
          <View>
            <Text style={styles.heroLabel}>REVENUS TOTAUX</Text>
            <Text style={styles.heroValue}>{fmtCFA(d?.revenue.total ?? 0)} FCFA</Text>
            <View style={styles.heroBreakdown}>
              <View style={styles.heroPill}>
                <View style={[styles.heroDot, { backgroundColor: "#D97706" }]} />
                <Text style={styles.heroPillText}>Billets {fmtCFA(d?.revenue.booking ?? 0)}</Text>
              </View>
              <View style={styles.heroPill}>
                <View style={[styles.heroDot, { backgroundColor: "#7C3AED" }]} />
                <Text style={styles.heroPillText}>Colis {fmtCFA(d?.revenue.parcel ?? 0)}</Text>
              </View>
            </View>
          </View>
          <OccupancyRing rate={d?.occupancy.rate ?? 0} />
        </View>

        {/* ── KPI grid ── */}
        <Section title="Indicateurs clés">
          <View style={styles.kpiGrid}>
            <StatCard
              icon="users" label="Réservations"
              value={String(d?.bookings.total ?? 0)}
              sub={`${d?.bookings.paid ?? 0} payées`}
              color="#D97706" light="#FEF3C7"
            />
            <StatCard
              icon="navigation" label="Trajets"
              value={String(d?.trips.total ?? 0)}
              sub={`${d?.occupancy.booked ?? 0}/${d?.occupancy.total ?? 0} places`}
              color="#2563EB" light="#EFF6FF"
            />
            <StatCard
              icon="package" label="Colis total"
              value={String(d?.parcels.total ?? 0)}
              sub={`${d?.parcels.delivered ?? 0} livrés`}
              color="#7C3AED" light="#F5F3FF"
            />
            <StatCard
              icon="clock" label="En attente"
              value={String(d?.parcels.pending ?? 0)}
              sub="colis non livrés"
              color="#EF4444" light="#FEE2E2"
            />
          </View>
        </Section>

        {/* ── Charts ── */}
        <Section title="Évolution">
          {/* Chart toggle */}
          <View style={styles.chartToggle}>
            <Pressable
              style={[styles.toggleBtn, chartMode === "revenue" && styles.toggleBtnActive]}
              onPress={() => setChartMode("revenue")}
            >
              <Text style={[styles.toggleText, chartMode === "revenue" && styles.toggleTextActive]}>
                Revenus
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, chartMode === "bookings" && styles.toggleBtnActive]}
              onPress={() => setChartMode("bookings")}
            >
              <Text style={[styles.toggleText, chartMode === "bookings" && styles.toggleTextActive]}>
                Réservations
              </Text>
            </Pressable>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>
              {chartMode === "revenue" ? "Revenus par jour (FCFA)" : "Réservations par jour"}
            </Text>
            {d && d.dailyChart.length > 0 ? (
              <BarChart
                data={d.dailyChart}
                color={chartMode === "revenue" ? "#D97706" : "#2563EB"}
                valueKey={chartMode}
                period={period}
                height={150}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={styles.chartEmptyText}>Pas de données pour cette période</Text>
              </View>
            )}
          </View>
        </Section>

        {/* ── Parcel breakdown ── */}
        <Section title="Colis — Détail">
          <View style={styles.parcelCard}>
            <View style={styles.parcelRow}>
              <View style={styles.parcelStat}>
                <Text style={styles.parcelNum}>{d?.parcels.total ?? 0}</Text>
                <Text style={styles.parcelLbl}>Total</Text>
              </View>
              <View style={[styles.parcelDivider]} />
              <View style={styles.parcelStat}>
                <Text style={[styles.parcelNum, { color: "#059669" }]}>{d?.parcels.delivered ?? 0}</Text>
                <Text style={styles.parcelLbl}>Livrés</Text>
              </View>
              <View style={styles.parcelDivider} />
              <View style={styles.parcelStat}>
                <Text style={[styles.parcelNum, { color: "#EF4444" }]}>{d?.parcels.pending ?? 0}</Text>
                <Text style={styles.parcelLbl}>En attente</Text>
              </View>
            </View>

            {/* Progress bar */}
            {(d?.parcels.total ?? 0) > 0 && (
              <View style={styles.parcelProgress}>
                <View style={[
                  styles.parcelProgressFill,
                  { width: `${Math.round((d!.parcels.delivered / d!.parcels.total) * 100)}%` as any },
                ]} />
              </View>
            )}
            {(d?.parcels.total ?? 0) > 0 && (
              <Text style={styles.parcelProgressLabel}>
                {Math.round((d!.parcels.delivered / d!.parcels.total) * 100)}% livrés
              </Text>
            )}
          </View>
        </Section>

        {/* ── Agent performance ── */}
        {(d?.agents ?? []).length > 0 && (
          <Section title="Performance agents">
            <View style={styles.agentTable}>
              {/* Header */}
              <View style={[styles.agentRow, styles.agentHeader]}>
                <Text style={[styles.agentCell, { flex: 3 }]}>Agent</Text>
                <Text style={[styles.agentCell, styles.agentNum]}>Scans</Text>
                <Text style={[styles.agentCell, styles.agentNum]}>Ventes</Text>
                <Text style={[styles.agentCell, styles.agentNum]}>Colis</Text>
              </View>

              {d!.agents.slice(0, 8).map((a, i) => (
                <View key={a.agentId} style={[styles.agentRow, i % 2 === 1 && styles.agentRowAlt]}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.agentName} numberOfLines={1}>{a.agentName}</Text>
                    <Text style={styles.agentRole}>{a.agentRole}</Text>
                  </View>
                  <View style={styles.agentNum}>
                    <Text style={styles.agentNumText}>{a.scans}</Text>
                  </View>
                  <View style={styles.agentNum}>
                    <Text style={[styles.agentNumText, { color: "#D97706" }]}>{a.ventes}</Text>
                  </View>
                  <View style={styles.agentNum}>
                    <Text style={[styles.agentNumText, { color: "#7C3AED" }]}>{a.colis}</Text>
                  </View>
                </View>
              ))}

              {(d?.agents.length ?? 0) === 0 && (
                <View style={styles.agentEmpty}>
                  <Text style={styles.agentEmptyText}>Aucune activité sur cette période</Text>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* Empty state */}
        {(d?.agents ?? []).length === 0 && (d?.bookings.total ?? 0) === 0 && (
          <View style={styles.emptyState}>
            <Feather name="bar-chart-2" size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Aucune donnée</Text>
            <Text style={styles.emptySub}>Pas d&apos;activité sur cette période</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const AMBER  = "#D97706";
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F1F5F9" },
  center:       { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:  { color: "#94A3B8", fontSize: 14 },

  header:       { backgroundColor: "#0B3C5D", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  backBtn:      { padding: 4 },
  headerTitle:  { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub:    { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  refreshBtn:   { padding: 4 },

  periodRow:    { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  periodTab:    { flex: 1, paddingVertical: 11, alignItems: "center" },
  periodTabActive: { borderBottomWidth: 2, borderBottomColor: AMBER },
  periodText:   { fontSize: 13, color: "#64748B", fontWeight: "500" },
  periodTextActive: { color: AMBER, fontWeight: "700" },

  scroll:       { padding: 14, gap: 16 },

  /* Revenue hero */
  revenueHero:  { backgroundColor: "#0B3C5D", borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel:    { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  heroValue:    { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 2 },
  heroBreakdown:{ flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" },
  heroPill:     { flexDirection: "row", alignItems: "center", gap: 5 },
  heroDot:      { width: 8, height: 8, borderRadius: 4 },
  heroPillText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },

  /* KPI grid */
  section:      { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.6 },
  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:     { flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 12, padding: 14, borderTopWidth: 3, elevation: 1 },
  statIcon:     { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue:    { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  statLabel:    { fontSize: 12, color: "#94A3B8", marginTop: 2, fontWeight: "500" },
  statSub:      { fontSize: 11, color: "#CBD5E1", marginTop: 2 },

  /* Chart */
  chartToggle:  { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 10, padding: 3, alignSelf: "flex-start" },
  toggleBtn:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText:   { fontSize: 13, color: "#64748B" },
  toggleTextActive: { color: "#1E293B", fontWeight: "600" },
  chartCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 1 },
  chartLabel:   { fontSize: 12, color: "#94A3B8", fontWeight: "600", marginBottom: 10 },
  chartEmpty:   { height: 120, alignItems: "center", justifyContent: "center" },
  chartEmptyText: { color: "#CBD5E1", fontSize: 13 },

  /* Parcels */
  parcelCard:   { backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 1 },
  parcelRow:    { flexDirection: "row", alignItems: "center" },
  parcelStat:   { flex: 1, alignItems: "center" },
  parcelDivider:{ width: 1, height: 40, backgroundColor: "#E2E8F0" },
  parcelNum:    { fontSize: 26, fontWeight: "800", color: "#1E293B" },
  parcelLbl:    { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  parcelProgress:      { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, marginTop: 14, overflow: "hidden" },
  parcelProgressFill:  { height: 8, backgroundColor: "#059669", borderRadius: 4 },
  parcelProgressLabel: { fontSize: 11, color: "#059669", fontWeight: "600", marginTop: 4 },

  /* Agent table */
  agentTable:   { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", elevation: 1 },
  agentHeader:  { backgroundColor: "#F8FAFC" },
  agentRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  agentRowAlt:  { backgroundColor: "#FAFAFA" },
  agentCell:    { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase" },
  agentNum:     { width: 52, alignItems: "center" },
  agentName:    { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  agentRole:    { fontSize: 10, color: "#94A3B8", marginTop: 1 },
  agentNumText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  agentEmpty:   { padding: 20, alignItems: "center" },
  agentEmptyText: { color: "#CBD5E1", fontSize: 13 },

  /* Empty */
  emptyState:   { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: "600", color: "#94A3B8" },
  emptySub:     { fontSize: 13, color: "#CBD5E1" },
});
