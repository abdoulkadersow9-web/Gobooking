import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
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

const RED    = "#BE123C";
const RED_D  = "#9F1239";
const RED_L  = "#FFF1F2";
const RED_M  = "#FDA4AF";

function authHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const RESPONSE_OPTIONS = [
  { id: "panne",    label: "🔧 Panne mécanique", color: "#DC2626", bg: "#FEE2E2" },
  { id: "controle", label: "🚔 Contrôle routier", color: "#D97706", bg: "#FEF3C7" },
  { id: "pause",    label: "☕ Pause normale",     color: "#166534", bg: "#DCFCE7" },
];

const BUS_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente: { label: "En attente",  color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
  en_route:   { label: "En route",    color: "#166534", bg: "#DCFCE7", icon: "navigate-outline" },
  arrivé:     { label: "Arrivé",      color: "#0369A1", bg: "#E0F2FE", icon: "checkmark-circle-outline" },
  en_panne:   { label: "En panne",    color: "#DC2626", bg: "#FEE2E2", icon: "warning-outline" },
};

interface BusItem {
  id: string; busName: string; plateNumber: string;
  logisticStatus: string; currentLocation?: string; issue?: string;
}
interface TripItem {
  id: string; from: string; to: string; departureTime: string; status: string; busId?: string; busName?: string;
}
interface AlertItem {
  id: string; type: string; busId?: string; busName?: string;
  agentId: string; agentName?: string;
  message: string; status: string;
  response?: string | null; respondedAt?: string | null;
  responseRequested?: boolean; createdAt: string;
}
interface Overview { buses: BusItem[]; trips: TripItem[]; alerts: AlertItem[] }

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════ */
export default function SuiviScreen() {
  const { user, token, logout } = useAuth();
  const [data,        setData]        = useState<Overview | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [triggerBus,  setTriggerBus]  = useState<BusItem | null>(null);
  const [acting,      setActing]      = useState(false);

  /* Alarm pulse animation */
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasAlerts = (data?.alerts?.length ?? 0) > 0;

  useEffect(() => {
    if (hasAlerts) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [hasAlerts]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/overview`, {
        headers: authHeader(token),
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  /* ── Trigger alert ── */
  const doTrigger = async (bus: BusItem, message?: string) => {
    setActing(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/trigger`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({ busId: bus.id, message }),
      });
      if (res.ok) {
        Alert.alert("✅ Alerte déclenchée", "L'Agent Suivi est notifié.");
        setTriggerBus(null);
        await load(true);
      } else {
        Alert.alert("Erreur", "Impossible de déclencher l'alerte.");
      }
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setActing(false);
  };

  /* ── Demander réponse à l'agent en route ── */
  const demanderReponse = async (alertId: string) => {
    setActing(true);
    try {
      await fetch(`${BASE_URL}/agent/suivi/alerts/${alertId}/demander-reponse`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
      });
      Alert.alert("📨 Demande envoyée", "L'agent en route va être notifié et devra répondre.");
      await load(true);
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setActing(false);
  };

  /* ── Confirm / resolve alert ── */
  const doConfirm = async (alertId: string) => {
    setActing(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/${alertId}/confirm`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
      });
      if (res.ok) {
        Alert.alert("✅ Alerte résolue", "La situation est normalisée.");
        await load(true);
      }
    } catch {}
    setActing(false);
  };

  if (user?.role !== "agent") {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Accès non autorisé</Text>
        <TouchableOpacity style={{ backgroundColor: RED, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={RED_D} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="radio" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>📡 Suivi & Alertes</Text>
            <Text style={S.headerSub}>
              {hasAlerts ? `🚨 ${data!.alerts.length} alerte(s) active(s)` : "Surveillance en temps réel"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity onPress={() => load(true)} style={S.refreshBtn}>
            <Feather name="refresh-cw" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={S.logoutBtn}>
            <Text style={S.logoutTxt}>Déco.</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={{ marginTop: 12, color: "#64748B" }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          showsVerticalScrollIndicator={false}
        >

          {/* ── ALERT PANEL ── */}
          {hasAlerts && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={S.alarmBanner}>
                <Ionicons name="warning" size={24} color="#fff" />
                <Text style={S.alarmTxt}>🚨 {data!.alerts.length} ALERTE{data!.alerts.length > 1 ? "S" : ""} ACTIVE{data!.alerts.length > 1 ? "S" : ""}</Text>
                <Ionicons name="warning" size={24} color="#fff" />
              </View>
            </Animated.View>
          )}

          {/* ── ALERTS LIST ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🚨 Alertes ({data?.alerts?.length ?? 0})</Text>
            {!data?.alerts?.length && (
              <View style={S.empty}><Ionicons name="checkmark-circle" size={32} color="#4ADE80" />
                <Text style={S.emptyTxt}>Aucune alerte active</Text>
              </View>
            )}
            {data?.alerts?.map(alert => {
              const hasResponse   = !!alert.response;
              const reqRequested  = !!alert.responseRequested;
              const responseOpt   = RESPONSE_OPTIONS.find(r => r.id === alert.response);
              return (
                <View key={alert.id} style={S.alertCard}>
                  {/* Top row */}
                  <View style={S.alertTop}>
                    <View style={[S.alertTypeBadge, { backgroundColor: alert.type === "panne" ? "#FEE2E2" : RED_L }]}>
                      <Text style={[S.alertTypeTxt, { color: alert.type === "panne" ? "#DC2626" : RED }]}>
                        {alert.type.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={S.alertBus}>{alert.busName ?? "Bus inconnu"}</Text>
                    <Text style={S.alertTime}>
                      {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>

                  {/* Message */}
                  <Text style={S.alertMsg}>{alert.message}</Text>
                  <Text style={S.alertAgent}>Par {alert.agentName ?? alert.agentId}</Text>

                  {/* State indicators */}
                  {hasResponse && responseOpt && (
                    <View style={[S.responsePill, { backgroundColor: responseOpt.bg }]}>
                      <Text style={[S.responseTxt, { color: responseOpt.color }]}>
                        ✅ Réponse agent route : {responseOpt.label}
                      </Text>
                    </View>
                  )}
                  {!hasResponse && reqRequested && (
                    <View style={S.waitPill}>
                      <ActivityIndicator size="small" color="#D97706" />
                      <Text style={S.waitTxt}>⏳ En attente de réponse — agent en route notifié</Text>
                    </View>
                  )}
                  {!hasResponse && !reqRequested && (
                    <View style={[S.waitPill, { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" }]}>
                      <Ionicons name="alert-circle-outline" size={14} color={RED} />
                      <Text style={[S.waitTxt, { color: RED }]}>🚨 Aucune réponse — action requise</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={S.alertActions}>
                    {!hasResponse && !reqRequested && (
                      <TouchableOpacity
                        style={[S.alertBtn, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}
                        onPress={() => demanderReponse(alert.id)}
                        disabled={acting}
                      >
                        <Ionicons name="send-outline" size={14} color="#D97706" />
                        <Text style={[S.alertBtnTxt, { color: "#D97706" }]}>Demander réponse</Text>
                      </TouchableOpacity>
                    )}
                    {hasResponse && (
                      <TouchableOpacity
                        style={[S.alertBtn, { backgroundColor: "#DCFCE7", borderColor: "#4ADE80" }]}
                        onPress={() => doConfirm(alert.id)}
                        disabled={acting}
                      >
                        {acting ? <ActivityIndicator size="small" color="#166534" /> : <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />}
                        <Text style={[S.alertBtnTxt, { color: "#166534" }]}>Confirmer résolution</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── BUS LIST ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🚌 Bus en temps réel ({data?.buses?.length ?? 0})</Text>
            {!data?.buses?.length && (
              <View style={S.empty}><Text style={S.emptyTxt}>Aucun bus trouvé</Text></View>
            )}
            {data?.buses?.map(bus => {
              const st = BUS_STATUS[bus.logisticStatus] ?? { label: bus.logisticStatus, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
              const trip = data.trips.find(t => t.busId === bus.id);
              return (
                <View key={bus.id} style={S.busCard}>
                  <View style={S.busTop}>
                    <View style={[S.busStatus, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon as any} size={20} color={st.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.busName}>{bus.busName}</Text>
                      <Text style={S.busPlate}>{bus.plateNumber}</Text>
                      {bus.currentLocation && <Text style={S.busLoc}>📍 {bus.currentLocation}</Text>}
                      {trip && <Text style={S.busTrip}>🗺️ {trip.from} → {trip.to} · {trip.departureTime}</Text>}
                      {bus.issue && <Text style={S.busIssue}>⚠️ {bus.issue}</Text>}
                    </View>
                    <View style={[S.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* Trigger alert button */}
                  <TouchableOpacity
                    style={S.triggerBtn}
                    onPress={() => setTriggerBus(bus)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="warning-outline" size={14} color={RED} />
                    <Text style={S.triggerBtnTxt}>Déclencher une alerte</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Trigger Alert Modal ── */}
      <Modal visible={!!triggerBus} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>⚠️ Déclencher une alerte</Text>
            <Text style={S.modalSub}>Bus : {triggerBus?.busName} ({triggerBus?.plateNumber})</Text>

            <Text style={S.modalLabel}>Message (optionnel)</Text>
            {/* Simple quick options */}
            {[
              "Arrêt anormal non prévu",
              "Bus immobilisé sur route",
              "Besoin d'assistance immédiate",
            ].map(msg => (
              <TouchableOpacity
                key={msg}
                style={S.msgOption}
                onPress={() => triggerBus && doTrigger(triggerBus, msg)}
              >
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={S.msgOptionTxt}>{msg}</Text>
              </TouchableOpacity>
            ))}

            <View style={S.modalActions}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: "#F1F5F9" }]}
                onPress={() => setTriggerBus(null)}>
                <Text style={{ fontWeight: "700", color: "#475569" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: RED }]}
                onPress={() => triggerBus && doTrigger(triggerBus)}
                disabled={acting}
              >
                {acting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontWeight: "700", color: "#fff" }}>Alerte générale</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rapport button */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14, margin: 16, marginTop: 0, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="alert-triangle" size={16} color="#fff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>📋 Faire un rapport</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ── Styles ───────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: "#FFF1F2" },
  header:     { backgroundColor: RED_D, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle:{ color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:  { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  logoutBtn:  { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutTxt:  { color: "#fff", fontSize: 12, fontWeight: "700" },

  alarmBanner:{ backgroundColor: RED, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14, shadowColor: RED, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  alarmTxt:   { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },

  section:      { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  empty:        { backgroundColor: "#fff", borderRadius: 12, padding: 28, alignItems: "center", gap: 8 },
  emptyTxt:     { color: "#94A3B8", fontSize: 14, fontWeight: "600" },

  alertCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 10, borderLeftWidth: 4, borderLeftColor: RED, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  alertTop:     { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTypeBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  alertTypeTxt: { fontSize: 10, fontWeight: "800" },
  alertBus:     { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A" },
  alertTime:    { fontSize: 11, color: "#94A3B8" },
  alertMsg:     { fontSize: 13, color: "#1E293B", fontWeight: "600", lineHeight: 18 },
  alertAgent:   { fontSize: 11, color: "#94A3B8" },
  responsePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  responseTxt:  { fontSize: 12, fontWeight: "700" },
  waitPill:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  waitTxt:      { fontSize: 12, color: "#D97706", fontWeight: "600" },
  alertActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  alertBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  alertBtnTxt:  { fontSize: 12, fontWeight: "700" },

  busCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  busTop:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busStatus: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  busName:   { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  busPlate:  { fontSize: 11, color: "#64748B" },
  busLoc:    { fontSize: 11, color: "#64748B", marginTop: 2 },
  busTrip:   { fontSize: 11, color: "#0369A1", marginTop: 2, fontWeight: "600" },
  busIssue:  { fontSize: 11, color: "#DC2626", marginTop: 2, fontWeight: "600" },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  triggerBtn:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: RED_M, backgroundColor: RED_L },
  triggerBtnTxt:{ fontSize: 13, fontWeight: "700", color: RED },

  modalBg:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:{ fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalSub:  { fontSize: 13, color: "#64748B" },
  modalLabel:{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 4 },
  msgOption: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: RED_L, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: RED_M },
  msgOptionTxt:{ flex: 1, fontSize: 13, fontWeight: "600", color: RED_D },
  responseOption:{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0" },
  responseOptionTxt:{ flex: 1, fontSize: 14, color: "#374151", fontWeight: "600" },
  modalActions:{ flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn:  { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12 },
});
