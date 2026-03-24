import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TextInput, Pressable, FlatList, Alert, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ──────────────────────────────────────────────────── */
interface Customer {
  userId: string; name: string; email: string; phone: string;
  tripCount: number; totalSpent: number; lastTrip: string; segment: string;
}
interface SmsLog {
  id: string; segment: string; message: string;
  recipients: number; status: string; createdAt: string;
}

type SegmentKey = "all" | "loyal" | "recent" | "inactive";

const SEGMENTS: { key: SegmentKey; label: string; desc: string; color: string; bg: string; icon: string }[] = [
  { key: "all",      label: "Tous",       desc: "Tous les clients",         color: "#0B3C5D", bg: "#EFF6FF", icon: "users" },
  { key: "loyal",    label: "Fidèles",    desc: "≥ 5 voyages",              color: "#059669", bg: "#ECFDF5", icon: "star" },
  { key: "recent",   label: "Récents",    desc: "Actifs ce mois",           color: "#D97706", bg: "#FFFBEB", icon: "clock" },
  { key: "inactive", label: "Inactifs",   desc: "Absents > 90 jours",       color: "#7C3AED", bg: "#F5F3FF", icon: "moon" },
];

const SEG_LABEL: Record<SegmentKey, string> = {
  all: "Tous", loyal: "Fidèles", recent: "Récents", inactive: "Inactifs",
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

/* ─── Helpers ──────────────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const BADGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  loyal:    { bg: "#ECFDF5", text: "#059669", label: "Fidèle" },
  recent:   { bg: "#FFFBEB", text: "#D97706", label: "Récent" },
  inactive: { bg: "#F5F3FF", text: "#7C3AED", label: "Inactif" },
};

/* ─── Main ─────────────────────────────────────────────────────── */
type TabId = "form" | "clients" | "historique";

export default function SmsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [tab, setTab] = useState<TabId>("form");

  /* Form state */
  const [segment, setSegment]   = useState<SegmentKey>("all");
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);

  /* Data */
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [logs, setLogs]             = useState<SmsLog[]>([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoadingCust(true);
    try {
      const data = await apiFetch<Customer[]>("/company/customers", { token: token ?? undefined });
      setCustomers(data);
    } catch { setCustomers([]); }
    finally { setLoadingCust(false); }
  }, [token]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await apiFetch<SmsLog[]>("/company/sms/logs", { token: token ?? undefined });
      setLogs(data);
    } catch { setLogs([]); }
    finally { setLoadingLogs(false); }
  }, [token]);

  useEffect(() => { loadCustomers(); loadLogs(); }, []);
  useEffect(() => { if (tab === "clients") loadCustomers(); if (tab === "historique") loadLogs(); }, [tab]);

  /* Stats */
  const filteredCustomers = segment === "all"
    ? customers
    : customers.filter(c => c.segment === segment);

  const sendSms = async () => {
    if (!message.trim()) { Alert.alert("Message vide", "Saisissez un message avant d'envoyer."); return; }
    if (filteredCustomers.length === 0) { Alert.alert("Aucun destinataire", "Aucun client dans ce segment."); return; }

    Alert.alert(
      "Confirmer l'envoi",
      `Envoyer ce SMS à ${filteredCustomers.length} client${filteredCustomers.length > 1 ? "s" : ""} (segment : ${SEG_LABEL[segment]}) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Envoyer", style: "default",
          onPress: async () => {
            setSending(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const result = await apiFetch<{ sent: number; failed: number; total: number }>(
                "/company/sms/send",
                { method: "POST", body: JSON.stringify({ message: message.trim(), segment }), token: token ?? undefined }
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("SMS envoyés ✓", `${result.sent} message${result.sent > 1 ? "s" : ""} envoyé${result.sent > 1 ? "s" : ""} avec succès.`);
              setMessage("");
              loadLogs();
            } catch {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Erreur", "L'envoi a échoué. Réessayez.");
            } finally { setSending(false); }
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient colors={["#D97706", "#B45309"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise" as never)} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Feather name="send" size={20} color="white" />
          <Text style={styles.headerTitle}>SMS Marketing</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* KPI strip */}
      <View style={styles.kpiRow}>
        {[
          { label: "Clients", value: customers.length, color: "#0B3C5D" },
          { label: "Fidèles", value: customers.filter(c => c.segment === "loyal").length, color: "#059669" },
          { label: "Récents", value: customers.filter(c => c.segment === "recent").length, color: "#D97706" },
          { label: "Inactifs", value: customers.filter(c => c.segment === "inactive").length, color: "#7C3AED" },
        ].map(k => (
          <View key={k.label} style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["form", "clients", "historique"] as TabId[]).map(t => {
          const labels: Record<TabId, string> = { form: "Nouveau SMS", clients: "Clients", historique: "Historique" };
          const icons:  Record<TabId, string> = { form: "edit-2", clients: "users", historique: "list" };
          return (
            <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Feather name={icons[t] as never} size={15} color={tab === t ? "#D97706" : "#94A3B8"} />
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{labels[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Tab: Formulaire ─── */}
      {tab === "form" && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>

          {/* Sélection segment */}
          <Text style={styles.sectionTitle}>Choisir un segment</Text>
          <View style={styles.segmentGrid}>
            {SEGMENTS.map(s => (
              <Pressable
                key={s.key}
                style={[styles.segCard, segment === s.key && { borderColor: s.color, borderWidth: 2 }]}
                onPress={() => { setSegment(s.key); Haptics.selectionAsync(); }}
              >
                <View style={[styles.segIcon, { backgroundColor: s.bg }]}>
                  <Feather name={s.icon as never} size={18} color={s.color} />
                </View>
                <Text style={[styles.segLabel, segment === s.key && { color: s.color }]}>{s.label}</Text>
                <Text style={styles.segDesc}>{s.desc}</Text>
                <Text style={[styles.segCount, { color: s.color }]}>
                  {segment === s.key
                    ? `${filteredCustomers.length} client${filteredCustomers.length > 1 ? "s" : ""}`
                    : `${s.key === "all" ? customers.length : customers.filter(c => c.segment === s.key).length} clients`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Zone de message */}
          <Text style={styles.sectionTitle}>Votre message</Text>
          <View style={styles.messageBox}>
            <TextInput
              style={styles.messageInput}
              placeholder="Ex : Profitez de -20% sur votre prochain voyage ce weekend ! Réservez sur GoBooking."
              placeholderTextColor="#94A3B8"
              multiline
              value={message}
              onChangeText={setMessage}
              maxLength={160}
            />
            <View style={styles.charRow}>
              <Feather name="message-square" size={13} color="#94A3B8" />
              <Text style={styles.charCount}>{message.length}/160 caractères</Text>
            </View>
          </View>

          {/* Aperçu */}
          {message.trim().length > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Aperçu SMS</Text>
              <View style={styles.previewBubble}>
                <Text style={styles.previewText}>{message.trim()}</Text>
                <Text style={styles.previewSender}>GoBooking · maintenant</Text>
              </View>
            </View>
          )}

          {/* Bouton envoi */}
          <Pressable
            style={[styles.sendBtn, (sending || !message.trim()) && { opacity: 0.6 }]}
            onPress={sendSms}
            disabled={sending || !message.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Feather name="send" size={18} color="white" />
                <Text style={styles.sendBtnText}>
                  Envoyer à {filteredCustomers.length} client{filteredCustomers.length > 1 ? "s" : ""}
                </Text>
              </>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ─── Tab: Clients ─── */}
      {tab === "clients" && (
        <>
          {loadingCust ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#D97706" /></View>
          ) : customers.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="users" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Aucun client</Text>
              <Text style={styles.emptyText}>Les clients apparaîtront dès leur première réservation.</Text>
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={c => c.userId}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const badge = BADGE_COLORS[item.segment] ?? BADGE_COLORS.recent;
                return (
                  <View style={styles.custCard}>
                    <View style={styles.custAvatar}>
                      <Text style={styles.custInitials}>{getInitials(item.name)}</Text>
                    </View>
                    <View style={styles.custInfo}>
                      <View style={styles.custRow}>
                        <Text style={styles.custName}>{item.name}</Text>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.custPhone}>{item.phone || item.email}</Text>
                      <View style={styles.custStats}>
                        <Feather name="map" size={11} color="#94A3B8" />
                        <Text style={styles.custStat}>{item.tripCount} voyage{item.tripCount > 1 ? "s" : ""}</Text>
                        <Feather name="credit-card" size={11} color="#94A3B8" />
                        <Text style={styles.custStat}>{item.totalSpent.toLocaleString("fr-FR")} F</Text>
                        <Feather name="calendar" size={11} color="#94A3B8" />
                        <Text style={styles.custStat}>Dernier : {formatDate(item.lastTrip)}</Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ─── Tab: Historique ─── */}
      {tab === "historique" && (
        <>
          {loadingLogs ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#D97706" /></View>
          ) : logs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Aucun SMS envoyé</Text>
              <Text style={styles.emptyText}>Vos campagnes SMS apparaîtront ici.</Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={l => l.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const segInfo = SEGMENTS.find(s => s.key === item.segment) ?? SEGMENTS[0];
                return (
                  <View style={styles.logCard}>
                    <View style={styles.logTop}>
                      <View style={[styles.logSegBadge, { backgroundColor: segInfo.bg }]}>
                        <Feather name={segInfo.icon as never} size={12} color={segInfo.color} />
                        <Text style={[styles.logSegText, { color: segInfo.color }]}>{segInfo.label}</Text>
                      </View>
                      <View style={[styles.statusDot, { backgroundColor: item.status === "sent" ? "#059669" : "#EF4444" }]} />
                      <Text style={styles.logDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.logMsg} numberOfLines={3}>{item.message}</Text>
                    <View style={styles.logBottom}>
                      <Feather name="send" size={13} color="#94A3B8" />
                      <Text style={styles.logRecip}>
                        {item.recipients} destinataire{item.recipients > 1 ? "s" : ""}
                      </Text>
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
  root:        { flex: 1, backgroundColor: "#F8FAFC" },
  flex:        { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerCenter:{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "white" },

  kpiRow:  { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  kpiCard: { flex: 1, alignItems: "center", paddingVertical: 10 },
  kpiValue:{ fontSize: 20, fontWeight: "800" },
  kpiLabel:{ fontSize: 10, color: "#94A3B8", marginTop: 1 },

  tabBar:      { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tabBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  tabBtnActive:{ borderBottomWidth: 2, borderBottomColor: "#D97706" },
  tabLabel:    { fontSize: 12, color: "#94A3B8" },
  tabLabelActive:{ color: "#D97706", fontWeight: "600" },

  formScroll: { padding: 16, gap: 12 },
  sectionTitle:{ fontSize: 13, fontWeight: "700", color: "#334155", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },

  segmentGrid:{ flexDirection: "row", flexWrap: "wrap", gap: 10 },
  segCard:    { width: "47%", backgroundColor: "white", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  segIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  segLabel:   { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  segDesc:    { fontSize: 11, color: "#94A3B8" },
  segCount:   { fontSize: 12, fontWeight: "600", marginTop: 4 },

  messageBox:   { backgroundColor: "white", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  messageInput: { fontSize: 14, color: "#1E293B", minHeight: 100, textAlignVertical: "top", lineHeight: 22 },
  charRow:      { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  charCount:    { fontSize: 11, color: "#94A3B8" },

  preview:       { gap: 8 },
  previewLabel:  { fontSize: 11, fontWeight: "600", color: "#94A3B8", textTransform: "uppercase" },
  previewBubble: { backgroundColor: "#E8F4FD", borderRadius: 14, padding: 14, borderTopLeftRadius: 4, gap: 6 },
  previewText:   { fontSize: 14, color: "#1E293B", lineHeight: 20 },
  previewSender: { fontSize: 11, color: "#64748B" },

  sendBtn:     { backgroundColor: "#D97706", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  sendBtnText: { fontSize: 16, fontWeight: "700", color: "white" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty:  { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569" },
  emptyText:  { fontSize: 13, color: "#94A3B8", textAlign: "center" },

  custCard:   { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  custAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0B3C5D", justifyContent: "center", alignItems: "center" },
  custInitials:{ color: "white", fontWeight: "700", fontSize: 15 },
  custInfo:   { flex: 1, gap: 3 },
  custRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  custName:   { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  custPhone:  { fontSize: 12, color: "#64748B" },
  custStats:  { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 },
  custStat:   { fontSize: 11, color: "#94A3B8" },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:  { fontSize: 10, fontWeight: "700" },

  logCard:    { backgroundColor: "white", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  logTop:     { flexDirection: "row", alignItems: "center", gap: 8 },
  logSegBadge:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  logSegText: { fontSize: 11, fontWeight: "700" },
  statusDot:  { width: 7, height: 7, borderRadius: 3.5 },
  logDate:    { fontSize: 11, color: "#94A3B8", marginLeft: "auto" },
  logMsg:     { fontSize: 13, color: "#475569", lineHeight: 19 },
  logBottom:  { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  logRecip:   { fontSize: 12, color: "#94A3B8" },
});
