import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
type AlertType = "urgence" | "panne" | "controle" | "sos";

interface AlertRecord {
  id: string;
  type: AlertType;
  status: "active" | "resolved";
  busName: string | null;
  message: string | null;
  createdAt: string | null;
}

/* ─── Config alertes ─────────────────────────────────────────────────── */
const ALERT_CONFIG: Record<AlertType, {
  label: string; icon: string;
  bg: string; text: string; border: string;
  desc: string;
}> = {
  urgence:  { label: "URGENCE",  icon: "alert-octagon", bg: "#EF4444", text: "#fff",    border: "#DC2626", desc: "Incident grave nécessitant intervention immédiate" },
  panne:    { label: "PANNE",    icon: "tool",          bg: "#F59E0B", text: "#fff",    border: "#D97706", desc: "Problème mécanique ou technique sur le bus" },
  controle: { label: "CONTRÔLE", icon: "shield",        bg: "#3B82F6", text: "#fff",    border: "#2563EB", desc: "Contrôle routier, douane ou forces de l'ordre" },
  sos:      { label: "SOS",      icon: "life-buoy",     bg: "#7C3AED", text: "#fff",    border: "#6D28D9", desc: "Danger immédiat — appel de secours" },
};

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function SecuriteScreen() {
  const { token, user } = useAuth();
  const insets           = useSafeAreaInsets();

  const [sending,   setSending]   = useState<AlertType | null>(null);
  const [history,   setHistory]   = useState<AlertRecord[]>([]);
  const [loadHist,  setLoadHist]  = useState(true);
  const [message,   setMessage]   = useState("");
  const [tab,       setTab]       = useState<"buttons" | "history">("buttons");
  const [sosTapped, setSosTapped] = useState(false);

  /* Pulse animation for SOS */
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  /* Fetch alert history */
  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch<AlertRecord[]>("/agent/alerts", { token: token ?? undefined });
      setHistory(data ?? []);
    } catch { /* silent */ } finally {
      setLoadHist(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* Get current GPS */
  const getLocation = async (): Promise<{ lat: number; lon: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { lat: loc.coords.latitude, lon: loc.coords.longitude };
    } catch { return null; }
  };

  /* Send alert */
  const sendAlert = useCallback(async (type: AlertType) => {
    if (sending) return;

    const cfg = ALERT_CONFIG[type];

    if (type === "sos" && !sosTapped) {
      setSosTapped(true);
      setTimeout(() => setSosTapped(false), 3000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Alert.alert(
      cfg.label,
      `Confirmer l'envoi d'une alerte "${cfg.label}" ?`,
      [
        { text: "Annuler", style: "cancel", onPress: () => setSosTapped(false) },
        {
          text: "Envoyer",
          style: "destructive",
          onPress: async () => {
            setSending(type);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            const gps = await getLocation();

            try {
              await apiFetch("/agent/alert", {
                method: "POST",
                token: token ?? undefined,
                body: JSON.stringify({
                  type,
                  message: message.trim() || null,
                  lat: gps?.lat ?? null,
                  lon: gps?.lon ?? null,
                }),
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Alerte envoyée", `Votre alerte "${cfg.label}" a été transmise à la compagnie.`);
              setMessage("");
              setSosTapped(false);
              fetchHistory();
            } catch {
              Alert.alert("Erreur", "Impossible d'envoyer l'alerte. Vérifiez votre connexion.");
            } finally {
              setSending(null);
            }
          },
        },
      ]
    );
  }, [sending, sosTapped, message, token, fetchHistory]);

  /* ── Alert History Item ── */
  const HistoryItem = ({ item }: { item: AlertRecord }) => {
    const cfg = ALERT_CONFIG[item.type] ?? ALERT_CONFIG.urgence;
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }) : "—";

    return (
      <View style={[styles.histItem, { borderLeftColor: cfg.bg }]}>
        <View style={[styles.histBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={13} color="#fff" />
          <Text style={styles.histBadgeText}>{cfg.label}</Text>
        </View>
        <Text style={styles.histDate}>{date}</Text>
        {item.busName && <Text style={styles.histBus}>{item.busName}</Text>}
        {item.message && <Text style={styles.histMsg}>"{item.message}"</Text>}
        <View style={[styles.histStatus, { backgroundColor: item.status === "resolved" ? "#D1FAE5" : "#FEE2E2" }]}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: item.status === "resolved" ? "#059669" : "#DC2626" }}>
            {item.status === "resolved" ? "Résolue" : "En cours"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Sécurité</Text>
          <Text style={styles.headerSub}>{user?.name ?? "Agent"}</Text>
        </View>
        <View style={styles.headerRight}>
          <Feather name="shield" size={24} color="rgba(255,255,255,0.6)" />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "buttons" && styles.tabActive]} onPress={() => setTab("buttons")}>
          <Text style={[styles.tabText, tab === "buttons" && styles.tabTextActive]}>Alertes</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "history" && styles.tabActive]} onPress={() => setTab("history")}>
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>Historique {history.length > 0 && `(${history.length})`}</Text>
        </Pressable>
      </View>

      {tab === "buttons" ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Feather name="info" size={15} color="#1E40AF" />
            <Text style={styles.infoText}>
              Chaque alerte notifie immédiatement votre compagnie avec votre position GPS.
            </Text>
          </View>

          {/* Optional message */}
          <View style={styles.msgBox}>
            <Text style={styles.msgLabel}>Message optionnel</Text>
            <TextInput
              style={styles.msgInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Précisez la situation (ex: accident, contrôle, panne moteur...)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* Alert buttons */}
          <Text style={styles.sectionTitle}>Choisir le type d&apos;alerte</Text>

          {(["urgence", "panne", "controle"] as AlertType[]).map(type => {
            const cfg = ALERT_CONFIG[type];
            const isSending = sending === type;
            return (
              <Pressable
                key={type}
                style={[styles.alertBtn, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                onPress={() => sendAlert(type)}
                disabled={!!sending}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name={cfg.icon as any} size={26} color="#fff" />
                )}
                <View style={styles.alertBtnInfo}>
                  <Text style={[styles.alertBtnLabel, { color: cfg.text }]}>{cfg.label}</Text>
                  <Text style={[styles.alertBtnDesc, { color: "rgba(255,255,255,0.8)" }]}>{cfg.desc}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            );
          })}

          {/* SOS button — discrete but accessible */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Bouton SOS</Text>
          <Text style={styles.sosHint}>Appuyez deux fois pour activer · Appel de secours extrême</Text>

          <Animated.View style={{ transform: [{ scale: sosTapped ? pulseAnim : 1 }] }}>
            <Pressable
              style={[
                styles.sosBtn,
                sosTapped && styles.sosBtnArmed,
                sending === "sos" && styles.sosBtnSending,
              ]}
              onPress={() => sendAlert("sos")}
              disabled={!!sending && sending !== "sos"}
            >
              {sending === "sos" ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <Feather name="life-buoy" size={36} color="#fff" />
                  <Text style={styles.sosBtnText}>
                    {sosTapped ? "APPUYEZ À NOUVEAU POUR CONFIRMER" : "SOS"}
                  </Text>
                  {sosTapped && (
                    <Text style={styles.sosBtnSub}>Alerte de détresse · Aide immédiate</Text>
                  )}
                </>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      ) : (
        /* History tab */
        loadHist ? (
          <View style={styles.center}>
            <ActivityIndicator color="#EF4444" />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.center}>
            <Feather name="check-circle" size={40} color="#D1FAE5" />
            <Text style={styles.emptyText}>Aucune alerte envoyée</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <HistoryItem item={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )
      )}
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: "#0F172A" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:      { color: "#94A3B8", fontSize: 15 },

  header:         { backgroundColor: "#0F172A", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { padding: 4 },
  headerTitle:    { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub:      { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  headerRight:    { marginLeft: "auto" },

  tabs:           { flexDirection: "row", backgroundColor: "#1E293B" },
  tab:            { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: "#EF4444" },
  tabText:        { color: "#64748B", fontSize: 14, fontWeight: "600" },
  tabTextActive:  { color: "#fff" },

  content:        { padding: 16, gap: 12 },

  infoBanner:     { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoText:       { color: "#1E40AF", fontSize: 13, flex: 1, lineHeight: 18 },

  msgBox:         { backgroundColor: "#1E293B", borderRadius: 12, padding: 14 },
  msgLabel:       { color: "#94A3B8", fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  msgInput:       { color: "#fff", fontSize: 14, minHeight: 72, textAlignVertical: "top" },

  sectionTitle:   { color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },

  alertBtn:       { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 14, borderWidth: 1 },
  alertBtnInfo:   { flex: 1 },
  alertBtnLabel:  { fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  alertBtnDesc:   { fontSize: 12, marginTop: 3, lineHeight: 16 },

  sosHint:        { color: "#64748B", fontSize: 12, marginBottom: 4 },
  sosBtn:         { backgroundColor: "#7C3AED", borderRadius: 16, padding: 28, alignItems: "center", gap: 10, borderWidth: 2, borderColor: "#6D28D9" },
  sosBtnArmed:    { backgroundColor: "#DC2626", borderColor: "#B91C1C" },
  sosBtnSending:  { opacity: 0.8 },
  sosBtnText:     { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", letterSpacing: 1 },
  sosBtnSub:      { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center" },

  /* History */
  histItem:       { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, borderLeftWidth: 4 },
  histBadge:      { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  histBadgeText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  histDate:       { color: "#64748B", fontSize: 12, marginBottom: 4 },
  histBus:        { color: "#94A3B8", fontSize: 12 },
  histMsg:        { color: "#CBD5E1", fontSize: 13, fontStyle: "italic", marginTop: 4 },
  histStatus:     { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 8 },
});
