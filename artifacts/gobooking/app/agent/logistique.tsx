import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { BASE_URL } from "@/utils/api";

const BLUE     = "#0369A1";
const BLUE_D   = "#075985";
const BLUE_L   = "#E0F2FE";
const BLUE_MID = "#0EA5E9";

/* ── helpers ─────────────────────────────────────────────────────── */
function authHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_BUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente: { label: "En attente",  color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
  en_route:   { label: "En route",    color: "#166534", bg: "#DCFCE7", icon: "navigate-outline" },
  arrivé:     { label: "Arrivé",      color: "#0369A1", bg: "#E0F2FE", icon: "checkmark-circle-outline" },
  en_panne:   { label: "En panne",    color: "#DC2626", bg: "#FEE2E2", icon: "warning-outline" },
};

const STATUS_TRIP: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: "En préparation", color: "#D97706", bg: "#FEF3C7" },
  in_progress: { label: "En cours",       color: "#166534", bg: "#DCFCE7" },
  completed:   { label: "Terminé",        color: "#64748B", bg: "#F1F5F9" },
  cancelled:   { label: "Annulé",         color: "#DC2626", bg: "#FEE2E2" },
};

function getBusStatus(s: string) {
  return STATUS_BUS[s] ?? { label: s, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
}

function getTripStatus(s: string) {
  return STATUS_TRIP[s] ?? { label: s, color: "#64748B", bg: "#F1F5F9" };
}

/* ── types ───────────────────────────────────────────────────────── */
interface BusStat { busesEnRoute: number; busesEnAttente: number; busesEnPanne: number; colisEnAttente: number; ticketsVendusAuj: number }
interface BusItem { id: string; busName: string; plateNumber: string; busType: string; capacity: number; logisticStatus: string; currentLocation?: string; condition: string; companyId: string }
interface TripItem { id: string; from: string; to: string; departureTime: string; date: string; status: string; busId?: string; busName?: string; price: number }
interface AlertItem { id: string; type: string; busId?: string; busName?: string; message: string; status: string; createdAt: string }

interface Overview {
  stats:  BusStat;
  buses:  BusItem[];
  trips:  TripItem[];
  alerts: AlertItem[];
}

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════ */
export default function LogistiqueScreen() {
  const { user, token, logout } = useAuth();
  const [data,       setData]       = useState<Overview | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId,   setActionId]   = useState<string | null>(null);

  const isAgent = user?.role === "agent";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/logistique/overview`, {
        headers: authHeader(token),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const doAction = async (busId: string, action: "mettre-en-route" | "marquer-arrive" | "signaler-panne" | "remettre-en-attente") => {
    const labels: Record<string, string> = {
      "mettre-en-route":      "Mettre en route",
      "marquer-arrive":       "Marquer arrivé",
      "signaler-panne":       "Signaler une panne",
      "remettre-en-attente":  "Remettre en attente",
    };

    if (action === "signaler-panne") {
      Alert.prompt(
        "Signaler une panne",
        "Décrivez brièvement le problème :",
        async (issue) => {
          setActionId(busId);
          try {
            await fetch(`${BASE_URL}/agent/logistique/buses/${busId}/signaler-panne`, {
              method: "POST",
              headers: { ...authHeader(token), "Content-Type": "application/json" },
              body: JSON.stringify({ issue }),
            });
            await load(true);
          } catch {}
          setActionId(null);
        },
        "plain-text",
      );
      return;
    }

    Alert.alert(
      labels[action],
      "Confirmer cette action ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            setActionId(busId);
            try {
              await fetch(`${BASE_URL}/agent/logistique/buses/${busId}/${action}`, {
                method: "POST",
                headers: { ...authHeader(token), "Content-Type": "application/json" },
              });
              await load(true);
            } catch { Alert.alert("Erreur", "Impossible d'effectuer l'action."); }
            setActionId(null);
          },
        },
      ],
    );
  };

  if (!isAgent) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Accès non autorisé</Text>
        <TouchableOpacity style={{ backgroundColor: BLUE, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE_D} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="bus" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>🚛 Logistique</Text>
            <Text style={S.headerSub}>Gestion des bus & trajets</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déco.</Text>
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={{ marginTop: 12, color: "#64748B" }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── STATS ── */}
          {data?.stats && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>📊 Tableau de bord</Text>
              <View style={S.statsGrid}>
                <StatCard label="Bus en route"    value={data.stats.busesEnRoute}    color="#166534" bg="#DCFCE7" icon="navigate" />
                <StatCard label="En attente"      value={data.stats.busesEnAttente}  color="#D97706" bg="#FEF3C7" icon="time" />
                <StatCard label="En panne"        value={data.stats.busesEnPanne}    color="#DC2626" bg="#FEE2E2" icon="warning" />
                <StatCard label="Colis en cours"  value={data.stats.colisEnAttente}  color="#7C3AED" bg="#EDE9FE" icon="cube" />
                <StatCard label="Tickets auj."    value={data.stats.ticketsVendusAuj} color="#0369A1" bg="#E0F2FE" icon="ticket" />
              </View>
            </View>
          )}

          {/* ── ALERTS ── */}
          {data?.alerts && data.alerts.length > 0 && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>🚨 Alertes actives ({data.alerts.length})</Text>
              {data.alerts.map(a => (
                <View key={a.id} style={S.alertCard}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                  <Text style={S.alertMsg} numberOfLines={2}>{a.message}</Text>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={S.alertTime}>{new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>
                    <View style={[S.badge, { backgroundColor: a.type === "panne" ? "#FEE2E2" : "#FEF3C7" }]}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: a.type === "panne" ? "#DC2626" : "#D97706" }}>{a.type.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── BUSES ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🚌 Flotte de bus ({data?.buses?.length ?? 0})</Text>
            {!data?.buses?.length && (
              <View style={S.empty}><Text style={S.emptyTxt}>Aucun bus trouvé</Text></View>
            )}
            {data?.buses?.map(bus => {
              const st = getBusStatus(bus.logisticStatus);
              const busy = actionId === bus.id;
              return (
                <View key={bus.id} style={S.busCard}>
                  <View style={S.busTop}>
                    <View style={S.busIconBox}>
                      <Ionicons name="bus" size={22} color={BLUE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.busName}>{bus.busName}</Text>
                      <Text style={S.busPlate}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
                      {bus.currentLocation && (
                        <Text style={S.busLoc}><Ionicons name="location-outline" size={11} color="#64748B" /> {bus.currentLocation}</Text>
                      )}
                    </View>
                    <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon as any} size={12} color={st.color} />
                      <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={S.busActions}>
                    {bus.logisticStatus !== "en_route" && bus.logisticStatus !== "en_panne" && (
                      <ActionBtn label="Mettre en route" icon="navigate-outline" color="#166534" bg="#DCFCE7"
                        busy={busy} onPress={() => doAction(bus.id, "mettre-en-route")} />
                    )}
                    {bus.logisticStatus === "en_route" && (
                      <ActionBtn label="Marquer arrivé" icon="checkmark-circle-outline" color="#0369A1" bg="#E0F2FE"
                        busy={busy} onPress={() => doAction(bus.id, "marquer-arrive")} />
                    )}
                    {bus.logisticStatus !== "en_panne" && (
                      <ActionBtn label="Signaler panne" icon="warning-outline" color="#DC2626" bg="#FEE2E2"
                        busy={busy} onPress={() => doAction(bus.id, "signaler-panne")} />
                    )}
                    {bus.logisticStatus === "en_panne" && (
                      <ActionBtn label="Remettre en attente" icon="refresh-outline" color="#D97706" bg="#FEF3C7"
                        busy={busy} onPress={() => doAction(bus.id, "remettre-en-attente")} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── TRIPS ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🗺️ Trajets du jour ({data?.trips?.length ?? 0})</Text>
            {!data?.trips?.length && (
              <View style={S.empty}><Text style={S.emptyTxt}>Aucun trajet aujourd'hui</Text></View>
            )}
            {data?.trips?.map(trip => {
              const st = getTripStatus(trip.status);
              return (
                <View key={trip.id} style={S.tripCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                    <Text style={S.tripSub}>{trip.departureTime} · {trip.busName ?? "Bus"}</Text>
                  </View>
                  <View style={[S.badge, { backgroundColor: st.bg }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: st.color }}>{st.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Navigate to suivi */}
          <TouchableOpacity style={S.suiviBtn} onPress={() => router.push("/agent/suivi" as never)}>
            <Ionicons name="radio-outline" size={18} color="#fff" />
            <Text style={S.suiviBtnTxt}>Ouvrir Suivi & Alertes temps réel</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── Sub-components ───────────────────────────────────────────────── */
function StatCard({ label, value, color, bg, icon }: { label: string; value: number; color: string; bg: string; icon: string }) {
  return (
    <View style={[S.statCard, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({ label, icon, color, bg, busy, onPress }: { label: string; icon: string; color: string; bg: string; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[S.actionBtn, { backgroundColor: bg, borderColor: color + "50" }]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.7}
    >
      {busy
        ? <ActivityIndicator size="small" color={color} />
        : <Ionicons name={icon as any} size={14} color={color} />
      }
      <Text style={[S.actionBtnTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Styles ───────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: "#F0F9FF" },
  header:     { backgroundColor: BLUE_D, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle:{ color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:  { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  logoutBtn:  { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutTxt:  { color: "#fff", fontSize: 12, fontWeight: "700" },

  section:      { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard:  { flex: 1, minWidth: "28%", borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, color: "#475569", textAlign: "center", fontWeight: "600" },

  alertCard:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF1F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECDD3" },
  alertMsg:   { flex: 1, fontSize: 12, color: "#991B1B", fontWeight: "600" },
  alertTime:  { fontSize: 10, color: "#DC2626", fontWeight: "600" },

  busCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12 },
  busTop:     { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: BLUE_L, justifyContent: "center", alignItems: "center" },
  busName:    { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  busPlate:   { fontSize: 11, color: "#64748B", marginTop: 1 },
  busLoc:     { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusBadge:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTxt:  { fontSize: 10, fontWeight: "700" },
  busActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  actionBtnTxt: { fontSize: 11, fontWeight: "700" },

  tripCard:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tripRoute:  { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  tripSub:    { fontSize: 11, color: "#64748B", marginTop: 2 },

  badge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  empty:      { backgroundColor: "#fff", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyTxt:   { color: "#94A3B8", fontSize: 14 },

  suiviBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20 },
  suiviBtnTxt:{ color: "#fff", fontSize: 14, fontWeight: "800", flex: 1, textAlign: "center" },
});
