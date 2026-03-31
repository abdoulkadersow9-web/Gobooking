import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useOnSync } from "@/context/SyncContext";
import { apiFetch } from "@/utils/api";

const INDIGO  = "#3730A3";
const INDIGO2 = "#4F46E5";

/* ─── Génération HTML du bordereau ─── */
function buildBordereauHtml(b: Bordereau, agenceName?: string): string {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "0";
  const statusColor = b.status === "parti" ? "#059669" : b.status === "annulé" ? "#DC2626" : "#D97706";
  const statusLabel = b.status === "parti" ? "PARTI" : b.status === "annulé" ? "ANNULÉ" : (b.status ?? "PROGRAMMÉ").toUpperCase();
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bordereau de départ</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #111827; }
    .page { max-width: 680px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #3730A3, #4F46E5); padding: 28px 32px 22px; color: #fff; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .company { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .brand-sub { font-size: 11px; opacity: 0.7; margin-top: 2px; letter-spacing: 2px; text-transform: uppercase; }
    .doc-label { background: rgba(255,255,255,0.18); border-radius: 8px; padding: 6px 14px; text-align: right; }
    .doc-label-title { font-size: 10px; opacity: 0.75; letter-spacing: 1px; text-transform: uppercase; }
    .doc-label-num { font-size: 16px; font-weight: 800; }
    .route-banner { margin-top: 18px; background: rgba(255,255,255,0.12); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
    .city { font-size: 26px; font-weight: 900; }
    .arrow { font-size: 22px; opacity: 0.6; flex: 1; text-align: center; }
    .status-pill { background: ${statusColor}; color: #fff; border-radius: 20px; padding: 4px 16px; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .meta-row { display: flex; border-bottom: 1px solid #E5E7EB; }
    .meta-cell { flex: 1; padding: 14px 18px; border-right: 1px solid #E5E7EB; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .meta-value { font-size: 14px; font-weight: 700; }
    .section { padding: 20px 24px 0; }
    .section-title { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #6B7280; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 16px; }
    .revenue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .rev-card { background: #F8FAFC; border-radius: 10px; padding: 14px; border-left: 4px solid; }
    .rev-card.blue { border-color: #1D4ED8; } .rev-card.purple { border-color: #7C3AED; } .rev-card.green { border-color: #059669; }
    .rev-label { font-size: 10px; color: #6B7280; margin-bottom: 6px; }
    .rev-val { font-size: 18px; font-weight: 900; }
    .rev-card.blue .rev-val { color: #1D4ED8; } .rev-card.purple .rev-val { color: #7C3AED; } .rev-card.green .rev-val { color: #059669; }
    .total-bar { background: #111827; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .total-label { color: rgba(255,255,255,0.65); font-size: 12px; }
    .total-val { color: #fff; font-size: 22px; font-weight: 900; }
    .expense-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .expense-cell { flex: 1; border-radius: 10px; padding: 12px 16px; border-left: 4px solid; }
    .fuel-cell { background: #FEF3C7; border-color: #D97706; }
    .net-pos { background: #ECFDF5; border-color: #059669; }
    .net-neg { background: #FEF2F2; border-color: #DC2626; }
    .exp-label { font-size: 10px; color: #6B7280; margin-bottom: 4px; }
    .exp-val { font-size: 16px; font-weight: 800; }
    .fuel-val { color: #D97706; } .pos-val { color: #059669; } .neg-val { color: #DC2626; }
    .no-fuel { background: #FFFBEB; border: 2px dashed #FCD34D; border-radius: 10px; padding: 14px; text-align: center; color: #92400E; font-size: 13px; margin-bottom: 16px; }
    .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 16px 24px; display: flex; justify-content: space-between; }
    .footer-brand { font-size: 13px; font-weight: 800; color: #3730A3; }
    .footer-date { font-size: 11px; color: #9CA3AF; }
    .sig-row { display: flex; gap: 24px; padding: 16px 24px 24px; }
    .sig-box { flex: 1; border-top: 1.5px solid #E5E7EB; padding-top: 8px; }
    .sig-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="company">${agenceName ? agenceName.toUpperCase() : "GOBOOKING"}</div>
          <div class="brand-sub">Transport Interurbain • Côte d'Ivoire</div>
        </div>
        <div class="doc-label">
          <div class="doc-label-title">Bordereau de départ</div>
          <div class="doc-label-num">#${String(b.id ?? "").slice(-6).toUpperCase() || "------"}</div>
        </div>
      </div>
      <div class="route-banner">
        <div class="city">${b.from}</div>
        <div class="arrow">→</div>
        <div class="city">${b.to}</div>
        <div class="status-pill">${statusLabel}</div>
      </div>
    </div>
    <div class="meta-row">
      <div class="meta-cell"><div class="meta-label">Date</div><div class="meta-value">${b.date}</div></div>
      <div class="meta-cell"><div class="meta-label">Départ</div><div class="meta-value">${b.departureTime}</div></div>
      <div class="meta-cell"><div class="meta-label">Bus</div><div class="meta-value">${b.busName}</div></div>
      <div class="meta-cell"><div class="meta-label">Passagers</div><div class="meta-value">${b.passengersCount ?? 0} pax</div></div>
    </div>
    <div class="section" style="padding-top:20px;">
      <div class="section-title">Détail des recettes</div>
      <div class="revenue-grid">
        <div class="rev-card blue"><div class="rev-label">Billets</div><div class="rev-val">${fmt(b.ticketRevenue)}</div></div>
        <div class="rev-card purple"><div class="rev-label">Bagages</div><div class="rev-val">${fmt(b.bagageRevenue)}</div></div>
        <div class="rev-card green"><div class="rev-label">Colis</div><div class="rev-val">${fmt(b.colisRevenue)}</div></div>
      </div>
    </div>
    <div class="section">
      <div class="total-bar"><div class="total-label">RECETTES TOTALES</div><div class="total-val">${fmt(b.totalRecettes)} FCFA</div></div>
    </div>
    <div class="section">
      <div class="section-title">Dépenses &amp; Résultat net</div>
      ${b.hasFuel ? `
      <div class="expense-row">
        <div class="expense-cell fuel-cell"><div class="exp-label">⛽ Carburant${b.fuelDesc ? " — " + b.fuelDesc : ""}</div><div class="exp-val fuel-val">${fmt(b.carburantAmount)} FCFA</div></div>
        <div class="expense-cell ${b.netRevenue >= 0 ? "net-pos" : "net-neg"}"><div class="exp-label">Résultat net</div><div class="exp-val ${b.netRevenue >= 0 ? "pos-val" : "neg-val"}">${b.netRevenue >= 0 ? "+" : ""}${fmt(b.netRevenue)} FCFA</div></div>
      </div>` : `<div class="no-fuel">⚠️ Coût carburant non renseigné — résultat net non calculable</div>`}
    </div>
    <div class="section" style="margin-top:8px;"><div class="section-title">Signatures</div></div>
    <div class="sig-row">
      <div class="sig-box"><div class="sig-label">Agent guichet</div></div>
      <div class="sig-box"><div class="sig-label">Chef d'agence</div></div>
      <div class="sig-box"><div class="sig-label">Chauffeur</div></div>
    </div>
    <div class="footer">
      <div class="footer-brand">GoBooking — Transport Ivoirien</div>
      <div class="footer-date">Édité le ${now}</div>
    </div>
  </div>
</body>
</html>`;
}

/* ─── Types ─── */
type DashData = {
  agence: { id: string; name: string; city: string; address?: string; phone?: string } | null;
  stats: { tripsToday: number; agentsActive: number; passengersToday: number; busesAvailable: number };
};
type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; arrival_time: string; status: string;
  bus_name: string; total_seats: number; passenger_count: number;
  capacity_status?: string; delay_minutes?: number;
  estimated_arrival_time?: string;
};
type Bordereau = {
  id: string; from: string; to: string; date: string; departureTime: string;
  busName: string; busType: string; status: string; passengersCount: number;
  ticketRevenue: number; bagageRevenue: number; colisRevenue: number;
  totalRecettes: number; totalExpenses: number; carburantAmount: number;
  hasFuel: boolean; netRevenue: number; fuelDesc?: string;
};
type AgenceStats = {
  colis:   { aValider: number; enGare: number; enTransit: number; arrives: number; total: number };
  alertes: { active: number };
  revenue: { today: { billets: number; colis: number; bagages: number; total: number; expenses: number; net: number } };
};

/* ─── Helpers ─── */
function tripStatus(s: string): { label: string; color: string; bg: string } {
  if (s === "scheduled")   return { label: "Programmé",    color: "#D97706", bg: "#FEF3C7" };
  if (s === "boarding")    return { label: "Embarquement", color: "#7C3AED", bg: "#EDE9FE" };
  if (s === "en_route")    return { label: "En route",     color: "#166534", bg: "#DCFCE7" };
  if (s === "in_progress") return { label: "En route",     color: "#166534", bg: "#DCFCE7" };
  if (s === "arrived")     return { label: "Arrivé",       color: "#0369A1", bg: "#E0F2FE" };
  if (s === "completed")   return { label: "Terminé",      color: "#6B7280", bg: "#F3F4F6" };
  if (s === "cancelled")   return { label: "Annulé",       color: "#DC2626", bg: "#FEE2E2" };
  return { label: s, color: "#6B7280", bg: "#F3F4F6" };
}

/* ─── Composant Section ─── */
function SectionHeader({ title, accent, count, extra }: {
  title: string; accent: string; count?: string | number; extra?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 }}>
      <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", flex: 1, letterSpacing: -0.3 }}>{title}</Text>
      {count !== undefined && (
        <View style={{ backgroundColor: accent + "20", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: accent }}>{count}</Text>
        </View>
      )}
      {extra}
    </View>
  );
}

/* ─── Page principale ─── */
export default function ChefHome() {
  const { user, token, logoutIfActiveToken } = useAuth();
  const authToken = token ?? "";

  const [dash, setDash]           = useState<DashData | null>(null);
  const [trips, setTrips]         = useState<Trip[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCaisses, setPendingCaisses] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSync, setLastSync]   = useState<Date | null>(null);
  const [bordereaux, setBordereaux] = useState<Bordereau[]>([]);
  const [agenceStats, setAgenceStats] = useState<AgenceStats | null>(null);
  const [fuelModal, setFuelModal] = useState<{ visible: boolean; trip: Bordereau | null }>({ visible: false, trip: null });
  const [fuelAmount, setFuelAmount] = useState("");
  const [fuelDesc, setFuelDesc]   = useState("");
  const [fuelLoading, setFuelLoading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  /* ─── Impression bordereau ─── */
  const printBordereau = async (b: Bordereau) => {
    setPrintingId(b.id);
    try {
      const html = buildBordereauHtml(b, dash?.agence?.name);
      if (Platform.OS === "web") {
        const win = window.open("", "_blank");
        if (win) { win.document.write(html); win.document.close(); win.print(); }
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      Alert.alert("Impression", "Impossible d'imprimer le bordereau.");
    } finally {
      setPrintingId(null);
    }
  };

  /* ─── Chargement données ─── */
  const load = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    if (user?.agentRole && user.agentRole !== "chef_agence") {
      setLoading(false);
      setLoadError(`Rôle détecté : ${user.agentRole}. Ce tableau de bord est réservé au chef d'agence.`);
      return;
    }
    setLoadError(null);
    try {
      const [d, t, cs, as_] = await Promise.all([
        apiFetch<DashData>("/agent/chef/dashboard", { token: authToken }),
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: authToken }),
        apiFetch<{ sessions: any[]; stats: { pending: number; validated: number; rejected: number } }>("/agent/chef/caisses", { token: authToken }),
        apiFetch<AgenceStats>("/agent/chef/stats-agence", { token: authToken }).catch(() => null),
      ]);
      setDash(d);
      setTrips(t.trips ?? []);
      setPendingCaisses((cs as any).stats?.pending ?? 0);
      if (as_) setAgenceStats(as_);
      setLastSync(new Date());
    } catch (e: any) {
      if (e?.httpStatus === 401) { logoutIfActiveToken(authToken); return; }
      setLoadError(e?.message ?? e?.error ?? "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, user, logoutIfActiveToken]);

  const loadBordereaux = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch<{ bordereaux: Bordereau[] }>("/agent/chef/bordereaux", { token: authToken });
      setBordereaux(res.bordereaux ?? []);
    } catch { /* silencieux */ }
  }, [authToken]);

  const submitFuel = useCallback(async () => {
    if (!fuelModal.trip) return;
    const amt = parseInt(fuelAmount);
    if (!fuelAmount || isNaN(amt) || amt <= 0) { Alert.alert("Erreur", "Entrez un montant valide."); return; }
    setFuelLoading(true);
    try {
      await apiFetch(`/agent/chef/bordereaux/${fuelModal.trip.id}/fuel`, {
        token: authToken, method: "POST",
        body: { amount: amt, description: fuelDesc || "Carburant" },
      });
      setFuelModal({ visible: false, trip: null });
      setFuelAmount(""); setFuelDesc("");
      loadBordereaux();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'enregistrer le carburant.");
    } finally { setFuelLoading(false); }
  }, [fuelModal, fuelAmount, fuelDesc, authToken, loadBordereaux]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBordereaux(); }, [loadBordereaux]);
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);
  useOnSync(["boarding", "ticket", "reservation"], load);

  /* ─── Animation LIVE ─── */
  const ND = Platform.OS !== "web";
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: ND }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, ND]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* ─── Données dérivées ─── */
  const firstName  = user?.name?.split(" ")[0] ?? "Chef";
  const agence     = dash?.agence;
  const stats      = dash?.stats;
  const todayStr   = new Date().toISOString().slice(0, 10);
  const tripsToday = trips.filter(t => t.date === todayStr && t.status !== "cancelled");
  const upcoming   = trips.filter(t => t.date > todayStr  && t.status !== "cancelled").slice(0, 4);
  const activeTrips = tripsToday.filter(t => ["boarding", "en_route", "in_progress"].includes(t.status));
  const waitingTrips = tripsToday.filter(t => t.status === "scheduled");
  const doneTrips    = tripsToday.filter(t => ["arrived", "completed"].includes(t.status));
  const missingFuel  = bordereaux.filter(b => !b.hasFuel);
  const activeAlerts = agenceStats?.alertes.active ?? 0;

  /* ─── États de chargement / erreur ─── */
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" }}>
        <ActivityIndicator size="large" color={INDIGO2} />
        <Text style={{ marginTop: 12, color: INDIGO, fontSize: 15 }}>Chargement…</Text>
      </SafeAreaView>
    );
  }
  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF", padding: 32 }}>
        <Feather name="alert-triangle" size={52} color="#DC2626" />
        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "800", color: "#1F2937", textAlign: "center" }}>Tableau de bord indisponible</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 }}>{loadError}</Text>
        <Pressable onPress={() => { setLoading(true); load(); }}
          style={{ marginTop: 20, backgroundColor: INDIGO2, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /* ═══════════════════════════════════════════════════════
     RENDU PRINCIPAL
  ═══════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F6FB" }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={INDIGO} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO2} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* ══════════════════════════════════
            HEADER — Identité + Statut live
        ══════════════════════════════════ */}
        <LinearGradient colors={[INDIGO, INDIGO2, "#6366F1"]} style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>Bonjour, {firstName} 👋</Text>
              <Text style={s.role}>Chef d'Agence</Text>
              {agence && (
                <View style={s.agenceBadge}>
                  <Feather name="map-pin" size={12} color="#A5B4FC" />
                  <Text style={s.agenceText}>{agence.name} — {agence.city}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/agent/home" as never)} style={s.homeBtn}>
              <Feather name="grid" size={20} color="white" />
            </Pressable>
          </View>
          <View style={s.liveBadge}>
            <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
            <Text style={s.liveText}>
              {lastSync
                ? `En direct · màj ${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")}:${lastSync.getSeconds().toString().padStart(2,"0")}`
                : "Connexion…"}
            </Text>
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════
            A. VUE RAPIDE — 4 indicateurs clés
        ══════════════════════════════════ */}
        <View style={s.statsGrid}>
          {[
            { label: "Départs aujourd'hui", value: stats?.tripsToday ?? 0,       color: INDIGO2,   bg: "#EEF2FF",  icon: "navigation" as const },
            { label: "Agents actifs",        value: stats?.agentsActive ?? 0,     color: "#166534", bg: "#DCFCE7",  icon: "users" as const },
            { label: "Passagers aujourd'hui",value: stats?.passengersToday ?? 0,  color: "#D97706", bg: "#FEF3C7",  icon: "user" as const },
            { label: "Alertes actives",      value: activeAlerts,                  color: activeAlerts > 0 ? "#DC2626" : "#6B7280", bg: activeAlerts > 0 ? "#FEE2E2" : "#F3F4F6", icon: "alert-triangle" as const },
          ].map((item, i) => (
            <Pressable
              key={i}
              style={[s.statCard, { backgroundColor: item.bg }]}
              onPress={i === 3 && activeAlerts > 0 ? () => router.push("/agent/suivi" as never) : undefined}
            >
              <View style={[s.statIcon, { backgroundColor: item.color + "20" }]}>
                <Feather name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
              {i === 3 && activeAlerts > 0 && (
                <Text style={{ fontSize: 9, color: "#DC2626", fontWeight: "700", marginTop: 2 }}>Voir alertes →</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Revenus du jour — bande compacte */}
        {agenceStats && (
          <View style={s.revenueStrip}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.revStripLabel}>Billets</Text>
              <Text style={[s.revStripValue, { color: "#1D4ED8" }]}>
                {agenceStats.revenue.today.billets > 0 ? `${Math.round(agenceStats.revenue.today.billets / 1000)}k` : "—"}
              </Text>
            </View>
            <View style={s.revDivider} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.revStripLabel}>Colis</Text>
              <Text style={[s.revStripValue, { color: "#7C3AED" }]}>
                {agenceStats.revenue.today.colis > 0 ? `${Math.round(agenceStats.revenue.today.colis / 1000)}k` : "—"}
              </Text>
            </View>
            <View style={s.revDivider} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.revStripLabel}>Bagages</Text>
              <Text style={[s.revStripValue, { color: "#059669" }]}>
                {agenceStats.revenue.today.bagages > 0 ? `${Math.round(agenceStats.revenue.today.bagages / 1000)}k` : "—"}
              </Text>
            </View>
            <View style={s.revDivider} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.revStripLabel}>Net du jour</Text>
              <Text style={[s.revStripValue, {
                color: agenceStats.revenue.today.net >= 0 ? "#059669" : "#DC2626",
                fontSize: 14,
              }]}>
                {agenceStats.revenue.today.net >= 0 ? "+" : ""}{Math.round(agenceStats.revenue.today.net / 1000)}k
              </Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════
            B. SUPERVISION DES OPÉRATIONS
        ══════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader title="Supervision des opérations" accent={INDIGO2}
            count={`${tripsToday.length} départ${tripsToday.length !== 1 ? "s" : ""} aujourd'hui`}
          />

          {/* Départs EN COURS — mis en avant */}
          {activeTrips.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              {activeTrips.map(t => {
                const st   = tripStatus(t.status);
                const pct  = t.total_seats > 0 ? Math.round((t.passenger_count / t.total_seats) * 100) : 0;
                const isBoarding = t.status === "boarding";
                return (
                  <View key={t.id} style={[s.tripCardActive, { borderColor: isBoarding ? "#DDD6FE" : "#BBF7D0" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isBoarding ? "#EDE9FE" : "#DCFCE7", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={isBoarding ? "checkmark-done-circle-outline" : "navigate-outline"} size={20} color={isBoarding ? "#7C3AED" : "#059669"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>{t.from_city} → {t.to_city}</Text>
                        <Text style={{ fontSize: 12, color: isBoarding ? "#7C3AED" : "#059669", fontWeight: "600", marginTop: 1 }}>
                          {isBoarding ? "⏳ EMBARQUEMENT EN COURS" : "🚌 EN ROUTE"} · {t.departure_time}
                        </Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: st.bg }]}>
                        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1, height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 90 ? "#DC2626" : isBoarding ? "#7C3AED" : "#059669" }} />
                      </View>
                      <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600" }}>{t.passenger_count}/{t.total_seats}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>{t.bus_name}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Départs en attente */}
          {waitingTrips.length > 0 && (
            <>
              <Text style={s.subLabel}>EN ATTENTE DE DÉPART ({waitingTrips.length})</Text>
              {waitingTrips.map(t => {
                const pct = t.total_seats > 0 ? Math.round((t.passenger_count / t.total_seats) * 100) : 0;
                return (
                  <View key={t.id} style={s.tripCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tripRoute}>{t.from_city} → {t.to_city}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <Feather name="clock" size={11} color="#9CA3AF" />
                          <Text style={s.tripMeta}>{t.departure_time}</Text>
                          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>·</Text>
                          <Text style={s.tripMeta}>{t.bus_name}</Text>
                        </View>
                      </View>
                      <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}>
                        <Text style={[s.badgeText, { color: "#D97706" }]}>Programmé</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <View style={{ flex: 1, height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                        <View style={{ height: 4, borderRadius: 2, width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 90 ? "#D97706" : "#4ADE80" }} />
                      </View>
                      <Text style={{ fontSize: 11, color: "#6B7280" }}>{t.passenger_count}/{t.total_seats} pax</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Départs terminés */}
          {doneTrips.length > 0 && (
            <>
              <Text style={[s.subLabel, { marginTop: 12 }]}>TERMINÉS AUJOURD'HUI ({doneTrips.length})</Text>
              {doneTrips.map(t => (
                <View key={t.id} style={[s.tripCard, { backgroundColor: "#F9FAFB" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check-circle" size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.tripRoute, { color: "#6B7280" }]}>{t.from_city} → {t.to_city}</Text>
                      <Text style={[s.tripMeta, { marginTop: 2 }]}>{t.departure_time} · {t.bus_name} · {t.passenger_count} pax</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: "#F3F4F6" }]}>
                      <Text style={[s.badgeText, { color: "#6B7280" }]}>Terminé</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Aucun départ */}
          {tripsToday.length === 0 && (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={28} color="#9CA3AF" />
              <Text style={s.emptyText}>Aucun départ aujourd'hui</Text>
            </View>
          )}

          {/* Prochains départs */}
          {upcoming.length > 0 && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 }}>
                <Text style={[s.subLabel, { marginTop: 0 }]}>PROCHAINS DÉPARTS</Text>
                <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
                  <Text style={{ fontSize: 12, color: INDIGO2, fontWeight: "700" }}>Tout voir →</Text>
                </Pressable>
              </View>
              {upcoming.map(t => (
                <View key={t.id} style={[s.tripCard, { backgroundColor: "#F8FAFF" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="calendar" size={14} color="#A5B4FC" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.tripRoute}>{t.from_city} → {t.to_city}</Text>
                      <Text style={s.tripMeta}>{t.date} · {t.departure_time}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: "#EEF2FF" }]}>
                      <Text style={[s.badgeText, { color: INDIGO2 }]}>Programmé</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Bouton accès gestion */}
          <Pressable style={[s.sectionCTA, { backgroundColor: INDIGO2 }]} onPress={() => router.push("/agent/chef-trips" as never)}>
            <Feather name="list" size={15} color="white" />
            <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Gérer tous les départs</Text>
          </Pressable>
        </View>

        {/* ══════════════════════════════════
            C. CAISSES DES AGENTS
        ══════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader title="Caisses des agents" accent="#D97706"
            count={pendingCaisses > 0 ? `${pendingCaisses} à valider` : "À jour"}
          />

          <Pressable
            style={[s.caisseCard, pendingCaisses > 0 && s.caisseCardUrgent]}
            onPress={() => router.push({ pathname: "/agent/chef-trips", params: { tab: "caisses" } } as never)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: pendingCaisses > 0 ? "#FEF3C7" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                <Feather name="dollar-sign" size={22} color={pendingCaisses > 0 ? "#D97706" : "#9CA3AF"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
                  {pendingCaisses > 0 ? `${pendingCaisses} caisse${pendingCaisses > 1 ? "s" : ""} en attente` : "Aucune caisse en attente"}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                  {pendingCaisses > 0 ? "Valider ou rejeter les soumissions des agents" : "Toutes les caisses ont été traitées"}
                </Text>
              </View>
              {pendingCaisses > 0 && (
                <View style={{ backgroundColor: "#D97706", borderRadius: 14, minWidth: 32, height: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{pendingCaisses}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={18} color="#9CA3AF" />
            </View>
          </Pressable>

          {/* Colis à valider */}
          {agenceStats && agenceStats.colis.aValider > 0 && (
            <Pressable
              style={[s.caisseCard, { borderColor: "#DDD6FE", marginTop: 8 }]}
              onPress={() => router.push("/agent/colis" as never)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={22} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
                    {agenceStats.colis.aValider} colis à valider
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                    En transit : {agenceStats.colis.enTransit} · En gare : {agenceStats.colis.enGare}
                  </Text>
                </View>
                <View style={{ backgroundColor: "#7C3AED", borderRadius: 14, minWidth: 32, height: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{agenceStats.colis.aValider}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </View>
            </Pressable>
          )}
        </View>

        {/* ══════════════════════════════════
            D. BORDEREAUX DE DÉPART
        ══════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Bordereaux de départ"
            accent="#0369A1"
            count={`${bordereaux.length} départ${bordereaux.length !== 1 ? "s" : ""}`}
            extra={
              missingFuel.length > 0
                ? <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="alert-circle" size={11} color="#D97706" />
                    <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>{missingFuel.length} sans carburant</Text>
                  </View>
                : undefined
            }
          />

          {bordereaux.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="file-text" size={28} color="#9CA3AF" />
              <Text style={s.emptyText}>Aucun départ ces 7 derniers jours</Text>
            </View>
          ) : (
            bordereaux.slice(0, 10).map((b) => (
              <View key={b.id} style={[s.bordCard, !b.hasFuel && s.bordCardIncomplete]}>

                {/* Ligne 1 : Route + statut carburant */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827", letterSpacing: -0.3 }}>
                      {b.from} → {b.to}
                    </Text>
                  </View>
                  {b.hasFuel ? (
                    <View style={s.statusPillOk}>
                      <Feather name="check-circle" size={11} color="#059669" />
                      <Text style={[s.statusPillText, { color: "#059669" }]}>Clôturé</Text>
                    </View>
                  ) : (
                    <View style={s.statusPillWarn}>
                      <Feather name="alert-circle" size={11} color="#D97706" />
                      <Text style={[s.statusPillText, { color: "#D97706" }]}>Carburant manquant</Text>
                    </View>
                  )}
                </View>

                {/* Ligne 2 : Métadonnées du trajet */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Feather name="calendar" size={11} color="#9CA3AF" />
                  <Text style={s.tripMeta}>{b.date}</Text>
                  <Text style={{ color: "#D1D5DB" }}>·</Text>
                  <Feather name="clock" size={11} color="#9CA3AF" />
                  <Text style={s.tripMeta}>{b.departureTime}</Text>
                  <Text style={{ color: "#D1D5DB" }}>·</Text>
                  <Feather name="truck" size={11} color="#9CA3AF" />
                  <Text style={s.tripMeta}>{b.busName}</Text>
                  <Text style={{ color: "#D1D5DB" }}>·</Text>
                  <Feather name="users" size={11} color="#9CA3AF" />
                  <Text style={s.tripMeta}>{b.passengersCount} pax</Text>
                </View>

                {/* Ligne 3 : Recettes ventilées */}
                <View style={s.revenueRow}>
                  <View style={s.revTile}>
                    <Text style={[s.revTileLabel, { color: "#1D4ED8" }]}>Billets</Text>
                    <Text style={[s.revTileValue, { color: "#1D4ED8" }]}>
                      {b.ticketRevenue > 0 ? `${Math.round(b.ticketRevenue / 1000)}k` : "—"}
                    </Text>
                  </View>
                  <View style={s.revTile}>
                    <Text style={[s.revTileLabel, { color: "#7C3AED" }]}>Bagages</Text>
                    <Text style={[s.revTileValue, { color: "#7C3AED" }]}>
                      {b.bagageRevenue > 0 ? `${Math.round(b.bagageRevenue / 1000)}k` : "—"}
                    </Text>
                  </View>
                  <View style={s.revTile}>
                    <Text style={[s.revTileLabel, { color: "#059669" }]}>Colis</Text>
                    <Text style={[s.revTileValue, { color: "#059669" }]}>
                      {b.colisRevenue > 0 ? `${Math.round(b.colisRevenue / 1000)}k` : "—"}
                    </Text>
                  </View>
                </View>

                {/* Ligne 4 : Total + Net ou carburant manquant */}
                <View style={[s.totalRow, { borderTopColor: "#F1F5F9" }]}>
                  <View>
                    <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "600" }}>RECETTE TOTALE</Text>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827", marginTop: 1 }}>
                      {b.totalRecettes.toLocaleString()} FCFA
                    </Text>
                  </View>
                  {b.hasFuel ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "600" }}>NET (après carburant)</Text>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: b.netRevenue >= 0 ? "#059669" : "#DC2626", marginTop: 1 }}>
                        {b.netRevenue >= 0 ? "+" : ""}{b.netRevenue.toLocaleString()} FCFA
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "600" }}>CARBURANT</Text>
                      <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "700", marginTop: 1 }}>Non renseigné</Text>
                    </View>
                  )}
                </View>

                {/* Ligne 5 : Actions */}
                <View style={s.actionsRow}>
                  {!b.hasFuel && (
                    <Pressable
                      style={s.btnPrimary}
                      onPress={() => { setFuelModal({ visible: true, trip: b }); setFuelAmount(""); setFuelDesc(""); }}
                    >
                      <Feather name="plus-circle" size={14} color="white" />
                      <Text style={s.btnPrimaryText}>Ajouter carburant</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.btnSecondary, b.hasFuel && { flex: 1 }]}
                    onPress={() => printBordereau(b)}
                    disabled={printingId === b.id}
                  >
                    {printingId === b.id
                      ? <ActivityIndicator size="small" color={INDIGO} />
                      : <Feather name="printer" size={14} color={INDIGO} />}
                    <Text style={s.btnSecondaryText}>
                      {printingId === b.id ? "Génération…" : "Imprimer le bordereau"}
                    </Text>
                  </Pressable>
                </View>

              </View>
            ))
          )}
        </View>

        {/* Raccourci rapport */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Pressable
            style={[s.sectionCTA, { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" }]}
            onPress={() => router.push("/agent/rapport" as never)}
          >
            <Feather name="bar-chart-2" size={15} color={INDIGO2} />
            <Text style={{ color: INDIGO2, fontSize: 13, fontWeight: "700" }}>Voir les rapports de l'agence</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* ── Modal Carburant ── */}
      <Modal visible={fuelModal.visible} transparent animationType="slide" onRequestClose={() => setFuelModal({ visible: false, trip: null })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={s.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>⛽ Coût carburant</Text>
                {fuelModal.trip && (
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    {fuelModal.trip.from} → {fuelModal.trip.to} · {fuelModal.trip.date}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setFuelModal({ visible: false, trip: null })} style={s.modalClose}>
                <Feather name="x" size={18} color="#6B7280" />
              </Pressable>
            </View>
            {fuelModal.trip && (
              <View style={{ backgroundColor: "#F8FAFF", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: "#374151", fontWeight: "600" }}>Recettes à couvrir</Text>
                <Text style={{ fontSize: 13, color: INDIGO2, fontWeight: "800" }}>{fuelModal.trip.totalRecettes.toLocaleString()} FCFA</Text>
              </View>
            )}
            <Text style={s.inputLabel}>Montant carburant (FCFA) *</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: 45 000"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={fuelAmount}
              onChangeText={setFuelAmount}
            />
            <Text style={[s.inputLabel, { marginTop: 12 }]}>Description (optionnel)</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Plein gasoil Bouaké"
              placeholderTextColor="#9CA3AF"
              value={fuelDesc}
              onChangeText={setFuelDesc}
            />
            <Pressable
              onPress={submitFuel}
              disabled={fuelLoading}
              style={[s.modalBtn, fuelLoading && { opacity: 0.6 }]}
            >
              {fuelLoading
                ? <ActivityIndicator color="white" />
                : <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>Valider le bordereau carburant</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── FAB ── */}
      <Pressable style={s.fab} onPress={() => router.push("/agent/chef-trips" as never)}>
        <Feather name="plus" size={24} color="white" />
      </Pressable>

    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  greeting: { fontSize: 22, fontWeight: "800", color: "white" },
  role: { fontSize: 13, color: "#A5B4FC", marginTop: 2, marginBottom: 6 },
  agenceBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  agenceText: { color: "#C7D2FE", fontSize: 13 },
  homeBtn: { padding: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  liveText: { color: "#C7D2FE", fontSize: 12 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
    paddingHorizontal: 16, marginTop: -16, paddingTop: 0,
  },
  statCard: { flex: 1, minWidth: "44%", borderRadius: 18, padding: 16, elevation: 2 },
  statIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: "#6B7280", marginTop: 3, fontWeight: "600" },

  revenueStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "white", marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: "#F1F5F9",
  },
  revStripLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "600", marginBottom: 3 },
  revStripValue: { fontSize: 15, fontWeight: "800" },
  revDivider: { width: 1, height: 36, backgroundColor: "#F1F5F9" },

  section: { marginHorizontal: 16, marginTop: 28 },
  subLabel: { fontSize: 10, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1, marginBottom: 8 },

  tripCardActive: {
    backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 8,
    borderWidth: 2, elevation: 1,
  },
  tripCard: {
    backgroundColor: "white", borderRadius: 14, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: "#EEF2F8",
  },
  tripRoute: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripMeta: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  sectionCTA: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 14, marginTop: 12,
  },

  caisseCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: "#F1F5F9",
  },
  caisseCardUrgent: {
    borderColor: "#FCD34D", backgroundColor: "#FFFBEB",
  },

  /* Bordereaux */
  bordCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#EEF2F8",
  },
  bordCardIncomplete: {
    borderColor: "#FDE68A", borderWidth: 2,
  },
  statusPillOk: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillWarn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  revenueRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  revTile: { flex: 1, backgroundColor: "#F8FAFF", borderRadius: 10, padding: 9, alignItems: "center" },
  revTileLabel: { fontSize: 9, fontWeight: "700", marginBottom: 3 },
  revTileValue: { fontSize: 13, fontWeight: "900" },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 12, marginBottom: 12 },

  actionsRow: { flexDirection: "row", gap: 8 },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: INDIGO2, borderRadius: 12, paddingVertical: 11 },
  btnPrimaryText: { color: "white", fontSize: 12, fontWeight: "700" },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F1F5F9", borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: "#E2E8F0" },
  btnSecondaryText: { color: INDIGO, fontSize: 12, fontWeight: "700" },

  emptyCard: {
    backgroundColor: "white", borderRadius: 16, padding: 28,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#F1F5F9",
  },
  emptyText: { color: "#9CA3AF", fontSize: 14 },

  /* Modal */
  modal: {
    backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 4,
  },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    padding: 14, fontSize: 16, fontWeight: "700", color: "#111827",
  },
  modalBtn: {
    backgroundColor: INDIGO2, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 16,
  },

  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: INDIGO2, justifyContent: "center", alignItems: "center",
    elevation: 8,
  },
});
