import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardCharts from "@/components/DashboardCharts";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Alerte {
  type: "bus" | "colis" | "trajet";
  severity: "critical" | "warning";
  message: string;
  detail: string;
  id: string;
}

interface BookingStats {
  total: number; confirmed: number; paid: number;
  boarded: number; cancelled: number; pending: number;
}
interface ParcelStats {
  total: number; créé: number; en_gare: number;
  chargé_bus: number; en_transit: number; arrivé: number; livré: number; annulé: number;
}
interface Revenue { totalRevenue: number; bookingRevenue: number; parcelRevenue: number }
interface ActiveTrip {
  id: string; from: string; to: string; date: string;
  departureTime: string; busName: string; status: string; totalSeats: number;
}
interface DailyPoint { date: string; count: number; revenue: number; parcels: number }
interface Summary {
  totalBuses: number; activeBuses: number;
  totalTrips: number; activeTripsCount: number;
}
interface DashboardData {
  bookingStats: BookingStats;
  parcelStats: ParcelStats;
  revenue: Revenue;
  activeTrips: ActiveTrip[];
  dailyData: DailyPoint[];
  summary: Summary;
}

/* ─── Palette ────────────────────────────────────────────────────────── */
const AMBER    = "#D97706";
const AMBER_DK = "#92400E";
const AMBER_LT = "#FEF3C7";
const GREEN    = "#059669";
const GREEN_LT = "#D1FAE5";
const BLUE     = "#2563EB";
const BLUE_LT  = "#DBEAFE";
const VIOLET   = "#7C3AED";
const VIOLET_LT= "#EDE9FE";
const RED      = "#DC2626";
const RED_LT   = "#FEE2E2";
const SLATE    = "#0F172A";
const GRAY     = "#64748B";

/* ─── Helpers ────────────────────────────────────────────────────────── */
function fmtAmount(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)} k`;
  return String(v);
}
function fmtDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  } catch { return s; }
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function SectionTitle({ icon, title, color = AMBER }: { icon: string; title: string; color?: string }) {
  return (
    <View style={ss.sectionRow}>
      <View style={[ss.sectionIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={14} color={color} />
      </View>
      <Text style={ss.sectionTitle}>{title}</Text>
    </View>
  );
}

interface StatCardProps {
  label: string; value: number | string;
  icon: string; bg: string; fg: string; flex?: number;
}
function StatCard({ label, value, icon, bg, fg, flex = 1 }: StatCardProps) {
  return (
    <View style={[ss.card, { flex, backgroundColor: bg }]}>
      <View style={[ss.cardIcon, { backgroundColor: fg + "22" }]}>
        <Feather name={icon as any} size={16} color={fg} />
      </View>
      <Text style={[ss.cardValue, { color: fg }]}>{value}</Text>
      <Text style={ss.cardLabel}>{label}</Text>
    </View>
  );
}

function RevenueCard({ revenue }: { revenue: Revenue }) {
  return (
    <LinearGradient
      colors={[AMBER_DK, AMBER, "#F59E0B"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={ss.revenueCard}
    >
      <View style={ss.revenueTop}>
        <View>
          <Text style={ss.revenueLabel}>Revenus totaux</Text>
          <Text style={ss.revenueValue}>{fmtAmount(revenue.totalRevenue)} FCFA</Text>
        </View>
        <View style={ss.revenueBadge}>
          <Feather name="trending-up" size={22} color="#fff" />
        </View>
      </View>
      <View style={ss.revenueSplit}>
        <View style={ss.revenueSplitItem}>
          <Feather name="users" size={13} color="rgba(255,255,255,0.8)" />
          <Text style={ss.revenueSplitLabel}>Billets</Text>
          <Text style={ss.revenueSplitVal}>{fmtAmount(revenue.bookingRevenue)}</Text>
        </View>
        <View style={ss.revenueDivider} />
        <View style={ss.revenueSplitItem}>
          <Feather name="package" size={13} color="rgba(255,255,255,0.8)" />
          <Text style={ss.revenueSplitLabel}>Colis</Text>
          <Text style={ss.revenueSplitVal}>{fmtAmount(revenue.parcelRevenue)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function ActiveTripCard({ trip }: { trip: ActiveTrip }) {
  return (
    <View style={ss.tripCard}>
      <View style={ss.tripDot} />
      <View style={ss.tripInfo}>
        <Text style={ss.tripRoute}>{trip.from} → {trip.to}</Text>
        <Text style={ss.tripMeta}>{trip.busName} · {trip.departureTime} · {fmtDate(trip.date)}</Text>
      </View>
      <View style={ss.tripBadge}>
        <Text style={ss.tripBadgeTxt}>En route</Text>
      </View>
    </View>
  );
}

function SummaryPills({ summary }: { summary: Summary }) {
  const items = [
    { icon: "truck", label: "Bus actifs", value: `${summary.activeBuses}/${summary.totalBuses}`, color: BLUE },
    { icon: "map", label: "Trajets", value: summary.totalTrips, color: VIOLET },
  ];
  return (
    <View style={ss.pillsRow}>
      {items.map(it => (
        <View key={it.label} style={[ss.pill, { borderColor: it.color + "30" }]}>
          <Feather name={it.icon as any} size={14} color={it.color} />
          <Text style={[ss.pillVal, { color: it.color }]}>{it.value}</Text>
          <Text style={ss.pillLbl}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────── */
interface ScanStats { passager: number; colis: number; bagage: number }

export default function EntrepriseDashboard() {
  const insets  = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [data, setData]             = useState<DashboardData | null>(null);
  const [scanStats, setScanStats]   = useState<ScanStats | null>(null);
  const [alertes, setAlertes]       = useState<Alerte[]>([]);
  const [alertesOpen, setAlertesOpen] = useState(true);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [dashRes, scanRes, alertRes] = await Promise.all([
        apiFetch<DashboardData>("/company/dashboard", { token: token ?? undefined }),
        apiFetch<{ stats: ScanStats }>("/company/scan-stats",  { token: token ?? undefined }).catch(() => null),
        apiFetch<{ alertes: Alerte[] }>("/company/alertes", { token: token ?? undefined }).catch(() => null),
      ]);
      setData(dashRes);
      if (scanRes) setScanStats(scanRes.stats);
      if (alertRes?.alertes) setAlertes(alertRes.alertes);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  /* ── Header ─────────────────────────────────────────────────────── */
  const Header = (
    <LinearGradient
      colors={[AMBER_DK, AMBER]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={[ss.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={ss.headerRow}>
        <View>
          <Text style={ss.headerGreet}>Bonjour 👋</Text>
          <Text style={ss.headerName}>{user?.name ?? "Compagnie"}</Text>
        </View>
        <Pressable style={ss.headerBtn} onPress={() => router.push("/dashboard/company")}>
          <Feather name="settings" size={18} color="#fff" />
        </Pressable>
      </View>
      <Text style={ss.headerSub}>Tableau de bord · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
    </LinearGradient>
  );

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={ss.flex}>
        {Header}
        <View style={ss.center}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={ss.loadTxt}>Chargement des statistiques…</Text>
        </View>
      </View>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────── */
  if (error || !data) {
    return (
      <View style={ss.flex}>
        {Header}
        <View style={ss.center}>
          <Feather name="wifi-off" size={40} color={GRAY} />
          <Text style={ss.errorTxt}>{error ?? "Aucune donnée"}</Text>
          <Pressable style={[ss.retryBtn, { backgroundColor: AMBER }]} onPress={() => load()}>
            <Text style={ss.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { bookingStats, parcelStats, revenue, activeTrips, dailyData, summary } = data;

  return (
    <View style={ss.flex}>
      {Header}
      <ScrollView
        style={ss.scroll}
        contentContainerStyle={[ss.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AMBER} />
        }
      >
        {/* ── Alertes automatiques ── */}
        {alertes.length > 0 && (
          <View style={ss.alertBox}>
            <Pressable style={ss.alertHeader} onPress={() => setAlertesOpen(o => !o)}>
              <View style={ss.alertTitleRow}>
                <View style={ss.alertIconBox}>
                  <Text style={{ fontSize: 16 }}>⚠️</Text>
                </View>
                <View>
                  <Text style={ss.alertTitle}>Alertes</Text>
                  <Text style={ss.alertSub}>{alertes.length} problème{alertes.length > 1 ? "s" : ""} détecté{alertes.length > 1 ? "s" : ""}</Text>
                </View>
              </View>
              <View style={ss.alertCountBadge}>
                <Text style={ss.alertCountTxt}>{alertes.length}</Text>
              </View>
              <Feather name={alertesOpen ? "chevron-up" : "chevron-down"} size={16} color="#B91C1C" style={{ marginLeft: 4 }} />
            </Pressable>

            {alertesOpen && (
              <View style={ss.alertList}>
                {alertes.map((a, i) => {
                  const typeIcon = a.type === "bus" ? "🚌" : a.type === "colis" ? "📦" : "🗺️";
                  const isCritical = a.severity === "critical";
                  return (
                    <View
                      key={a.id + i}
                      style={[ss.alertRow, isCritical && { backgroundColor: "#FEE2E2" }, i === alertes.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <Text style={{ fontSize: 16, marginRight: 8 }}>{typeIcon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.alertMsg}>{a.message}</Text>
                        {!!a.detail && <Text style={ss.alertDetail}>{a.detail}</Text>}
                      </View>
                      <View style={[ss.severityDot, { backgroundColor: isCritical ? RED : "#F59E0B" }]} />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Revenue card */}
        <View style={ss.section}>
          <RevenueCard revenue={revenue} />
        </View>

        {/* Summary pills */}
        <SummaryPills summary={summary} />

        {/* Réservations */}
        <View style={ss.section}>
          <SectionTitle icon="users" title="Réservations" color={BLUE} />
          <View style={ss.row}>
            <StatCard label="Total" value={bookingStats.total} icon="list" bg={BLUE_LT} fg={BLUE} />
            <StatCard label="Confirmées" value={bookingStats.confirmed} icon="check-circle" bg="#EFF6FF" fg={BLUE} />
            <StatCard label="Payées" value={bookingStats.paid} icon="credit-card" bg={GREEN_LT} fg={GREEN} />
          </View>
          <View style={[ss.row, { marginTop: 8 }]}>
            <StatCard label="Embarquées" value={bookingStats.boarded} icon="user-check" bg="#F0FDF4" fg={GREEN} />
            <StatCard label="Annulées" value={bookingStats.cancelled} icon="x-circle" bg={RED_LT} fg={RED} />
            <StatCard label="En attente" value={bookingStats.pending} icon="clock" bg="#FFF7ED" fg={AMBER} />
          </View>
        </View>

        {/* Colis */}
        <View style={ss.section}>
          <SectionTitle icon="package" title="Colis" color={VIOLET} />
          <View style={ss.row}>
            <StatCard label="Créés" value={parcelStats.créé} icon="plus-circle" bg={VIOLET_LT} fg={VIOLET} />
            <StatCard label="En gare" value={parcelStats.en_gare} icon="map-pin" bg="#F5F3FF" fg={VIOLET} />
            <StatCard label="Chargés" value={parcelStats.chargé_bus} icon="truck" bg={BLUE_LT} fg={BLUE} />
            <StatCard label="Livrés" value={parcelStats.livré} icon="check" bg={GREEN_LT} fg={GREEN} />
          </View>
          {parcelStats.total > 0 && (
            <View style={ss.parcelBar}>
              {[
                { v: parcelStats.créé,       c: VIOLET },
                { v: parcelStats.en_gare,    c: AMBER },
                { v: parcelStats.chargé_bus, c: BLUE },
                { v: parcelStats.en_transit, c: "#0891B2" },
                { v: parcelStats.arrivé,     c: "#10B981" },
                { v: parcelStats.livré,      c: GREEN },
                { v: parcelStats.annulé,     c: RED },
              ].filter(it => it.v > 0).map((it, idx) => (
                <View
                  key={idx}
                  style={[ss.barSegment, {
                    flex: it.v,
                    backgroundColor: it.c,
                    borderRadius: idx === 0 ? 4 : 0,
                  }]}
                />
              ))}
              <View style={ss.barEnd} />
            </View>
          )}
        </View>

        {/* Scan unifiés du jour */}
        {scanStats !== null && (
          <View style={ss.section}>
            <SectionTitle icon="scan" title="Scans du jour" color="#7C3AED" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: "#ECFDF5", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 }}>
                <Feather name="user-check" size={20} color="#059669" />
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#059669" }}>{scanStats.passager}</Text>
                <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>Passagers</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 }}>
                <Feather name="package" size={20} color="#2563EB" />
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#2563EB" }}>{scanStats.colis}</Text>
                <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>Colis</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#F5F3FF", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 }}>
                <Feather name="briefcase" size={20} color="#7C3AED" />
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#7C3AED" }}>{scanStats.bagage}</Text>
                <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>Bagages</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bus en cours */}
        {activeTrips.length > 0 && (
          <View style={ss.section}>
            <SectionTitle icon="navigation" title={`Bus en route (${activeTrips.length})`} color={GREEN} />
            {activeTrips.map(t => <ActiveTripCard key={t.id} trip={t} />)}
          </View>
        )}

        {/* Charts */}
        {dailyData.length > 0 && (
          <View style={ss.section}>
            <DashboardCharts
              dailyBookings={dailyData}
              accentColor={AMBER}
              showRevenue
            />
          </View>
        )}

        {/* Quick nav */}
        <View style={ss.section}>
          <SectionTitle icon="grid" title="Accès rapide" color={GRAY} />
          <View style={ss.navGrid}>
            {[
              { icon: "calendar",  label: "Trajets",      route: "/entreprise/trajets",        color: BLUE },
              { icon: "users",     label: "Réservations", route: "/entreprise/reservations",   color: GREEN },
              { icon: "package",   label: "Colis",        route: "/entreprise/colis",          color: VIOLET },
              { icon: "map",           label: "Suivi Live",   route: "/entreprise/live-tracking",  color: "#EF4444" },
              { icon: "alert-octagon", label: "Alertes",      route: "/entreprise/alertes",        color: "#DC2626" },
              { icon: "bar-chart-2",   label: "Analytics",    route: "/entreprise/analytiques",    color: "#059669" },
              { icon: "send",          label: "SMS Marketing",route: "/entreprise/sms",            color: "#D97706" },
              { icon: "zap",           label: "Marketing Auto",route: "/entreprise/marketing",     color: "#7C3AED" },
              { icon: "home",          label: "Agences",      route: "/entreprise/agences",        color: "#0369A1" },
              { icon: "git-branch",    label: "Routes",       route: "/entreprise/routes",         color: "#7C3AED" },
              { icon: "check-square",  label: "Embarquement", route: "/entreprise/embarquement",        color: "#059669" },
              { icon: "clock",         label: "Histo. colis", route: "/entreprise/colis-historique",    color: "#7C3AED" },
              { icon: "star",          label: "Avis clients",  route: "/entreprise/avis",           color: "#FBBF24" },
              { icon: "truck",         label: "Suivi Engins",  route: "/entreprise/bus-suivi",     color: "#22C55E" },
              { icon: "tool",          label: "Maintenance",   route: "/entreprise/maintenance-bus", color: "#F59E0B" },
              { icon: "droplet",       label: "Carburant",     route: "/entreprise/carburant",       color: "#16A34A" },
              { icon: "users",         label: "Affectation",   route: "/entreprise/bus-agents",      color: "#7C3AED" },
              { icon: "bar-chart-2",   label: "Rentabilité",   route: "/entreprise/rentabilite",     color: "#0891B2" },
              { icon: "activity",      label: "Comparaison",   route: "/entreprise/comparaison",     color: "#6366F1" },
              { icon: "settings",      label: "Gestion",       route: "/dashboard/company",        color: AMBER },
            ].map(it => (
              <Pressable
                key={it.route}
                style={[ss.navCard, { borderColor: it.color + "30" }]}
                onPress={() => router.push(it.route as any)}
              >
                <View style={[ss.navIcon, { backgroundColor: it.color + "18" }]}>
                  <Feather name={it.icon as any} size={20} color={it.color} />
                </View>
                <Text style={[ss.navLabel, { color: it.color }]}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 4 },

  /* Header */
  header:      { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerGreet: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  headerName:  { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  headerBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },

  /* States */
  center:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadTxt:  { fontSize: 14, color: GRAY, marginTop: 8 },
  errorTxt: { fontSize: 14, color: GRAY, textAlign: "center" },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  retryTxt: { color: "#fff", fontWeight: "700" },

  /* Section */
  section:     { marginTop: 16 },
  sectionRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle:{ fontSize: 15, fontWeight: "700", color: SLATE },

  /* Revenue card */
  revenueCard:     { borderRadius: 20, padding: 20, shadowColor: AMBER_DK, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  revenueTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  revenueLabel:    { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  revenueValue:    { fontSize: 28, fontWeight: "900", color: "#fff" },
  revenueBadge:    { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  revenueSplit:    { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 12, padding: 12 },
  revenueSplitItem:{ flex: 1, alignItems: "center", gap: 4 },
  revenueSplitLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  revenueSplitVal: { fontSize: 15, fontWeight: "800", color: "#fff" },
  revenueDivider:  { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 8 },

  /* Pills */
  pillsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  pill:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  pillVal:  { fontSize: 15, fontWeight: "800" },
  pillLbl:  { fontSize: 11, color: GRAY },

  /* Stat cards */
  row:       { flexDirection: "row", gap: 8 },
  card:      { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardValue: { fontSize: 22, fontWeight: "900" },
  cardLabel: { fontSize: 11, color: "#64748B", textAlign: "center", fontWeight: "500" },

  /* Parcel progress bar */
  parcelBar:   { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10, backgroundColor: "#E2E8F0" },
  barSegment:  { height: "100%" },
  barEnd:      { width: 0 },

  /* Active trips */
  tripCard:    { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: GREEN, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tripDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  tripInfo:    { flex: 1 },
  tripRoute:   { fontSize: 14, fontWeight: "700", color: SLATE },
  tripMeta:    { fontSize: 12, color: GRAY, marginTop: 2 },
  tripBadge:   { backgroundColor: GREEN_LT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tripBadgeTxt:{ fontSize: 11, color: GREEN, fontWeight: "700" },

  /* Quick nav */
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  navCard: { width: "47%", backgroundColor: "#fff", borderRadius: 16, padding: 16, alignItems: "center", gap: 8, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  navIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  navLabel:{ fontSize: 13, fontWeight: "700" },

  /* Alertes */
  alertBox:        { marginTop: 14, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1.5, borderColor: "#FECACA", overflow: "hidden", shadowColor: "#DC2626", shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  alertHeader:     { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#FEF2F2" },
  alertTitleRow:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  alertIconBox:    { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  alertTitle:      { fontSize: 14, fontWeight: "800", color: "#B91C1C" },
  alertSub:        { fontSize: 11, color: "#DC2626", marginTop: 1 },
  alertCountBadge: { backgroundColor: RED, borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  alertCountTxt:   { fontSize: 12, fontWeight: "900", color: "#fff" },
  alertList:       { paddingVertical: 4 },
  alertRow:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#FEE2E2" },
  alertMsg:        { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  alertDetail:     { fontSize: 11, color: "#64748B", marginTop: 1 },
  severityDot:     { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
